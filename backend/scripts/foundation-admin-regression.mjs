import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);

// Build and run the actual admin application in an env-free copy. No browser
// account fixtures, passwords, session cookies or bridge keys are written to disk.
export async function verifyAdmin({apiPort, adminPort, email, password, scopedRoute}) {
  const root = path.resolve('..'), admin = path.join(root, 'admin');
  const parent = path.resolve('.local', 'foundation'); await fs.mkdir(parent, {recursive: true});
  const fixture = await fs.mkdtemp(path.join(parent, 'admin-'));
  const base = `http://127.0.0.1:${adminPort}`;
  const env = Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'COMSPEC', 'ComSpec', 'USERPROFILE', 'TEMP', 'TMP', 'APPDATA', 'LOCALAPPDATA'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
  Object.assign(env, {NODE_ENV: 'production', ADMIN_ENVIRONMENT: 'local', ADMIN_ORIGIN: base, API_URL: `http://127.0.0.1:${apiPort}`, STOREFRONT_ORIGIN: 'http://localhost:3000', BFF_SHARED_SECRET: process.env.BFF_SHARED_SECRET, COOKIE_SECURE: 'false', NEXT_TELEMETRY_DISABLED: '1'});
  let server;
  try {
    for (const name of ['src', 'public', 'scripts/check-config.mjs', 'package.json', 'package-lock.json', 'jsconfig.json', 'next.config.mjs']) {
      const target = path.join(fixture, name); await fs.mkdir(path.dirname(target), {recursive: true}); await fs.cp(path.join(admin, name), target, {recursive: true});
    }
    await fs.symlink(path.join(admin, 'node_modules'), path.join(fixture, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    const config = path.join(fixture, 'next.config.mjs');
    await fs.writeFile(config, (await fs.readFile(config, 'utf8')).replace('turbopack: {', `turbopack: { root: ${JSON.stringify(root)},`));
    const cli = require.resolve('../../admin/node_modules/next/dist/bin/next');
    const build = spawn(process.execPath, [cli, 'build'], {cwd: fixture, env, stdio: 'ignore'});
    const deadline = setTimeout(() => build.kill(), 180000);
    try {assert.equal((await once(build, 'exit'))[0], 0, 'Isolated admin production build must succeed');} finally {clearTimeout(deadline);}
    console.log('PASS Isolated admin production build');
    server = spawn(process.execPath, [cli, 'start', '--hostname', '127.0.0.1', '--port', String(adminPort)], {cwd: fixture, env, stdio: 'ignore'});
    for (let i = 0; i < 150; i++) {try {if ((await fetch(base + '/login')).status === 200) break;} catch {} if (i === 149) throw new Error('Isolated admin startup timeout'); await new Promise(r => setTimeout(r, 100));}
    const call = (route, options) => fetch(base + '/api/' + route, options);
    assert.equal((await fetch(base + '/dashboard', {redirect: 'manual'})).status, 307);
    assert.equal((await call('admin/staff')).status, 401);
    assert.equal((await call('admin/auth/login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email, password})})).status, 403);
    assert.equal((await call('auth/csrf', {headers: {Origin: 'https://hostile.invalid'}})).status, 403);
    const challenge = await call('auth/csrf'), csrfCookie = challenge.headers.getSetCookie()[0].split(';')[0];
    const {csrfToken} = await challenge.json();
    const headers = {Origin: base, 'Content-Type': 'application/json', 'x-csrf-token': csrfToken, Cookie: csrfCookie};
    const login = await call('admin/auth/login', {method: 'POST', headers, body: JSON.stringify({email, password})});
    assert.equal(login.status, 200); const loginBody = await login.json(); assert.equal(loginBody.token, undefined);
    const sessionHeader = login.headers.getSetCookie()[0]; assert.match(sessionHeader, /HttpOnly/i); assert.match(sessionHeader, /SameSite=strict/i);
    const cookie = csrfCookie + '; ' + sessionHeader.split(';')[0];
    assert.equal((await call('admin/auth/me', {headers: {Cookie: cookie}})).status, 200);
    assert.equal((await call(`admin/${scopedRoute}/access`, {headers: {Cookie: cookie}})).status, 200);
    const mutation = {method: 'POST', headers: {...headers, Cookie: cookie}, body: '{}'};
    assert.equal((await call(`admin/${scopedRoute}/roles`, {...mutation, headers: {...headers, Cookie: cookie, 'x-csrf-token': '0'.repeat(64)}})).status, 403);
    assert.equal((await call(`admin/${scopedRoute}/roles`, {...mutation, headers: {...headers, Cookie: cookie, Origin: 'https://hostile.invalid'}})).status, 403);
    assert.equal((await call('admin/unregistered/route', {headers: {Cookie: cookie}})).status, 404);
    assert.equal((await call('admin/auth/logout', mutation)).status, 201);
    assert.equal((await call('admin/auth/me', {headers: {Cookie: cookie}})).status, 401);
    console.log('PASS Real admin BFF login, host-only HttpOnly cookie, CSRF/Origin, scoped access, logout and replay rejection');
    return {passed: true, checks: 15, productionBuild: true, realBackend: true, persistedCredentials: false};
  } finally {
    if (server && server.exitCode === null && server.signalCode === null) {const exit = once(server, 'exit'); server.kill(); await exit;}
    if (path.dirname(fixture) !== parent || !path.basename(fixture).startsWith('admin-')) throw new Error('Unsafe fixture cleanup path');
    await fs.unlink(path.join(fixture, 'node_modules')).catch(error => {if (error.code !== 'ENOENT') throw error;});
    await fs.rm(fixture, {recursive: true, force: true});
  }
}
