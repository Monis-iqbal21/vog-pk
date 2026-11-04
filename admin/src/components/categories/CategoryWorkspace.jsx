"use client";
import { useEffect, useState } from "react";
import { adminMutation } from "@/lib/client-api";
import { TextField, SelectField, CheckField } from "../schema/SchemaFields";
import FilterEditor from "./FilterEditor";
import { read, Choices } from "./fields";
const blank = {
  code: "",
  name: "",
  slug: "",
  parentId: null,
  description: "",
  sortOrder: 0,
  visible: true,
  inNavigation: true,
  compatibility: "ANY",
  productTypeIds: [],
  media: { imagePath: null, bannerPath: null, alt: "" },
  seo: { title: "", description: "" },
};
function CategoryEditor({
  item,
  nodes,
  schemas,
  base,
  permissions,
  complete,
  run,
  busy,
}) {
  const [form, setForm] = useState(
    item
      ? {
          ...item,
          productTypeIds: item.allowedTypes.map((t) => t.productTypeId),
        }
      : blank,
  );
  const [impact, setImpact] = useState(null);
  const has = (p) => permissions.includes(p);
  const editable = !item
    ? has("categories.create")
    : has("categories.update") && ["DRAFT", "ACTIVE"].includes(item.status);
  const change = (k, value) => setForm((f) => ({ ...f, [k]: value }));
  const save = () =>
    run(async () => {
      const body = Object.fromEntries(
        Object.keys(blank).map((key) => [key, form[key]]),
      );
      if (item) {
        delete body.code;
        delete body.parentId;
        delete body.sortOrder;
        body.revision = item.revision;
      }
      complete(
        await adminMutation(
          `${base}/categories${item ? `/${item.id}` : ""}`,
          body,
          item ? "PATCH" : "POST",
        ),
      );
    });
  const lifecycle = (action) =>
    run(async () =>
      complete(
        await adminMutation(`${base}/categories/${item.id}/actions/${action}`, {
          revision: item.revision,
        }),
      ),
    );
  const types = [
    ...new Map(
      schemas.map((s) => [
        s.productTypeId,
        { id: s.productTypeId, label: s.label },
      ]),
    ).values(),
  ];
  return (
    <section className="schema-card">
      <h2>{item ? `Edit ${item.name}` : "Add category"}</h2>
      {item && (
        <p>
          Status: {item.status} · Revision {item.revision}
        </p>
      )}
      <fieldset disabled={!editable || busy}>
        <legend>Category details</legend>
        <div className="schema-grid">
          <TextField
            label="Category code"
            value={form.code}
            disabled={!!item}
            onChange={(v) => change("code", v)}
          />
          <TextField
            label="Category name"
            value={form.name}
            onChange={(v) => change("name", v)}
          />
          <TextField
            label="Category slug"
            value={form.slug}
            onChange={(v) => change("slug", v)}
          />
          <TextField
            label="Description"
            value={form.description}
            onChange={(v) => change("description", v)}
          />
          <TextField
            label="SEO title"
            value={form.seo.title}
            onChange={(v) => change("seo", { ...form.seo, title: v })}
          />
          <TextField
            label="SEO description"
            value={form.seo.description}
            onChange={(v) => change("seo", { ...form.seo, description: v })}
          />
          <TextField
            label="Image path"
            value={form.media.imagePath}
            onChange={(v) =>
              change("media", { ...form.media, imagePath: v || null })
            }
          />
          <TextField
            label="Banner path"
            value={form.media.bannerPath}
            onChange={(v) =>
              change("media", { ...form.media, bannerPath: v || null })
            }
          />
          <TextField
            label="Image alternative text"
            value={form.media.alt}
            onChange={(v) => change("media", { ...form.media, alt: v })}
          />
        </div>
        <p className="muted">
          Image metadata uses existing approved /images/ paths. Uploads are not
          available here.
        </p>
        <CheckField
          label="Visible category"
          value={form.visible}
          onChange={(v) => change("visible", v)}
        />
        <CheckField
          label="Show in navigation"
          value={form.inNavigation}
          onChange={(v) => change("inNavigation", v)}
        />
        <SelectField
          label="Product Type compatibility"
          value={form.compatibility}
          onChange={(v) => {
            change("compatibility", v);
            if (v === "ANY") change("productTypeIds", []);
          }}
        >
          <option value="ANY">Any Product Type</option>
          <option value="ALLOW_LIST">Selected Product Types</option>
        </SelectField>
        {form.compatibility === "ALLOW_LIST" && (
          <Choices
            label="Allowed Product Types"
            items={types}
            selected={form.productTypeIds}
            onChange={(v) => change("productTypeIds", v)}
          />
        )}
      </fieldset>
      <fieldset
        disabled={
          busy ||
          (item
            ? !has("categories.reorder") ||
              !["DRAFT", "ACTIVE"].includes(item.status)
            : !editable)
        }
      >
        <legend>Hierarchy and ordering</legend>
        <SelectField
          label="Parent category"
          value={form.parentId ?? ""}
          disabled={!!item && !has("categories.update")}
          onChange={(v) => change("parentId", v || null)}
        >
          <option value="">Root category</option>
          {nodes
            .filter(
              (n) =>
                n.id !== item?.id &&
                !n.path.includes(item?.id) &&
                n.status !== "ARCHIVED",
            )
            .map((n) => (
              <option key={n.id} value={n.id}>
                {"— ".repeat(n.depth - 1)}
                {n.name}
              </option>
            ))}
        </SelectField>
        <TextField
          label="Display order"
          type="number"
          min="0"
          max="100000"
          value={form.sortOrder}
          onChange={(v) => change("sortOrder", Number(v))}
        />
        {item && (
          <button
            type="button"
            onClick={() =>
              run(async () =>
                complete(
                  await adminMutation(`${base}/categories/${item.id}/move`, {
                    revision: item.revision,
                    parentId: form.parentId,
                    sortOrder: form.sortOrder,
                  }),
                ),
              )
            }
          >
            Save hierarchy and order
          </button>
        )}
      </fieldset>
      <div className="schema-actions">
        <button disabled={!editable || busy} onClick={save}>
          Save category
        </button>
        {item && (
          <>
            <button
              disabled={busy}
              onClick={() =>
                run(async () =>
                  setImpact(await read(`${base}/categories/${item.id}/impact`)),
                )
              }
            >
              Review category impact
            </button>
            {[
              ["review", "DRAFT", "categories.update"],
              ["draft", "REVIEW APPROVED", "categories.update"],
              ["approve", "REVIEW", "categories.approve"],
              ["activate", "APPROVED", "categories.activate"],
            ]
              .filter(
                ([, statuses, p]) =>
                  statuses.split(" ").includes(item.status) && has(p),
              )
              .map(([action]) => (
                <button
                  key={action}
                  disabled={busy}
                  onClick={() => lifecycle(action)}
                >
                  {action === "draft"
                    ? "Return category to draft"
                    : `${action[0].toUpperCase()}${action.slice(1)} category`}
                </button>
              ))}
            {has("categories.archive") && item.status !== "ARCHIVED" && (
              <button
                disabled={busy || !impact}
                onClick={() => lifecycle("archive")}
              >
                Archive category
              </button>
            )}
          </>
        )}
      </div>
      {impact && (
        <div role="status">
          <p>
            Child categories: {impact.children ?? impact.childCount ?? 0}.
            Assignment analysis: {impact.usage?.mode ?? "No listing model yet"}.
          </p>
          <pre className="category-evidence">
            {JSON.stringify(impact, null, 2)}
          </pre>
        </div>
      )}
    </section>
  );
}
function StoreWorkspace({ context }) {
  const base = `stores/${context.id}`,
    has = (p) => context.permissions.includes(p);
  const [query, setQuery] = useState({ search: "", status: "", page: 1 }),
    [data, setData] = useState({ items: [], total: 0 }),
    [nodes, setNodes] = useState([]),
    [schemas, setSchemas] = useState([]),
    [schemaTotal, setSchemaTotal] = useState(0),
    [selected, setSelected] = useState(null),
    [editing, setEditing] = useState(false),
    [tick, setTick] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [treeView, setTreeView] = useState("draft");
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
    if (has("categories.view"))
      Promise.all([
        read(`${base}/categories?${params}`),
        read(`${base}/categories/tree?maxDepth=32&view=${treeView}`),
      ])
        .then(([list, tree]) => {
          if (current) {
            setData(list);
            setNodes(tree.nodes);
          }
        })
        .catch((e) => {
          if (current) setError(e.message);
        });
    return () => {
      current = false;
    };
    // Permissions belong to the keyed store context and cannot change within this mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, query, tick, treeView]);
  useEffect(() => {
    let current = true;
    if (has("category-filters.view"))
      read(`${base}/filter-schemas?pageSize=25`)
        .then((d) => {
          if (current) {
            setSchemas(d.items);
            setSchemaTotal(d.total);
          }
        })
        .catch((e) => {
          if (current) setError(e.message);
        });
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);
  const complete = (item) => {
    setSelected(item);
    setEditing(true);
    setTick((t) => t + 1);
  };
  return (
    <>
      <p role="alert" className="form-error">
        {error}
      </p>
      <div className="schema-actions">
        {has("categories.create") && (
          <button
            onClick={() => {
              setSelected(null);
              setEditing(true);
            }}
          >
            Add category
          </button>
        )}
        {schemas.length < schemaTotal && (
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                const d = await read(
                  `${base}/filter-schemas?pageSize=25&page=${Math.floor(schemas.length / 25) + 1}`,
                );
                setSchemas([...schemas, ...d.items]);
              })
            }
          >
            Load more approved schemas
          </button>
        )}
      </div>
      <div className="schema-columns">
        <aside className="schema-card">
          <h2>Categories</h2>
          <TextField
            label="Search categories"
            value={query.search}
            onChange={(search) => setQuery({ ...query, search, page: 1 })}
          />
          <SelectField
            label="Category status"
            value={query.status}
            onChange={(status) => setQuery({ ...query, status, page: 1 })}
          >
            <option value="">All states</option>
            {["DRAFT", "REVIEW", "APPROVED", "ACTIVE", "ARCHIVED"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </SelectField>
          <ul className="schema-records">
            {data.items.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => {
                    setSelected(item);
                    setEditing(true);
                  }}
                >
                  {item.name}
                </button>
                <small>
                  {item.code} · {item.status}
                </small>
              </li>
            ))}
          </ul>
          <div className="schema-actions">
            <button
              disabled={query.page === 1}
              onClick={() => setQuery({ ...query, page: query.page - 1 })}
            >
              Previous categories
            </button>
            <span>
              Page {query.page} · {data.total} results
            </span>
            <button
              disabled={query.page * 20 >= data.total}
              onClick={() => setQuery({ ...query, page: query.page + 1 })}
            >
              Next categories
            </button>
          </div>
          <h3>Hierarchy preview</h3>
          <SelectField
            label="Hierarchy view"
            value={treeView}
            onChange={setTreeView}
          >
            <option value="draft">Draft hierarchy</option>
            <option value="active">Published hierarchy</option>
          </SelectField>
          <ol className="schema-records">
            {nodes.map((n) => (
              <li key={n.id}>
                <span>
                  {n.path
                    .map((id) => nodes.find((p) => p.id === id)?.name ?? "…")
                    .join(" → ")}
                </span>
              </li>
            ))}
          </ol>
          <p className="muted">
            Maximum 32 levels and 1,000 categories per store.
          </p>
        </aside>
        <div>
          {editing && (
            <CategoryEditor
              key={`${selected?.id ?? "new"}-${selected?.revision ?? 0}`}
              item={selected}
              nodes={nodes}
              schemas={schemas}
              base={base}
              permissions={context.permissions}
              complete={complete}
              run={run}
              busy={busy}
            />
          )}
          {selected && has("category-filters.view") && (
            <FilterEditor
              key={selected.id}
              category={selected}
              base={base}
              schemas={schemas}
              permissions={context.permissions}
            />
          )}
        </div>
      </div>
    </>
  );
}
export default function CategoryWorkspace({ contexts }) {
  const [store, setStore] = useState(contexts[0]?.id ?? "");
  const context = contexts.find((c) => c.id === store);
  return (
    <>
      <div className="page-intro">
        <h1>Categories & Filters</h1>
        <p className="muted">
          Store navigation and versioned filter configuration. Storefront reads
          remain unchanged.
        </p>
      </div>
      <SelectField
        label="Configuration store"
        value={store}
        onChange={setStore}
      >
        {contexts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.tenantName} / {c.name}
          </option>
        ))}
      </SelectField>
      {context ? (
        <StoreWorkspace key={context.id} context={context} />
      ) : (
        <p role="alert">No authorized store is available.</p>
      )}
    </>
  );
}
