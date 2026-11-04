"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Money, PublicImage } from "./CatalogCard";
function Specs({ groups }) {
  return (
    <section className="pd-specifications">
      <h2>Specifications</h2>
      {groups.map((g) => (
        <section key={g.code}>
          <h3>{g.label}</h3>
          <dl className="catalog-specs">
            {g.fields.map((f) => (
              <div key={`${f.level}-${f.code}`}>
                <dt>{f.label}</dt>
                <dd>
                  {f.value === null
                    ? "Unknown"
                    : typeof f.value === "boolean"
                      ? f.value
                        ? "Yes"
                        : "No"
                      : Array.isArray(f.value)
                        ? f.value.join(", ") || "Unknown"
                        : `${f.value}${f.unit ? " " + f.unit : ""}`}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </section>
  );
}
function Gallery({ images }) {
  const [index, setIndex] = useState(0);
  return (
    <section className="pd-gallery" aria-label="Product gallery">
      <div className="pd-main-image">
        <PublicImage image={images[index] ?? images[0]} />
      </div>
      <div className="pd-thumbnails">
        {images.map((m, i) => (
          <button
            key={m.id}
            className="pd-thumbnail"
            aria-label={`Show ${m.alt}`}
            aria-pressed={i === index}
            onClick={() => setIndex(i)}
          >
            <PublicImage image={m} />
          </button>
        ))}
      </div>
    </section>
  );
}
export default function CatalogProduct({ product }) {
  const router = useRouter(),
    initial = product.variants.find((v) => v.code === product.selectedVariant),
    [selection, setSelection] = useState(initial?.selections ?? {}),
    variant =
      product.variants.find((v) =>
        product.axes.every((a) => selection[a.id] === v.selections[a.id]),
      ) ?? (!product.axes.length ? product.variants[0] : null),
    media = variant?.media ?? product.media;
  useEffect(() => {
    const sync = () => {
      const code = new URL(window.location.href).searchParams.get("variant");
      setSelection(
        product.variants.find((v) => v.code === code)?.selections ?? {},
      );
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [product.variants]);
  function select(axis, value) {
    const next = { ...selection, [axis.id]: value };
    const index = product.axes.findIndex((a) => a.id === axis.id);
    for (const downstream of product.axes.slice(index + 1))
      if (
        next[downstream.id] &&
        !product.variants.some((v) =>
          product.axes
            .slice(0, product.axes.indexOf(downstream) + 1)
            .every((a) => !next[a.id] || v.selections[a.id] === next[a.id]),
        )
      )
        delete next[downstream.id];
    if (!value) delete next[axis.id];
    setSelection(next);
    const resolved = product.variants.find((v) =>
      product.axes.every((a) => v.selections[a.id] === next[a.id]),
    );
    router.replace(
      product.path +
        (resolved ? "?variant=" + encodeURIComponent(resolved.code) : ""),
      { scroll: false },
    );
  }
  const offer = variant?.offer ?? (!product.axes.length ? product.offer : null),
    gallery = media.filter((m) => m.purpose === "GALLERY"),
    posters = media.filter((m) => m.purpose !== "GALLERY");
  return (
    <article className="container pd-page catalog-public-product">
      <nav className="pd-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        {product.categories.map((c) => (
          <Link key={c.id} href={c.path}>
            {c.name}
          </Link>
        ))}
        <span aria-current="page">{product.name}</span>
      </nav>
      <div className="pd-main-layout">
        <Gallery key={variant?.code ?? "shared"} images={gallery} />
        <section>
          <p className="pd-brand">{product.brand}</p>
          <h1>{product.name}</h1>
          <p>{product.description}</p>
          <p>
            Listing:{" "}
            {product.sellingMode === "RFQ"
              ? "Request for quote"
              : product.sellingMode === "INFORMATIONAL"
                ? "Information only"
                : product.sellingMode === "REFERENCE"
                  ? "Reference only"
                  : "Fixed price"}
          </p>
          <p>Product ID: {product.legacyId ?? product.id}</p>
          {product.axes.map((a, index) => {
            const options = a.options.filter((o) =>
              product.variants.some(
                (v) =>
                  v.selections[a.id] === o.id &&
                  product.axes
                    .slice(0, index)
                    .every(
                      (up) =>
                        !selection[up.id] ||
                        v.selections[up.id] === selection[up.id],
                    ),
              ),
            );
            return (
              <label className="catalog-axis" key={a.id}>
                {a.label}
                <select
                  aria-label={a.label}
                  value={selection[a.id] ?? ""}
                  onChange={(e) => select(a, e.target.value)}
                >
                  <option value="">Select {a.label}</option>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
          <p className="product-price">
            <Money offer={offer ?? product.referencePrice} />
            {!offer && product.referencePrice && (
              <small>Reference price · not a selling offer</small>
            )}
          </p>
          {offer && offer.amount !== offer.regularAmount && (
            <p>
              <del>
                {offer.currency} {offer.regularAmount}
              </del>{" "}
              · {offer.promotion}
            </p>
          )}
          <p role="status">
            {!variant && product.axes.length
              ? "Select a valid configuration"
              : variant?.availability === "not_offered"
                ? "No approved selling offer"
                : variant?.availability === "in_stock"
                  ? "Available"
                  : variant?.availability === "out_of_stock"
                    ? "Out of stock"
                    : "Availability unknown"}
          </p>
          <p>Purchasing is not enabled.</p>
          {variant && <p>SKU: {variant.code}</p>}
        </section>
      </div>
      <section className="catalog-description">
        {product.content.map((b, i) =>
          b.type === "bullet" ? (
            <p key={i}>• {b.text}</p>
          ) : (
            <p key={i}>{b.text}</p>
          ),
        )}
      </section>
      <Specs groups={variant?.specifications ?? product.specifications} />
      {posters.length > 0 && (
        <section
          className="catalog-posters"
          aria-label="Product features and guides"
        >
          <h2>Features and guides</h2>
          {posters.map((m) => (
            <figure key={m.id}>
              <PublicImage image={m} poster />
              {m.caption && <figcaption>{m.caption}</figcaption>}
            </figure>
          ))}
        </section>
      )}
    </article>
  );
}
