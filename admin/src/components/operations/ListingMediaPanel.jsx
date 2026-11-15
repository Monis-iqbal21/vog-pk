"use client";
import { useEffect, useState } from "react";
import { TextField, SelectField, CheckField } from "../schema/SchemaFields";
import { read } from "../categories/fields";
import { adminMutation } from "@/lib/client-api";
import { MediaPreview } from "./MediaPanel";
const defaults = {
  fit: "contain",
  loading: "lazy",
  alignment: "center",
  widths: [320, 640, 1280],
};
export default function ListingMediaPanel({
  storeId,
  row,
  permissions,
  onReload,
  parentDirty,
}) {
  const base = `stores/${storeId}/operations/listings/${row.listingId}/revisions/${row.id}/media`,
    [data, setData] = useState(null),
    [references, setReferences] = useState([]),
    [source, setSource] = useState(""),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    read(base)
      .then((d) => {
        if (current) {
          setData(d);
          setReferences(
            d.media.map((r) => ({
              ...r,
              source: r.productMedia ?? r.skuMedia,
            })),
          );
        }
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [base]);
  const sources = data
    ? [
        ...data.productRevision.media.map((r) => ({
          ...r,
          key: "product:" + r.id,
          label: `Shared ${r.purpose}: ${r.altText}`,
        })),
        ...data.productRevision.skus
          .filter((s) => data.skus.some((pin) => pin.skuRevisionId === s.id))
          .flatMap((s) =>
            s.media.map((r) => ({
              ...r,
              key: "sku:" + r.id,
              label: `${s.sku.code} ${r.purpose}: ${r.altText}`,
            })),
          ),
      ]
    : [];
  const editable =
    row.status === "DRAFT" &&
    permissions.includes("listing-media.manage") &&
    permissions.includes("listings.update") &&
    !parentDirty;
  const update = (i, patch) => {
    setReferences(references.map((r, n) => (n === i ? { ...r, ...patch } : r)));
    setDirty(true);
  };
  const move = (i, d) => {
    const a = [...references],
      n = i + d;
    if (n < 0 || n >= a.length) return;
    [a[i], a[n]] = [a[n], a[i]];
    setReferences(a);
    setDirty(true);
  };
  return (
    <section className="schema-card operations-panel">
      <h3>Listing gallery & poster presentation</h3>
      <p role="alert" className="form-error">
        {error}
      </p>
      <p>
        Sources are restricted to this exact approved product revision and its
        selected SKU pins.
      </p>
      {parentDirty && <p>Save listing changes before editing presentation.</p>}
      <fieldset disabled={!editable || busy}>
        <legend>Approved presentation sources</legend>
        <SelectField
          label="Listing media source"
          value={source}
          onChange={setSource}
        >
          <option value="">Select source</option>
          {sources
            .filter((s) => !s.asset.archived)
            .map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
        </SelectField>
        <button
          type="button"
          disabled={!source || references.length >= 24}
          onClick={() => {
            const s = sources.find((s) => s.key === source);
            if (!s) return;
            setReferences([
              ...references,
              {
                productMediaId: s.key.startsWith("product:") ? s.id : null,
                skuMediaId: s.key.startsWith("sku:") ? s.id : null,
                purpose: s.purpose,
                altText: s.altText,
                caption: s.caption,
                visible: s.visible,
                presentation: { ...defaults, ...s.presentation },
                source: s,
              },
            ]);
            setDirty(true);
          }}
        >
          Add listing presentation media
        </button>
        {references.map((r, i) => (
          <fieldset key={i}>
            <legend>
              Listing media {i + 1}: {r.purpose}
            </legend>
            <MediaPreview
              asset={{ ...r.source.asset, altText: r.altText }}
              contentBase={base}
              width={r.purpose === "DETAIL_POSTER" ? 640 : 320}
            />
            <TextField
              label={`Listing media ${i + 1} alternative text`}
              value={r.altText}
              onChange={(v) => update(i, { altText: v })}
            />
            <TextField
              label={`Listing media ${i + 1} caption`}
              value={r.caption ?? ""}
              onChange={(v) => update(i, { caption: v || null })}
            />
            <CheckField
              label={`Listing media ${i + 1} visible`}
              value={r.visible}
              onChange={(v) => update(i, { visible: v })}
            />
            <div className="schema-actions">
              <button
                type="button"
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                Move listing media {i + 1} up
              </button>
              <button
                type="button"
                disabled={i === references.length - 1}
                onClick={() => move(i, 1)}
              >
                Move listing media {i + 1} down
              </button>
              <button
                type="button"
                onClick={() => {
                  setReferences(references.filter((_, n) => n !== i));
                  setDirty(true);
                }}
              >
                Remove listing media {i + 1}
              </button>
            </div>
          </fieldset>
        ))}
        <button
          disabled={!dirty}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await adminMutation(
                base,
                {
                  revision: data.revision,
                  references: references.map((r) => ({
                    productMediaId: r.productMediaId,
                    skuMediaId: r.skuMediaId,
                    purpose: r.purpose,
                    altText: r.altText,
                    caption: r.caption,
                    visible: r.visible,
                    presentation: {
                      ...defaults,
                      fit: r.presentation.fit ?? "contain",
                      loading: r.presentation.loading ?? "lazy",
                      alignment: r.presentation.alignment ?? "center",
                    },
                  })),
                },
                "PATCH",
              );
              await onReload();
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Save listing media order
        </button>
      </fieldset>
      <h4>Listing poster sequence preview</h4>
      {references
        .filter((r) => r.purpose === "DETAIL_POSTER" && r.visible)
        .map((r, i) => (
          <figure key={i}>
            <MediaPreview
              asset={{ ...r.source.asset, altText: r.altText }}
              contentBase={base}
              width={640}
            />
            {r.caption && <figcaption>{r.caption}</figcaption>}
          </figure>
        ))}
      {!references.length && (
        <p>
          No listing media overrides. Shared approved catalog references remain
          unchanged.
        </p>
      )}
    </section>
  );
}
