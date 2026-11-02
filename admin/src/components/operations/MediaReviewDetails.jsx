"use client";
import { useEffect, useState } from "react";
import { read } from "../categories/fields";
export default function MediaReviewDetails({ asset, base }) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    read(`${base}/assets/${asset.id}/review`)
      .then((d) => {
        if (active) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [asset.id, asset.revision, base]);
  if (error) return <p role="alert">{error}</p>;
  if (
    !data ||
    data.asset.id !== asset.id ||
    data.asset.revision !== asset.revision
  )
    return <p>Loading licensing evidence…</p>;
  return (
    <section aria-label="Media licensing review">
      <p>
        <strong>
          {data.publicationBlocked
            ? "Public publication blocked"
            : "Rights and development delivery eligible"}
        </strong>
      </p>
      <p>
        Source:{" "}
        {asset.sourceUrl ? (
          <a href={asset.sourceUrl} target="_blank" rel="noreferrer">
            View recorded source
          </a>
        ) : (
          "Not recorded"
        )}
      </p>
      <p>Content fingerprint: {asset.contentDigest ?? "Not recorded"}</p>
      <details>
        <summary>Recorded source and rights metadata</summary>
        <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {JSON.stringify(asset.rightsMetadata, null, 2)}
        </pre>
      </details>
      <h5>Reviewer decisions</h5>
      <p>
        Showing up to 100 recent decisions and 100 affected listing revisions.
      </p>
      {data.reviews.length ? (
        <ol>
          {data.reviews.map((r) => (
            <li key={r.id}>
              <strong>{r.decision}</strong> · {r.reviewer.name} ·{" "}
              <time dateTime={r.createdAt}>{r.createdAt}</time>
              <p>
                {r.license} {r.attribution}
              </p>
              <p>Evidence: {r.evidenceNote}</p>
              {r.evidenceUrl && (
                <a href={r.evidenceUrl} target="_blank" rel="noreferrer">
                  Evidence record
                </a>
              )}
              <p>
                Conditions:{" "}
                {r.conditions || "No additional conditions recorded"}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p>
          No structured review recorded. Legacy approvals:{" "}
          {data.legacyApprovals.length}.
        </p>
      )}
      <h5>Affected authorized listing revisions</h5>
      {data.affectedListings.length ? (
        <ul>
          {data.affectedListings.map((l) => (
            <li key={l.id}>
              {l.title} · {l.status} · /products/{l.slug}
            </li>
          ))}
        </ul>
      ) : (
        <p>
          No assigned or pending imported listings visible in your authorized
          stores.
        </p>
      )}
      <p>{data.replacement}</p>
    </section>
  );
}
