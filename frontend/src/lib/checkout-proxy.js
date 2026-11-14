import { NextResponse } from "next/server";
import { dynamicCatalog, catalogOrigin } from "@/lib/catalog/server";

export function staticCheckoutConfig() {
  return { enabled: false, revision: 0, currency: "PKR", paymentMethods: [], cities: [] };
}

function sameOrigin(request) {
  const origin = request.headers.get("origin"), host = request.headers.get("host");
  if (!origin || !host || host.includes(",")) return false;
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol || new URL(request.url).protocol.slice(0, -1);
  if (protocol !== "http" && protocol !== "https") return false;
  try {
    return new URL(origin).origin === new URL(`${protocol}://${host}`).origin;
  } catch {
    return false;
  }
}

export async function proxyCheckout(request, path, { method = "GET", body } = {}) {
  if (!dynamicCatalog()) {
    if (path === "checkout/config" && method === "GET") return NextResponse.json(staticCheckoutConfig(), { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ message: "Checkout is not enabled for this catalog." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  if (method !== "GET") {
    const origin = request.headers.get("origin");
    if (!sameOrigin(request)) return NextResponse.json({ message: "Request origin is not allowed." }, { status: 403 });
    headers.Origin = origin;
  }
  let response;
  try {
    response = await fetch(`${catalogOrigin()}/api/catalog/${path}`, {
      method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
    });
  } catch {
    return NextResponse.json({ message: "Checkout is temporarily unavailable. Please try again." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  let payload;
  try { payload = await response.json(); } catch { payload = { message: "Checkout returned an invalid response." }; }
  return NextResponse.json(payload, { status: response.status, headers: { "Cache-Control": "no-store" } });
}
