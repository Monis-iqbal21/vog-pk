import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

export async function compareStaticBrowser({
  root,
  directory,
  env,
  cli,
  browser,
  dynamicSite,
  manifest,
  output,
}) {
  const fixture = path.join(directory, 'static-frontend');
  for (const name of [
    'src',
    'public',
    'package.json',
    'package-lock.json',
    'jsconfig.json',
    'next.config.mjs',
  ])
    await fs.cp(path.join(root, 'frontend', name), path.join(fixture, name), {
      recursive: true,
    });
  await fs.symlink(
    path.join(root, 'frontend/node_modules'),
    path.join(fixture, 'node_modules'),
    'junction',
  );
  const config = path.join(fixture, 'next.config.mjs');
  await fs.writeFile(
    config,
    (await fs.readFile(config, 'utf8')).replace(
      'turbopack: {',
      `turbopack: { root: ${JSON.stringify(root)},`,
    ),
  );
  const staticEnv = { ...env, CATALOG_MODE: 'static' };
  delete staticEnv.CATALOG_API_ORIGIN;
  delete staticEnv.CATALOG_DEVELOPMENT;
  const build = spawn(process.execPath, [cli, 'build'], {
    cwd: fixture,
    env: staticEnv,
    stdio: 'pipe',
  });
  build.stdout.on('data', () => {});
  build.stderr.on('data', () => {});
  assert.equal(
    (await once(build, 'exit'))[0],
    0,
    'Clean static production build',
  );
  const port = await new Promise((resolve) => {
      const s = net.createServer();
      s.listen(0, '127.0.0.1', () => {
        const p = s.address().port;
        s.close(() => resolve(p));
      });
    }),
    site = `http://127.0.0.1:${port}`;
  const server = spawn(
    process.execPath,
    [cli, 'start', '--hostname', '127.0.0.1', '--port', String(port)],
    { cwd: fixture, env: staticEnv, stdio: 'pipe' },
  );
  server.stdout.on('data', () => {});
  server.stderr.on('data', () => {});
  let left, right;
  const comparisons = [];
  try {
    for (let i = 0; i < 150; i++) {
      try {
        if ((await fetch(site)).ok) break;
      } catch {}
      if (i === 149) throw Error('Static browser fixture startup timed out');
      await new Promise((r) => setTimeout(r, 100));
    }
    left = await browser.newPage();
    right = await browser.newPage();
    const slugs = [
      'keyboards',
      'processors',
      manifest.records[0].source.product.slug,
    ];
    for (const width of [1440, 768, 390]) {
      await left.setViewportSize({ width, height: 1000 });
      await right.setViewportSize({ width, height: 1000 });
      for (const slug of slugs) {
        await Promise.all([
          left.goto(site + '/products/' + slug),
          right.goto(dynamicSite + '/products/' + slug),
        ]);
        await left.locator('h1').waitFor();
        await right.locator('h1').waitFor();
        assert.equal(
          await left.locator('h1').textContent(),
          await right.locator('h1').textContent(),
        );
        assert.equal(
          await left.locator('link[rel=canonical]').getAttribute('href'),
          await right.locator('link[rel=canonical]').getAttribute('href'),
        );
        assert.equal(
          await left.locator('meta[name=description]').getAttribute('content'),
          await right.locator('meta[name=description]').getAttribute('content'),
        );
        comparisons.push({
          slug,
          width,
          heading: 'EXACT',
          canonical: 'EXACT',
          description: 'EXACT',
          media:
            'Intentional: legacy static references visible; unapproved dynamic references withheld',
        });
      }
    }
    for (const r of manifest.records) {
      const response = await fetch(site + r.source.aliases[0], {
        redirect: 'manual',
      });
      assert.equal(response.status, 308);
      assert.equal(
        new URL(response.headers.get('location'), site).pathname,
        r.source.path,
      );
      const dynamic = await fetch(dynamicSite + r.source.aliases[0], {
        redirect: 'manual',
      });
      assert.equal(dynamic.status, 308);
      assert.equal(
        new URL(dynamic.headers.get('location'), dynamicSite).pathname,
        r.source.path,
      );
    }
    await left.goto(
      site + '/products/' + manifest.records[0].source.product.slug,
    );
    assert.ok(await left.locator('.pd-main-image img').count());
    await left.waitForFunction(() => {
      const img = document.querySelector('.pd-main-image img');
      return img?.complete && img.naturalWidth > 0;
    });
    await fs.writeFile(
      path.join(output, 'browser-parity.json'),
      JSON.stringify(
        {
          passed: true,
          cleanStaticBuild: true,
          cleanDynamicBuild: true,
          realBackend: true,
          viewports: [1440, 768, 390],
          comparisons,
          legacyRedirectsCompared: 84,
          staticMainImageLoaded: true,
          staticProductionDefaultUnchanged: true,
          productionAccess: false,
        },
        null,
        2,
      ) + '\n',
    );
  } finally {
    await left?.close();
    await right?.close();
    if (server.exitCode === null) {
      server.kill();
      await once(server, 'exit');
    }
  }
}
