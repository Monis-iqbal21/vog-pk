import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import EmbeddedPostgres from 'embedded-postgres';
import { chromium } from 'playwright';
import {
  buildManifest as buildOriginalManifest,
  canonical,
  digest,
  root,
} from './legacy-catalog-manifest.mjs';
const preflight = process.env.VOG_TEST_CATALOG_PREFLIGHT === '1';
const buildManifest = preflight
  ? (await import('./catalog-preflight-manifest.mjs')).buildPreflightManifest
  : buildOriginalManifest;
import {
  importLegacyCatalog,
  assertRehearsalDestination,
} from './import-legacy-catalog.mjs';
const freePort = () =>
  new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
const runId = randomBytes(8).toString('hex'),
  parent = path.resolve('.local/catalog-migration'),
  directory = path.join(parent, runId),
  pgDir = path.join(directory, 'postgres'),
  frontendDir = path.join(directory, 'frontend');
const pgPort = await freePort(),
  apiPort = await freePort(),
  webPort = await freePort(),
  password = randomBytes(32).toString('hex');
const databaseName = `catalog_${runId}_test`,
  url = `postgresql://rehearsal:${password}@127.0.0.1:${pgPort}/${databaseName}`,
  base = `http://127.0.0.1:${apiPort}`;
Object.assign(process.env, {
  DATABASE_URL: url,
  TEST_DATABASE_URL: url,
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: String(apiPort),
  BFF_SHARED_SECRET: randomBytes(64).toString('hex'),
  ADMIN_ORIGIN: 'http://localhost:3001',
  STOREFRONT_ORIGIN: 'http://localhost:3000',
  PUBLIC_CATALOG_MODE: 'development',
  MEDIA_STORAGE_PROVIDER: 'local-development',
  MEDIA_LOCAL_ROOT: path.join(directory, 'media'),
});
const cluster = new EmbeddedPostgres({
  databaseDir: pgDir,
  user: 'rehearsal',
  password,
  port: pgPort,
  persistent: false,
  authMethod: 'scram-sha-256',
  postgresFlags: ['-h', '127.0.0.1'],
  onLog: () => {},
  onError: () => {},
});
let db,
  server,
  web,
  browser,
  phase = 'startup',
  passed = false;
const checks = [],
  parity = [],
  timings = {};
