// Server configuration only; no NEXT_PUBLIC switch or client-provided origin.
export function catalogMode(env = process.env) {
  const mode = env.CATALOG_MODE ?? "static";
  if (!["static", "dynamic-development", "dynamic-production"].includes(mode))
    throw Error("Invalid catalog mode.");
  if (
    mode === "dynamic-production" &&
    (env.NODE_ENV !== "production" ||
      env.CATALOG_PRODUCTION_READS_ENABLED !== "1" ||
      (env.VERCEL_ENV && env.VERCEL_ENV !== "production"))
  )
    throw Error("Production catalog cutover is not approved.");
  return mode;
}
export function configuredCatalogOrigin(env = process.env) {
  const mode = catalogMode(env),
    url = new URL(env.CATALOG_API_ORIGIN ?? "");
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw Error("Configure an exact catalog API origin.");
  if (mode === "dynamic-production") {
    if (
      url.protocol !== "https:" ||
      url.origin !== env.CATALOG_APPROVED_API_ORIGIN ||
      url.port ||
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
      throw Error("Approved HTTPS catalog origin required.");
  } else if (
    mode !== "dynamic-development" ||
    env.CATALOG_DEVELOPMENT !== "1" ||
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1"].includes(url.hostname)
  )
    throw Error("A loopback development catalog origin is required.");
  return url.origin;
}
