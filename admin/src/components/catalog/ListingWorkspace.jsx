"use client";
import { useEffect, useState } from "react";
import { adminMutation } from "@/lib/client-api";
import { TextField, SelectField, CheckField } from "../schema/SchemaFields";
import { Choices, read } from "../categories/fields";
import ListingMediaPanel from "../operations/ListingMediaPanel";
const blank = {
  code: "",
  title: "",
  slug: "",
  productRevisionId: "",
  categoryIds: [],
  skuRevisionIds: [],
  visible: true,
  seo: { title: "", description: "" },
  featuredOrder: null,
  newArrivalOrder: null,
  catalogOrder: null,
};
const fromRow = (r, code) => ({
  code,
  title: r.title,
  slug: r.slug,
  productRevisionId: r.productRevisionId,
  categoryIds: r.categories.map((c) => c.categoryId),
  skuRevisionIds: r.skus.map((s) => s.skuRevisionId),
  visible: r.visible,
  seo: r.seo,
  featuredOrder: r.featuredOrder,
  newArrivalOrder: r.newArrivalOrder,
  catalogOrder: r.catalogOrder,
});
function Editor({
  row,
  code,
  base,
  products,
  categories,
  permissions,
  run,
  busy,
  onLoad,
}) {
  const [form, setForm] = useState(row ? fromRow(row, code) : blank),
    [dirty, setDirty] = useState(false),
    [impact, setImpact] = useState(null);
  const has = (p) => permissions.includes(p),
    editable = row
      ? row.status === "DRAFT" && has("listings.update")
      : has("listings.create");
  const product = products.find((p) => p.id === form.productRevisionId),
    path = row ? `${base}/${row.listingId}/revisions/${row.id}` : null;
  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
    setImpact(null);
  };
  const save = () =>
    run(async () => {
      const body = { ...form };
      if (row) {
        delete body.code;
        body.revision = row.revision;
      }
      await onLoad(
        await adminMutation(row ? path : base, body, row ? "PATCH" : "POST"),
        form.code,
      );
    });
  return (
    <section className="schema-card">
      <h2>{row ? "Store listing revision" : "Create store listing"}</h2>
      {row && (
        <p role="status">
          Listing version {row.number} · {row.status} · Revision {row.revision}
          {dirty ? " · Unsaved changes" : ""}
        </p>
      )}
      <p className="muted">
        Pins approved shared catalog facts. Purchasing remains disabled for
        every policy. Configure store prices and stock in the product editor;
        organize this listing’s approved media below.
      </p>
      <fieldset disabled={!editable || busy}>
        <legend>Listing presentation</legend>
        <div className="schema-grid">
          <TextField
            label="Listing code"
            value={form.code}
            disabled={!!row}
            onChange={(v) => set("code", v)}
          />
          <TextField
            label="Listing title"
            value={form.title}
            onChange={(v) => set("title", v)}
          />
          <TextField
            label="Listing slug"
            value={form.slug}
            onChange={(v) => set("slug", v)}
          />
        </div>
        <SelectField
          label="Approved product revision"
          value={form.productRevisionId}
          onChange={(id) => {
            const p = products.find((p) => p.id === id);
            setForm((f) => ({
              ...f,
              productRevisionId: id,
              title: f.title || p?.name || "",
              slug: f.slug || p?.slug || "",
              skuRevisionIds: p?.skus.map((s) => s.id) ?? [],
            }));
            setDirty(true);
            setImpact(null);
          }}
        >
          <option value="">Select approved product</option>
          {products
            .filter((p) => !row || p.productId === row.productId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · v{p.number} · {p.sellingMode}
              </option>
            ))}
          {row && !product && (
            <option value={row.productRevisionId}>
              Pinned historical product revision
            </option>
          )}
        </SelectField>
        <CheckField
          label="Listing visible"
          value={form.visible}
          onChange={(v) => set("visible", v)}
        />
        <div className="schema-grid">
          <TextField
            label="Listing SEO title"
            value={form.seo.title}
            onChange={(v) => set("seo", { ...form.seo, title: v })}
          />
          <TextField
            label="Listing SEO description"
            value={form.seo.description}
            onChange={(v) => set("seo", { ...form.seo, description: v })}
          />
          <TextField
            label="Featured order (optional)"
            type="number"
            min="0"
            value={form.featuredOrder ?? ""}
            onChange={(v) => set("featuredOrder", v === "" ? null : Number(v))}
          />
          <TextField
            label="Catalog order (optional)"
            type="number"
            min="0"
            max="100000"
            value={form.catalogOrder ?? ""}
            onChange={(v) => set("catalogOrder", v === "" ? null : Number(v))}
          />
          <TextField
            label="New Arrivals order (optional)"
            type="number"
            min="0"
            value={form.newArrivalOrder ?? ""}
            onChange={(v) =>
              set("newArrivalOrder", v === "" ? null : Number(v))
            }
          />
        </div>
        <Choices
          label="Listing categories"
          disabled={!has("listings.assign-categories")}
          items={categories.map((c) => ({ id: c.id, label: c.name }))}
          selected={form.categoryIds}
          onChange={(v) => set("categoryIds", v)}
        />
        <Choices
          label="Approved listing SKU pins"
          items={(
            product?.skus ??
            row?.skus.map((s) => ({
              id: s.skuRevisionId,
              sku: s.skuRevision.sku,
            })) ??
            []
          ).map((s) => ({ id: s.id, label: s.sku.code }))}
          selected={form.skuRevisionIds}
          onChange={(v) => set("skuRevisionIds", v)}
        />
      </fieldset>
      <div className="schema-actions">
        <button disabled={!editable || busy} onClick={save}>
          Save listing draft
        </button>
        {row && (
          <>
            <button
              disabled={busy || dirty}
              onClick={() =>
                run(async () => setImpact(await read(`${path}/impact`)))
              }
            >
              Validate and compare listing
            </button>
            {has("listings.update") && row.status !== "DRAFT" && (
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
                Clone listing draft
              </button>
            )}
            {[
              ["review", "DRAFT", "listings.submit"],
              ["draft", "IN_REVIEW", "listings.update"],
              ["approve", "IN_REVIEW", "listings.approve"],
              ["publish", "APPROVED", "listings.publish"],
              [
                "archive",
                "DRAFT IN_REVIEW APPROVED PUBLISHED",
                "listings.archive",
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
                    (a === "publish" && !impact?.validation.valid)
                  }
                  onClick={() =>
                    run(async () =>
                      onLoad(
                        await adminMutation(`${path}/actions/${a}`, {
                          revision: row.revision,
                          ...(a === "publish" || a === "archive"
                            ? {
                                rootRevision:
                                  impact?.rootRevision ?? row.rootRevision,
                              }
                            : {}),
                        }),
                        code,
                      ),
                    )
                  }
                >
                  {a[0].toUpperCase() + a.slice(1)} listing
                </button>
              ))}
            {has("listings.archive") && (
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await adminMutation(`${base}/${row.listingId}/archive`, {
                      revision: row.rootRevision,
                    });
                    await onLoad({ ...row, status: "ARCHIVED" }, code);
                  })
                }
              >
                Archive listing identity
              </button>
            )}
          </>
        )}
      </div>
      {impact && (
        <div role="status">
          <h3>Listing validation and differences</h3>
          <p>
            {impact.validation.valid
              ? "Valid listing pins"
              : impact.validation.message}
          </p>
          <p>
            Changed: {impact.changed.join(", ") || "None"}. Purchasable: no.
          </p>
        </div>
      )}
      {row && permissions.includes("listing-media.view") && (
        <ListingMediaPanel
          key={`${row.id}-${row.revision}`}
          storeId={base.split("/")[1]}
          row={row}
          permissions={permissions}
          parentDirty={dirty}
          onReload={async () =>
            onLoad(
              await read(`${base}/${row.listingId}/revisions/${row.id}`),
              code,
            )
          }
        />
      )}
    </section>
  );
}
function StoreListings({ context }) {
  const base = `stores/${context.id}/listings`,
    [data, setData] = useState({ items: [], total: 0 }),
    [products, setProducts] = useState([]),
    [productTotal, setProductTotal] = useState(0),
    [categories, setCategories] = useState([]),
    [query, setQuery] = useState({ search: "", status: "", page: 1 }),
    [row, setRow] = useState(null),
    [code, setCode] = useState(""),
    [versions, setVersions] = useState([]),
    [editing, setEditing] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [tick, setTick] = useState(0),
    [productSearch, setProductSearch] = useState("");
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
    });
    read(`${base}?${params}`)
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
      read(
        `${base}/catalog?pageSize=25&search=${encodeURIComponent(productSearch)}`,
      ),
      read(`${base}/categories`),
    ])
      .then(([p, c]) => {
        if (current) {
          setProducts(p.items);
          setProductTotal(p.total);
          setCategories(c.nodes);
        }
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [base, productSearch, tick]);
  async function load(r, c) {
    setRow(r);
    setCode(c);
    setEditing(true);
    setTick((t) => t + 1);
    const root = await read(`${base}/${r.listingId}`);
    setVersions(root.revisions);
  }
  return (
    <>
      <p role="alert" className="form-error">
        {error}
      </p>
      <div className="schema-actions">
        {context.permissions.includes("listings.create") && (
          <button
            onClick={() => {
              setRow(null);
              setEditing(true);
              setVersions([]);
            }}
          >
            Create store listing
          </button>
        )}
      </div>
      <div className="schema-columns">
        <aside className="schema-card">
          <h2>Store listings</h2>
          <TextField
            label="Search store listings"
            value={query.search}
            onChange={(v) => setQuery({ ...query, search: v, page: 1 })}
          />
          <SelectField
            label="Listing status"
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
          <ul className="schema-records">
            {data.items.map((l) => (
              <li key={l.id}>
                <button
                  onClick={() =>
                    run(async () =>
                      load(
                        await read(
                          `${base}/${l.id}/revisions/${l.revisions[0].id}`,
                        ),
                        l.code,
                      ),
                    )
                  }
                >
                  {l.revisions[0]?.title ?? l.code}
                </button>
                <small>{l.archived ? "Archived identity" : l.code}</small>
              </li>
            ))}
          </ul>
          <div className="schema-actions">
            <button
              disabled={query.page <= 1}
              onClick={() => setQuery({ ...query, page: query.page - 1 })}
            >
              Previous listings
            </button>
            <span>
              Page {query.page} · {data.total} results
            </span>
            <button
              disabled={query.page * 20 >= data.total}
              onClick={() => setQuery({ ...query, page: query.page + 1 })}
            >
              Next listings
            </button>
          </div>
          <TextField
            label="Search approved products"
            value={productSearch}
            onChange={setProductSearch}
          />
          {products.length < productTotal && (
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const d = await read(
                    `${base}/catalog?pageSize=25&page=${Math.floor(products.length / 25) + 1}&search=${encodeURIComponent(productSearch)}`,
                  );
                  setProducts([...products, ...d.items]);
                })
              }
            >
              Load more listing products
            </button>
          )}
          {row && (
            <SelectField
              label="Listing revision history"
              value={row.id}
              onChange={(id) =>
                run(async () =>
                  load(
                    await read(`${base}/${row.listingId}/revisions/${id}`),
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
        </aside>
        {editing ? (
          <Editor
            key={`${row?.id ?? "new"}-${row?.revision ?? 0}`}
            row={row}
            code={code}
            base={base}
            products={products}
            categories={categories}
            permissions={context.permissions}
            run={run}
            busy={busy}
            onLoad={load}
          />
        ) : (
          <p>Select a listing or create a draft.</p>
        )}
      </div>
    </>
  );
}
export default function ListingWorkspace({ contexts }) {
  const [store, setStore] = useState(contexts[0]?.id ?? "");
  const context = contexts.find((c) => c.id === store);
  return (
    <>
      <div className="page-intro">
        <h1>Store Listings</h1>
        <p className="muted">
          Store-specific publication of approved catalog revisions.
        </p>
      </div>
      <SelectField label="Listing store" value={store} onChange={setStore}>
        {contexts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      {context ? (
        <StoreListings key={context.id} context={context} />
      ) : (
        <p role="alert">No authorized listing store.</p>
      )}
    </>
  );
}
