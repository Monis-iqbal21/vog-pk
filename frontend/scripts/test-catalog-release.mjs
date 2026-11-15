import assert from "node:assert/strict";
import {
  catalogMode,
  configuredCatalogOrigin,
} from "../src/lib/catalog/config.mjs";
assert.equal(catalogMode({}), "static");
const env = {
  NODE_ENV: "production",
  VERCEL_ENV: "production",
  CATALOG_MODE: "dynamic-production",
  CATALOG_PRODUCTION_READS_ENABLED: "1",
  CATALOG_API_ORIGIN: "https://80-225-254-168.sslip.io",
  CATALOG_APPROVED_API_ORIGIN: "https://80-225-254-168.sslip.io",
};
assert.equal(configuredCatalogOrigin(env), env.CATALOG_API_ORIGIN);
for (const bad of [
  { CATALOG_PRODUCTION_READS_ENABLED: "" },
  { CATALOG_PRODUCTION_READS_ENABLED: "true" },
  { VERCEL_ENV: "preview" },
  { NODE_ENV: "test" },
  { CATALOG_API_ORIGIN: "http://127.0.0.1:4000" },
  { CATALOG_API_ORIGIN: env.CATALOG_API_ORIGIN + "/path" },
  { CATALOG_API_ORIGIN: "https://other.invalid" },
  { CATALOG_API_ORIGIN: "https://x:password@example.invalid" },
])
  assert.throws(() => configuredCatalogOrigin({ ...env, ...bad }));
assert.equal(
  configuredCatalogOrigin({
    CATALOG_MODE: "dynamic-development",
    CATALOG_DEVELOPMENT: "1",
    CATALOG_API_ORIGIN: "http://127.0.0.1:4000",
  }),
  "http://127.0.0.1:4000",
);
console.log(
  "PASS Catalog release flags: static default, exact production opt-in, HTTPS allowlist, Preview isolation and unchanged loopback fixtures (11 checks).",
);
