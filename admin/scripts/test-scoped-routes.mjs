import assert from "node:assert/strict";
import { allowedScopedRoute } from "../src/lib/scoped-routes.js";
const id = "24671ca6-721f-4ea4-baa4-4a5b0f8f1000";
const base = `scopes/tenants/${id}/stores/${id}`;
assert.equal(allowedScopedRoute("POST", `${base}/roles`), true);
assert.equal(allowedScopedRoute("GET", "contexts"), true);
const attacks = [
  `${base}/roles/../members`,
  `${base}/roles?tenantId=${id}`,
  `${base}/roles#fragment`,
  `${base}/%2e%2e/roles`,
  `${base}/roles/`,
  `${base}/roles\n`,
  `https://other.invalid/${base}/roles`,
  `//other.invalid/${base}/roles`,
  "scopes/platform/users",
  "scopes/platform/tenants",
  "scopes/platform/roles/delete",
  "scopes/tenants/not-a-uuid/roles",
  `${base}/members/${id}/activate`,
];
for (const candidate of attacks)
  for (const method of ["GET", "POST", "PATCH", "DELETE"])
    assert.equal(allowedScopedRoute(method, candidate), false);
for (const method of ["DELETE", "PUT", "OPTIONS"])
  assert.equal(allowedScopedRoute(method, `${base}/roles`), false);
console.log(
  "PASS Scoped BFF allowlist rejects path injection, scope provisioning and unsupported methods (57 assertions).",
);
const catalog = `stores/${id}`,
  category = `${catalog}/categories/${id}`,
  filters = `${category}/filter-sets/${id}`;
const allowed = {
  GET: [
    category,
    catalog + "/categories",
    catalog + "/categories/tree",
    catalog + "/filter-schemas",
    catalog + "/filter-registry",
    category + "/impact",
    category + "/active-filters",
    category + "/filter-sets",
    filters,
    filters + "/impact",
    "contexts/catalog",
  ],
  POST: [
    catalog + "/categories",
    category + "/move",
    category + "/actions/activate",
    category + "/filter-sets",
    filters + "/clone",
    filters + "/preview",
    filters + "/actions/approve",
  ],
  PATCH: [category, filters],
};
let assertions = 0;
for (const [method, paths] of Object.entries(allowed))
  for (const route of paths) {
    assert.equal(allowedScopedRoute(method, route), true, route);
    assertions++;
  }
for (const route of [
  category + "/delete",
  category + "/actions/reset",
  filters + "/sql",
  filters + "/actions/run",
  catalog + "/secrets",
  category + "?storeId=" + id,
  filters + "/preview/",
  filters + "/../roles",
  catalog.replace(id, "not-a-uuid") + "/categories",
])
  for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
    assert.equal(allowedScopedRoute(method, route), false, route);
    assertions++;
  }
for (const method of ["PUT", "DELETE", "OPTIONS"]) {
  assert.equal(allowedScopedRoute(method, category), false);
  assertions++;
}
console.log(
  `PASS Category/filter BFF explicit route allowlist (${assertions} assertions).`,
);
