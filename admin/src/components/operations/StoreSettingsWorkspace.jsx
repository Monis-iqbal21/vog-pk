"use client";
import { useEffect, useState } from "react";
import { adminMutation } from "@/lib/client-api";
import CheckoutSettingsWorkspace from "./CheckoutSettingsWorkspace";

async function read(path) {
  const response = await fetch(`/api/admin/${path}`, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message ?? "Store settings could not be loaded.");
  return data;
}

export default function StoreSettingsWorkspace({ contexts }) {
  const [storeId, setStoreId] = useState(contexts[0]?.id ?? ""), [loaded, setLoaded] = useState(null), [form, setForm] = useState(null), [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
  const context = contexts.find((item) => item.id === storeId), settings = loaded?.id === storeId ? loaded : null, canManage = context?.permissions.includes("settings.manage") ?? false;
  useEffect(() => {
    let active = true;
    if (storeId) read(`stores/${storeId}/operations/store-settings`).then((value) => { if (active) { setLoaded(value); setForm(value); } }).catch((cause) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [storeId]);
  async function save(event) {
    event.preventDefault(); if (!settings || !canManage) return;
    setBusy(true); setError(""); setNotice("");
    try { const value = await adminMutation(`stores/${storeId}/operations/store-settings`, { expectedRevision: settings.revision, name: form.name, locale: form.locale, timeZone: form.timeZone }, "PATCH"); setLoaded(value); setForm(value); setNotice("Store settings saved."); }
    catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  return <section className="operations-workspace">
    <h1>Store settings</h1>
    {contexts.length ? <label>Store<select aria-label="Store settings context" value={storeId} onChange={(event) => { setStoreId(event.target.value); setLoaded(null); setForm(null); setError(""); }}>
      {contexts.map((item) => <option key={item.id} value={item.id}>{item.tenantName} · {item.name}</option>)}
    </select></label> : <p>You do not have access to store settings.</p>}
    {error && <p role="alert" className="form-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    {!settings && storeId && <p role="status">Loading store settings…</p>}
    {form && <form className="schema-card" onSubmit={save}><fieldset disabled={!canManage || busy}>
      <legend>Store profile</legend>
      <label>Store name<input required maxLength="160" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label>Locale<input required pattern="[a-z]{2,3}(-[A-Z]{2})?" value={form.locale} onChange={(event) => setForm({ ...form, locale: event.target.value })} /></label>
      <label>Time zone<input required maxLength="80" value={form.timeZone} onChange={(event) => setForm({ ...form, timeZone: event.target.value })} /><small>Use an IANA zone, for example Asia/Karachi.</small></label>
      <label>Store URL slug<input value={form.slug} readOnly /></label><label>Currency<input value={form.currency} readOnly /></label>
      {canManage && <button type="submit" disabled={busy || !settings || (form.name === settings.name && form.locale === settings.locale && form.timeZone === settings.timeZone)}>{busy ? "Saving…" : "Save store profile"}</button>}
    </fieldset></form>}
    {context && <CheckoutSettingsWorkspace contexts={[context]} />}
  </section>;
}
