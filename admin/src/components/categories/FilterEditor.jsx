"use client";
import { useEffect, useState } from "react";
import { adminMutation } from "@/lib/client-api";
import { TextField, SelectField, CheckField } from "../schema/SchemaFields";
import { read, Choices } from "./fields";

const definition = (row) => ({
  revision: row.revision,
  includeDescendants: row.includeDescendants,
  typeVersionIds: row.dependencies.map((d) => d.versionId),
  filters: row.filters.map((f) => ({
    keyId: f.keyId,
    code: f.code,
    label: f.label,
    description: f.description,
    group: f.group,
    sortOrder: f.sortOrder,
    visible: f.visible,
    source: f.source,
    attributeId: f.attributeId,
    level: f.snapshot.level,
    control: f.snapshot.control,
    operators: f.snapshot.operators,
    allowedValues: f.snapshot.values.map((v) => v.code),
    ...(f.snapshot.min !== undefined ? { min: f.snapshot.min } : {}),
    ...(f.snapshot.max !== undefined ? { max: f.snapshot.max } : {}),
    displayUnit: f.snapshot.displayUnit,
    typeVersionIds: f.snapshot.bindings.map((b) => b.versionId),
    aliases: f.snapshot.aliases,
    ui: f.snapshot.ui,
  })),
});
export default function FilterEditor({ category, base, schemas, permissions }) {
  const path = `${base}/categories/${category.id}`,
    has = (p) => permissions.includes(p);
  const [history, setHistory] = useState({ items: [], total: 0 }),
    [page, setPage] = useState(1),
    [active, setActive] = useState(null),
    [registry, setRegistry] = useState(null),
    [row, setRow] = useState(null),
    [draft, setDraft] = useState(null),
    [impact, setImpact] = useState(null),
    [preview, setPreview] = useState(null),
    [query, setQuery] = useState({}),
    [fixture, setFixture] = useState("hardware"),
    [source, setSource] = useState("PRICE"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [tick, setTick] = useState(0),
    [dirty, setDirty] = useState(false);
  const editable = row?.status === "DRAFT" && has("category-filters.manage");
  useEffect(() => {
    let current = true;
    Promise.all([
      read(`${path}/filter-sets?page=${page}`),
      read(`${path}/active-filters`),
      read(`${base}/filter-registry`),
    ])
      .then(([h, a, r]) => {
        if (current) {
          setHistory(h);
          setActive(a);
          setRegistry(r);
        }
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [path, base, page, tick]);
  function loaded(r) {
    setRow(r);
    setDraft(definition(r));
    setImpact(null);
    setPreview(null);
    setQuery({});
    setDirty(false);
    setTick((v) => v + 1);
  }
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
  const change = (next) => {
    setDraft(next);
    setDirty(true);
    setImpact(null);
    setPreview(null);
  };
  const update = (i, patch) =>
    change({
      ...draft,
      filters: draft.filters.map((f, n) => (n === i ? { ...f, ...patch } : f)),
    });
  const fields = [
    ...new Map(
      schemas
        .filter((s) => draft?.typeVersionIds.includes(s.id))
        .flatMap((s) =>
          s.attributes.map((a) => [`${a.attributeId}:${a.level}`, a]),
        ),
    ).values(),
  ];
  const options = [
    ...(registry?.builtIns ?? []).map((b) => ({ id: b.source, ...b })),
    ...fields.map((f) => ({
      id: `${f.attributeId}:${f.level}`,
      source: "ATTRIBUTE",
      attributeId: f.attributeId,
      level: f.level,
      dataType: f.snapshot.dataType,
      label: f.snapshot.label,
      snapshot: f.snapshot,
    })),
  ];
  function addFilter() {
    const s = options.find((o) => o.id === source);
    if (!s) return;
    const control = registry.controls[s.dataType][0];
    change({
      ...draft,
      filters: [
        ...draft.filters,
        {
          code: s.snapshot?.code ?? s.source.toLowerCase(),
          label: s.label,
          description: "",
          group: "Filters",
          sortOrder: draft.filters.length,
          visible: true,
          source: s.source,
          attributeId: s.attributeId ?? null,
          level: s.level,
          control,
          operators: registry.operators[control],
          allowedValues: [],
          displayUnit:
            s.source === "PRICE"
              ? registry.currency
              : (s.snapshot?.canonicalUnit ?? null),
          typeVersionIds:
            s.source === "ATTRIBUTE"
              ? schemas
                  .filter(
                    (v) =>
                      draft.typeVersionIds.includes(v.id) &&
                      v.attributes.some(
                        (a) =>
                          a.attributeId === s.attributeId &&
                          a.level === s.level,
                      ),
                  )
                  .map((v) => v.id)
              : [],
          aliases: [],
          ui: { collapsed: false },
        },
      ],
    });
  }
  const action = (name) =>
    run(async () =>
      loaded(
        await adminMutation(`${path}/filter-sets/${row.id}/actions/${name}`, {
          revision: row.revision,
          ...(name === "activate" ||
          (name === "archive" && row.status === "ACTIVE")
            ? { categoryRevision: impact.filterRevision }
            : {}),
        }),
      ),
    );
  return (
    <section className="schema-card">
      <h2>Category filter configurations</h2>
      <p role="alert" className="form-error">
        {error}
      </p>
      <p>Active version: {active?.active?.number ?? "None"}</p>
      {active?.warnings.map((w) => (
        <p key={w} role="status">
          {w}
        </p>
      ))}
      <div className="schema-actions">
        {has("category-filters.manage") && (
          <button
            disabled={busy}
            onClick={() =>
              run(async () =>
                loaded(await adminMutation(`${path}/filter-sets`, {})),
              )
            }
          >
            Create filter draft
          </button>
        )}
        <SelectField
          label="Filter configuration"
          value={row?.id ?? ""}
          onChange={(id) =>
            id &&
            run(async () => loaded(await read(`${path}/filter-sets/${id}`)))
          }
        >
          <option value="">Select version</option>
          {history.items.map((s) => (
            <option key={s.id} value={s.id}>
              Version {s.number} · {s.status}
            </option>
          ))}
        </SelectField>
        <button disabled={page <= 1 || busy} onClick={() => setPage(page - 1)}>
          Previous filter versions
        </button>
        <button
          disabled={page * 20 >= history.total || busy}
          onClick={() => setPage(page + 1)}
        >
          Next filter versions
        </button>
      </div>
      {row && registry && (
        <>
          <p>
            Version {row.number} · {row.status} · Revision {row.revision}
            {dirty ? " · Unsaved changes" : ""}
          </p>
          <fieldset disabled={!editable || busy}>
            <legend>Filter definition</legend>
            <CheckField
              label="Include descendant categories"
              value={draft.includeDescendants}
              onChange={(v) => change({ ...draft, includeDescendants: v })}
            />
            <Choices
              label="Approved Product Type versions"
              items={schemas.map((s) => ({
                id: s.id,
                label: `${s.label} · v${s.number}`,
              }))}
              selected={draft.typeVersionIds}
              onChange={(v) => change({ ...draft, typeVersionIds: v })}
            />
            <SelectField
              label="Add filter source"
              value={source}
              onChange={setSource}
            >
              {options.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} · {s.level}
                </option>
              ))}
            </SelectField>
            <button
              type="button"
              disabled={draft.filters.length >= 20}
              onClick={addFilter}
            >
              Add filter
            </button>
            {draft.filters.map((f, i) => {
              const binding = fields.find(
                (a) => a.attributeId === f.attributeId && a.level === f.level,
              );
              const saved = row.filters.find(
                (a) => a.keyId === f.keyId,
              )?.snapshot;
              const dataType =
                binding?.snapshot.dataType ??
                saved?.dataType ??
                registry.builtIns.find((b) => b.source === f.source)?.dataType;
              const values =
                binding?.snapshot.options ??
                saved?.values ??
                (f.source === "AVAILABILITY"
                  ? ["in_stock", "out_of_stock", "unknown"].map((code) => ({
                      code,
                      label: code,
                    }))
                  : []);
              return (
                <fieldset key={i}>
                  <legend>
                    Filter {i + 1}: {f.label}
                  </legend>
                  <p className="muted">
                    {f.source} · {f.level}
                  </p>
                  <div className="schema-grid">
                    <TextField
                      label={`Filter ${i + 1} code`}
                      value={f.code}
                      onChange={(v) => update(i, { code: v })}
                    />
                    <TextField
                      label={`Filter ${i + 1} label`}
                      value={f.label}
                      onChange={(v) => update(i, { label: v })}
                    />
                    <TextField
                      label={`Filter ${i + 1} help`}
                      value={f.description}
                      onChange={(v) => update(i, { description: v })}
                    />
                    <TextField
                      label={`Filter ${i + 1} group`}
                      value={f.group}
                      onChange={(v) => update(i, { group: v })}
                    />
                    <TextField
                      label={`Filter ${i + 1} order`}
                      type="number"
                      value={f.sortOrder}
                      onChange={(v) => update(i, { sortOrder: Number(v) })}
                    />
                    <SelectField
                      label={`Filter ${i + 1} control`}
                      value={f.control}
                      onChange={(v) =>
                        update(i, {
                          control: v,
                          operators: registry.operators[v],
                        })
                      }
                    >
                      {(registry.controls[dataType] ?? [f.control]).map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </SelectField>
                  </div>
                  <p>Supported operators: {f.operators.join(", ")}</p>
                  <CheckField
                    label={`Filter ${i + 1} visible`}
                    value={f.visible}
                    onChange={(v) => update(i, { visible: v })}
                  />
                  <CheckField
                    label={`Filter ${i + 1} initially collapsed`}
                    value={f.ui.collapsed}
                    onChange={(v) => update(i, { ui: { collapsed: v } })}
                  />
                  {dataType === "NUMBER" ? (
                    <div className="schema-grid">
                      <TextField
                        label={`Filter ${i + 1} minimum`}
                        value={f.min}
                        onChange={(v) => {
                          const n = { ...f };
                          n.min = v || undefined;
                          update(i, n);
                        }}
                      />
                      <TextField
                        label={`Filter ${i + 1} maximum`}
                        value={f.max}
                        onChange={(v) => {
                          const n = { ...f };
                          if (v) n.max = v;
                          else delete n.max;
                          change({
                            ...draft,
                            filters: draft.filters.map((a, nIndex) =>
                              nIndex === i ? n : a,
                            ),
                          });
                        }}
                      />
                      <SelectField
                        label={`Filter ${i + 1} display unit`}
                        value={f.displayUnit ?? ""}
                        onChange={(v) => update(i, { displayUnit: v || null })}
                      >
                        {f.source === "PRICE" ? (
                          <option>{registry.currency}</option>
                        ) : (
                          registry.units.map((u) => (
                            <option key={u.code}>{u.code}</option>
                          ))
                        )}
                      </SelectField>
                    </div>
                  ) : values.length ? (
                    <Choices
                      label={`Filter ${i + 1} allowed values (none selects all)`}
                      items={values.map((v) => ({
                        id: v.code,
                        label: v.label,
                      }))}
                      selected={f.allowedValues}
                      onChange={(v) => update(i, { allowedValues: v })}
                    />
                  ) : (
                    <TextField
                      label={`Filter ${i + 1} allowed values (comma separated)`}
                      value={f.allowedValues.join(",")}
                      onChange={(v) =>
                        update(i, {
                          allowedValues: v
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  )}
                  {f.source === "ATTRIBUTE" && (
                    <Choices
                      label={`Filter ${i + 1} applicable versions`}
                      items={schemas
                        .filter((s) => draft.typeVersionIds.includes(s.id))
                        .map((s) => ({
                          id: s.id,
                          label: `${s.label} · v${s.number}`,
                        }))}
                      selected={f.typeVersionIds}
                      onChange={(v) => update(i, { typeVersionIds: v })}
                    />
                  )}
                  <TextField
                    label={`Filter ${i + 1} aliases (comma separated)`}
                    value={f.aliases.join(",")}
                    onChange={(v) =>
                      update(i, {
                        aliases: v
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      change({
                        ...draft,
                        filters: draft.filters.filter((_, n) => n !== i),
                      })
                    }
                  >
                    Remove filter {i + 1}
                  </button>
                </fieldset>
              );
            })}
          </fieldset>
          <div className="schema-actions">
            <button
              disabled={!editable || busy || !dirty}
              onClick={() =>
                run(async () =>
                  loaded(
                    await adminMutation(
                      `${path}/filter-sets/${row.id}`,
                      draft,
                      "PATCH",
                    ),
                  ),
                )
              }
            >
              Save filter draft
            </button>
            <button
              disabled={dirty || busy}
              onClick={() =>
                run(async () =>
                  setImpact(await read(`${path}/filter-sets/${row.id}/impact`)),
                )
              }
            >
              Validate and compare filters
            </button>
            {has("category-filters.manage") && row.status !== "DRAFT" && (
              <button
                disabled={busy}
                onClick={() =>
                  run(async () =>
                    loaded(
                      await adminMutation(
                        `${path}/filter-sets/${row.id}/clone`,
                        { revision: row.revision },
                      ),
                    ),
                  )
                }
              >
                Clone as filter draft
              </button>
            )}
            {[
              ["review", "DRAFT", "category-filters.manage"],
              ["draft", "REVIEW", "category-filters.manage"],
              ["approve", "REVIEW", "category-filters.approve"],
              ["activate", "APPROVED", "category-filters.activate"],
              [
                "archive",
                "DRAFT REVIEW APPROVED ACTIVE",
                "category-filters.manage",
              ],
            ]
              .filter(
                ([, states, p]) =>
                  states.split(" ").includes(row.status) && has(p),
              )
              .map(([name]) => (
                <button
                  key={name}
                  disabled={
                    busy ||
                    dirty ||
                    ((name === "activate" ||
                      (name === "archive" && row.status === "ACTIVE")) &&
                      (!impact || impact.blockingReasons.length > 0))
                  }
                  onClick={() => action(name)}
                >
                  {name[0].toUpperCase() + name.slice(1)} filters
                </button>
              ))}
          </div>
          {impact && (
            <div role="status">
              <h3>Validation and differences</h3>
              <p>
                Added: {impact.added.join(", ") || "None"}. Removed:{" "}
                {impact.removed.join(", ") || "None"}. Changed:{" "}
                {impact.changed.join(", ") || "None"}.
              </p>
              {[...impact.warnings, ...impact.blockingReasons].map((w) => (
                <p key={w}>{w}</p>
              ))}
            </div>
          )}
          <fieldset disabled={busy || dirty}>
            <legend>Synthetic filter preview</legend>
            <p>
              Save first. Preview uses generated fixtures only; no live products
              or facet counts.
            </p>
            <SelectField
              label="Preview industry"
              value={fixture}
              onChange={setFixture}
            >
              <option value="hardware">Hardware</option>
              <option value="fashion">Fashion</option>
              <option value="vehicles">Vehicles</option>
            </SelectField>
            {draft.filters
              .filter((f) => f.visible)
              .map((f) => (
                <TextField
                  key={f.code}
                  label={`Preview ${f.label}${f.control === "number_range" ? " (min..max)" : " (comma separated)"}`}
                  value={(query[f.code] ?? []).join(",")}
                  onChange={(v) => {
                    const next = { ...query };
                    if (v) next[f.code] = v.split(",").map((s) => s.trim());
                    else delete next[f.code];
                    setQuery(next);
                  }}
                />
              ))}
            <button
              onClick={() =>
                run(async () =>
                  setPreview(
                    await adminMutation(
                      `${path}/filter-sets/${row.id}/preview`,
                      { fixture, query },
                    ),
                  ),
                )
              }
            >
              Run fixture preview
            </button>
          </fieldset>
          {preview && (
            <div role="status">
              <p>Matched fixtures: {preview.matchedIds.join(", ") || "None"}</p>
              <p>
                All SKU predicates must match one valid SKU. Facet counts are
                not implemented.
              </p>
              <details>
                <summary>Query contract</summary>
                <pre className="category-evidence">
                  {JSON.stringify(preview.plan, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </>
      )}
    </section>
  );
}
