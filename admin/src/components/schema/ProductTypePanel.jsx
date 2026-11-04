"use client";
import { useEffect, useState } from "react";
import { adminMutation } from "@/lib/client-api";
import {
  TextField,
  SelectField,
  CheckField,
  RulesEditor,
  CollectionToolbar,
} from "./SchemaFields";
import GeneratedPreview from "./GeneratedPreview";

const toDraft = (version) => ({
  allowNoSku: version.allowNoSku ?? false,
  label: version.label,
  description: version.description,
  revision: version.revision,
  groups: version.groups.map(({ code, label, sortOrder }) => ({
    code,
    label,
    sortOrder,
  })),
  fields: version.attributes.map((f) => ({
    attributeId: f.attributeId,
    groupCode: version.groups.find((g) => g.id === f.groupId)?.code,
    level: f.level,
    required: f.required,
    variantAxis: f.variantAxis,
    sortOrder: f.sortOrder,
    widget: f.snapshot.widget,
    rules: f.snapshot.rules,
    visibility: f.snapshot.visibility,
    snapshot: f.snapshot,
  })),
});
export default function ProductTypePanel({ base, permissions, registry }) {
  const [items, setItems] = useState([]),
    [total, setTotal] = useState(0),
    [query, setQuery] = useState({ search: "", sort: "code" }),
    [page, setPage] = useState(1),
    [epoch, setEpoch] = useState(0),
    [version, setVersion] = useState(null),
    [draft, setDraft] = useState(null),
    [newType, setNewType] = useState({ code: "", label: "", description: "" }),
    [creating, setCreating] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [impact, setImpact] = useState(null),
    [attributeSearch, setAttributeSearch] = useState(""),
    [attributes, setAttributes] = useState([]),
    [notice, setNotice] = useState("");
  const can = (permission) => permissions.includes(permission),
    editable = version?.status === "DRAFT" && can("product-types.update");
  useEffect(() => {
    const abort = new AbortController();
    fetch(
      `/api/admin/${base}/product-types?${new URLSearchParams({ ...query, page: String(page) })}`,
      { signal: abort.signal, cache: "no-store" },
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message);
        setItems(d.items);
        setTotal(d.total);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => abort.abort();
  }, [base, query, page, epoch]);
  useEffect(() => {
    if (!permissions.includes("attributes.view")) return;
    const abort = new AbortController();
    fetch(
      `/api/admin/${base}/attributes?${new URLSearchParams({ search: attributeSearch, pageSize: "25", status: "ACTIVE" })}`,
      { signal: abort.signal, cache: "no-store" },
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message);
        setAttributes(d.items);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => abort.abort();
  }, [base, attributeSearch, permissions]);
  async function loadVersion(selectedType, id) {
    setError("");
    setImpact(null);
    setNotice("");
    try {
      const r = await fetch(
          `/api/admin/${base}/product-types/${selectedType.id}/versions/${id}`,
          { cache: "no-store" },
        ),
        v = await r.json();
      if (!r.ok) throw new Error(v.message);
      setVersion(v);
      setDraft(toDraft(v));
      setCreating(false);
    } catch (e) {
      setError(e.message);
    }
  }
  const versionPath = version
    ? `${base}/product-types/${version.productTypeId}/versions/${version.id}`
    : "";
  async function run(work) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function create(event) {
    event.preventDefault();
    await run(async () => {
      const row = await adminMutation(`${base}/product-types`, newType);
      setEpoch((e) => e + 1);
      await loadVersion(row, row.versions[0].id);
    });
  }
  async function save(event) {
    event.preventDefault();
    await run(async () => {
      const body = {
        ...draft,
        fields: draft.fields.map(({ snapshot, ...field }) => field),
      };
      const row = await adminMutation(versionPath, body, "PATCH");
      setVersion(row);
      setDraft(toDraft(row));
      setEpoch((e) => e + 1);
      setImpact(null);
      setNotice(
        "Draft saved. Review the form and compare it with the active schema.",
      );
    });
  }
  async function compare() {
    await run(async () => {
      const r = await fetch(`/api/admin/${versionPath}/impact`, {
          cache: "no-store",
        }),
        d = await r.json();
      if (!r.ok) throw new Error(d.message);
      setImpact(d);
    });
  }
  async function olderVersions(type) {
    await run(async () => {
      const page = Math.floor(type.versions.length / 20) + 1;
      const response = await fetch(
          `/api/admin/${base}/product-types/${type.id}/versions?page=${page}&pageSize=20`,
          { cache: "no-store" },
        ),
        data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setItems((items) =>
        items.map((t) =>
          t.id === type.id
            ? {
                ...t,
                versions: [
                  ...t.versions,
                  ...data.items.filter(
                    (v) => !t.versions.some((old) => old.id === v.id),
                  ),
                ],
              }
            : t,
        ),
      );
    });
  }
  async function action(name) {
    await run(async () => {
      const row = await adminMutation(`${versionPath}/actions/${name}`, {
        revision: version.revision,
        ...(impact ? { typeRevision: impact.typeRevision } : {}),
      });
      setVersion(row);
      setDraft(toDraft(row));
      setImpact(null);
      setEpoch((e) => e + 1);
      setNotice(`Schema is now ${row.status}.`);
    });
  }
  async function clone() {
    await run(async () => {
      const row = await adminMutation(`${versionPath}/clone`, {
        revision: version.revision,
      });
      setVersion(row);
      setDraft(toDraft(row));
      setEpoch((e) => e + 1);
      setImpact(null);
      setNotice(
        "A new draft was created. Approved schema content remains unchanged.",
      );
    });
  }
  function fieldChange(index, key, value) {
    setDraft((d) => ({
      ...d,
      fields: d.fields.map((f, i) =>
        i === index ? { ...f, [key]: value } : f,
      ),
    }));
    setImpact(null);
  }
  function groupChange(index, key, value) {
    setDraft((current) => ({
      ...current,
      groups: current.groups.map((row, i) =>
        i === index ? { ...row, [key]: value } : row,
      ),
      fields:
        key === "code"
          ? current.fields.map((field) =>
              field.groupCode === current.groups[index].code
                ? { ...field, groupCode: value }
                : field,
            )
          : current.fields,
    }));
    setImpact(null);
  }
  const preview = draft
    ? {
        groups: draft.groups.map((g) => ({ ...g, id: g.code })),
        attributes: draft.fields
          .map((f, i) => {
            const def = attributes.find((a) => a.id === f.attributeId),
              source =
                f.snapshot ??
                (def
                  ? {
                      ...def,
                      options:
                        def.optionSet?.values.filter(
                          (v) => v.status === "ACTIVE",
                        ) ?? [],
                    }
                  : null);
            return {
              ...f,
              id: `field-${i}`,
              groupId: f.groupCode,
              snapshot: source
                ? {
                    ...source,
                    widget: f.widget,
                    rules: f.rules,
                    visibility: f.visibility,
                  }
                : null,
            };
          })
          .filter((f) => f.snapshot),
      }
    : null;
  return (
    <>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <CollectionToolbar {...{ query, setQuery, page, setPage, total }} />
      <div className="schema-columns">
        <section className="schema-card">
          <h2>Product Types</h2>
          <button
            type="button"
            disabled={!can("product-types.create")}
            onClick={() => {
              setCreating(true);
              setVersion(null);
              setDraft(null);
              setError("");
            }}
          >
            Create Product Type
          </button>
          <ul className="schema-records">
            {items.map((t) => (
              <li key={t.id}>
                <strong>{t.label}</strong>
                <small>
                  {t.code} · type r{t.revision}
                </small>
                <div className="schema-version-list">
                  {t.versions.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => loadVersion(t, v.id)}
                    >
                      Version {v.number} · {v.status}
                    </button>
                  ))}
                  {t.activeVersionId &&
                    !t.versions.some((v) => v.id === t.activeVersionId) && (
                      <button
                        type="button"
                        onClick={() => loadVersion(t, t.activeVersionId)}
                      >
                        Open active version
                      </button>
                    )}
                  {t._count?.versions > t.versions.length && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => olderVersions(t)}
                    >
                      Load older versions
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {!items.length && <p>No Product Types yet.</p>}
        </section>
        {creating && (
          <form className="schema-card" onSubmit={create}>
            <h2>New Product Type</h2>
            {[
              ["code", "Internal code"],
              ["label", "Product Type label"],
              ["description", "Description"],
            ].map(([key, label]) => (
              <TextField
                key={key}
                label={label}
                value={newType[key]}
                onChange={(value) => setNewType({ ...newType, [key]: value })}
                required={key !== "description"}
              />
            ))}
            <button disabled={busy || !can("product-types.create")}>
              Create draft
            </button>
          </form>
        )}
        {version && draft && (
          <section className="schema-card">
            <h2>
              {version.label} — version {version.number}
            </h2>
            <p className="status-badge">
              {version.status} · revision {version.revision}
            </p>
            <p className="muted">
              Saved field snapshots are frozen during review and after approval.
              Saving a draft explicitly refreshes its reusable definitions.
            </p>
            <form onSubmit={save}>
              <fieldset disabled={!editable || busy}>
                <TextField
                  label="Version label"
                  value={draft.label}
                  onChange={(label) => setDraft({ ...draft, label })}
                  required
                />
                <TextField
                  label="Version description"
                  value={draft.description}
                  onChange={(description) =>
                    setDraft({ ...draft, description })
                  }
                />
                <CheckField
                  label="Permit SKU-free informational or inquiry products"
                  value={draft.allowNoSku}
                  onChange={(allowNoSku) => setDraft({ ...draft, allowNoSku })}
                />
                <h3>Specification groups</h3>
                {draft.groups.map((g, index) => (
                  <fieldset key={index}>
                    <legend>Group {index + 1}</legend>
                    <div className="schema-grid">
                      {[
                        ["code", "Group code"],
                        ["label", "Group label"],
                      ].map(([key, label]) => (
                        <TextField
                          key={key}
                          label={label}
                          value={g[key]}
                          required
                          onChange={(value) => groupChange(index, key, value)}
                        />
                      ))}
                      <TextField
                        label="Group order"
                        type="number"
                        min="0"
                        value={g.sortOrder}
                        onChange={(value) =>
                          setDraft({
                            ...draft,
                            groups: draft.groups.map((row, i) =>
                              i === index
                                ? { ...row, sortOrder: Number(value) }
                                : row,
                            ),
                          })
                        }
                      />
                    </div>
                    <button
                      type="button"
                      disabled={draft.fields.some(
                        (f) => f.groupCode === g.code,
                      )}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          groups: draft.groups.filter((_, i) => i !== index),
                        })
                      }
                    >
                      Remove group
                    </button>
                  </fieldset>
                ))}
                <button
                  type="button"
                  disabled={draft.groups.length >= 12}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      groups: [
                        ...draft.groups,
                        {
                          code: `group_${draft.groups.length + 1}`,
                          label: "Specifications",
                          sortOrder: draft.groups.length,
                        },
                      ],
                    })
                  }
                >
                  Add specification group
                </button>
                <h3>Reusable attributes</h3>
                <TextField
                  label="Search reusable attributes"
                  value={attributeSearch}
                  onChange={setAttributeSearch}
                />
                <SelectField
                  label="Add reusable attribute"
                  value=""
                  onChange={(id) => {
                    const a = attributes.find((a) => a.id === id);
                    if (!a) return;
                    setDraft({
                      ...draft,
                      fields: [
                        ...draft.fields,
                        {
                          attributeId: a.id,
                          groupCode: draft.groups[0]?.code ?? "",
                          level: a.allowedScopes[0],
                          required: false,
                          variantAxis: false,
                          sortOrder: draft.fields.length,
                          widget: a.widget,
                          rules: a.rules,
                          visibility: a.visibility,
                          snapshot: {
                            ...a,
                            options:
                              a.optionSet?.values.filter(
                                (v) => v.status === "ACTIVE",
                              ) ?? [],
                          },
                        },
                      ],
                    });
                  }}
                  disabled={
                    !can("attributes.view") || draft.fields.length >= 40
                  }
                >
                  <option value="">Choose an attribute…</option>
                  {attributes
                    .filter(
                      (a) => !draft.fields.some((f) => f.attributeId === a.id),
                    )
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label} ({a.code})
                      </option>
                    ))}
                </SelectField>
                {!can("attributes.view") && (
                  <p>
                    Attribute read permission is needed to select reusable
                    fields.
                  </p>
                )}
                {draft.fields.map((f, index) => {
                  const a =
                    f.snapshot ??
                    attributes.find((a) => a.id === f.attributeId);
                  return (
                    <fieldset key={f.attributeId}>
                      <legend>{a?.label ?? f.attributeId}</legend>
                      <div className="schema-grid">
                        <SelectField
                          label="Specification group"
                          value={f.groupCode}
                          onChange={(v) => fieldChange(index, "groupCode", v)}
                        >
                          {draft.groups.map((g) => (
                            <option key={g.code} value={g.code}>
                              {g.label}
                            </option>
                          ))}
                        </SelectField>
                        <SelectField
                          label="Ownership level"
                          value={f.level}
                          onChange={(v) => fieldChange(index, "level", v)}
                        >
                          {(a?.allowedScopes ?? ["PRODUCT", "SKU"]).map(
                            (level) => (
                              <option key={level}>{level}</option>
                            ),
                          )}
                        </SelectField>
                        <SelectField
                          label="Field control"
                          value={f.widget}
                          onChange={(v) => fieldChange(index, "widget", v)}
                        >
                          {(registry.widgets[a?.dataType] ?? []).map((w) => (
                            <option key={w}>{w}</option>
                          ))}
                        </SelectField>
                        <TextField
                          label="Field order"
                          type="number"
                          min="0"
                          value={f.sortOrder}
                          onChange={(v) =>
                            fieldChange(index, "sortOrder", Number(v))
                          }
                        />
                      </div>
                      <CheckField
                        label="Required in this Product Type"
                        value={f.required}
                        onChange={(v) => fieldChange(index, "required", v)}
                      />
                      <CheckField
                        label="Selectable variant axis"
                        value={f.variantAxis}
                        disabled={!a?.axisEligible && !f.variantAxis}
                        onChange={(v) => fieldChange(index, "variantAxis", v)}
                      />
                      <CheckField
                        label="Show in admin form"
                        value={f.visibility.admin}
                        onChange={(v) =>
                          fieldChange(index, "visibility", {
                            ...f.visibility,
                            admin: v,
                          })
                        }
                      />
                      <CheckField
                        label="Show in storefront specifications"
                        value={f.visibility.storefront}
                        onChange={(v) =>
                          fieldChange(index, "visibility", {
                            ...f.visibility,
                            storefront: v,
                          })
                        }
                      />
                      <RulesEditor
                        type={a?.dataType}
                        rules={f.rules}
                        onChange={(v) => fieldChange(index, "rules", v)}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            fields: draft.fields.filter((_, i) => i !== index),
                          })
                        }
                      >
                        Remove binding
                      </button>
                    </fieldset>
                  );
                })}
                <button type="submit" disabled={busy}>
                  Save draft
                </button>
              </fieldset>
            </form>
            <div className="schema-actions">
              <button
                type="button"
                disabled={
                  busy ||
                  version.status === "DRAFT" ||
                  !can("product-types.update")
                }
                onClick={clone}
              >
                Create new draft from version
              </button>
              <button type="button" disabled={busy} onClick={compare}>
                Compare saved version &amp; analyze impact
              </button>
              {version.status === "DRAFT" && (
                <button
                  type="button"
                  disabled={busy || !can("product-types.update")}
                  onClick={() => action("review")}
                >
                  Submit saved draft for review
                </button>
              )}
              {version.status === "REVIEW" && (
                <>
                  <button
                    type="button"
                    disabled={busy || !can("product-types.update")}
                    onClick={() => action("draft")}
                  >
                    Return to draft
                  </button>
                  <button
                    type="button"
                    disabled={busy || !can("product-types.approve")}
                    onClick={() => action("approve")}
                  >
                    Approve schema
                  </button>
                </>
              )}
              {version.status === "APPROVED" && (
                <button
                  type="button"
                  disabled={busy || !impact || !can("product-types.activate")}
                  onClick={() => action("activate")}
                >
                  Activate compared schema
                </button>
              )}
              {["DRAFT", "APPROVED", "ACTIVE"].includes(version.status) && (
                <button
                  type="button"
                  disabled={
                    busy ||
                    !can("product-types.archive") ||
                    (version.status === "ACTIVE" &&
                      (!impact || !can("product-types.activate")))
                  }
                  onClick={() => action("archive")}
                >
                  Archive version
                </button>
              )}
            </div>
            {impact && (
              <div role="status" className="schema-impact">
                <h3>Saved schema comparison</h3>
                <p>
                  Added: {impact.added.join(", ") || "none"} · Removed:{" "}
                  {impact.removed.join(", ") || "none"} · Changed:{" "}
                  {impact.changed.join(", ") || "none"}
                </p>
                <p>
                  Group or label changes:{" "}
                  {impact.metadataChanged ? "yes" : "no"}
                </p>
                <p>
                  Usage mode: {impact.usage.mode}. Referenced products:{" "}
                  {impact.usage.referencedProducts ?? "unknown"}.{" "}
                  {impact.usage.blockingReasons.join(" ")}
                </p>
                <p className="muted">
                  Existing products keep their pinned schemas. Conflicting
                  approved facts or listing pins block activation until an
                  explicit migration is reviewed.
                </p>
                {impact.usage.affected && (
                  <>
                    <p>
                      SKU revisions: {impact.usage.affected.skuRevisionCount}.
                      Listing revisions:{" "}
                      {impact.usage.affected.listingRevisionCount}. Filter
                      dependencies: {impact.usage.affected.filterDependencies}.
                    </p>
                    {impact.usage.affected.conflicts.map((c) => (
                      <p key={c.revisionId}>
                        Product revision {c.revisionId}: {c.reasons.join(" ")}
                      </p>
                    ))}
                    {impact.usage.affected.truncated && (
                      <p role="alert">
                        Impact analysis is truncated; activation requires
                        explicit migration review.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        )}
      </div>
      {preview && <GeneratedPreview version={preview} />}
    </>
  );
}
