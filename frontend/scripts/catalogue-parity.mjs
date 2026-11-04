// Read-only Milestone 7 preparation. No import, price approval or data writes.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import {
  products,
  productCategories,
  getFeaturedProducts,
  getNewArrivals,
} from "../src/data/products.js";
import { staticCatalogSnapshot } from "../src/lib/catalog/static-adapter.js";
const files = [
  "src/data/products.js",
  "src/data/catalogue-products.js",
  "src/data/catalogue-images.js",
  "src/data/productDetails.js",
  "src/data/product-detail-gallery.js",
  "src/data/retail-product-images.js",
];
const hashes = [];
for (const file of files) {
  const current = await fs.readFile(file),
    before = execFileSync("git", ["show", `b6d088f:frontend/${file}`], {
      maxBuffer: 5000000,
    });
  const hash = (b) =>
    createHash("sha256")
      .update(b.toString().replaceAll("\r\n", "\n"))
      .digest("hex");
  assert.equal(hash(current), hash(before), `${file} changed`);
  hashes.push({ file, sha256: hash(current) });
}
assert.equal(products.length, 84);
assert.equal(productCategories.length, 12);
assert.equal(new Set(products.map((p) => p.id)).size, 84);
assert.equal(new Set(products.map((p) => p.slug)).size, 84);
for (const p of products) {
  assert.equal(p.pricingApproved, false);
  assert.equal(p.inventoryVerified, false);
}
const snapshot = staticCatalogSnapshot();
assert.equal(snapshot.products.length, 84);
for (const [i, p] of snapshot.products.entries()) {
  assert.equal(p.referencePricePKR, products[i].referencePricePKR);
  assert.equal(p.slug, products[i].slug);
  assert.equal(p.purchasable, false);
  assert.equal(p.inventoryVerified, false);
}
const report = {
  passed: true,
  mode: "read-only static compatibility parity; not a production import",
  products: products.length,
  categories: productCategories.length,
  featured: getFeaturedProducts().map((p) => p.id),
  newArrivals: getNewArrivals().map((p) => p.id),
  hashes,
  adapterValidated: true,
  productionAccess: false,
};
if (process.argv.includes("--write-report")) {
  await fs.mkdir("docs", { recursive: true });
  await fs.writeFile(
    "docs/storefront-static-parity.json",
    JSON.stringify(report, null, 2) + "\n",
  );
}
console.log(JSON.stringify(report, null, 2));
