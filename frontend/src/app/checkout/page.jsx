"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/CartProvider";
import { useCheckoutQuote } from "@/components/cart/useCheckoutQuote";

const money = (currency, value) => `${currency ?? "PKR"} ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 }).format(Number(value))}`;

export default function CheckoutPage() {
  const router = useRouter(), cart = useCart(), { quote, pending: quoting, error: quoteError } = useCheckoutQuote(cart.items, cart.ready, cart.couponCode);
  const [config, setConfig] = useState(null), [configError, setConfigError] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; fetch("/api/checkout/config", { cache: "no-store" }).then(async (r) => { const data = await r.json(); if (!r.ok) throw new Error(data.message ?? "Payment options are unavailable."); return data; }).then((data) => { if (active) setConfig(data); }).catch((cause) => { if (active) setConfigError(cause.message); }); return () => { active = false; }; }, []);
  async function submit(event) {
    event.preventDefault();
    if (!config?.enabled || !config.paymentMethods.some((method) => method.code === "COD") || !quote || quoteError) { setError("Checkout is unavailable. Review your cart and the store payment settings."); return; }
    setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    let idempotencyKey = sessionStorage.getItem("vogpk-checkout-key");
    if (!idempotencyKey) { idempotencyKey = crypto.randomUUID(); sessionStorage.setItem("vogpk-checkout-key", idempotencyKey); }
    const payload = { idempotencyKey, items: cart.items, ...(cart.couponCode ? { couponCode: cart.couponCode } : {}), customerName: form.get("customerName"), phone: form.get("phone"), city: form.get("city"), address: form.get("address"), paymentMethod: "COD" };
    try {
      const response = await fetch("/api/checkout/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) { if (response.status >= 400 && response.status < 500) sessionStorage.removeItem("vogpk-checkout-key"); throw new Error(data.message ?? "We could not place your order. Please review your details and try again."); }
      sessionStorage.setItem(`vogpk-receipt:${data.orderNumber}`, data.receiptToken);
      sessionStorage.removeItem("vogpk-checkout-key");
      cart.clear();
      router.replace(`/order-confirmation/${encodeURIComponent(data.orderNumber)}`);
    } catch (cause) { setError(cause.message); setBusy(false); }
  }
  return <section className="container checkout-page">
    <h1>Checkout</h1>
    {!cart.ready ? <p role="status">Loading your cart…</p> : !cart.items.length ? <p>Your cart is empty. <Link href="/products">Browse products</Link></p> : <>
      {quoteError && <p className="checkout-error" role="alert">{quoteError}</p>}
      {configError && <p className="checkout-error" role="alert">{configError}</p>}
      {config && !config.enabled && <p className="checkout-error" role="alert">This store has no active payment method. Checkout is unavailable.</p>}
      {error && <p className="checkout-error" role="alert">{error}</p>}
      {quote && <div className="checkout-totals"><p>Subtotal <strong>{money(quote.currency, quote.subtotal)}</strong></p><p>Delivery <strong>{money(quote.currency, quote.delivery)}</strong></p>{Number(quote.discount) > 0 && <p>Coupon {quote.couponCode} <strong>−{money(quote.currency, quote.discount)}</strong></p>}<p>Total <strong>{money(quote.currency, quote.total)}</strong></p></div>}
      <form className="checkout-form" onSubmit={submit}>
        <fieldset disabled={busy || quoting || !quote || Boolean(quoteError) || !config?.enabled || !config.paymentMethods?.length}>
          <legend>Delivery details</legend>
          <label>Full name<input name="customerName" autoComplete="name" minLength="2" maxLength="120" required /></label>
          <label>Phone number<input name="phone" type="tel" autoComplete="tel" pattern="\+?\d[\d ()-]{7,24}" required aria-describedby="phone-hint" /><small id="phone-hint">Enter a Pakistan contact number.</small></label>
          <label>City<select name="city" required defaultValue=""><option value="" disabled>Select a city</option>{(config?.cities ?? []).map((city) => <option value={city} key={city}>{city}</option>)}</select></label>
          <label>Delivery address<textarea name="address" autoComplete="street-address" minLength="8" maxLength="500" required /></label>
          <fieldset><legend>Payment method</legend>{config?.paymentMethods?.map((method) => <label key={method.code}><input type="radio" name="paymentMethod" value={method.code} defaultChecked={method.code === "COD"} />{method.label}</label>)}</fieldset>
          <button className="checkout-primary" type="submit" disabled={busy || quoting || !quote || Boolean(quoteError) || !config?.paymentMethods?.length}>{busy ? "Placing order…" : "Place COD order"}</button>
        </fieldset>
      </form>
      <p>Cash on Delivery orders are not marked as paid. Final price and stock are checked again when you submit.</p>
    </>}
  </section>;
}
