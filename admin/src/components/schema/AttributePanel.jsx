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

const emptyAttribute = {
  code: "",
  label: "",
  description: "",
  dataType: "TEXT",
  canonicalUnit: null,
  optionSetId: null,
  rules: {},
  widget: "text",
  allowedScopes: ["PRODUCT"],
  axisEligible: false,
  visibility: { admin: true, storefront: true },
};
const emptyOptions = {
  code: "",
  label: "",
  description: "",
  values: [
    { code: "", label: "", sortOrder: 0, swatch: null, status: "ACTIVE" },
  ],
};
export default function AttributePanel({ base, permissions, registry }) {
  const [resource, setResource] = useState(
      permissions.includes("attributes.view") ? "attributes" : "option-sets",
    ),
    [items, setItems] = useState([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [query, setQuery] = useState({ search: "", sort: "code" }),
    [epoch, setEpoch] = useState(0),
    [editor, setEditor] = useState(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const needsOptions = ["SINGLE_SELECT", "MULTI_SELECT"].includes(
    editor?.dataType,
  );
  const [optionSearch, setOptionSearch] = useState(""),
    [options, setOptions] = useState([]);
  const can = (code) => permissions.includes(code),
    editing = !!editor?.id;
  const canSave =
    resource === "attributes"
      ? can(editing ? "attributes.update" : "attributes.create")
      : can("option-sets.manage");
  useEffect(() => {
    const abort = new AbortController();
    fetch(
      `/api/admin/${base}/${resource}?${new URLSearchParams({ ...query, page: String(page) })}`,
      { signal: abort.signal, cache: "no-store" },
    )
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message);
        setItems(data.items);
        setTotal(data.total);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => abort.abort();
  }, [base, resource, page, query, epoch]);
  useEffect(() => {
    if (!needsOptions) return;
    const abort = new AbortController();
    fetch(
      `/api/admin/${base}/option-sets?${new URLSearchParams({ search: optionSearch, status: "ACTIVE", pageSize: "25" })}`,
      { signal: abort.signal, cache: "no-store" },
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message);
        setOptions(d.items);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => abort.abort();
  }, [base, optionSearch, needsOptions]);
  const change = (key, value) =>
    setEditor((current) => ({ ...current, [key]: value }));
  function select(row) {
    setEditor(row);
    setError("");
    setNotice("");
  }
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      let body;
      if (resource === "attributes") {
        const {
          code,
          label,
          description,
          dataType,
          canonicalUnit,
          optionSetId,
          rules,
          widget,
          allowedScopes,
          axisEligible,
          visibility,
        } = editor;
        body = {
          label,
          description,
          canonicalUnit,
          optionSetId,
          rules,
          widget,
          allowedScopes,
          axisEligible,
          visibility,
          ...(editing
            ? { revision: editor.revision, status: editor.status }
            : { code, dataType }),
        };
      } else {
        body = {
          label: editor.label,
          description: editor.description,
          values: editor.values.map(
            ({ id, code, label, sortOrder, swatch, status }) => ({
              ...(id ? { id } : {}),
              code,
              label,
              sortOrder,
              swatch,
              status,
            }),
          ),
          ...(editing
            ? { revision: editor.revision, status: editor.status }
            : { code: editor.code }),
        };
      }
      const result = await adminMutation(
        `${base}/${resource}${editing ? "/" + editor.id : ""}`,
        body,
        editing ? "PATCH" : "POST",
      );
      setEditor(result);
      setEpoch((e) => e + 1);
      setNotice(
        "Configuration saved. Approved schemas retain their existing snapshots.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="schema-actions" role="group" aria-label="Definition kind">
        <button
          type="button"
          aria-pressed={resource === "attributes"}
          onClick={() => {
            setResource("attributes");
            setPage(1);
            setEditor(null);
          }}
        >
          Attributes
        </button>
        {can("option-sets.view") && (
          <button
            type="button"
            aria-pressed={resource === "option-sets"}
            onClick={() => {
              setResource("option-sets");
              setPage(1);
              setEditor(null);
            }}
          >
            Option sets
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <CollectionToolbar {...{ query, setQuery, page, setPage, total }} />
      <div className="schema-columns">
        <section className="schema-card">
          <h2>{resource === "attributes" ? "Attributes" : "Option sets"}</h2>
          <button
            type="button"
            disabled={
              !can(
                resource === "attributes"
                  ? "attributes.create"
                  : "option-sets.manage",
              )
            }
            onClick={() =>
              select(
                structuredClone(
                  resource === "attributes" ? emptyAttribute : emptyOptions,
                ),
              )
            }
          >
            Create {resource === "attributes" ? "attribute" : "option set"}
          </button>
          <ul className="schema-records">
            {items.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => select(item)}>
                  {item.label}{" "}
                  <small>
                    {item.code} · {item.status} · r{item.revision}
                  </small>
                </button>
              </li>
            ))}
          </ul>
          {!items.length && <p>No matching definitions.</p>}
        </section>
        {editor && (
          <form className="schema-card" onSubmit={save}>
            <h2>
              {editing ? "Edit" : "Create"}{" "}
              {resource === "attributes" ? "attribute" : "option set"}
            </h2>
            <fieldset disabled={busy || !canSave}>
              <TextField
                label="Internal code"
                value={editor.code}
                onChange={(v) => change("code", v)}
                required
                disabled={editing}
                pattern="[a-z][a-z0-9_]*"
                maxLength={64}
              />
              <TextField
                label="Label"
                value={editor.label}
                onChange={(v) => change("label", v)}
                required
                maxLength={120}
              />
              <TextField
                label="Description"
                value={editor.description}
                onChange={(v) => change("description", v)}
                maxLength={500}
              />
              {editing && (
                <SelectField
                  label="Status"
                  value={editor.status}
                  disabled={
                    resource === "attributes" && !can("attributes.archive")
                  }
                  onChange={(v) => change("status", v)}
                >
                  <option>ACTIVE</option>
                  <option>ARCHIVED</option>
                </SelectField>
              )}
              {resource === "attributes" ? (
                <>
                  <SelectField
                    label="Data type"
                    value={editor.dataType}
                    disabled={editing}
                    onChange={(dataType) => {
                      const widget = registry.widgets[dataType][0];
                      setEditor({
                        ...editor,
                        dataType,
                        widget,
                        rules: {},
                        canonicalUnit: dataType === "NUMBER" ? "one" : null,
                        optionSetId: null,
                        axisEligible: false,
                      });
                    }}
                  >
                    {Object.keys(registry.widgets).map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </SelectField>
                  {editor.dataType === "NUMBER" && (
                    <SelectField
                      label="Canonical unit"
                      value={editor.canonicalUnit}
                      onChange={(v) => change("canonicalUnit", v)}
                    >
                      {registry.units.map((u) => (
                        <option key={u.code} value={u.code}>
                          {u.code} — {u.dimension}
                        </option>
                      ))}
                    </SelectField>
                  )}
                  {["SINGLE_SELECT", "MULTI_SELECT"].includes(
                    editor.dataType,
                  ) && (
                    <>
                      <TextField
                        label="Search option sets"
                        value={optionSearch}
                        onChange={setOptionSearch}
                      />
                      <SelectField
                        label="Option set"
                        value={editor.optionSetId}
                        disabled={editing}
                        onChange={(v) => change("optionSetId", v || null)}
                        required
                      >
                        <option value="">Choose…</option>
                        {editor.optionSetId &&
                          !options.some((o) => o.id === editor.optionSetId) && (
                            <option value={editor.optionSetId}>
                              {editor.optionSet?.label ?? "Selected vocabulary"}
                            </option>
                          )}
                        {options.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </SelectField>
                    </>
                  )}
                  <SelectField
                    label="Display control"
                    value={editor.widget}
                    onChange={(v) => change("widget", v)}
                  >
                    {registry.widgets[editor.dataType].map((w) => (
                      <option key={w}>{w}</option>
                    ))}
                  </SelectField>
                  <fieldset>
                    <legend>Allowed ownership levels</legend>
                    {["PRODUCT", "SKU"].map((level) => (
                      <CheckField
                        key={level}
                        label={level}
                        value={editor.allowedScopes.includes(level)}
                        onChange={(checked) =>
                          change(
                            "allowedScopes",
                            checked
                              ? [...editor.allowedScopes, level]
                              : editor.allowedScopes.filter((v) => v !== level),
                          )
                        }
                      />
                    ))}
                  </fieldset>
                  <CheckField
                    label="Eligible as a variant axis"
                    value={editor.axisEligible}
                    disabled={editor.dataType !== "SINGLE_SELECT"}
                    onChange={(v) => change("axisEligible", v)}
                  />
                  <CheckField
                    label="Visible in admin forms"
                    value={editor.visibility.admin}
                    onChange={(v) =>
                      change("visibility", { ...editor.visibility, admin: v })
                    }
                  />
                  <CheckField
                    label="Visible in storefront specifications"
                    value={editor.visibility.storefront}
                    onChange={(v) =>
                      change("visibility", {
                        ...editor.visibility,
                        storefront: v,
                      })
                    }
                  />
                  <RulesEditor
                    type={editor.dataType}
                    rules={editor.rules}
                    onChange={(v) => change("rules", v)}
                  />
                </>
              ) : (
                <>
                  <p className="muted">
                    Existing option codes are fixed. Referenced options cannot
                    be removed or archived.
                  </p>
                  {editor.values.map((value, index) => (
                    <fieldset key={index}>
                      <legend>Option {index + 1}</legend>
                      <div className="schema-grid">
                        {[
                          ["code", "Option code"],
                          ["label", "Option label"],
                          ["swatch", "Color swatch (#RRGGBB)"],
                        ].map(([key, label]) => (
                          <TextField
                            key={key}
                            label={label}
                            value={value[key]}
                            disabled={key === "code" && !!value.id}
                            required={key !== "swatch"}
                            onChange={(text) =>
                              change(
                                "values",
                                editor.values.map((v, i) =>
                                  i === index
                                    ? {
                                        ...v,
                                        [key]:
                                          key === "swatch"
                                            ? text || null
                                            : text,
                                      }
                                    : v,
                                ),
                              )
                            }
                          />
                        ))}
                        <TextField
                          label="Option order"
                          type="number"
                          min="0"
                          value={value.sortOrder}
                          onChange={(text) =>
                            change(
                              "values",
                              editor.values.map((v, i) =>
                                i === index
                                  ? { ...v, sortOrder: Number(text) }
                                  : v,
                              ),
                            )
                          }
                        />
                        <SelectField
                          label="Option status"
                          value={value.status}
                          onChange={(status) =>
                            change(
                              "values",
                              editor.values.map((v, i) =>
                                i === index ? { ...v, status } : v,
                              ),
                            )
                          }
                        >
                          <option>ACTIVE</option>
                          <option>ARCHIVED</option>
                        </SelectField>
                      </div>
                      {!value.id && editor.values.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            change(
                              "values",
                              editor.values.filter((_, i) => i !== index),
                            )
                          }
                        >
                          Remove new option
                        </button>
                      )}
                    </fieldset>
                  ))}
                  <button
                    type="button"
                    disabled={editor.values.length >= 50}
                    onClick={() =>
                      change("values", [
                        ...editor.values,
                        {
                          code: "",
                          label: "",
                          sortOrder: editor.values.length,
                          swatch: null,
                          status: "ACTIVE",
                        },
                      ])
                    }
                  >
                    Add option
                  </button>
                </>
              )}
              <button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save configuration"}
              </button>
            </fieldset>
          </form>
        )}
      </div>
    </>
  );
}
