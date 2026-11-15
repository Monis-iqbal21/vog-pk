"use client";
import { useEffect, useState } from "react";
import AttributePanel from "./AttributePanel";
import ProductTypePanel from "./ProductTypePanel";
import { SelectField } from "./SchemaFields";

function TenantWorkspace({ context, mode }) {
  const [registry, setRegistry] = useState(null),
    [error, setError] = useState("");
  const base = `scopes/tenants/${context.id}/schema`;
  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/admin/${base}/registry`, {
      signal: abort.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message);
        setRegistry(d);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => abort.abort();
  }, [base]);
  if (error)
    return (
      <p role="alert" className="form-error">
        {error}
      </p>
    );
  if (!registry) return <p role="status">Loading authorized configuration…</p>;
  return mode === "attributes" ? (
    <AttributePanel
      base={base}
      permissions={context.permissions}
      registry={registry}
    />
  ) : (
    <ProductTypePanel
      base={base}
      permissions={context.permissions}
      registry={registry}
    />
  );
}
export default function SchemaWorkspace({ mode, contexts }) {
  const [tenantId, setTenantId] = useState(contexts[0]?.id ?? "");
  const context = contexts.find((c) => c.id === tenantId);
  return (
    <>
      <div className="page-intro">
        <h1>
          {mode === "attributes" ? "Attributes & Options" : "Product Types"}
        </h1>
        <p className="muted">
          Tenant-shared schema configuration. This workspace does not create
          products, SKUs or storefront filters.
        </p>
      </div>
      <SelectField
        label="Configuration tenant"
        value={tenantId}
        onChange={setTenantId}
      >
        {contexts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      {context ? (
        <TenantWorkspace
          key={`${context.id}-${mode}`}
          context={context}
          mode={mode}
        />
      ) : (
        <p role="alert">No authorized tenant is available.</p>
      )}
    </>
  );
}
