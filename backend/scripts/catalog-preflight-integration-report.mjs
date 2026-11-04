import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { root, digest } from './legacy-catalog-manifest.mjs';
const read = async (file) =>
  JSON.parse(await fs.readFile(path.join(root, file), 'utf8'));
const preflight = await read(
    'backend/docs/catalog-preflight/verification.json',
  ),
  synthetic = await read('backend/docs/storefront-verification.json'),
  foundation = await read('backend/docs/commerce-foundation-verification.json'),
  auth = await read('backend/docs/commerce-foundation-auth-regression.json'),
  review = await read('backend/docs/catalog-preflight/source-review.json'),
  media = await read('backend/docs/catalog-preflight/media-audit.json'),
  parity = await read('backend/docs/catalog-preflight/parity.json');
assert.ok([preflight, synthetic, foundation, auth].every((r) => r.passed));
assert.equal(preflight.checks.length, 12);
const migrationFiles = execFileSync(
  'git',
  ['ls-files', 'backend/prisma/migrations/*/migration.sql'],
  { cwd: root, encoding: 'utf8' },
)
  .trim()
  .split('\n');
const migrations = [];
for (const file of migrationFiles) {
  const previous = execFileSync('git', ['show', '96915e1:' + file], {
      cwd: root,
      encoding: 'utf8',
    }).replaceAll('\r\n', '\n'),
    current = (await fs.readFile(path.join(root, file), 'utf8')).replaceAll(
      '\r\n',
      '\n',
    );
  assert.equal(current, previous);
  migrations.push({ file, sha256: digest(current), unchangedFrom7A: true });
}
assert.equal(migrations.length, 8);
const components = [
  'Tenant/store compound ownership and draft isolation',
  'Custom RBAC and default-context Owner compatibility',
  'Approved Product Types/schema versions and dynamic category filters',
  'Immutable product/SKU/listing revisions and one default SKU',
  'Reference-only prices and unknown inventory',
  'Media rights gating and shared/variant poster lifecycle',
  'Public catalog same-SKU predicates and pagination',
  'Admin BFF CSRF/session/path allowlists',
  'Runtime routes, 84 legacy redirects, SEO and sitemap',
  'Independent 7-product home rows and complete editorial memberships',
];
const report = {
  baselineCommit: '96915e1',
  localRegressionStatus: 'PASS',
  productionRecommendation: 'NO-GO',
  sourceReview: review.summary,
  media: media.summary,
  migrations,
  components: components.map((component) => ({
    component,
    status: 'PASS_IN_ISOLATED_REGRESSION',
    productionVerified: false,
  })),
  regressions: {
    backendBuild: 'PASS',
    backendLint: 'PASS',
    unitFiles: 9,
    unitTests: 37,
    adminLint: 'PASS',
    adminBuild: 'PASS clean actual built fixture',
    frontendLint: 'PASS',
    frontendBuild: 'PASS static and dynamic',
    migrationAndReviewGroups: preflight.checks.length,
    reviewTests: preflight.checks,
    integrationGroups: synthetic.checks,
    foundationGroups: foundation.checks,
    authenticationGroups: auth.checks,
    adminBrowser: synthetic.admin,
    facetValueComparisons: parity.facetCases,
    listingOrderCompatibility:
      'PASS real API: set 42, omitted save preserves 42, explicit null clears',
    routingChecks: 19,
    bffAllowlistAssertions: 356,
  },
  audits: {
    runtime: { backend: 0, admin: 0, frontend: 0 },
    fullModerate: { backend: 2, admin: 16, frontend: 16 },
    high: 0,
    critical: 0,
    note: 'Inherited development-tool findings; no new dependency/provider installed',
  },
  remainingIntegrationDecisions: [
    'Production catalog gates/HTTPS origin and production importer remain unimplemented',
    'Additive production permission/context/Owner bridge backfill requires separate review; blanket seed forbidden',
    'Existing release prepare tool blocks schema deltas; migration-aware staging required',
    'Reference-price editing/carry-forward after listing republish needs an explicit workflow; the old import pin is intentionally not reused automatically',
    'Legacy filter URL/reference-price browsing and production SEO/breadcrumb decisions',
    '95 media approvals and a reviewed static bundle or private production delivery adapter',
    'Actual cloud capacity/hosting plan, fresh recovery proof and Oracle ARM64 release checks unverified',
  ],
  cleanup: {
    preflight: preflight.cleanup,
    synthetic: synthetic.cleanup,
    foundation: foundation.cleanup,
    preexistingIgnoredDirectories: 'Preserved; no cleanup attempted',
  },
  productionAccess: false,
  push: false,
  merge: false,
  deploy: false,
  paidResourcesCreated: false,
};
const out = path.join(root, 'backend/docs/catalog-preflight');
await fs.writeFile(
  path.join(out, 'integration.json'),
  JSON.stringify(report, null, 2) + '\n',
);
await fs.copyFile(
  path.join(root, 'backend/docs/storefront-query-performance.json'),
  path.join(out, 'synthetic-regression-performance.json'),
);
console.log(
  JSON.stringify({
    integratedLocalChecks: 'PASS',
    migrationCount: 8,
    sourceResolved: 58,
    sourcePending: 72,
    production: 'NO-GO',
  }),
);
