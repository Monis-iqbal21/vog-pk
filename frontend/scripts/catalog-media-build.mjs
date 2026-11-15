// Only the future explicitly approved disposable Vercel build may remove these copies.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
export async function preparePlaceholderBuild(
  root,
  records,
  env = process.env,
) {
  if (env.CATALOG_MODE !== "dynamic-production")
    return { withheld: 0, mode: "unchanged-static-or-development" };
  if (
    env.VERCEL !== "1" ||
    env.VERCEL_ENV !== "production" ||
    env.CATALOG_PRODUCTION_READS_ENABLED !== "1" ||
    env.CATALOG_MEDIA_PRESENTATION !== "generic-approved"
  )
    throw Error(
      "Explicit approved generic-media Vercel production build required",
    );
  if (records.length !== 95 || new Set(records.map((r) => r.path)).size !== 95)
    throw Error("Expected reviewed 95-file policy");
  const publicRoot = await fs.realpath(path.join(root, "public")),
    targets = [];
  for (const r of records) {
    if (
      !/^\/images\/products\/[a-zA-Z0-9_/-]+\.(png|webp|jpg|jpeg)$/.test(r.path)
    )
      throw Error("Invalid reviewed media path");
    const file = path.join(publicRoot, r.path),
      real = await fs.realpath(file);
    if (
      !real.startsWith(publicRoot + path.sep) ||
      (await fs.lstat(file)).isSymbolicLink() ||
      createHash("sha256")
        .update(await fs.readFile(file))
        .digest("hex") !== r.sha256
    )
      throw Error("Reviewed media source differs");
    targets.push(file);
  }
  for (const file of targets) await fs.unlink(file);
  return {
    withheld: targets.length,
    mode: "explicitly-approved-generic-build",
  };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const root = fileURLToPath(new URL("../", import.meta.url));
    // Static staging never reads or removes product files.
    const records =
      process.env.CATALOG_MODE === "dynamic-production"
        ? JSON.parse(
            await fs.readFile(
              path.join(root, "docs/catalog-withheld-media.json"),
              "utf8",
            ),
          )
        : [];
    console.log(JSON.stringify(await preparePlaceholderBuild(root, records)));
  } catch {
    console.error(
      "Catalog media build failed closed. No publication approved.",
    );
    process.exitCode = 1;
  }
}
