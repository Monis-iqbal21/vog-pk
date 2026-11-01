"use client";
import { CheckField } from "../schema/SchemaFields";
export async function read(path) {
  const response = await fetch(`/api/admin/${path}`, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.message ?? "Unable to load configuration.");
  return data;
}
export function Choices({ label, items, selected, onChange, disabled }) {
  return (
    <fieldset disabled={disabled}>
      <legend>{label}</legend>
      {items.map((item) => (
        <CheckField
          key={item.id}
          label={item.label}
          value={selected.includes(item.id)}
          onChange={(checked) =>
            onChange(
              checked
                ? [...selected, item.id]
                : selected.filter((id) => id !== item.id),
            )
          }
        />
      ))}
      {!items.length && <p>No eligible definitions available.</p>}
    </fieldset>
  );
}
