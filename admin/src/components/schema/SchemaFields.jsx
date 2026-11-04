"use client";

export function TextField({ label, value, onChange, ...props }) {
  return (
    <label className="schema-field">
      <span>{label}</span>
      <input
        aria-label={label}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        {...props}
      />
    </label>
  );
}
export function SelectField({ label, value, onChange, children, ...props }) {
  return (
    <label className="schema-field">
      <span>{label}</span>
      <select
        aria-label={label}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}
export function CheckField({ label, value, onChange, ...props }) {
  return (
    <label className="schema-check">
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}
export function RulesEditor({ type, rules, onChange, disabled = false }) {
  function change(key, value, numeric = false) {
    const next = { ...rules };
    if (value === "") delete next[key];
    else next[key] = numeric ? Number(value) : value;
    onChange(next);
  }
  const entries =
    type === "TEXT"
      ? [
          ["minLength", "Minimum length", true],
          ["maxLength", "Maximum length", true],
        ]
      : type === "NUMBER"
        ? [
            ["min", "Minimum", false],
            ["max", "Maximum", false],
            ["step", "Increment", false],
          ]
        : type === "MULTI_SELECT"
          ? [
              ["minItems", "Minimum selections", true],
              ["maxItems", "Maximum selections", true],
            ]
          : [];
  return (
    <fieldset className="schema-rules" disabled={disabled}>
      <legend>Validation</legend>
      <div className="schema-grid">
        {entries.map(([key, label, numeric]) => (
          <TextField
            key={key}
            label={label}
            value={rules[key]}
            onChange={(value) => change(key, value, numeric)}
            type={numeric ? "number" : "text"}
            inputMode={numeric ? "numeric" : "decimal"}
          />
        ))}
      </div>
      {["TEXT", "NUMBER"].includes(type) && (
        <label className="schema-field">
          <span>Allowed values (one per line, optional)</span>
          <textarea
            rows={3}
            value={rules.allowedValues?.join("\n") ?? ""}
            onChange={(e) => {
              const next = { ...rules };
              if (!e.target.value) delete next.allowedValues;
              else next.allowedValues = e.target.value.split("\n");
              onChange(next);
            }}
          />
        </label>
      )}
      {entries.length === 0 && (
        <p className="muted">
          No additional validation rules for this field type.
        </p>
      )}
    </fieldset>
  );
}
export function CollectionToolbar({
  query,
  setQuery,
  page,
  setPage,
  total,
  pageSize = 20,
}) {
  return (
    <div className="schema-toolbar">
      <TextField
        label="Search definitions"
        value={query.search}
        onChange={(search) => {
          setQuery({ ...query, search });
          setPage(1);
        }}
      />
      <SelectField
        label="Sort definitions"
        value={query.sort}
        onChange={(sort) => {
          setQuery({ ...query, sort });
          setPage(1);
        }}
      >
        <option value="code">Code</option>
        <option value="label">Label</option>
        <option value="createdAt">Created</option>
      </SelectField>
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
      >
        Previous page
      </button>
      <span>
        Page {page} · {total} results
      </span>
      <button
        type="button"
        disabled={page * pageSize >= total}
        onClick={() => setPage(page + 1)}
      >
        Next page
      </button>
    </div>
  );
}
