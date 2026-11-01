import "server-only";
import { cache } from "react";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import {
  navigationSchema,
  listSchema,
  detailSchema,
  routeSchema,
} from "./contracts";
export function dynamicCatalog() {
  const mode = process.env.CATALOG_MODE ?? "static";
  if (!["static", "dynamic-development"].includes(mode))
    throw Error("Invalid catalog mode.");
  return mode === "dynamic-development";
}
export function catalogOrigin() {
  if (!dynamicCatalog() || process.env.CATALOG_DEVELOPMENT !== "1")
    throw Error("Dynamic development catalog is not configured.");
  const url = new URL(process.env.CATALOG_API_ORIGIN ?? "");
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw Error("A loopback development catalog origin is required.");
  return url.origin;
}
export class CatalogError extends Error {
  constructor(status) {
    super(
      status === 400
        ? "Invalid catalog filters or selection."
        : "The catalog is temporarily unavailable.",
    );
    this.status = status;
  }
}
const request = cache(async (path, schema) => {
  await connection();
  const origin = catalogOrigin();
  let response;
  try {
    response = await fetch(`${origin}/api/catalog/${path}`, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    unstable_rethrow(error);
    throw new CatalogError(503);
  }
  if (!response.ok) throw new CatalogError(response.status);
  if (Number(response.headers.get("content-length") ?? 0) > 4000000)
    throw new CatalogError(503);
  try {
    return schema.parse(await response.json());
  } catch (error) {
    unstable_rethrow(error);
    throw new CatalogError(503);
  }
});
/** @returns {Promise<import('zod').infer<typeof navigationSchema>>} */
export const catalogNavigation = () => request("navigation", navigationSchema);
/** @param {string} slug @returns {Promise<import('zod').infer<typeof routeSchema>>} */
export const catalogRoute = (slug) =>
  request(`routes/${encodeURIComponent(slug)}`, routeSchema);
/** @param {string} slug @param {string|undefined} variant @returns {Promise<import('zod').infer<typeof detailSchema>>} */
export const catalogProduct = (slug, variant) =>
  request(
    `products/${encodeURIComponent(slug)}${variant ? "?variant=" + encodeURIComponent(variant) : ""}`,
    detailSchema,
  );
/** @param {Record<string,string|number|undefined>} values @returns {Promise<import('zod').infer<typeof listSchema>>} */
export function catalogList(values = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== "") params.set(key, String(value));
  return request("listings?" + params.toString(), listSchema);
}
// React cache only deduplicates within a server render. No persistent price,
// availability or rights cache survives publication or crosses configured stores.
