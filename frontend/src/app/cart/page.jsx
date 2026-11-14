"use client";
import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { useCheckoutQuote } from "@/components/cart/useCheckoutQuote";

const money = (currency, value) => `${currency ?? "PKR"} ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 }).format(Number(value))}`;

export default function CartPage() {
  const cart = useCart(), [couponDraft, setCouponDraft] = useState(cart.couponCode), { quote, pending, error } = useCheckoutQuote(cart.items, cart.ready, cart.couponCode);
  const quoteByLine = new Map((quote?.items ?? []).map((item) => [`${item.listingId}:${item.skuCode}`, item]));
  return <section className="container checkout-page">
    <h1>Your cart</h1>
    {!cart.ready ? <p role="status">Loading your cart…</p> : !cart.items.length ? <div><p>Your cart is empty.</p><Link href="/products">Browse products</Link></div> : <>
      {error && <p className="checkout-error" role="alert">{error} Check the coupon and cart availability before checkout.</p>}
      {pending && <p role="status">Checking current prices and stock…</p>}
      <div className="checkout-lines">{cart.items.map((line) => {
        const key = `${line.listingId}:${line.skuCode}`, item = quoteByLine.get(key);
        return <article className="checkout-line" key={key}>
          <div><h2>{item?.productName ?? "Product"}</h2><p>Variant/SKU: {line.skuCode}</p>{item ? <p>{money(quote.currency, item.unitPrice)} each</p> : <p>Availability and price need rechecking.</p>}</div>
          <label>Quantity <input type="number" min="1" max="50" value={line.quantity} onChange={(event) => cart.setQuantity(line.listingId, line.skuCode, Number(event.target.value))} /></label>
          {item && <p>Line total: {money(quote.currency, item.lineTotal)}</p>}
          <button type="button" onClick={() => cart.removeItem(line.listingId, line.skuCode)}>Remove</button>
        </article>;
      })}</div>
      <div className="checkout-actions"><label>Coupon code<input value={couponDraft} maxLength="40" onChange={(event) => setCouponDraft(event.target.value.toUpperCase())} /></label><button type="button" onClick={() => cart.setCouponCode(couponDraft)}>Apply coupon</button>{cart.couponCode && <button type="button" onClick={() => { setCouponDraft(""); cart.setCouponCode(""); }}>Remove coupon</button>}</div>
      {quote && !error && <div className="checkout-totals"><p>Subtotal <strong>{money(quote.currency, quote.subtotal)}</strong></p><p>Delivery <strong>{money(quote.currency, quote.delivery)}</strong></p>{Number(quote.discount) > 0 && <p>Coupon {quote.couponCode} <strong>−{money(quote.currency, quote.discount)}</strong></p>}<p>Total <strong>{money(quote.currency, quote.total)}</strong></p></div>}
      <div className="checkout-actions"><Link href="/products">Continue shopping</Link>{quote && !error && <Link className="checkout-primary" href="/checkout">Continue to checkout</Link>}</div>
    </>}
  </section>;
}
