"use client";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { TextField, SelectField, CheckField } from "../schema/SchemaFields";
import { read } from "../categories/fields";
import { adminMutation } from "@/lib/client-api";
import MediaReviewDetails from "./MediaReviewDetails";
const purposes = [
  "GALLERY",
  "DETAIL_POSTER",
  "SIZE_CHART",
  "DIMENSIONS",
  "INSTALLATION_GUIDE",
  "FEATURE_DIAGRAM",
  "OTHER_CONTENT",
];
const presentation = {
  fit: "contain",
  loading: "lazy",
  alignment: "center",
  widths: [320, 640, 1280],
};
export function MediaPreview({
  asset,
  contentBase,
  width = 320,
  allowReference = false,
}) {
  const [src, setSrc] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    if (
      asset.storageProvider === "LOCAL_DEVELOPMENT" ||
      (allowReference && asset.storageProvider === "REFERENCE")
    )
      read(`${contentBase}/${asset.id}/content?width=${width}`)
        .then((d) => {
          if (current) setSrc(d.dataUrl);
        })
        .catch((e) => {
          if (current) setError(e.message);
        });
    return () => {
      current = false;
    };
  }, [asset.id, asset.storageProvider, contentBase, width, allowReference]);
  return src ? (
    <Image
      unoptimized
      src={src}
      alt={asset.altText || "Media preview"}
      width={asset.width ?? width}
      height={asset.height ?? width}
      style={{
        width: "100%",
        height: "auto",
        maxHeight: width === 320 ? "220px" : undefined,
        objectFit: "contain",
      }}
    />
  ) : (
    <p className="muted">
      {error || "Private preview unavailable for reference-only media."}
    </p>
  );
}
function Library({ base, permissions, onSelect, refresh }) {
  const has = (p) => permissions.includes(p),
    [data, setData] = useState(null),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [tick, setTick] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [uploadState, setUploadState] = useState(""),
    [purpose, setPurpose] = useState("DETAIL_POSTER"),
    [source, setSource] = useState(""),
    [edit, setEdit] = useState(null),
    [meta, setMeta] = useState(null),
    [license, setLicense] = useState(""),
    [publicUse, setPublicUse] = useState(false),
    [evidenceUrl, setEvidenceUrl] = useState(""),
    [evidenceNote, setEvidenceNote] = useState(""),
    [conditions, setConditions] = useState("");
  const uploadKeys = useRef(new Map());
  useEffect(() => {
    let current = true;
    read(`${base}/assets?page=${page}&search=${encodeURIComponent(search)}`)
      .then((d) => {
        if (current) setData(d);
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [base, page, search, tick, refresh]);
  async function run(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      setTick((t) => t + 1);
    }
  }
  async function uploads(files) {
    await run(async () => {
      if (!data?.storage.active) throw Error("Storage provider is inactive.");
      if (files.length > data.storage.limits.maxBatch)
        throw Error("Choose at most eight files per batch.");
      for (const [i, file] of files.entries()) {
        if (file.size > data.storage.limits.maxBytes)
          throw Error(`${file.name}: exceeds the configured file-size limit.`);
        setUploadState(`Uploading ${i + 1} of ${files.length}: ${file.name}`);
        const encoded = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = () => reject(Error("Unable to read image."));
          reader.readAsDataURL(file);
        });
        const fingerprint = `${file.name}:${file.size}:${file.lastModified}:${purpose}:${source}`;
        if (!uploadKeys.current.has(fingerprint))
          uploadKeys.current.set(fingerprint, crypto.randomUUID());
        await adminMutation(base + "/uploads", {
          uploadKey: uploadKeys.current.get(fingerprint),
          fileName: file.name,
          mimeType: file.type,
          dataBase64: encoded,
          altText: file.name.replace(/\.[^.]+$/, "") || "Uploaded image",
          caption: null,
          intendedPurpose: purpose,
          sourceUrl: source || null,
        });
      }
      setUploadState(
        `${files.length} images uploaded privately. Review alternative text and usage rights.`,
      );
    });
  }
  function editing(asset) {
    setEdit(asset);
    setMeta({
      revision: asset.revision,
      altText: asset.altText,
      caption: asset.caption,
      intendedPurpose: asset.intendedPurpose,
      sourceUrl: asset.sourceUrl,
      attribution: asset.rightsMetadata.attribution ?? "",
    });
    setLicense("");
    setPublicUse(false);
    setEvidenceUrl("");
    setEvidenceNote("");
    setConditions("");
  }
  return (
    <section className="schema-card">
      <h3>Media library</h3>
      <p role="alert" className="form-error">
        {error}
      </p>
      <p role="status">{uploadState}</p>
      <TextField
        label="Search media"
        value={search}
        onChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
      />
      {data && (
        <p className="muted">
          Provider: {data.storage.provider} ·{" "}
          {data.storage.active
            ? "Private development uploads enabled"
            : "Uploads inactive"}{" "}
          · Remote uploading inactive.
        </p>
      )}
      {has("media.upload") && (
        <fieldset disabled={busy || !data?.storage.active}>
          <legend>Upload images</legend>
          <SelectField
            label="Uploaded media purpose"
            value={purpose}
            onChange={setPurpose}
          >
            {purposes.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </SelectField>
          <TextField
            label="Media source URL (HTTPS, optional)"
            value={source}
            onChange={setSource}
          />
          <label className="schema-field">
            <span>Images (PNG, JPEG, WebP; at most 8)</span>
            <input
              aria-label="Upload product images"
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const files = [...e.target.files];
                e.target.value = "";
                if (files.length) uploads(files);
              }}
            />
          </label>
          <p>
            Uploads are development-only until rights approval. Files are
            decoded and re-encoded privately; no remote URL is fetched.
          </p>
        </fieldset>
      )}
      <ul className="media-library-grid">
        {data?.items.map((asset) => (
          <li key={asset.id} className="schema-card">
            <MediaPreview asset={asset} contentBase={base + "/assets"} />
            <strong>{asset.altText || asset.code}</strong>
            <p>
              {asset.intendedPurpose} ·{" "}
              {asset.archived ? "Archived" : asset.rights} ·{" "}
              {asset.publicUse ? "Public use approved" : "Development only"}
            </p>
            <div className="schema-actions">
              {onSelect && (
                <button
                  disabled={asset.archived || busy}
                  onClick={() => onSelect(asset)}
                >
                  Assign {asset.altText || "image"}
                </button>
              )}
              <button disabled={busy} onClick={() => editing(asset)}>
                Inspect media {asset.altText || asset.code}
              </button>
              {has("media.manage") && !asset.archived && (
                <button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await adminMutation(
                        `${base}/assets/${asset.id}/archive`,
                        { revision: asset.revision },
                      );
                      setEdit(null);
                    })
                  }
                >
                  Archive {asset.altText || "image"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="schema-actions">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Previous media
        </button>
        <span>
          Page {page} · {data?.total ?? 0} assets
        </span>
        <button
          disabled={page * 12 >= (data?.total ?? 0)}
          onClick={() => setPage(page + 1)}
        >
          Next media
        </button>
      </div>
      {edit && meta && (
        <section className="schema-card">
          <h4>Selected media metadata</h4>
          <MediaPreview
            key={edit.id}
            asset={edit}
            contentBase={base + "/assets"}
            allowReference
          />
          <MediaReviewDetails asset={edit} base={base} />
          <fieldset
            disabled={
              busy ||
              !has("media.manage") ||
              edit.rights === "APPROVED" ||
              edit.archived
            }
          >
            <TextField
              label="Asset alternative text"
              value={meta.altText}
              onChange={(v) => setMeta({ ...meta, altText: v })}
            />
            <TextField
              label="Asset caption"
              value={meta.caption ?? ""}
              onChange={(v) => setMeta({ ...meta, caption: v || null })}
            />
            <TextField
              label="Asset attribution"
              value={meta.attribution}
              onChange={(v) => setMeta({ ...meta, attribution: v })}
            />
            <TextField
              label="Asset source URL"
              value={meta.sourceUrl ?? ""}
              onChange={(v) => setMeta({ ...meta, sourceUrl: v || null })}
            />
            <SelectField
              label="Asset intended purpose"
              value={meta.intendedPurpose}
              onChange={(v) => setMeta({ ...meta, intendedPurpose: v })}
            >
              {purposes.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </SelectField>
            <button
              onClick={() =>
                run(async () =>
                  editing(
                    await adminMutation(
                      `${base}/assets/${edit.id}`,
                      meta,
                      "PATCH",
                    ),
                  ),
                )
              }
            >
              Save media metadata
            </button>
          </fieldset>
          <fieldset
            disabled={
              busy ||
              !has("media.approve") ||
              edit.rights === "APPROVED" ||
              edit.archived
            }
          >
            <legend>Usage-rights decision</legend>
            <TextField
              label="Media license or permission evidence"
              value={license}
              onChange={setLicense}
            />
            <CheckField
              label="I confirm authorization for public use"
              value={publicUse}
              onChange={setPublicUse}
            />
            <TextField
              label="Rights evidence URL (HTTPS, optional)"
              value={evidenceUrl}
              onChange={setEvidenceUrl}
            />
            <TextField
              label="Rights evidence notes or rejection reason"
              value={evidenceNote}
              onChange={setEvidenceNote}
            />
            <TextField
              label="License conditions and restrictions"
              value={conditions}
              onChange={setConditions}
            />
            <button
              onClick={() =>
                run(async () =>
                  editing(
                    await adminMutation(`${base}/assets/${edit.id}/approve`, {
                      revision: edit.revision,
                      license,
                      attribution: meta.attribution,
                      scope: publicUse ? "PUBLIC" : "DEVELOPMENT",
                      evidenceUrl: evidenceUrl || null,
                      evidenceNote,
                      conditions,
                    }),
                  ),
                )
              }
            >
              Approve media rights
            </button>
            <button
              disabled={!evidenceNote.trim()}
              onClick={() =>
                run(async () =>
                  editing(
                    await adminMutation(`${base}/assets/${edit.id}/reject`, {
                      revision: edit.revision,
                      reason: evidenceNote,
                      evidenceUrl: evidenceUrl || null,
                      conditions,
                    }),
                  ),
                )
              }
            >
              Reject commercial usage
            </button>
          </fieldset>
          <p>
            Approved media is immutable. Upload replacement bytes as a new
            asset; existing reviewed references remain intact.
          </p>
        </section>
      )}
    </section>
  );
}
function Organizer({ row, base, permissions, onReload, parentDirty }) {
  const path = `${base}/products/${row.productId}/revisions/${row.id}/assignments`,
    [data, setData] = useState(null),
    [target, setTarget] = useState("shared"),
    [references, setReferences] = useState([]),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    read(path)
      .then((d) => {
        if (active) {
          setData(d);
          setReferences(d.shared.map((ref) => ({ ...ref, asset: ref.asset })));
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [path]);
  const editable =
    row.status === "DRAFT" &&
    permissions.includes("media.manage") &&
    permissions.includes("products.update") &&
    !parentDirty &&
    (target === "shared" || permissions.includes("skus.update"));
  const choose = (id) => {
    setTarget(id);
    const selected =
      id === "shared"
        ? data.shared
        : (data.skus.find((s) => s.id === id)?.media ?? []);
    setReferences(selected);
    setDirty(false);
  };
  const update = (i, patch) => {
    setReferences(references.map((r, n) => (n === i ? { ...r, ...patch } : r)));
    setDirty(true);
  };
  const move = (i, delta) => {
    const next = [...references],
      j = i + delta;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setReferences(next);
    setDirty(true);
  };
  return (
    <>
      <section className="schema-card">
        <h2>Gallery & promotional posters</h2>
        <p role="alert" className="form-error">
          {error}
        </p>
        <p>
          Shared product media and SKU-specific images are separate. Poster
          sequence is previewed below; no public storefront renderer is changed.
        </p>
        {parentDirty && (
          <p role="status">Save catalog changes before organizing media.</p>
        )}
        {data && (
          <SelectField
            label="Media assignment target"
            value={target}
            disabled={dirty || busy}
            onChange={choose}
          >
            <option value="shared">Shared product revision</option>
            {data.skus.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · SKU revision
              </option>
            ))}
          </SelectField>
        )}
        <fieldset disabled={!editable || busy}>
          <legend>Ordered media assignments</legend>
          {references.map((ref, i) => (
            <fieldset key={`${ref.assetId}-${i}`}>
              <legend>Media assignment {i + 1}</legend>
              <MediaPreview
                asset={ref.asset}
                contentBase={base + "/assets"}
                width={ref.purpose === "DETAIL_POSTER" ? 640 : 320}
              />
              <SelectField
                label={`Assignment ${i + 1} purpose`}
                value={ref.purpose}
                onChange={(v) => update(i, { purpose: v })}
              >
                {purposes.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </SelectField>
              <TextField
                label={`Assignment ${i + 1} alternative text`}
                value={ref.altText}
                onChange={(v) => update(i, { altText: v })}
              />
              <TextField
                label={`Assignment ${i + 1} caption`}
                value={ref.caption ?? ""}
                onChange={(v) => update(i, { caption: v || null })}
              />
              <CheckField
                label={`Assignment ${i + 1} visible`}
                value={ref.visible}
                onChange={(v) => update(i, { visible: v })}
              />
              <SelectField
                label={`Assignment ${i + 1} loading`}
                value={ref.presentation.loading ?? "lazy"}
                onChange={(v) =>
                  update(i, {
                    presentation: {
                      ...presentation,
                      ...ref.presentation,
                      loading: v,
                    },
                  })
                }
              >
                <option value="lazy">Load when near viewport</option>
                <option value="eager">Eager</option>
              </SelectField>
              <div className="schema-actions">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  Move assignment {i + 1} up
                </button>
                <button
                  type="button"
                  disabled={i === references.length - 1}
                  onClick={() => move(i, 1)}
                >
                  Move assignment {i + 1} down
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReferences(references.filter((_, n) => n !== i));
                    setDirty(true);
                  }}
                >
                  Remove assignment {i + 1}
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
                const payload = references.map((r) => ({
                  assetId: r.assetId,
                  purpose: r.purpose,
                  altText: r.altText,
                  caption: r.caption,
                  visible: r.visible,
                  presentation: {
                    ...presentation,
                    fit: r.presentation.fit ?? "contain",
                    loading: r.presentation.loading ?? "lazy",
                    alignment: r.presentation.alignment ?? "center",
                  },
                }));
                await adminMutation(
                  target === "shared"
                    ? path
                    : `${base}/products/${row.productId}/revisions/${row.id}/skus/${target}/assignments`,
                  { revision: data.revision, references: payload },
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
            Save ordered media assignments
          </button>
        </fieldset>
        <h3>Promotional poster sequence preview</h3>
        {references
          .filter((r) => r.purpose === "DETAIL_POSTER" && r.visible)
          .map((ref, i) => (
            <figure key={`${ref.assetId}-${i}`}>
              <MediaPreview
                asset={{ ...ref.asset, altText: ref.altText }}
                contentBase={base + "/assets"}
                width={640}
              />
              {ref.caption && <figcaption>{ref.caption}</figcaption>}
            </figure>
          ))}
        {!references.some(
          (r) => r.purpose === "DETAIL_POSTER" && r.visible,
        ) && (
          <p>
            No visible posters assigned. Products without posters are supported.
          </p>
        )}
      </section>
      <Library
        base={base}
        permissions={permissions}
        onSelect={
          editable
            ? (asset) => {
                if (references.length >= 24) {
                  setError("At most 24 assignments per target.");
                  return;
                }
                setReferences([
                  ...references,
                  {
                    assetId: asset.id,
                    asset,
                    purpose: asset.intendedPurpose,
                    altText: asset.altText,
                    caption: asset.caption,
                    visible: true,
                    presentation,
                  },
                ]);
                setDirty(true);
              }
            : null
        }
      />
    </>
  );
}
export default function MediaPanel({
  tenantId,
  permissions,
  row,
  onReload,
  parentDirty = false,
}) {
  const base = `scopes/tenants/${tenantId}/media`;
  if (!permissions.includes("media.view")) return null;
  return (
    <div className="operations-panel">
      {row ? (
        <Organizer
          key={`${row.id}-${row.revision}`}
          row={row}
          base={base}
          permissions={permissions}
          onReload={onReload}
          parentDirty={parentDirty}
        />
      ) : (
        <Library base={base} permissions={permissions} />
      )}
    </div>
  );
}
