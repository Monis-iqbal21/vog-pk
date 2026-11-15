"use client";
import { useState } from "react";
import { SelectField } from "../schema/SchemaFields";
import MediaPanel from "./MediaPanel";
export default function MediaWorkspace({ contexts }) {
  const [id, setId] = useState(contexts[0]?.id ?? ""),
    context = contexts.find((c) => c.id === id);
  return (
    <>
      <h1>Media library & posters</h1>
      <p className="muted">
        The same media library and ordered assignment controls are integrated
        into product and SKU revisions.
      </p>
      <SelectField label="Media tenant" value={id} onChange={setId}>
        {contexts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      {context ? (
        <MediaPanel key={id} tenantId={id} permissions={context.permissions} />
      ) : (
        <p>No authorized media tenant.</p>
      )}
    </>
  );
}
