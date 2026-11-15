"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const money = (currency, value) => `${currency} ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 }).format(Number(value))}`;

export default function OrderReceipt({ orderNumber }) {
  const [receipt, setReceipt] = useState(null), [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const receiptToken = sessionStorage.getItem(`vogpk-receipt:${orderNumber}`);
    if (!receiptToken) { const timer = setTimeout(() => { if (active) setError("This receipt is available only in the browser session that placed the order."); }, 0); return () => { active = false; clearTimeout(timer); }; }
    fetch("/api/checkout/receipt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderNumber, receiptToken }) })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.message ?? "Receipt could not be loaded."); return data; })
      .then((data) => { if (active) setReceipt(data); })
      .catch((cause) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [orderNumber]);
  return <section className="container checkout-page" aria-live="polite">
    <h1>Order confirmation</h1><p>Your order number is <strong>{orderNumber}</strong>.</p>
    {!receipt && !error && <p role="status">Loading your receipt…</p>}
    {error && <p className="checkout-error" role="alert">{error}</p>}
    {receipt && <><p>Thank you, {receipt.customerName}. Your Cash on Delivery order is <strong>{receipt.status.toLowerCase()}</strong>; payment is <strong>{receipt.paymentStatus.toLowerCase()}</strong>.</p>
      <h2>Delivery</h2><p>{receipt.phone}<br />{receipt.address}<br />{receipt.city}, Pakistan</p>
      <h2>Items</h2><ul>{receipt.items.map((item, index) => <li key={`${item.skuCode}-${index}`}>{item.productName} · {item.variantName} ({item.skuCode}) × {item.quantity} — {money(receipt.currency, item.lineTotal)}</li>)}</ul>
      <p>Subtotal: {money(receipt.currency, receipt.subtotal)}{receipt.couponCode ? ` · Coupon ${receipt.couponCode} −${money(receipt.currency, receipt.discount)}` : ""} · Total: {money(receipt.currency, receipt.total)}</p>
    </>}
    <Link href="/">Return to store</Link>
  </section>;
}
