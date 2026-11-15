"use client";
import { useEffect, useState } from "react";

async function read(path) { const response = await fetch(`/api/admin/${path}`, { cache: "no-store" }), value = await response.json(); if (!response.ok) throw new Error(value.message ?? "Store metrics could not be loaded."); return value; }
export default function StoreDashboard({ contexts, user }) {
  const stores = contexts.filter((item) => item.permissions.includes("dashboard.view")), [storeId, setStoreId] = useState(stores[0]?.id ?? ""), [metrics, setMetrics] = useState(null), [error, setError] = useState("");
  useEffect(() => { let active = true; if (storeId) read(`stores/${storeId}/operations/dashboard`).then((value) => { if (active) setMetrics(value); }).catch((cause) => { if (active) setError(cause.message); }); return () => { active = false; }; }, [storeId]);
  const selected = stores.find((item) => item.id === storeId);
  return <><div className="page-intro"><h1>Welcome, {user.name}</h1><p className="muted">Store operations overview. Metrics include only records available in your authorized context.</p><div className="role-list">{user.roles.map((role) => <span key={role.code}>{role.name}</span>)}</div></div>
    {stores.length > 1 && <label>Store<select aria-label="Dashboard store" value={storeId} onChange={(event) => { setStoreId(event.target.value); setMetrics(null); setError(""); }}>{stores.map((item) => <option key={item.id} value={item.id}>{item.tenantName} · {item.name}</option>)}</select></label>}
    {error && <p role="alert" className="form-error">{error}</p>}{!selected && <p role="status">No store context is available for dashboard metrics.</p>}
    {selected && !metrics && !error && <p role="status">Loading authorized store metrics…</p>}
    {metrics && <><h2>{metrics.store.name}</h2><section className="quick-grid" aria-label="Store metrics">
      {[['Orders', metrics.orders], ['Orders needing fulfillment', metrics.pendingOrders], ['Published listings', metrics.publishedListings], ['Verified stock balances', metrics.verifiedStockBalances]].map(([label, value]) => <article className="schema-card" key={label}><h3>{label}</h3><p className="metric-value">{value}</p></article>)}
    </section><section className="metrics-empty"><h2>Inventory status</h2>{metrics.quantityInventoryItems === 0 ? <p>No quantity-tracked inventory records exist for this store.</p> : metrics.verifiedStockBalances === 0 ? <p>Inventory records exist, but no active stock balances are verified yet.</p> : <p>{metrics.verifiedStockBalances} active balances have known stock. Unknown stock is excluded.</p>}{metrics.orders === 0 && <p>No orders have been received for this store.</p>}<p className="muted">Revenue is not shown until paid sales can be verified. COD orders are not counted as paid revenue.</p></section></>}
  </>;
}
