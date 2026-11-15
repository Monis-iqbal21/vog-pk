process.env.VOG_TEST_CATALOG_PREFLIGHT = '1';
process.env.VOG_TEST_CATALOG_COMPLIANCE = '1';
process.env.MEDIA_REFERENCE_PREVIEW = '1';
await import('./test-catalog-migration.mjs');
