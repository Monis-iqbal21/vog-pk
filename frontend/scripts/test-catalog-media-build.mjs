import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { preparePlaceholderBuild } from "./catalog-media-build.mjs";
const parent = path.resolve(".local");
await fs.mkdir(parent, { recursive: true });
const root = await fs.mkdtemp(path.join(parent, "media-build-"));
try {
  await fs.mkdir(path.join(root, "public/images/products"), {
    recursive: true,
  });
  const bytes = Buffer.from(
    "Isolated build file fixture; not a product photograph",
  );
  const records = Array.from({ length: 95 }, (_, i) => ({
    path: `/images/products/fixture-${i}.png`,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  }));
  for (const r of records)
    await fs.writeFile(path.join(root, "public", r.path), bytes);
  await fs.writeFile(path.join(root, "public/unrelated.txt"), "preserve");
  assert.equal((await preparePlaceholderBuild(root, records, {})).withheld, 0);
  await assert.rejects(() =>
    preparePlaceholderBuild(root, records, {
      CATALOG_MODE: "dynamic-production",
    }),
  );
  const env = {
    CATALOG_MODE: "dynamic-production",
    VERCEL: "1",
    VERCEL_ENV: "production",
    CATALOG_PRODUCTION_READS_ENABLED: "1",
    CATALOG_MEDIA_PRESENTATION: "generic-approved",
  };
  await assert.rejects(() =>
    preparePlaceholderBuild(
      root,
      [{ ...records[0], path: "/../unsafe" }, ...records.slice(1)],
      env,
    ),
  );
  assert.equal(
    (await preparePlaceholderBuild(root, records, env)).withheld,
    95,
  );
  assert.equal(
    await fs.readFile(path.join(root, "public/unrelated.txt"), "utf8"),
    "preserve",
  );
  console.log(
    "PASS Explicit generic build withholds exactly 95 reviewed fixture files, preserves unrelated files, rejects unsafe paths and leaves static builds unchanged.",
  );
} finally {
  if (path.dirname(root) !== parent) throw Error("Unsafe fixture cleanup");
  await fs.rm(root, { recursive: true, force: true });
}
