"use client";
import { useState } from "react";
import { previewErrors } from "@/lib/schema-preview";

// Registry choices are mapped to React controls, never HTML strings or code.
export default function GeneratedPreview({ version }) {
  const [result, setResult] = useState(null);
  return (
    <section className="schema-card" aria-label="Generated form preview">
      <h2>Form preview</h2>
      <p className="muted">
        Schema preview only. Values are not saved as products or SKUs.
      </p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setResult(previewErrors(version, new FormData(event.currentTarget)));
        }}
      >
        {version.groups.map((group) => (
          <fieldset key={group.id}>
            <legend>{group.label}</legend>
            {version.attributes
              .filter(
                (f) => f.groupId === group.id && f.snapshot.visibility.admin,
              )
              .map((field) => {
                const s = field.snapshot,
                  id = `preview-${field.id}`,
                  common = {
                    id,
                    name: field.id,
                    required: field.required,
                    "aria-describedby": `${id}-help`,
                  };
                let control;
                if (s.dataType === "TEXT")
                  control =
                    s.widget === "textarea" ? (
                      <textarea
                        {...common}
                        minLength={s.rules.minLength}
                        maxLength={s.rules.maxLength}
                      />
                    ) : (
                      <input
                        {...common}
                        type="text"
                        minLength={s.rules.minLength}
                        maxLength={s.rules.maxLength}
                        list={
                          s.rules.allowedValues ? `${id}-values` : undefined
                        }
                      />
                    );
                else if (s.dataType === "NUMBER")
                  control = (
                    <input
                      {...common}
                      type="number"
                      min={s.rules.min}
                      max={s.rules.max}
                      step={s.rules.step ?? "any"}
                    />
                  );
                else if (s.dataType === "BOOLEAN")
                  control = (
                    <input {...common} required={false} type="checkbox" />
                  );
                else if (
                  s.dataType === "SINGLE_SELECT" &&
                  ["radio", "swatch"].includes(s.widget)
                )
                  control = (
                    <div role="group" aria-label={s.label}>
                      {s.options.map((o) => (
                        <label className="schema-check" key={o.id}>
                          <input
                            type="radio"
                            name={field.id}
                            value={o.id}
                            required={field.required}
                          />
                          {s.widget === "swatch" &&
                            /^#[0-9a-f]{6}$/i.test(o.swatch ?? "") && (
                              <span
                                className="schema-swatch"
                                style={{ backgroundColor: o.swatch }}
                              />
                            )}
                          {o.label}
                        </label>
                      ))}
                    </div>
                  );
                else if (
                  s.dataType === "MULTI_SELECT" &&
                  s.widget === "checkboxes"
                )
                  control = (
                    <div role="group" aria-label={s.label}>
                      {s.options.map((o) => (
                        <label className="schema-check" key={o.id}>
                          <input type="checkbox" name={field.id} value={o.id} />
                          {o.label}
                        </label>
                      ))}
                    </div>
                  );
                else if (["SINGLE_SELECT", "MULTI_SELECT"].includes(s.dataType))
                  control = (
                    <select
                      {...common}
                      multiple={s.dataType === "MULTI_SELECT"}
                      defaultValue={s.dataType === "MULTI_SELECT" ? [] : ""}
                    >
                      {s.dataType === "SINGLE_SELECT" && (
                        <option value="">Choose…</option>
                      )}
                      {s.options.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  );
                else control = <p>Unsupported field control.</p>;
                return (
                  <div className="schema-field" key={field.id}>
                    <label htmlFor={id}>
                      {s.label}
                      {field.required ? " *" : ""}{" "}
                      <small>
                        ({field.level}
                        {field.variantAxis ? ", variant axis" : ""})
                      </small>
                    </label>
                    {control}
                    <small id={`${id}-help`}>
                      {s.description}{" "}
                      {s.canonicalUnit && `Unit: ${s.canonicalUnit}`}
                      {s.dataType === "MULTI_SELECT" &&
                        ` · Selections: ${s.rules.minItems ?? 0}–${s.rules.maxItems ?? s.options.length}`}
                    </small>
                    {s.dataType === "TEXT" && s.rules.allowedValues && (
                      <datalist id={`${id}-values`}>
                        {s.rules.allowedValues.map((value) => (
                          <option key={value} value={value} />
                        ))}
                      </datalist>
                    )}
                  </div>
                );
              })}
          </fieldset>
        ))}
        <button type="submit">Validate preview values</button>
        {result && (
          <div role={result.length ? "alert" : "status"}>
            {result.length ? (
              <ul>
                {result.map((message, index) => (
                  <li key={index}>{message}</li>
                ))}
              </ul>
            ) : (
              <p>Preview values satisfy this schema. Nothing was saved.</p>
            )}
          </div>
        )}
      </form>
    </section>
  );
}
