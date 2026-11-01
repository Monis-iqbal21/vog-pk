"use client";
import { useEffect, useState } from "react";
import { TextField, SelectField } from "../schema/SchemaFields";
import { read } from "../categories/fields";
import { adminMutation } from "@/lib/client-api";
const blankPrice = (currency) => ({
  currency,
  regularAmount: "",
  validFrom: null,
  validUntil: null,
  promotions: [],
});
function PricePanel({ base, permissions, onChanged }) {
  const has = (p) => permissions.includes(p),
    [data, setData] = useState(null),
    [row, setRow] = useState(null),
    [dirty, setDirty] = useState(false),
    [form, setForm] = useState(null),
    [page, setPage] = useState(1),
    [tick, setTick] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    read(`${base}/prices?page=${page}`)
      .then((d) => {
        if (current) {
          setData(d);
          setForm((f) => f ?? blankPrice(d.currency));
        }
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [base, page, tick]);
  async function run(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
      setTick((t) => t + 1);
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function selected(r) {
    setDirty(false);
    setRow(r);
    setForm({
      currency: r.currency,
      regularAmount: r.regularAmount,
      validFrom: r.validFrom,
      validUntil: r.validUntil,
      promotions: r.promotions.map((p) => ({
        label: p.label,
        amount: p.amount,
        startsAt: p.startsAt,
        endsAt: p.endsAt,
      })),
    });
  }
  if (!data || !form)
    return (
      <p role={error ? "alert" : "status"}>
        {error || "Loading store prices…"}
      </p>
    );
  const editable = has("pricing.propose") && (!row || row.status === "DRAFT");
  const set = (k, v) => {
    setForm({ ...form, [k]: v });
    setDirty(true);
  };
  return (
    <section className="schema-card">
      <h3>SKU prices</h3>
      <p role="alert" className="form-error">
        {error}
      </p>
      <p>
        Currency: {data.currency}. Current approved offer:{" "}
        {data.effectiveOffer
          ? `${data.effectiveOffer.currency} ${data.effectiveOffer.sellingAmount}`
          : "None"}
        .
      </p>
      <p className="muted">
        Prices are independent of catalog drafts. Purchasing is disabled. Enter
        scheduling times with an explicit UTC offset, for example
        2026-11-01T09:00:00+05:00.
      </p>
      <div className="schema-actions">
        <button
          disabled={!has("pricing.propose") || busy}
          onClick={() => {
            setRow(null);
            setForm(blankPrice(data.currency));
          }}
        >
          New price proposal
        </button>
        {row && row.status !== "DRAFT" && (
          <button
            disabled={!has("pricing.propose") || busy}
            onClick={() => setRow(null)}
          >
            Copy price as new proposal
          </button>
        )}
      </div>
      {row && (
        <p role="status">
          Price version {row.number} · {row.status} · Revision {row.revision}
        </p>
      )}
      <fieldset disabled={!editable || busy}>
        <legend>Price proposal</legend>
        <TextField
          label="Regular selling amount"
          inputMode="decimal"
          value={form.regularAmount}
          onChange={(v) => set("regularAmount", v)}
        />
        <div className="schema-grid">
          <TextField
            label="Offer start (ISO offset, optional)"
            value={form.validFrom ?? ""}
            onChange={(v) => set("validFrom", v || null)}
          />
          <TextField
            label="Offer expiry (ISO offset, optional)"
            value={form.validUntil ?? ""}
            onChange={(v) => set("validUntil", v || null)}
          />
        </div>
        {form.promotions.map((p, i) => (
          <fieldset key={i}>
            <legend>Promotion {i + 1}</legend>
            {[
              ["label", "Promotion label"],
              ["amount", "Sale amount"],
              ["startsAt", "Sale start (ISO offset)"],
              ["endsAt", "Sale end (ISO offset)"],
            ].map(([k, label]) => (
              <TextField
                key={k}
                label={`${label} ${i + 1}`}
                value={p[k]}
                onChange={(v) =>
                  set(
                    "promotions",
                    form.promotions.map((n, j) =>
                      j === i ? { ...n, [k]: v } : n,
                    ),
                  )
                }
              />
            ))}
            <button
              type="button"
              onClick={() =>
                set(
                  "promotions",
                  form.promotions.filter((_, n) => n !== i),
                )
              }
            >
              Remove promotion {i + 1}
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          disabled={form.promotions.length >= 8}
          onClick={() =>
            set("promotions", [
              ...form.promotions,
              { label: "", amount: "", startsAt: "", endsAt: "" },
            ])
          }
        >
          Add scheduled promotion
        </button>
      </fieldset>
      <div className="schema-actions">
        <button
          disabled={!editable || busy}
          onClick={() =>
            run(async () =>
              selected(
                await adminMutation(
                  `${base}/prices${row ? `/${row.id}` : ""}`,
                  { ...form, ...(row ? { revision: row.revision } : {}) },
                  row ? "PATCH" : "POST",
                ),
              ),
            )
          }
        >
          Save price proposal
        </button>
        {row &&
          [
            ["review", "DRAFT", "pricing.propose"],
            ["draft", "IN_REVIEW", "pricing.propose"],
            ["approve", "IN_REVIEW", "pricing.approve"],
            ["publish", "APPROVED", "pricing.publish"],
            [
              "archive",
              "DRAFT IN_REVIEW APPROVED PUBLISHED",
              "pricing.archive",
            ],
          ]
            .filter(
              ([, states, p]) =>
                states.split(" ").includes(row.status) && has(p),
            )
            .map(([a]) => (
              <button
                key={a}
                disabled={busy || dirty}
                onClick={() =>
                  run(async () =>
                    selected(
                      await adminMutation(
                        `${base}/prices/${row.id}/actions/${a}`,
                        {
                          revision: row.revision,
                          rootRevision: data.root?.revision ?? 1,
                        },
                      ),
                    ),
                  )
                }
              >
                {a[0].toUpperCase() + a.slice(1)} price
              </button>
            ))}
      </div>
      <h4>Price history</h4>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Version</th>
              <th>State</th>
              <th>Regular price</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((r) => (
              <tr key={r.id}>
                <td>{r.number}</td>
                <td>{r.status}</td>
                <td>
                  {r.currency} {r.regularAmount}
                </td>
                <td>
                  <button onClick={() => selected(r)}>
                    Open price {r.number}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="schema-actions">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Previous prices
        </button>
        <span>
          Page {page} · {data.total} revisions
        </span>
        <button
          disabled={page * 12 >= data.total}
          onClick={() => setPage(page + 1)}
        >
          Next prices
        </button>
      </div>
    </section>
  );
}
function InventoryPanel({ base, storeBase, permissions, onChanged }) {
  const has = (p) => permissions.includes(p),
    [data, setData] = useState(null),
    [locations, setLocations] = useState([]),
    [location, setLocation] = useState(""),
    [policy, setPolicy] = useState("UNTRACKED"),
    [threshold, setThreshold] = useState(""),
    [mode, setMode] = useState("COUNT"),
    [quantity, setQuantity] = useState(""),
    [reason, setReason] = useState(""),
    [key, setKey] = useState(() => crypto.randomUUID()),
    [tick, setTick] = useState(0),
    [page, setPage] = useState(1),
    [history, setHistory] = useState({ items: [], total: 0 }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [newLocation, setNewLocation] = useState({
      code: "",
      name: "",
      isDefault: false,
    });
  useEffect(() => {
    let current = true;
    Promise.all([
      read(base + "/inventory"),
      read(storeBase + "/locations"),
      has("inventory.audit")
        ? read(`${base}/inventory/history?page=${page}`)
        : Promise.resolve({ items: [], total: 0 }),
    ])
      .then(([d, l, h]) => {
        if (current) {
          setData(d);
          setPolicy(d.item?.policy ?? "UNTRACKED");
          setThreshold(d.item?.lowStockThreshold ?? "");
          setLocations(l);
          setLocation(
            (v) => v || l.find((n) => n.isDefault)?.id || l[0]?.id || "",
          );
          setHistory(h);
        }
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
    // Permissions are fixed for this keyed store mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, storeBase, page, tick]);
  async function run(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
      setTick((t) => t + 1);
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <p role={error ? "alert" : "status"}>
        {error || "Loading store inventory…"}
      </p>
    );
  const balance = data.item?.balances.find((b) => b.locationId === location),
    summary = data.summary;
  return (
    <section className="schema-card">
      <h3>SKU inventory</h3>
      <p role="alert" className="form-error">
        {error}
      </p>
      <p role="status">
        Stock:{" "}
        {summary.known
          ? summary.quantity === null
            ? summary.status
            : summary.quantity
          : "Unknown"}{" "}
        · {summary.policy}
        {summary.lowStock ? " · Low stock" : ""}
      </p>
      <fieldset disabled={!has("inventory.configure") || busy}>
        <legend>Inventory policy</legend>
        <SelectField
          label="Inventory policy"
          value={policy}
          onChange={setPolicy}
        >
          {["QUANTITY", "SERIALIZED", "NON_STOCK", "UNTRACKED"].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </SelectField>
        <TextField
          label="Low-stock threshold (optional)"
          type="number"
          min="0"
          value={threshold}
          onChange={setThreshold}
        />
        <button
          onClick={() =>
            run(async () =>
              adminMutation(
                base + "/inventory",
                {
                  revision: data.item?.revision ?? 0,
                  policy,
                  lowStockThreshold:
                    threshold === "" ? null : Number(threshold),
                },
                "PATCH",
              ),
            )
          }
        >
          Save inventory policy
        </button>
      </fieldset>
      <p className="muted">
        Only quantity adjustments are implemented. Serialized stock is
        unverified; untracked stock is unknown. No reservations or checkout
        deductions exist.
      </p>
      <SelectField
        label="Inventory location"
        value={location}
        onChange={(v) => {
          setLocation(v);
          setKey(crypto.randomUUID());
        }}
      >
        <option value="">Select location</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
            {l.isDefault ? " (default)" : ""}
          </option>
        ))}
      </SelectField>
      {has("inventory.configure") && (
        <fieldset disabled={busy}>
          <legend>Locations</legend>
          {!locations.length ? (
            <button
              onClick={() =>
                run(async () => {
                  const l = await adminMutation(storeBase + "/locations", {
                    code: "main",
                    name: "Default inventory location",
                    isDefault: true,
                  });
                  setLocation(l.id);
                })
              }
            >
              Create default location
            </button>
          ) : (
            <>
              <TextField
                label="New location code"
                value={newLocation.code}
                onChange={(v) => setNewLocation({ ...newLocation, code: v })}
              />
              <TextField
                label="New location name"
                value={newLocation.name}
                onChange={(v) => setNewLocation({ ...newLocation, name: v })}
              />
              <button
                onClick={() =>
                  run(async () => {
                    await adminMutation(storeBase + "/locations", newLocation);
                    setNewLocation({ code: "", name: "", isDefault: false });
                  })
                }
              >
                Add inventory location
              </button>
            </>
          )}
        </fieldset>
      )}
      <fieldset
        disabled={
          !has("inventory.adjust") ||
          busy ||
          data.item?.policy !== "QUANTITY" ||
          !location
        }
      >
        <legend>Audited stock adjustment</legend>
        <p>
          Selected location: {balance?.known ? balance.onHand : "Unknown"} ·
          Revision {balance?.revision ?? 0}.
        </p>
        <SelectField
          label="Adjustment mode"
          value={mode}
          onChange={(v) => {
            setMode(v);
            setQuantity(v === "INVALIDATE" ? "0" : "");
            setKey(crypto.randomUUID());
          }}
        >
          <option value="COUNT">Verified physical count</option>
          <option value="DELTA">Quantity correction</option>
          <option value="INVALIDATE">Mark verification unknown</option>
        </SelectField>
        <TextField
          label="Adjustment quantity"
          type="number"
          value={quantity}
          disabled={mode === "INVALIDATE"}
          onChange={(v) => {
            setQuantity(v);
            setKey(crypto.randomUUID());
          }}
        />
        <TextField
          label="Adjustment reason"
          value={reason}
          onChange={(v) => {
            setReason(v);
            setKey(crypto.randomUUID());
          }}
        />
        <button
          onClick={() =>
            run(async () => {
              if (quantity === "")
                throw new Error(
                  "Enter an explicit adjustment quantity. Zero must be entered deliberately.",
                );
              await adminMutation(base + "/inventory/adjustments", {
                locationId: location,
                expectedRevision: balance?.revision ?? 0,
                idempotencyKey: key,
                mode,
                quantity: Number(quantity),
                reason,
              });
              setKey(crypto.randomUUID());
              setQuantity("");
              setReason("");
            })
          }
        >
          Record stock adjustment
        </button>
      </fieldset>
      {has("inventory.audit") && (
        <>
          <h4>Inventory history</h4>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Mode</th>
                  <th>Before</th>
                  <th>After</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {history.items.map((m) => (
                  <tr key={m.id}>
                    <td>{m.mode}</td>
                    <td>{m.beforeKnown ? m.beforeQuantity : "Unknown"}</td>
                    <td>{m.afterKnown ? m.afterQuantity : "Unknown"}</td>
                    <td>{m.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="schema-actions">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous movements
            </button>
            <span>
              Page {page} · {history.total} movements
            </span>
            <button
              disabled={page * 12 >= history.total}
              onClick={() => setPage(page + 1)}
            >
              Next movements
            </button>
          </div>
        </>
      )}
    </section>
  );
}
function CurrencyPanel({ base, permissions, onChanged }) {
  const [settings, setSettings] = useState(null),
    [draft, setDraft] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    read(base + "/settings")
      .then((s) => {
        if (active) {
          setSettings(s);
          setDraft(s);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [base]);
  return (
    <details>
      <summary>Store currency and timezone</summary>
      <p role="alert">{error}</p>
      {draft && (
        <fieldset disabled={!permissions.includes("pricing.configure")}>
          <TextField
            label="Store ISO currency"
            value={draft.currency}
            onChange={(v) => setDraft({ ...draft, currency: v })}
          />
          <TextField
            label="Store IANA timezone"
            value={draft.timeZone}
            onChange={(v) => setDraft({ ...draft, timeZone: v })}
          />
          <button
            onClick={async () => {
              try {
                const s = await adminMutation(
                  base + "/settings",
                  {
                    ...draft,
                    expectedCurrency: settings.currency,
                    expectedTimeZone: settings.timeZone,
                  },
                  "PATCH",
                );
                setSettings(s);
                setDraft(s);
                setError("");
                onChanged();
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            Save store currency
          </button>
        </fieldset>
      )}
    </details>
  );
}
function SkuOverview({ base, skus, permissions, refresh, onSelect }) {
  const [page, setPage] = useState(1),
    [data, setData] = useState(null),
    [error, setError] = useState("");
  const canPrice = permissions.includes("pricing.view"),
    canStock = permissions.includes("inventory.view");
  useEffect(() => {
    let active = true;
    Promise.all(
      skus.slice((page - 1) * 4, page * 4).map(async (s) => {
        const [price, stock] = await Promise.all([
          canPrice ? read(`${base}/skus/${s.skuId}/prices?pageSize=1`) : null,
          canStock ? read(`${base}/skus/${s.skuId}/inventory`) : null,
        ]);
        return {
          id: s.skuId,
          code: s.sku.code,
          price: price?.effectiveOffer,
          stock: stock?.summary,
        };
      }),
    )
      .then((rows) => {
        if (active) {
          setData({ page, refresh, rows });
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [base, skus, canPrice, canStock, page, refresh]);
  return (
    <section>
      <h3>SKU price and stock overview</h3>
      <p className="muted">
        Approved offers and verified inventory only. Purchasing is disabled.
      </p>
      {error && <p role="alert">{error}</p>}
      {data?.page === page && data?.refresh === refresh ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                {canPrice && <th>Current approved offer</th>}
                {canStock && <th>Stock</th>}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <button onClick={() => onSelect(r.id)}>{r.code}</button>
                  </td>
                  {canPrice && (
                    <td>
                      {r.price
                        ? `${r.price.currency} ${r.price.sellingAmount}`
                        : "No current approved offer"}
                    </td>
                  )}
                  {canStock && (
                    <td>
                      {r.stock?.known
                        ? (r.stock.quantity ?? r.stock.status)
                        : "Unknown"}
                      {r.stock?.lowStock ? " · Low stock" : ""}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p role="status">Loading SKU overview…</p>
      )}
      <div className="schema-actions">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Previous operational SKUs
        </button>
        <span>Page {page}</span>
        <button
          disabled={page * 4 >= skus.length}
          onClick={() => setPage(page + 1)}
        >
          Next operational SKUs
        </button>
      </div>
    </section>
  );
}
function SelectedStore({ store, skus }) {
  const [skuId, setSkuId] = useState(skus[0]?.skuId ?? ""),
    [refresh, setRefresh] = useState(0),
    [settingsRevision, setSettingsRevision] = useState(0),
    permissions = store.permissions,
    base = `stores/${store.id}/operations`;
  return (
    <>
      <SkuOverview
        base={base}
        skus={skus}
        permissions={permissions}
        refresh={refresh}
        onSelect={setSkuId}
      />
      <SelectField label="Operational SKU" value={skuId} onChange={setSkuId}>
        {skus.map((s) => (
          <option key={s.skuId} value={s.skuId}>
            {s.sku.code}
          </option>
        ))}
      </SelectField>
      {permissions.includes("pricing.view") && (
        <CurrencyPanel
          base={base}
          permissions={permissions}
          onChanged={() => {
            setSettingsRevision((r) => r + 1);
            setRefresh((r) => r + 1);
          }}
        />
      )}
      <div className="schema-columns">
        {skuId && permissions.includes("pricing.view") && (
          <PricePanel
            key={`p-${skuId}-${settingsRevision}`}
            base={`${base}/skus/${skuId}`}
            permissions={permissions}
            onChanged={() => setRefresh((r) => r + 1)}
          />
        )}{" "}
        {skuId && permissions.includes("inventory.view") && (
          <InventoryPanel
            key={`i-${skuId}`}
            base={`${base}/skus/${skuId}`}
            storeBase={base}
            permissions={permissions}
            onChanged={() => setRefresh((r) => r + 1)}
          />
        )}
      </div>
    </>
  );
}
export default function OperationsPane({ stores, skus }) {
  const [storeId, setStoreId] = useState(stores[0]?.id ?? ""),
    store = stores.find((s) => s.id === storeId);
  if (!skus.length)
    return (
      <p>
        Save an explicit SKU before configuring store offers or quantity
        inventory.
      </p>
    );
  return (
    <section className="schema-card">
      <h2>Store pricing & inventory</h2>
      <SelectField
        label="Operational store"
        value={storeId}
        onChange={setStoreId}
      >
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </SelectField>
      {store ? (
        <SelectedStore key={store.id} store={store} skus={skus} />
      ) : (
        <p>
          No authorized operational store. Store pricing or inventory read
          permission is required.
        </p>
      )}
    </section>
  );
}
