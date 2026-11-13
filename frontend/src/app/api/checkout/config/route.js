import { proxyCheckout } from "@/lib/checkout-proxy";
export const dynamic = "force-dynamic";
export async function GET(request) { return proxyCheckout(request, "checkout/config"); }
