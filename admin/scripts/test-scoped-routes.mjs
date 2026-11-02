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
const productBase = `scopes/tenants/${id}/catalog`,
  pr = `${productBase}/products/${id}/revisions/${id}`,
  listingBase = `stores/${id}/listings`,
  lr = `${listingBase}/${id}/revisions/${id}`;
const catalogAllowed = {
  GET: [
    "contexts/products",
    productBase + "/schemas",
    productBase + "/brands",
    productBase + "/products",
    productBase + `/products/${id}`,
    productBase + `/products/${id}/revisions`,
    pr,
    pr + "/impact",
    listingBase,
    listingBase + "/catalog",
    listingBase + "/categories",
    listingBase + `/${id}`,
    listingBase + `/${id}/revisions`,
    lr,
    lr + "/impact",
  ],
  POST: [
    productBase + "/products",
    productBase + "/brands",
    productBase + `/products/${id}/archive`,
    productBase + `/products/${id}/skus/${id}/archive`,
    pr + "/clone",
    pr + "/resolve",
    pr + "/actions/review",
    pr + "/actions/publish",
    listingBase,
    listingBase + `/${id}/archive`,
    lr + "/clone",
    lr + "/actions/approve",
    lr + "/actions/publish",
  ],
  PATCH: [pr, lr],
};
let catalogAssertions = 0;
for (const [method, paths] of Object.entries(catalogAllowed))
  for (const path of paths) {
    assert.equal(allowedScopedRoute(method, path), true, path);
    catalogAssertions++;
  }
for (const path of [
  productBase + "/sql",
  pr + "/actions/activate",
  pr + "/actions/reset",
  lr + "/actions/execute",
  productBase + "/products?tenantId=" + id,
  pr + "/../roles",
  productBase.replace(id, "invalid") + "/products",
  listingBase + "/catalog/execute",
  listingBase + "/upload",
  pr + "/media",
  lr + "/media",
])
  for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
    assert.equal(allowedScopedRoute(method, path), false, path);
    catalogAssertions++;
  }
for (const method of ["PUT", "DELETE", "OPTIONS"])
  for (const path of [pr, lr]) {
    assert.equal(allowedScopedRoute(method, path), false);
    catalogAssertions++;
  }
console.log(
  `PASS Product/SKU/listing BFF allowlist (${catalogAssertions} assertions).`,
);
const ops = `stores/${id}/operations`,
  media = `scopes/tenants/${id}/media`,
  item = `${ops}/skus/${id}`,
  presentation = `${ops}/listings/${id}/revisions/${id}/media`,
  assignments = `${media}/products/${id}/revisions/${id}`;
const operationalAllowed = {
  GET: [
    `${ops}/settings`,
    `${ops}/locations`,
    `${item}/prices`,
    `${item}/inventory`,
    `${item}/inventory/history`,
    `${item}/quote`,
    presentation,
    `${presentation}/${id}/content`,
    `${media}/assets`,
    `${media}/assets/${id}/content`,
    `${assignments}/assignments`,
  ],
  POST: [
    `${ops}/locations`,
    `${item}/prices`,
    ...["review", "draft", "approve", "publish", "archive"].map(
      (a) => `${item}/prices/${id}/actions/${a}`,
    ),
    `${item}/inventory/adjustments`,
    `${media}/uploads`,
    `${media}/assets/${id}/approve`,
    `${media}/assets/${id}/archive`,
  ],
  PATCH: [
    `${ops}/settings`,
    `${item}/prices/${id}`,
    `${item}/inventory`,
    presentation,
    `${media}/assets/${id}`,
    `${assignments}/assignments`,
    `${assignments}/skus/${id}/assignments`,
  ],
};
let operationsAssertions = 0;
for (const [method, paths] of Object.entries(operationalAllowed))
  for (const path of paths) {
    assert.equal(allowedScopedRoute(method, path), true, `${method} ${path}`);
    operationsAssertions++;
    for (const forbiddenMethod of ["PUT", "DELETE", "OPTIONS"]) {
      assert.equal(allowedScopedRoute(forbiddenMethod, path), false);
      operationsAssertions++;
    }
  }
for (const path of [
  `${ops}/sql`,
  `${ops}/restart`,
  `${media}/fetch-url`,
  `${media}/uploads/execute`,
  `${media}/assets/${id}/delete`,
  `${media}/assets/${id}/approve/admin`,
  `${item}/prices/${id}/actions/activate`,
  `${item}/inventory/delete`,
  `${media}/../roles`,
  `${media}/assets?tenantId=${id}`,
  `${assignments}/skus/not-a-uuid/assignments`,
])
  for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
    assert.equal(allowedScopedRoute(method, path), false, path);
    operationsAssertions++;
  }
console.log(
  `PASS Pricing/inventory/media BFF allowlist (${operationsAssertions} assertions).`,
);
let reviewAssertions = 0;
for (const [verb, suffix] of [
  ["GET", "review"],
  ["POST", "reject"],
]) {
  const route = `${media}/assets/${id}/${suffix}`;
  for (const method of ["GET", "POST", "PATCH", "DELETE", "PUT"]) {
    assert.equal(allowedScopedRoute(method, route), method === verb);
    reviewAssertions++;
  }
  for (const bad of [
    route + "/",
    route + "/../approve",
    route + "?scope=PUBLIC",
    route.replace(id, "not-a-uuid"),
  ]) {
    assert.equal(allowedScopedRoute(verb, bad), false);
    reviewAssertions++;
  }
}
console.log(
  `PASS Media review/rejection BFF routes (${reviewAssertions} assertions).`,
);