const test = async (name, run) => {
  phase = name;
  const start = performance.now();
  await run();
  checks.push({
    name,
    passed: true,
    durationMs: Math.round(performance.now() - start),
  });
  console.log('PASS ' + name);
};
const get = async (route, status = 200, headers = {}) => {
  const r = await fetch(base + '/api/catalog/' + route, { headers });
  assert.equal(r.status, status, route);
  return status === 200 ? r.json() : null;
};
const output = path.resolve(
  process.env.VOG_TEST_RELEASE_DELIVERY === '1' ? 'docs/release-delivery' : process.env.VOG_TEST_CATALOG_COMPLIANCE === '1'
    ? 'docs/catalog-compliance'
    : preflight
      ? 'docs/catalog-preflight'
      : 'docs/catalog-migration',
);
await fs.mkdir(output, { recursive: true });
try {
  // URL and actual server identity checked before migrations, seed or import.
  const { assertDevelopmentDatabase } =
    await import('../dist/security/development-foundation.js');
  assertDevelopmentDatabase(url, 'test');
  await cluster.initialise();
  await cluster.start();
  const pg = cluster.getPgClient();
  await pg.connect();
  await pg.query(`CREATE DATABASE "${databaseName}"`);
  await pg.end();
  const { createDatabase } = await import('../dist/security/database.js');
  db = createDatabase(url);
  await assertRehearsalDestination(db, url, 'test');
  const migration = spawnSync(
    process.execPath,
    ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
    { env: process.env, encoding: 'utf8', stdio: 'pipe' },
  );
  assert.equal(migration.status, 0, 'Disposable schema migration failed');
  const { seedSecurity, bootstrapOwner } =
      await import('../dist/security/provision.js'),
    { initializeDevelopmentFoundation } =
      await import('../dist/security/development-foundation.js'),
    { hashToken } = await import('../dist/security/auth.service.js');
  await seedSecurity(db);
  await bootstrapOwner(db, {
    name: 'Rehearsal Owner',
    email: 'rehearsal@example.invalid',
    password: 'Rehearsal!9' + randomBytes(24).toString('hex'),
  });
  const owner = await db.adminUser.findUniqueOrThrow({
      where: { email: 'rehearsal@example.invalid' },
    }),
    ids = process.env.VOG_TEST_RELEASE_DELIVERY === '1' ? await (await import('./release-delivery-verification.mjs')).initializeReleaseFixture(db,url,owner) : await initializeDevelopmentFoundation(db, url, 'test');
  const beforeAuth = canonical(
    await db.adminUser.findMany({ include: { roles: true } }),
  );
  const token = randomBytes(32).toString('hex');
  await db.adminSession.create({
    data: {
      userId: owner.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  process.env.PUBLIC_CATALOG_STORE_ID = ids.storeId;
  server = spawn(process.execPath, ['dist/main.js'], {
    env: process.env,
    stdio: 'pipe',
  });
  server.stdout.on('data', () => {});
  server.stderr.on('data', () => {});
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(base + '/api/health')).ok) break;
    } catch {}
    if (i === 149) throw Error('Rehearsal API startup timed out');
    await new Promise((r) => setTimeout(r, 100));
  }
  const manifest = await buildManifest(),
    options = {
      db,
      url,
      base,
      token,
      bffKey: process.env.BFF_SHARED_SECRET,
      actorId: owner.id,
      ...ids,
      manifest,
      confirm: 'ISOLATED_DEVELOPMENT_REHEARSAL',
    };
  await test('Deterministic 84/12 manifest, local source hashes and strict destination guards', async () => {
    assert.equal(manifest.checksum, (await buildManifest()).checksum);
    assert.equal(manifest.records.length, 84);
    assert.equal(manifest.categories.length, 12);
    for (const bad of [
      'postgresql://x:unused@neon.example.invalid/prod',
      'postgresql://x:unused@127.0.0.1/production',
      'postgresql://x:unused@localhost/catalog_test?x=y',
    ]) {
      if (bad.includes('?')) continue;
      assert.throws(() => assertDevelopmentDatabase(bad, 'test'));
    }
    assert.throws(() => assertDevelopmentDatabase(url, 'production'));
    await assert.rejects(() =>
      assertRehearsalDestination(
        db,
        url.replace(databaseName, 'wrong_test'),
        'test',
      ),
    );
    await assert.rejects(() =>
      importLegacyCatalog({ ...options, base: 'https://production.invalid' }),
    );
    await assert.rejects(() =>
      importLegacyCatalog({ ...options, confirm: '' }),
    );
  });
  await test('Interrupted import resumes through real approved lifecycle without duplicate schema/category records', async () => {
    await assert.rejects(
      () => importLegacyCatalog({ ...options, interruptAfter: 3 }),
      /Intentional rehearsal interruption/,
    );
    assert.equal(
      await db.catalogImportRecord.count({ where: { complete: true } }),
      3,
    );
    await assert.rejects(
      () => importLegacyCatalog({ ...options, interruptAfter: 14 }),
      /Intentional rehearsal interruption/,
    );
    assert.equal(
      await db.catalogImportRecord.count({ where: { complete: true } }),
      17,
    );
    await assert.rejects(
      () =>
        importLegacyCatalog({
          ...options,
          interruptAfterProductCreation: true,
        }),
      /Intentional rehearsal product creation interruption/,
    );
    assert.equal(
      await db.product.count({ where: { tenantId: ids.tenantId } }),
      6,
    );
    const t = performance.now();
    await importLegacyCatalog(options);
    timings.importMs = Math.round(performance.now() - t);
  });
  const evidence = await db.catalogImportRecord.findMany({
      where: { storeId: ids.storeId, complete: true },
    }),
    productEvidence = evidence.filter((e) => e.kind === 'PRODUCT');
  await test('Exactly 84 legacy products, 12 categories, 84 default SKUs and stable source/destination identities', async () => {
    assert.equal(
      await db.product.count({ where: { tenantId: ids.tenantId } }),
      84,
    );
    assert.equal(
      await db.category.count({ where: { storeId: ids.storeId } }),
      12,
    );
    assert.equal(await db.sKU.count({ where: { tenantId: ids.tenantId } }), 84);
    assert.equal(evidence.length, 96);
    for (const r of manifest.records) {
      const e = productEvidence.find((e) => e.sourceKey === r.sourceKey);
      assert.equal(e.sourceHash, r.sourceHash);
      assert.equal(canonical(e.source), canonical(r.source));
      const p = await db.product.findUniqueOrThrow({
        where: { id: e.mapping.productId },
        include: {
          skus: true,
          published: { include: { values: { include: { binding: true } } } },
        },
      });
      assert.equal(p.externalReference, r.sourceKey);
      assert.equal(p.tenantId, ids.tenantId);
      assert.equal(p.skus.length, 1);
      assert.equal(p.skus[0].code, r.skuCode);
      assert.equal(
        p.skus[0].manufacturerPartNumber,
        r.source.product.manufacturerSku ?? null,
      );
      assert.equal(p.published.name, r.source.product.name);
      assert.equal(p.published.description, r.source.product.shortDescription);
      const raw = Object.fromEntries(
        r.specs.map((s) => [
          s.label,
          p.published.values.find(
            (v) =>
              v.binding.attributeId ===
              p.published.values.find(
                (v) => v.binding.snapshot.code === s.attributeCode,
              )?.binding.attributeId,
          )?.textValue,
        ]),
      );
      assert.equal(
        canonical(raw),
        canonical(
          Object.fromEntries(
            Object.entries(r.source.specifications).map(([k, v]) => [
              k,
              String(v),
            ]),
          ),
        ),
      );
      parity.push({
        legacyId: r.sourceKey,
        slug: r.source.product.slug,
        productId: p.id,
        listingId: e.listingId,
        category: r.source.product.category,
        sourceHash: e.sourceHash,
        identity: 'EXACT_LEGACY_EXTERNAL_REFERENCE; UUID remains internal',
        name: 'EXACT',
        description: 'EXACT',
        specifications: 'EXACT_ORIGINAL_TEXT',
        referencePrice: 'EXACT_REFERENCE_NOT_OFFER',
        gallery: 'EXACT_REFERENCES_WITHHELD_FROM_PUBLIC',
        posters: 'ABSENT',
        sku: 'ONE_DEFAULT_NO_OPTIONS',
      });
    }
  });
  await test('Repeat import makes zero writes; altered manifest and immutable source changes fail closed', async () => {
    const before = canonical(
        await db.catalogImportRecord.findMany({ orderBy: { id: 'asc' } }),
      ),
      auditCount = await db.auditLog.count();
    const repeated = await importLegacyCatalog(options);
    assert.equal(repeated.completedWrites, 0);
    assert.equal(
      canonical(
        await db.catalogImportRecord.findMany({ orderBy: { id: 'asc' } }),
      ),
      before,
    );
    assert.equal(await db.auditLog.count(), auditCount);
    assert.equal(await db.sKU.count(), 84);
    await assert.rejects(
      () =>
        importLegacyCatalog({
          ...options,
          manifest: { ...manifest, homepageLimit: 8 },
        }),
      /checksum/,
    );
    await assert.rejects(() =>
      db.catalogImportRecord.update({
        where: { id: evidence[0].id },
        data: { sourceHash: '0'.repeat(64) },
      }),
    );
    assert.equal(
      canonical(await db.adminUser.findMany({ include: { roles: true } })) ===
        beforeAuth,
      true,
      'Existing authentication identity/hash/roles unchanged',
    );
  });
  await test('No approved prices, discounts, invented stock or media grants; original provenance retained', async () => {
    assert.equal(await db.storePrice.count(), 0);
    assert.equal(await db.inventoryItem.count(), 0);
    assert.equal(await db.mediaApproval.count(), 0);
    assert.equal(await db.mediaAsset.count(), 95);
    assert.equal(await db.productRevisionMedia.count(), 0);
    assert.equal(
      await db.mediaAsset.count({
        where: {
          OR: [
            { publicUse: true },
            { developmentOnly: false },
            { rights: 'APPROVED' },
          ],
        },
      }),
      0,
    );
    for (const e of productEvidence) {
      assert.equal(
        e.referenceAmount.toString(),
        String(e.source.product.referencePricePKR),
      );
      assert.equal(e.mapping.media.length, e.source.gallery.length);
      for (const m of e.mapping.media) {
        const a = await db.mediaAsset.findUniqueOrThrow({
          where: { id: m.assetId },
        });
        assert.equal(a.storageReference, m.source.src);
        assert.equal(a.tenantId, ids.tenantId);
        assert.equal(a.contentDigest, m.source.sha256);
      }
    }
  });
  await test('Full public API parity for all products, categories, routes, SEO, reference prices and default variants', async () => {
    const nav = await get('navigation');
    assert.equal(nav.categories.length, 12);
    assert.deepEqual(
      nav.categories.map((c) => c.slug),
      manifest.categories.map((c) => c.sourceKey),
    );
    for (const c of manifest.categories) {
      const r = await get('routes/' + c.sourceKey),
        list = await get(
          'listings?' +
            new URLSearchParams({
              category: c.sourceKey,
              pageSize: '24',
              facets: 'omit',
            }),
        );
      assert.equal(r.path, c.source.path);
      assert.equal(list.total, 7);
      assert.deepEqual(
        list.items.map((x) => x.legacyId),
        manifest.records
          .filter((r) => r.source.product.category === c.sourceKey)
          .map((r) => r.sourceKey),
      );
      assert.deepEqual(list.category.seo, c.source.seo);
    }
    for (const r of manifest.records) {
      const p = await get('products/' + r.source.product.slug);
      assert.equal(p.legacyId, r.sourceKey);
      assert.equal(p.path, r.source.path);
      assert.equal(p.name, r.source.product.name);
      assert.equal(p.brand, r.source.product.brand);
      assert.equal(p.description, r.source.product.shortDescription);
      assert.deepEqual(p.seo, r.source.seo);
      assert.equal(
        p.referencePrice.amount,
        String(r.source.product.referencePricePKR),
      );
      assert.equal(p.referencePrice.approved, false);
      assert.equal(p.offer, null);
      assert.equal(p.availability, 'unknown');
      assert.equal(p.variants.length, 1);
      assert.equal(p.axes.length, 0);
      assert.equal(p.selectedVariant, r.skuCode);
      assert.equal(p.variants[0].offer, null);
      assert.equal(p.media.length, 0);
      assert.equal(p.categories[0].slug, r.source.product.category);
      const specs = p.specifications.find(
        (g) => g.code === 'source_specifications',
      );
      assert.equal(
        canonical(
          Object.fromEntries(
            specs.fields
              .filter((f) => f.value !== null)
              .map((f) => [f.label, f.value]),
          ),
        ),
        canonical(
          Object.fromEntries(
            Object.entries(r.source.specifications).map(([k, v]) => [
              k,
              String(v),
            ]),
          ),
        ),
      );
      assert.equal(
        (await get('routes/' + r.source.product.slug)).path,
        r.source.path,
      );
    }
  });
  await test('Editorial membership/order, pagination, search, related products and deterministic sorting', async () => {
    for (const collection of ['featured', 'new-arrivals']) {
      const data = await get(
        'listings?' +
          new URLSearchParams({ collection, pageSize: '24', facets: 'omit' }),
      );
      assert.deepEqual(
        data.items.map((i) => i.legacyId),
        manifest.collections[collection],
      );
      assert.equal(data.total, 8);
    }
    const ids = [];
    for (let page = 1; page <= 7; page++) {
      const d = await get(
        'listings?' +
          new URLSearchParams({
            page: String(page),
            pageSize: '12',
            facets: 'omit',
          }),
      );
      assert.equal(d.total, 84);
      ids.push(...d.items.map((x) => x.legacyId));
    }
    assert.deepEqual(
      ids,
      manifest.records.map((r) => r.sourceKey),
    );
    assert.equal(new Set(ids).size, 84);
    assert.equal((await get('listings?page=8&facets=omit')).items.length, 0);
    const one = manifest.records[0],
      search = await get(
        'listings?' +
          new URLSearchParams({
            search: one.source.product.name,
            facets: 'omit',
          }),
      );
    assert.equal(search.items[0].legacyId, one.sourceKey);
    const related = await get(
      'listings?' +
        new URLSearchParams({
          related: one.source.product.slug,
          facets: 'omit',
        }),
    );
    assert.equal(related.total, 6);
    assert.ok(
      related.items.every(
        (p) =>
          p.legacyId !== one.sourceKey &&
          p.categories[0].slug === one.source.product.category,
      ),
    );
    const sorted = await get('listings?sort=name&pageSize=24&facets=omit');
    assert.deepEqual(
      sorted.items,
      (await get('listings?sort=name&pageSize=24&facets=omit')).items,
    );
  });
  let facetCases = 0;
  await test('Every equivalent source facet value preserves matching IDs and disjunctive counts', async () => {
    for (const c of manifest.categories) {
      const records = manifest.records.filter(
          (r) => r.source.product.category === c.sourceKey,
        ),
        data = await get(
          'listings?' +
            new URLSearchParams({ category: c.sourceKey, pageSize: '24' }),
        );
      for (const f of data.filters) {
        if (f.code === 'brand') continue;
        const source = records
          .flatMap((r) => r.filters)
          .find((x) => x.code === f.code);
        assert.ok(source);
        const facet = data.facets.find((x) => x.code === f.code);
        for (const v of facet.values) {
          const option =
            f.values?.find?.((x) => x.code === v.code) ??
            f.snapshot?.values?.find?.((x) => x.code === v.code);
          const def = await db.optionValue.findFirstOrThrow({
            where: { tenantId: ids.tenantId, code: v.code },
          });
          const expected = records
            .filter((r) =>
              r.filters
                .find((x) => x.code === f.code)
                ?.values.includes(def.label),
            )
            .map((r) => r.sourceKey);
          assert.equal(v.count, expected.length);
          const matched = await get(
            'listings?' +
              new URLSearchParams({
                category: c.sourceKey,
                filters: new URLSearchParams({ [f.code]: v.code }).toString(),
                pageSize: '24',
                facets: 'omit',
              }),
          );
          assert.deepEqual(
            matched.items.map((x) => x.legacyId),
            expected,
          );
          facetCases++;
          void option;
        }
      }
    }
    assert.ok(facetCases > 100);
  });
  await test('Cross-tenant/store isolation, private drafts, scope forgery and protected APIs remain closed', async () => {
    const foreign = await db.tenant.create({
        data: { slug: 'foreign_' + runId, name: 'Private tenant' },
      }),
      foreignStore = await db.store.create({
        data: { tenantId: foreign.id, slug: 'foreign', name: 'Private store' },
      });
    await assert.rejects(() =>
      db.catalogImportRecord.create({
        data: {
          tenantId: foreign.id,
          storeId: foreignStore.id,
          kind: 'PRODUCT',
          sourceKey: 'foreign',
          sourceHash: '0'.repeat(64),
          manifestHash: '0'.repeat(64),
          source: {},
          listingId: productEvidence[0].listingId,
          complete: true,
        },
      }),
    );
    await get('listings?storeId=' + foreignStore.id, 400);
    await get('listings?tenantId=' + foreign.id, 400);
    const normal = await get('navigation');
    assert.deepEqual(
      await get('navigation', 200, {
        'x-store-id': foreignStore.id,
        Host: 'foreign.invalid',
      }),
      normal,
    );
    const r = await fetch(base + `/api/admin/stores/${ids.storeId}/listings`);
    assert.ok([401, 403].includes(r.status));
    for (const e of productEvidence.slice(0, 3))
      await get(
        'media/' +
          e.source.product.slug +
          '/' +
          e.mapping.media[0].assetId +
          '?width=640',
        404,
      );
    const privateType = await db.productType.create({
      data: {
        tenantId: foreign.id,
        code: 'foreign_private',
        label: 'Secret foreign type',
      },
    });
    assert.equal((await get('listings?facets=omit')).total, 84);
    assert.ok(
      !JSON.stringify(await get('navigation')).includes(privateType.label),
    );
  });
  await test('Imported dataset SQL plan, constant per-page query count and isolated 284-record growth store', async () => {
    const { verifyMigrationPerformance } =
      await import('./catalog-migration-performance.mjs');
    await verifyMigrationPerformance({ db, manifest, owner, ids, get, output });
  });
  await test('Built storefront browser parity: desktop/tablet/mobile, reference-only pages, SEO, collections and missing-media safety', async () => {
    for (const name of [
      'src',
      'public',
      'package.json',
      'package-lock.json',
      'jsconfig.json',
      'next.config.mjs',
    ])
      await fs.cp(
        path.join(root, 'frontend', name),
        path.join(frontendDir, name),
        { recursive: true },
      );
    await fs.symlink(
      path.join(root, 'frontend/node_modules'),
      path.join(frontendDir, 'node_modules'),
      'junction',
    );
    const config = path.join(frontendDir, 'next.config.mjs');
    await fs.writeFile(
      config,
      (await fs.readFile(config, 'utf8')).replace(
        'turbopack: {',
        `turbopack: { root: ${JSON.stringify(root)},`,
      ),
    );
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        ([k]) =>
          !/(SECRET|TOKEN|PASSWORD|DATABASE|^ADMIN_|^API_|^PUBLIC_|^CATALOG_)/i.test(
            k,
          ),
      ),
    );
    Object.assign(env, {
      NODE_ENV: 'production',
      CATALOG_MODE: 'dynamic-development',
      CATALOG_DEVELOPMENT: '1',
      CATALOG_API_ORIGIN: base,
      NEXT_TELEMETRY_DISABLED: '1',
    });
    const cli = path.join(root, 'frontend/node_modules/next/dist/bin/next'),
      build = spawn(process.execPath, [cli, 'build'], {
        cwd: frontendDir,
        env,
        stdio: 'pipe',
      });
    let log = '';
    build.stdout.on('data', (c) => (log = (log + c).slice(-3000)));
    build.stderr.on('data', (c) => (log = (log + c).slice(-3000)));
    assert.equal((await once(build, 'exit'))[0], 0, log);
    web = spawn(
      process.execPath,
      [cli, 'start', '--hostname', '127.0.0.1', '--port', String(webPort)],
      { cwd: frontendDir, env, stdio: 'pipe' },
    );
    web.stdout.on('data', () => {});
    web.stderr.on('data', () => {});
    const site = `http://127.0.0.1:${webPort}`;
    for (let n = 0; n < 200; n++) {
      try {
        if ((await fetch(site + '/products')).status === 200) break;
      } catch {}
      if (n === 199) throw Error('Storefront startup timeout');
      await new Promise((r) => setTimeout(r, 100));
    }
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.name));
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const slug of [
        'keyboards',
        'processors',
        manifest.records[0].source.product.slug,
      ]) {
        const response = await page.goto(site + '/products/' + slug);
        assert.equal(response.status(), 200);
        await page.locator('h1').waitFor();
        assert.ok(
          !(await page
            .getByText('Catalog unavailable', { exact: true })
            .count()),
        );
        const overflow = await page.evaluate(() => ({
          width: window.innerWidth,
          scroll: document.documentElement.scrollWidth,
          elements: [...document.querySelectorAll('body *')]
            .filter(
              (e) => e.getBoundingClientRect().right > window.innerWidth + 1,
            )
            .slice(0, 8)
            .map((e) => ({ tag: e.tagName, class: e.className })),
        }));
        assert.ok(
          overflow.scroll <= width + 1,
          JSON.stringify({ slug, ...overflow }),
        );
      }
      await page.screenshot({
        path: path.join(directory, `parity-${width}.png`),
        fullPage: true,
      });
    }
    await page.goto(
      site + '/products/' + manifest.records[0].source.product.slug,
    );
    assert.ok(
      await page
        .getByText('Reference price · not a selling offer', { exact: true })
        .count(),
    );
    assert.ok(
      await page.getByText('Image unavailable', { exact: true }).count(),
    );
    assert.ok(
      await page
        .getByText('Product ID: ' + manifest.records[0].sourceKey, {
          exact: true,
        })
        .count(),
    );
    assert.equal(
      await page.locator('link[rel=canonical]').getAttribute('href'),
      manifest.records[0].source.canonical,
    );
    assert.ok(
      (
        await page.locator('meta[name=robots]').getAttribute('content')
      ).includes('noindex'),
    );
    assert.ok(
      !(await page
        .locator('script[type="application/ld+json"]')
        .textContent()
        .then((s) => s.includes('"offers"'))),
    );
    const sitemap = await (await fetch(site + '/sitemap.xml')).text();
    for (const r of manifest.records)
      assert.ok(sitemap.includes(r.source.path));
    for (const c of manifest.categories)
      assert.ok(sitemap.includes(c.source.path));
    const redirect = await fetch(
      site +
        '/products/' +
        manifest.records[0].source.product.category +
        '/' +
        manifest.records[0].source.product.slug,
      { redirect: 'manual' },
    );
    assert.ok([307, 308].includes(redirect.status));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(site + '/products/keyboards');
    await page.getByRole('checkbox', { name: /Black/ }).first().check();
    await page.waitForURL(/f.color=/);
    await page.waitForFunction(
      () =>
        document.querySelector('article.pl-page')?.getAttribute('aria-busy') ===
        'false',
    );
    assert.ok((await page.locator('article.product-card').count()) > 0);
    const facets = await get('listings?category=keyboards');
    assert.ok(
      facets.filters
        .find((f) => f.code === 'brand')
        .values.every((v) => !v.label.startsWith('legacy_brand_')),
    );
    await page.goto(site);
    for (const name of ['Featured Products', 'New Arrivals']) {
      const section = page
        .locator('section')
        .filter({ has: page.getByRole('heading', { name, exact: true }) })
        .last();
      assert.equal(await section.locator('article.product-card').count(), 7);
      assert.ok(
        await section.getByText('View All Products', { exact: true }).count(),
      );
    }
    await page
      .locator('.desktop-nav summary')
      .filter({ hasText: 'Shop by Category' })
      .click();
    assert.equal(
      await page.locator('.desktop-nav .dropdown-links a').count(),
      12,
    );
    for (const r of manifest.records)
      assert.ok(
        r.source.aliases.includes(
          '/products/' +
            r.source.product.category +
            '/' +
            r.source.product.slug,
        ),
      );
    const { compareStaticBrowser } =
      await import('./catalog-migration-static-browser.mjs');
    await compareStaticBrowser({
      root,
      directory,
      env,
      cli,
      browser,
      dynamicSite: site,
      manifest,
      output,
    });
    assert.deepEqual(errors, []);
    await browser.close();
    browser = null;
  });
  if (preflight)
    await test('Reviewed unit values, cached field provenance and corrected gallery sources survive the real import', async () => {
      assert.equal(manifest.resolutions.length, 58);
      for (const e of productEvidence) {
        assert.equal(e.mapping.review.profile, manifest.reviewProfile);
        assert.equal(e.mapping.review.manifestHash, manifest.checksum);
        const record = manifest.records.find(
          (r) => r.sourceKey === e.sourceKey,
        );
        const values = await db.productAttributeValue.findMany({
          where: { productRevisionId: e.mapping.productRevisionId },
          include: { binding: true },
        });
        for (const spec of record.specs.filter((s) => s.numeric?.provenance)) {
          const attribute = await db.attributeDefinition.findUniqueOrThrow({
            where: {
              tenantId_code: {
                tenantId: ids.tenantId,
                code: (await import('./legacy-catalog-manifest.mjs')).code(
                  'legacy_number',
                  spec.attributeCode,
                ),
              },
            },
          });
          assert.equal(
            values
              .find((v) => v.binding.attributeId === attribute.id)
              .numberValue.toString(),
            spec.numeric.number,
          );
        }
        for (const media of e.mapping.media) {
          const asset = await db.mediaAsset.findUniqueOrThrow({
            where: { id: media.assetId },
          });
          assert.equal(asset.sourceUrl, media.source.sourceUrl);
        }
      }
      assert.equal(
        productEvidence.reduce(
          (n, e) => n + e.mapping.review.resolutions.length,
          0,
        ),
        58,
      );
    });
  if (process.env.VOG_TEST_CATALOG_COMPLIANCE === '1')
    await (
      await import('./media-compliance-verification.mjs')
    ).verifyMediaCompliance({
      db,
      ids,
      owner,
      token,
      base,
      test,
      productEvidence,
      output,
    });
  if(process.env.VOG_TEST_RELEASE_DELIVERY==='1')await (await import('./release-delivery-verification.mjs')).verifyReleaseDelivery({db,url,ids,owner,base,token,manifest,test,output,directory});
  passed = true;
  await fs.writeFile(
    path.join(output, 'parity.json'),
    JSON.stringify(
      {
        passed: true,
        manifestHash: manifest.checksum,
        products: parity,
        categories: manifest.categories.map((c) => ({
          slug: c.sourceKey,
          identity: 'EXACT_SLUG',
          path: c.source.path,
          hierarchy: 'EXACT_FLAT_SOURCE',
        })),
        facetCases,
        classification: {
          exact: [
            '84 names/descriptions/specification source values/reference prices',
            '96 canonical route paths',
            '8 featured + 8 arrivals members and ordering',
            '95 retained media references and checksums',
          ],
          intentionalTransformations: [
            'UUID internal identities with exact legacy external references',
            'One default SKU, reference-only offers disabled',
            'Canonical numeric fields supplement original text; 14 numeric Cores/Threads display as strings under the public spec contract, original JSON number types retained in evidence',
            'Legacy filter labels mapped to stable option codes',
            'All restricted media withheld from public renderer',
          ],
          requiringReview: [
            'Media commercial rights/provider and poster absence',
            'Unsupported canonical measurements',
            'Reference-price filtering/sorting differs from approved offer filtering',
            'Product breadcrumb uses full name rather than legacy modelIdentifier; source retained',
            'Dynamic development noindex; production gate remains closed',
          ],
          regressions: [],
        },
      },
      null,
      2,
    ) + '\n',
  );
} catch (e) {
  console.error('FAIL ' + phase + ' (' + e.constructor.name + ')');
  if (
    e.constructor.name === 'AssertionError' ||
    e.message.startsWith('Import admin')
  )
    console.error(e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  for (const child of [web, server])
    if (child && child.exitCode === null) {
      child.kill();
      await once(child, 'exit');
    }
  await db?.$disconnect();
  await cluster.stop();
  // This invocation owns only its fresh random directory, never historical .local fixtures.
  if (path.dirname(directory) !== parent)
    throw Error('Unsafe rehearsal cleanup');
  await fs.rm(directory, {
    recursive: true,
    force: true,
    maxRetries: 8,
    retryDelay: 150,
  });
  await fs.writeFile(
    path.join(output, 'verification.json'),
    JSON.stringify(
      {
        passed,
        checks,
        failedPhase: passed ? null : phase,
        timings,
        productionAccess: false,
        credentialsPersisted: false,
        cleanup:
          'owned API/PostgreSQL/browser/frontend stopped; owned temporary files removed; historical ignored directory untouched',
      },
      null,
      2,
    ) + '\n',
  );
}
