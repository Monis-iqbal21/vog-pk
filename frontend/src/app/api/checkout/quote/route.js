import { proxyCheckout } from "@/lib/checkout-proxy";
export const dynamic = "force-dynamic";
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ message: "Invalid checkout request." }, { status: 400 }); }
  return proxyCheckout(request, "checkout/quote", { method: "POST", body });
}
