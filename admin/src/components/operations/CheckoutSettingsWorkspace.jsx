"use client";
import { useEffect, useState } from "react";
import { adminMutation } from "@/lib/client-api";

async function read(path) {
  const response = await fetch("/api/admin/" + path, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message ?? "Settings could not be loaded.");
  return data;
}

export default function CheckoutSettingsWorkspace({ contexts }) {
  const [storeId, setStoreId] = useState(contexts[0]?.id ?? "");
  const [loaded, setLoaded] = useState(null);
  const [codChoice, setCodChoice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loadFailure, setLoadFailure] = useState(null);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const selected = contexts.find((context) => context.id === storeId);
  const canManage = selected?.permissions.includes("settings.manage") ?? false;
  const settings = loaded?.storeId === storeId ? loaded.value : null;
  const codEnabled = codChoice?.storeId === storeId ? codChoice.value : (settings?.codEnabled ?? false);
  const error = actionError || (loadFailure?.storeId === storeId ? loadFailure.message : "");

  useEffect(() => {
    let active = true;
    if (storeId) read(`stores/${storeId}/operations/checkout-settings`).then((value) => {
      if (active) setLoaded({ storeId, value });
    }).catch((cause) => { if (active) setLoadFailure({ storeId, message: cause.message }); });
    return () => { active = false; };
  }, [storeId]);

  async function save(event) {
    event.preventDefault();
    if (!settings || !canManage) return;
    setBusy(true); setActionError(""); setNotice("");
    try {
      const saved = await adminMutation(`stores/${storeId}/operations/checkout-settings`, {
        expectedRevision: settings.revision,
        codEnabled,
        cardEnabled: false,
      }, "PATCH");
      setLoaded({ storeId, value: saved }); setCodChoice({ storeId, value: saved.codEnabled }); setNotice("Checkout settings saved for this store.");
    } catch (cause) { setActionError(cause.message); }
    finally { setBusy(false); }
  }

  return <section className="operations-workspace">
    <h1>Checkout settings</h1>
    <p className="muted">Choose which payment methods customers can use at this store. Card payments stay unavailable until a verified payment gateway is configured.</p>
    {contexts.length ? <label>Store
      <select value={storeId} onChange={(event) => setStoreId(event.target.value)} aria-label="Store checkout settings">
        {contexts.map((context) => <option key={context.id} value={context.id}>{context.tenantName} · {context.name}</option>)}
      </select>
    </label> : <p>You do not have access to checkout settings for a store.</p>}
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {settings && <form onSubmit={save}>
      <fieldset disabled={busy || !canManage}>
        <legend>Payment methods</legend>
        <label><input type="checkbox" checked={codEnabled} onChange={(event) => setCodChoice({ storeId, value: event.target.checked })} /> Cash on Delivery</label>
        <label><input type="checkbox" checked={false} disabled /> Card payment</label>
        <p className="muted">{settings.cardReason}</p>
      </fieldset>
      {canManage && <button type="submit" disabled={busy || codEnabled === settings.codEnabled}>{busy ? "Saving…" : "Save checkout settings"}</button>}
    </form>}
  </section>;
}
