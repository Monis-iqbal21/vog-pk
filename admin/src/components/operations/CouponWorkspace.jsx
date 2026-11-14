"use client";
import { useEffect, useState } from "react";
import { adminMutation } from "@/lib/client-api";

const blank = (currency) => ({ code: "", discountType: "PERCENT", discountValue: "10", minimumOrder: "0", currency, usageLimit: "", startsAt: new Date().toISOString().slice(0, 16), endsAt: new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 16), active: false });
async function request(path) { const response = await fetch(`/api/admin/${path}`, { cache: "no-store" }), data = await response.json(); if (!response.ok) throw new Error(data.message ?? "Coupons could not be loaded."); return data; }
function stamp(value) { return new Date(value).toLocaleString("en-PK", { timeZone: "Asia/Karachi" }); }
function state(row) { const now = Date.now(); if (row.archived) return "Archived"; if (now < new Date(row.startsAt).getTime()) return "Scheduled"; if (now >= new Date(row.endsAt).getTime()) return "Expired"; if (row.usageLimit !== null && row.usageCount >= row.usageLimit) return "Usage limit reached"; return row.active ? "Active" : "Inactive"; }

export default function CouponWorkspace({ contexts }) {
  const [storeId, setStoreId] = useState(contexts[0]?.id ?? ""), [data, setData] = useState(null), [selected, setSelected] = useState(null), [form, setForm] = useState(blank("PKR")), [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false), [refresh, setRefresh] = useState(0);
  const context = contexts.find((item) => item.id === storeId), canManage = context?.permissions.includes("coupons.manage") ?? false, base = `stores/${storeId}/operations/coupons`;
  useEffect(() => { let active = true; if (storeId) request(`${base}?page=1&pageSize=25`).then((value) => { if (active) setData(value); }).catch((cause) => { if (active) setError(cause.message); }); return () => { active = false; }; }, [base, storeId, refresh]);
  function choose(row) { setSelected(row); setForm({ code: row.code, discountType: row.discountType, discountValue: String(row.discountValue), minimumOrder: String(row.minimumOrder), currency: row.currency, usageLimit: row.usageLimit ?? "", startsAt: new Date(row.startsAt).toISOString().slice(0, 16), endsAt: new Date(row.endsAt).toISOString().slice(0, 16), active: row.active }); setError(""); setNotice(""); }
  async function save(event) { event.preventDefault(); if (!canManage) return; setBusy(true); setError(""); setNotice("");
    const body = { ...form, discountValue: form.discountValue, minimumOrder: form.minimumOrder, usageLimit: form.usageLimit === "" ? null : Number(form.usageLimit), startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString() };
    try { const result = selected ? await adminMutation(`${base}/${selected.id}`, { ...body, expectedRevision: selected.revision }, "PATCH") : await adminMutation(base, body); setSelected(result); setNotice("Coupon saved. It will apply only during its active date range and while usage remains."); setRefresh((value) => value + 1); }
    catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  async function archive(row) { setBusy(true); setError(""); try { await adminMutation(`${base}/${row.id}/archive`, { revision: row.revision }); setSelected(null); setForm(blank(data?.currency ?? "PKR")); setNotice("Coupon archived."); setRefresh((value) => value + 1); } catch (cause) { setError(cause.message); } finally { setBusy(false); } }
  return <section className="operations-workspace">
    <h1>Coupons & promotions</h1><p className="muted">Customer coupon codes are separate from approved SKU price promotions. Discounts are revalidated and snapshotted at checkout.</p>
    {contexts.length ? <label>Store<select aria-label="Coupon store" value={storeId} onChange={(event) => { setStoreId(event.target.value); setData(null); setSelected(null); setError(""); }}>
      {contexts.map((item) => <option key={item.id} value={item.id}>{item.tenantName} · {item.name}</option>)}
    </select></label> : <p>You do not have access to store coupons.</p>}
    {error && <p role="alert" className="form-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    <div className="schema-columns"><section className="schema-card"><h2>Store coupons</h2>{data?.rows?.length ? <div className="table-scroll"><table><thead><tr><th>Code</th><th>Discount</th><th>Usage</th><th>State</th></tr></thead><tbody>{data.rows.map((row) => <tr key={row.id}><td><button type="button" onClick={() => choose(row)}>{row.code}</button></td><td>{row.discountType === "PERCENT" ? `${row.discountValue}%` : `${row.currency} ${row.discountValue}`}</td><td>{row.usageCount}{row.usageLimit ? ` / ${row.usageLimit}` : " / unlimited"}</td><td>{state(row)}</td></tr>)}</tbody></table></div> : <p role="status">{data ? "No coupons have been created for this store." : "Loading coupons…"}</p>}</section>
      <form className="schema-card" onSubmit={save}><h2>{selected ? `Edit ${selected.code}` : "Create coupon"}</h2><fieldset disabled={!canManage || busy || Boolean(selected?.archived)}>
        <label>Coupon code<input required minLength="3" maxLength="40" pattern="[A-Za-z0-9_-]+" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} /></label>
        <label>Discount type<select value={form.discountType} onChange={(event) => setForm({ ...form, discountType: event.target.value })}><option value="PERCENT">Percentage</option><option value="FIXED">Fixed amount</option></select></label>
        <label>{form.discountType === "PERCENT" ? "Percent (up to 100)" : `Amount (${form.currency})`}<input type="number" min="0.01" max={form.discountType === "PERCENT" ? "100" : undefined} step="0.01" required value={form.discountValue} onChange={(event) => setForm({ ...form, discountValue: event.target.value })} /></label>
        <label>Minimum order ({form.currency})<input type="number" min="0" step="0.01" required value={form.minimumOrder} onChange={(event) => setForm({ ...form, minimumOrder: event.target.value })} /></label>
        <label>Usage limit (blank for unlimited)<input type="number" min="1" step="1" value={form.usageLimit} onChange={(event) => setForm({ ...form, usageLimit: event.target.value })} /></label>
        <label>Starts<input type="datetime-local" required value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></label><label>Expires<input type="datetime-local" required value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></label>
        <label><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Active during this period</label>
        {canManage && <div className="schema-actions"><button disabled={busy}>{busy ? "Saving…" : selected ? "Save coupon" : "Create coupon"}</button>{selected && !selected.archived && <button type="button" disabled={busy} onClick={() => archive(selected)}>Archive</button>}{selected && <button type="button" onClick={() => { setSelected(null); setForm(blank(data?.currency ?? "PKR")); }}>New coupon</button>}</div>}
      </fieldset>
      {selected && <p className="muted">Created {stamp(selected.createdAt)} · revision {selected.revision}. Archived coupons cannot be reactivated.</p>}
    </form></div>
  </section>;
}
