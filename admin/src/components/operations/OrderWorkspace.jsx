"use client";
import { useEffect, useState } from "react";
import { adminMutation } from "@/lib/client-api";

const states = ["RECEIVED", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
const next = { RECEIVED: ["CONFIRMED", "CANCELLED"], CONFIRMED: ["PROCESSING", "CANCELLED"], PROCESSING: ["SHIPPED", "CANCELLED"], SHIPPED: ["DELIVERED"], DELIVERED: [], CANCELLED: [] };
async function read(path) { const response = await fetch(`/api/admin/${path}`, { cache: "no-store" }), value = await response.json(); if (!response.ok) throw new Error(value.message ?? "Orders could not be loaded."); return value; }
const money = (currency, value) => `${currency} ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 }).format(Number(value))}`;

export default function OrderWorkspace({ contexts }) {
  const [storeId, setStoreId] = useState(contexts[0]?.id ?? ""), [filter, setFilter] = useState(""), [search, setSearch] = useState(""), [data, setData] = useState(null), [order, setOrder] = useState(null), [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false), [refresh, setRefresh] = useState(0);
  const context = contexts.find((item) => item.id === storeId), canManage = context?.permissions.includes("orders.manage") ?? false, base = `stores/${storeId}/operations/orders`;
  useEffect(() => { let active = true; if (storeId) { const query = new URLSearchParams({ page: "1", pageSize: "25", ...(filter ? { status: filter } : {}), ...(search ? { search } : {}) }); read(`${base}?${query}`).then((value) => { if (active) setData(value); }).catch((cause) => { if (active) setError(cause.message); }); } return () => { active = false; }; }, [base, storeId, filter, search, refresh]);
  async function choose(row) { setError(""); try { const value = await read(`${base}/${row.id}`); setOrder(value); } catch (cause) { setError(cause.message); } }
  async function transition(status) { if (!order || !canManage) return; setBusy(true); setError(""); setNotice(""); try { const saved = await adminMutation(`${base}/${order.id}/status`, { expectedRevision: order.revision, status }, "PATCH"); setOrder({ ...order, ...saved }); setNotice(`Order moved to ${status.toLowerCase()}.`); setRefresh((value) => value + 1); } catch (cause) { setError(cause.message); } finally { setBusy(false); } }
  return <section className="operations-workspace">
    <h1>Orders</h1><p className="muted">Manage store orders and fulfillment. Payment status is separate; no payment confirmation or refund action is available here.</p>
    {contexts.length ? <label>Store<select aria-label="Order store" value={storeId} onChange={(event) => { setStoreId(event.target.value); setData(null); setOrder(null); setError(""); }}>
      {contexts.map((item) => <option key={item.id} value={item.id}>{item.tenantName} · {item.name}</option>)}
    </select></label> : <p>You do not have access to store orders.</p>}
    {error && <p role="alert" className="form-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    <div className="schema-columns"><section className="schema-card"><h2>Store orders</h2><label>Search order number or phone<input value={search} onChange={(event) => setSearch(event.target.value)} /></label><label>Status<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">All statuses</option>{states.map((status) => <option key={status}>{status}</option>)}</select></label>
      {data?.rows?.length ? <div className="table-scroll"><table><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Total</th></tr></thead><tbody>{data.rows.map((row) => <tr key={row.id}><td><button type="button" onClick={() => choose(row)}>{row.orderNumber}</button></td><td>{row.customerName}</td><td>{row.status}</td><td>{money(row.currency, row.total)}</td></tr>)}</tbody></table></div> : <p role="status">{data ? "No orders match this filter." : "Loading orders…"}</p>}
    </section>
    <section className="schema-card"><h2>Order details</h2>{order ? <>
      <dl><dt>Order number</dt><dd>{order.orderNumber}</dd><dt>Customer</dt><dd>{order.customerName}</dd><dt>Phone</dt><dd>{order.phone}</dd><dt>Delivery</dt><dd>{order.address}, {order.city}, Pakistan</dd><dt>Order status</dt><dd>{order.status}</dd><dt>Payment</dt><dd>{order.paymentMethod} · {order.paymentStatus}</dd><dt>Subtotal</dt><dd>{money(order.currency, order.subtotal)}</dd><dt>Coupon discount</dt><dd>{order.couponCode ? `${order.couponCode} · ${money(order.currency, order.discount)}` : "None"}</dd><dt>Total</dt><dd>{money(order.currency, order.total)}</dd></dl>
      <h3>Items</h3><ul>{order.items.map((item) => <li key={item.id}>{item.productName} · {item.variantName} ({item.skuCode}) × {item.quantity} — {money(order.currency, item.lineTotal)}</li>)}</ul>
      {canManage && next[order.status]?.length > 0 && <div className="schema-actions">{next[order.status].map((status) => <button type="button" key={status} disabled={busy} onClick={() => transition(status)}>{status === "CANCELLED" ? "Cancel order and release reserved stock" : `Mark ${status.toLowerCase()}`}</button>)}</div>}
      <p className="muted">Order and price snapshots are preserved. COD remains unpaid until a separately verified payment event.</p>
    </> : <p>Select an order to inspect its delivery, payment, snapshot and fulfillment details.</p>}</section></div>
  </section>;
}
