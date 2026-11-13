"use client";
import { useEffect, useState } from "react";

export function useCheckoutQuote(items, ready) {
  const [result, setResult] = useState(null);
  const key = JSON.stringify(items);
  useEffect(() => {
    let active = true;
    if (!ready || !items.length) return () => { active = false; };
    fetch("/api/checkout/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }), cache: "no-store" })
      .then(async (response) => { const value = await response.json(); if (!response.ok) throw new Error(value.message ?? "Some cart items are no longer available."); return value; })
      .then((value) => { if (active) setResult({ key, quote: value, error: "" }); })
      .catch((cause) => { if (active) setResult({ key, quote: null, error: cause.message }); });
    return () => { active = false; };
  }, [items, key, ready]);
  const current = result?.key === key && ready && items.length > 0;
  return { quote: current ? result.quote : null, pending: ready && items.length > 0 && !current, error: current ? result.error : "" };
}
