"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

const KEY = "vogpk-cart-v1";
const CartContext = createContext(null);
const emptySnapshot = Object.freeze({ items: [], ready: false });
let snapshot = emptySnapshot;
const listeners = new Set();
function publish(items, ready = true) {
  snapshot = { items: clean(items), ready };
  if (ready) localStorage.setItem(KEY, JSON.stringify(snapshot.items));
  listeners.forEach((listener) => listener());
}
function subscribe(listener) {
  listeners.add(listener);
  const syncStorage = (event) => { if (event.key === KEY) { try { snapshot = { items: clean(JSON.parse(event.newValue ?? "[]")), ready: true }; } catch { snapshot = { items: [], ready: true }; } listeners.forEach((notify) => notify()); } };
  window.addEventListener("storage", syncStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", syncStorage); };
}
const idPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const skuPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;

function clean(items) {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => item && idPattern.test(item.listingId) && skuPattern.test(item.skuCode) && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 50)
    .map(({ listingId, skuCode, quantity }) => ({ listingId, skuCode, quantity }));
}

export function CartProvider({ children }) {
  const state = useSyncExternalStore(subscribe, () => snapshot, () => emptySnapshot);
  const { items, ready } = state;
  useEffect(() => {
    if (snapshot.ready) return;
    try { publish(JSON.parse(localStorage.getItem(KEY) ?? "[]")); } catch { publish([]); }
  }, []);
  const addItem = useCallback((incoming) => {
    const line = clean([incoming])[0];
    if (!line) return;
    const next = (() => {
      const current = snapshot.items;
      const found = current.find((item) => item.listingId === line.listingId && item.skuCode === line.skuCode);
      return found ? current.map((item) => item === found ? { ...item, quantity: Math.min(50, item.quantity + line.quantity) } : item) : [...current, line];
    })();
    publish(next);
  }, []);
  const setQuantity = useCallback((listingId, skuCode, quantity) => {
    if (!Number.isInteger(quantity) || quantity < 1) {
      publish(snapshot.items.filter((item) => item.listingId !== listingId || item.skuCode !== skuCode));
      return;
    }
    publish(snapshot.items.map((item) => item.listingId === listingId && item.skuCode === skuCode ? { ...item, quantity: Math.min(50, quantity) } : item));
  }, []);
  const removeItem = useCallback((listingId, skuCode) => publish(snapshot.items.filter((item) => item.listingId !== listingId || item.skuCode !== skuCode)), []);
  const clear = useCallback(() => publish([]), []);
  const value = useMemo(() => ({ items, ready, addItem, setQuantity, removeItem, clear, itemCount: items.reduce((sum, item) => sum + item.quantity, 0) }), [items, ready, addItem, setQuantity, removeItem, clear]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider.");
  return value;
}
