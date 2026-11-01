"use client";
import { useEffect, useState } from "react";
import { adminMutation } from "@/lib/client-api";
import { TextField, SelectField, CheckField } from "../schema/SchemaFields";
import { read } from "../categories/fields";
import ValueFields, { valuesFrom } from "./ValueFields";
import OperationsPane from "../operations/OperationsPane";
import MediaPanel from "../operations/MediaPanel";
const empty = {
  code: "",
  name: "",
  slug: "",
  schemaVersionId: "",
  description: "",
  brandId: null,
  content: [],
  sellingMode: "REFERENCE",
  axisIds: [],
  values: [],
  skus: [],
};
const fromRow = (r, code) => ({
  code,
  name: r.name,
  slug: r.slug,
  schemaVersionId: r.schemaVersionId,
  description: r.description,
  brandId: r.brandId,
  content: r.content,
  sellingMode: r.sellingMode,
  axisIds: r.bindings.filter((b) => b.axis).map((b) => b.attributeId),
  values: valuesFrom(r.values),
  skus: r.skus.map((s) => ({
    id: s.skuId,
    code: s.sku.code,
    manufacturerPartNumber: s.sku.manufacturerPartNumber,
    state: s.state,
    values: valuesFrom(s.values),
  })),
});
function Editor({
  row,
  code,
  base,
  schemas,
  brands,
  permissions,
  onLoad,
  run,
  busy,
  stores,
  tenantId,
}) {
  const [form, setForm] = useState(row ? fromRow(row, code) : empty),
    [dirty, setDirty] = useState(false),
    [comparison, setComparison] = useState(null),
    [selection, setSelection] = useState({}),
    [resolved, setResolved] = useState(null);
  const has = (p) => permissions.includes(p),
    editable = !row
      ? has("products.create")
      : row.status === "DRAFT" && has("products.update") && !row.rootArchived;
  const schema = schemas.find((s) => s.id === form.schemaVersionId),
    fields = schema?.attributes ?? row?.bindings ?? [];
  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
    setComparison(null);
    setResolved(null);
  };
  const path = row
    ? `${base}/products/${row.productId}/revisions/${row.id}`
    : null;
  const skuChange = (i, patch) =>
    set(
      "skus",
      form.skus.map((s, n) => (n === i ? { ...s, ...patch } : s)),
    );
  const save = () =>
    run(async () => {
      const body = { ...form };
      if (row) {
        delete body.code;
        body.revision = row.revision;
      }
      if (!has("skus.update")) delete body.skus;
      const r = await adminMutation(
        row ? path : `${base}/products`,
        body,
        row ? "PATCH" : "POST",
      );
      await onLoad(r, form.code);
    });
  const action = (name) =>
    run(async () =>
      onLoad(
        await adminMutation(`${path}/actions/${name}`, {
          revision: row.revision,
          ...(name === "publish" || name === "archive"
            ? { rootRevision: comparison?.rootRevision ?? row.rootRevision }
            : {}),
        }),
        code,
      ),
    );
  return (
    <section className="schema-card">
      <h2>{row ? "Product revision" : "Create product"}</h2>
      {row && (
        <p role="status">
          Product version {row.number} · {row.status} · Revision {row.revision}
          {dirty ? " · Unsaved changes" : ""}
        </p>
      )}
      <p className="muted">
        Catalog facts and store operations are managed separately. Purchasing
        remains disabled.
      </p>
      <fieldset disabled={!editable || busy}>
        <legend>General information</legend>
        <div className="schema-grid">
          <TextField
            label="Product code"
            value={form.code}
            disabled={!!row}
            onChange={(v) => set("code", v)}
          />
          <TextField
            label="Product name"
            value={form.name}
            onChange={(v) => set("name", v)}
          />
          <TextField
            label="Product slug"
            value={form.slug}
            onChange={(v) => set("slug", v)}
          />
          <TextField
            label="Product description"
            value={form.description}
            onChange={(v) => set("description", v)}
          />
        </div>
        <SelectField
          label="Approved catalog schema"
          value={form.schemaVersionId}
          onChange={(id) => {
            setForm((f) => ({
              ...f,
              schemaVersionId: id,
              axisIds: [],
              values: [],
              skus: [],
            }));
            setDirty(true);
          }}
        >
          <option value="">Select approved Product Type version</option>
          {schemas
            .filter((s) => !row || s.productTypeId === row.productTypeId)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} · v{s.number}
              </option>
            ))}
          {row && !schema && (
            <option value={row.schemaVersionId}>
              Pinned historical version · select a current schema before editing
            </option>
          )}
        </SelectField>
        <SelectField
          label="Selling policy"
          value={form.sellingMode}
          onChange={(v) => set("sellingMode", v)}
        >
          {["REFERENCE", "INFORMATIONAL", "RFQ", "RETAIL"].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </SelectField>
        <SelectField
          label="Manufacturer reference"
          value={form.brandId ?? ""}
          onChange={(v) => set("brandId", v || null)}
        >
          <option value="">Not provided</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </SelectField>
        <label className="schema-field">
          <span>Additional plain-text paragraphs (one per line)</span>
          <textarea
            aria-label="Additional plain-text paragraphs"
            value={form.content.map((b) => b.text).join("\n")}
            onChange={(e) =>
              set(
                "content",
                e.target.value
                  ? e.target.value
                      .split("\n")
                      .map((text) => ({ type: "paragraph", text }))
                  : [],
              )
            }
          />
        </label>
        <ValueFields
          prefix="Product"
          fields={fields.filter((b) => b.level === "PRODUCT")}
          values={form.values}
          onChange={(v) => set("values", v)}
        />
        <fieldset disabled={!has("variants.manage")}>
          <legend>Selectable variant axes</legend>
          {fields
            .filter((b) => b.level === "SKU" && (b.variantAxis || b.axis))
            .map((b) => (
              <CheckField
                key={b.attributeId}
                label={`Axis: ${b.snapshot.label}`}
                value={form.axisIds.includes(b.attributeId)}
                onChange={(checked) =>
                  set(
                    "axisIds",
                    checked
                      ? [...form.axisIds, b.attributeId]
                      : form.axisIds.filter((id) => id !== b.attributeId),
                  )
                }
              />
            ))}
          <p>
            Only explicitly entered combinations exist. Changing an existing
            physical SKU&apos;s axes or part number requires a new SKU identity.
          </p>
        </fieldset>
        <fieldset disabled={!has("skus.update")}>
          <legend>Explicit SKU configurations</legend>
          {form.skus.map((s, i) => (
            <fieldset key={s.id ?? `new-${i}`}>
              <legend>SKU {i + 1}</legend>
              <div className="schema-grid">
                <TextField
                  label={`SKU ${i + 1} code`}
                  value={s.code}
                  disabled={!!s.id}
                  onChange={(v) => skuChange(i, { code: v })}
                />
                <TextField
                  label={`SKU ${i + 1} manufacturer part number`}
                  value={s.manufacturerPartNumber}
                  disabled={!!s.id}
                  onChange={(v) =>
                    skuChange(i, { manufacturerPartNumber: v || null })
                  }
                />
                <SelectField
                  label={`SKU ${i + 1} state`}
                  value={s.state}
                  disabled={!has("skus.archive")}
                  onChange={(v) => skuChange(i, { state: v })}
                >
                  <option>ACTIVE</option>
                  <option>ARCHIVED</option>
                </SelectField>
              </div>
              <ValueFields
                prefix={`SKU ${i + 1}`}
                fields={fields.filter((b) => b.level === "SKU")}
                values={s.values}
                onChange={(v) => skuChange(i, { values: v })}
              />
              <button
                type="button"
                disabled={!has("skus.archive") && !!s.id}
                onClick={() =>
                  set(
                    "skus",
                    form.skus.filter((_, n) => n !== i),
                  )
                }
              >
                Remove SKU {i + 1} from draft
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            disabled={!has("skus.create") || form.skus.length >= 50}
            onClick={() =>
              set("skus", [
                ...form.skus,
                {
                  code: "",
                  manufacturerPartNumber: null,
                  state: "ACTIVE",
                  values: [],
                },
              ])
            }
          >
            Add explicit SKU
          </button>
          <p>
            Without axes, retail/reference products require one default SKU.
            SKU-free RFQ/informational products require the approved
            schema&apos;s permission.
          </p>
        </fieldset>
      </fieldset>
      <div className="schema-actions">
        <button disabled={!editable || busy} onClick={save}>
          Save product draft
        </button>
        {row && (
          <>
            <button
              disabled={dirty || busy}
              onClick={() =>
                run(async () => setComparison(await read(`${path}/impact`)))
              }
            >
              Validate and compare product
            </button>
            {has("products.update") && row.status !== "DRAFT" && (
              <button
                disabled={busy}
                onClick={() =>
                  run(async () =>
                    onLoad(
                      await adminMutation(`${path}/clone`, {
                        revision: row.revision,
                      }),
                      code,
                    ),
                  )
                }
              >
                Clone product draft
              </button>
            )}
            {[
              ["review", "DRAFT", "products.submit"],
              ["draft", "IN_REVIEW", "products.update"],
              ["approve", "IN_REVIEW", "products.approve"],
              ["publish", "APPROVED", "products.publish"],
              [
                "archive",
                "DRAFT IN_REVIEW APPROVED PUBLISHED",
                "products.archive",
              ],
            ]
              .filter(
                ([, states, p]) =>
                  states.split(" ").includes(row.status) && has(p),
              )
              .map(([a]) => (
                <button
                  key={a}
                  disabled={
                    busy ||
                    dirty ||
                    (a === "publish" && !comparison?.validation.valid)
                  }
                  onClick={() => action(a)}
                >
                  {a[0].toUpperCase() + a.slice(1)} product
                </button>
              ))}
            {has("products.archive") && (
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await adminMutation(
                      `${base}/products/${row.productId}/archive`,
                      { revision: row.rootRevision },
                    );
                    await onLoad({ ...row, rootArchived: true }, code);
                  })
                }
              >
                Archive product identity
              </button>
            )}
          </>
        )}
      </div>
      {comparison && (
        <div role="status">
          <h3>Product validation and differences</h3>
          <p>
            {comparison.validation.valid
              ? "Valid catalog facts"
              : comparison.validation.message}
          </p>
          <p>
            Changed: {comparison.changed.join(", ") || "None"}. SKU count:{" "}
            {comparison.skuChanges.before} → {comparison.skuChanges.after}.
            Pinned listing revisions: {comparison.affectedStoreListings}.
          </p>
        </div>
      )}
      {row && (
        <fieldset disabled={busy || dirty}>
          <legend>Dependent variant preview</legend>
          {row.bindings
            .filter((b) => b.axis)
            .map((b) => (
              <SelectField
                key={b.attributeId}
                label={`Resolve ${b.snapshot.label}`}
                value={selection[b.attributeId] ?? ""}
                onChange={(optionId) =>
                  run(async () => {
                    const next = { ...selection };
                    if (optionId) next[b.attributeId] = optionId;
                    else delete next[b.attributeId];
                    setSelection(next);
                    const result = await adminMutation(`${path}/resolve`, {
                      selection: Object.entries(next).map(
                        ([attributeId, optionId]) => ({
                          attributeId,
                          optionId,
                        }),
                      ),
                      ...(optionId
                        ? { changedAttributeId: b.attributeId }
                        : {}),
                    });
                    setSelection(result.selection);
                    setResolved(result);
                  })
                }
              >
                <option value="">Not selected</option>
                {(
                  resolved?.nextOptions.find(
                    (a) => a.attributeId === b.attributeId,
                  )?.options ?? b.snapshot.options
                ).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </SelectField>
            ))}
          <button
            onClick={() =>
              run(async () =>
                setResolved(
                  await adminMutation(`${path}/resolve`, {
                    selection: Object.entries(selection).map(
                      ([attributeId, optionId]) => ({ attributeId, optionId }),
                    ),
                  }),
                ),
              )
            }
          >
            Resolve saved SKU
          </button>
          {resolved && (
            <div role="status">
              <p>
                Resolution: {resolved.status}. Matching SKU:{" "}
                {resolved.matchingSku?.code ?? "None"}.
              </p>
              <p>
                Cleared incompatible choices:{" "}
                {resolved.clearedAttributeIds.length}. Prices and inventory are
                not available.
              </p>
              <details>
                <summary>Resolved specifications</summary>
                <pre className="category-evidence">
                  {JSON.stringify(
                    resolved.matchingSku?.specifications ?? [],
                    null,
                    2,
                  )}
                </pre>
              </details>
            </div>
          )}
        </fieldset>
      )}
      {row && (
        <>
          <OperationsPane stores={stores} skus={row.skus} />
          <MediaPanel
            tenantId={tenantId}
            permissions={permissions}
            row={row}
            parentDirty={dirty}
            onReload={async () =>
              onLoad(
                await read(
                  `${base}/products/${row.productId}/revisions/${row.id}`,
                ),
                code,
              )
            }
          />
        </>
      )}
    </section>
  );
}
function TenantCatalog({ context, stores }) {
  const base = `scopes/tenants/${context.id}/catalog`,
    has = (p) => context.permissions.includes(p);
  const [data, setData] = useState({ items: [], total: 0 }),
    [schemas, setSchemas] = useState([]),
    [schemaTotal, setSchemaTotal] = useState(0),
    [brands, setBrands] = useState([]),
    [query, setQuery] = useState({
      search: "",
      status: "",
      productTypeId: "",
      page: 1,
    }),
    [row, setRow] = useState(null),
    [code, setCode] = useState(""),
    [versions, setVersions] = useState([]),
    [editing, setEditing] = useState(false),
    [tick, setTick] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [brand, setBrand] = useState({ code: "", name: "" });
  async function run(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let current = true;
    const params = new URLSearchParams({
      search: query.search,
      page: query.page,
      ...(query.status ? { status: query.status } : {}),
      ...(query.productTypeId ? { productTypeId: query.productTypeId } : {}),
    });
    read(`${base}/products?${params}`)
      .then((d) => {
        if (current) setData(d);
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [base, query, tick]);
  useEffect(() => {
    let current = true;
    Promise.all([
      read(`${base}/schemas?pageSize=25`),
      read(`${base}/brands?pageSize=25`),
    ])
      .then(([s, b]) => {
        if (current) {
          setSchemas(s.items);
          setSchemaTotal(s.total);
          setBrands(b.items);
        }
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [base]);
  const load = async (r, c) => {
    setRow(r);
    setCode(c);
    setEditing(true);
    setTick((t) => t + 1);
    const root = await read(`${base}/products/${r.productId}`);
    setVersions(root.revisions);
  };
  const open = (p) =>
    run(async () =>
      load(
        await read(`${base}/products/${p.id}/revisions/${p.revisions[0].id}`),
        p.code,
      ),
    );
  return (
    <>
      <p role="alert" className="form-error">
        {error}
      </p>
      <div className="schema-actions">
        {has("products.create") && (
          <button
            onClick={() => {
              setRow(null);
              setCode("");
              setEditing(true);
              setVersions([]);
            }}
          >
            Create product
          </button>
        )}
        {schemas.length < schemaTotal && (
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                const d = await read(
                  `${base}/schemas?pageSize=25&page=${Math.floor(schemas.length / 25) + 1}`,
                );
                setSchemas([...schemas, ...d.items]);
              })
            }
          >
            Load more catalog schemas
          </button>
        )}
      </div>
      <div className="schema-columns">
        <aside className="schema-card">
          <h2>Catalog products</h2>
          <TextField
            label="Search catalog products"
            value={query.search}
            onChange={(v) => setQuery({ ...query, search: v, page: 1 })}
          />
          <SelectField
            label="Catalog status"
            value={query.status}
            onChange={(v) => setQuery({ ...query, status: v, page: 1 })}
          >
            <option value="">All states</option>
            {["DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"].map(
              (s) => (
                <option key={s}>{s}</option>
              ),
            )}
          </SelectField>
          <SelectField
            label="Catalog Product Type"
            value={query.productTypeId}
            onChange={(v) => setQuery({ ...query, productTypeId: v, page: 1 })}
          >
            <option value="">All Product Types</option>
            {[
              ...new Map(schemas.map((s) => [s.productTypeId, s])).values(),
            ].map((s) => (
              <option key={s.productTypeId} value={s.productTypeId}>
                {s.label}
              </option>
            ))}
          </SelectField>
          <ul className="schema-records">
            {data.items.map((p) => (
              <li key={p.id}>
                <button onClick={() => open(p)}>
                  {p.revisions[0]?.name ?? p.code}
                </button>
                <small>
                  {p.code} · {p.type.label}
                  {p.archived ? " · Archived identity" : ""}
                </small>
              </li>
            ))}
          </ul>
          <div className="schema-actions">
            <button
              disabled={query.page <= 1}
              onClick={() => setQuery({ ...query, page: query.page - 1 })}
            >
              Previous products
            </button>
            <span>
              Page {query.page} · {data.total} results
            </span>
            <button
              disabled={query.page * 20 >= data.total}
              onClick={() => setQuery({ ...query, page: query.page + 1 })}
            >
              Next products
            </button>
          </div>
          {row && (
            <SelectField
              label="Product revision history"
              value={row.id}
              onChange={(id) =>
                run(async () =>
                  load(
                    await read(
                      `${base}/products/${row.productId}/revisions/${id}`,
                    ),
                    code,
                  ),
                )
              }
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  Version {v.number} · {v.status}
                </option>
              ))}
            </SelectField>
          )}
          {has("products.update") && (
            <fieldset disabled={busy}>
              <legend>Manufacturer reference</legend>
              <TextField
                label="Manufacturer code"
                value={brand.code}
                onChange={(v) => setBrand({ ...brand, code: v })}
              />
              <TextField
                label="Manufacturer name"
                value={brand.name}
                onChange={(v) => setBrand({ ...brand, name: v })}
              />
              <button
                onClick={() =>
                  run(async () => {
                    const b = await adminMutation(`${base}/brands`, brand);
                    setBrands([...brands, b]);
                    setBrand({ code: "", name: "" });
                  })
                }
              >
                Add manufacturer reference
              </button>
            </fieldset>
          )}
        </aside>
        {editing ? (
          <Editor
            key={`${row?.id ?? "new"}-${row?.revision ?? 0}`}
            row={row}
            code={code}
            base={base}
            schemas={schemas}
            brands={brands}
            permissions={context.permissions}
            onLoad={load}
            run={run}
            busy={busy}
            stores={stores}
            tenantId={context.id}
          />
        ) : (
          <p>Select a product or create a catalog draft.</p>
        )}
      </div>
    </>
  );
}
export default function ProductWorkspace({ contexts, stores = [] }) {
  const [tenant, setTenant] = useState(contexts[0]?.id ?? "");
  const context = contexts.find((c) => c.id === tenant);
  return (
    <>
      <div className="page-intro">
        <h1>Products & SKU Variants</h1>
        <p className="muted">
          Tenant-owned, versioned catalog facts. Store publication is managed
          separately in Store Listings.
        </p>
      </div>
      <SelectField label="Catalog tenant" value={tenant} onChange={setTenant}>
        {contexts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      {context ? (
        <TenantCatalog
          key={context.id}
          context={context}
          stores={stores.filter(
            (s) =>
              s.tenantId === context.id &&
              s.permissions.some((p) =>
                ["pricing.view", "inventory.view"].includes(p),
              ),
          )}
        />
      ) : (
        <p role="alert">No authorized catalog tenant.</p>
      )}
    </>
  );
}
