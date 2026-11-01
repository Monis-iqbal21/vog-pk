"use client";
import { TextField, SelectField } from "../schema/SchemaFields";
export function valuesFrom(rows) {
  return rows.map((v) => ({
    attributeId: v.binding.attributeId,
    ...(v.textValue !== null
      ? { text: v.textValue }
      : v.numberValue !== null
        ? { number: String(v.numberValue) }
        : v.booleanValue !== null
          ? { boolean: v.booleanValue }
          : { options: v.choices.map((c) => c.optionId) }),
  }));
}
export default function ValueFields({
  fields,
  values,
  onChange,
  prefix,
  disabled = false,
}) {
  const set = (id, value) =>
    onChange([
      ...values.filter((v) => v.attributeId !== id),
      ...(value === undefined ? [] : [{ attributeId: id, ...value }]),
    ]);
  return (
    <fieldset disabled={disabled}>
      <legend>{prefix} specifications</legend>
      {fields.map((b) => {
        const s = b.snapshot,
          v = values.find((v) => v.attributeId === b.attributeId),
          name = `${prefix}: ${s.label}${b.required ? " (required)" : ""}`;
        return (
          <div key={b.attributeId}>
            {s.dataType === "TEXT" ? (
              <TextField
                label={name}
                value={v?.text ?? ""}
                onChange={(text) =>
                  set(b.attributeId, text === "" ? undefined : { text })
                }
              />
            ) : s.dataType === "NUMBER" ? (
              <TextField
                label={`${name} (${s.canonicalUnit})`}
                inputMode="decimal"
                value={v?.number ?? ""}
                onChange={(number) =>
                  set(b.attributeId, number === "" ? undefined : { number })
                }
              />
            ) : s.dataType === "BOOLEAN" ? (
              <SelectField
                label={name}
                value={v === undefined ? "" : String(v.boolean)}
                onChange={(boolean) =>
                  set(
                    b.attributeId,
                    boolean === ""
                      ? undefined
                      : { boolean: boolean === "true" },
                  )
                }
              >
                <option value="">Not provided</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </SelectField>
            ) : s.dataType === "SINGLE_SELECT" ? (
              <SelectField
                label={name}
                value={v?.options?.[0] ?? ""}
                onChange={(id) =>
                  set(b.attributeId, id ? { options: [id] } : undefined)
                }
              >
                <option value="">Not provided</option>
                {s.options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </SelectField>
            ) : (
              <label className="schema-field">
                <span>{name}</span>
                <select
                  aria-label={name}
                  multiple
                  value={v?.options ?? []}
                  onChange={(e) => {
                    const options = [...e.target.selectedOptions].map(
                      (o) => o.value,
                    );
                    set(
                      b.attributeId,
                      options.length ? { options } : undefined,
                    );
                  }}
                >
                  {s.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {v !== undefined && (
              <button
                type="button"
                onClick={() => set(b.attributeId, undefined)}
              >
                Clear {name}
              </button>
            )}
          </div>
        );
      })}
      {!fields.length && <p>No configured fields at this scope.</p>}
    </fieldset>
  );
}
