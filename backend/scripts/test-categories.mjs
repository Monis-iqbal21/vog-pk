// The schema harness always provisions a fresh random-port loopback cluster,
// random in-memory credentials and an env-free real admin production build.
process.env.VOG_TEST_CATEGORIES = '1';
await import('./test-product-types.mjs');
