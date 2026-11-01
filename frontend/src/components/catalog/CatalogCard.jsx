"use client";
/* eslint-disable @next/next/no-img-element -- Already optimized provider derivatives, no unrestricted optimizer. */
import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
export function Money({ offer }) {
  if (!offer) return <>Price unavailable</>;
  const [whole, fraction = ""] = offer.amount.split(".");
  return (
    <>
      {offer.currency} {whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
      {offer.minorUnits ? "." + fraction.padEnd(offer.minorUnits, "0") : ""}
    </>
  );
}
export function PublicImage({ image, className = "", poster = false }) {
  const [failed, setFailed] = useState(null);
  if (!image || failed === image.src)
    return (
      <div
        className="catalog-image-fallback"
        role="img"
        aria-label={image?.alt || "Product image unavailable"}
      >
        Image unavailable
      </div>
    );
  // Provider-generated responsive derivatives. Native picture delivery avoids
  // a second image optimizer or any unrestricted remote image fetch.
  return (
    <img
      className={className}
      src={image.src}
      srcSet={image.sources
        .filter(
          (s, i, a) =>
            a.findIndex(
              (p) =>
                Math.min(p.width, image.width) ===
                Math.min(s.width, image.width),
            ) === i,
        )
        .map((s) => `${s.src} ${Math.min(s.width, image.width)}w`)
        .join(", ")}
      sizes={
        poster
          ? "(min-width: 1280px) 1200px, 100vw"
          : "(min-width: 1024px) 350px, 80vw"
      }
      alt={image.alt}
      width={image.width}
      height={image.height}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(image.src)}
      style={{ width: "100%", height: "auto", objectFit: "contain" }}
    />
  );
}
/** @param {{product:import('@/lib/catalog/contracts').CatalogCard}} props */
export default function CatalogCard({ product }) {
  return (
    <article className="product-card">
      <Link href={product.path} className="product-card-link">
        <div className="product-image-wrap catalog-card-image">
          <PublicImage image={product.media[0]} />
        </div>
        <span className="product-brand">{product.brand}</span>
        <h3 className="product-name">{product.name}</h3>
        <p className="product-description">{product.description}</p>
      </Link>
      <div className="product-card-bottom">
        <div className="product-price-block">
          {product.offer &&
            product.offer.regularAmount !== product.offer.amount && (
              <del>
                {product.offer.currency} {product.offer.regularAmount}
              </del>
            )}
          <span className="product-price">
            <Money offer={product.offer} />
          </span>
          <small>
            {product.sellingMode === "RFQ"
              ? "Request for quote"
              : product.sellingMode === "INFORMATIONAL"
                ? "Information only"
                : product.availability === "in_stock"
                  ? "Available"
                  : product.availability === "out_of_stock"
                    ? "Out of stock"
                    : "Availability unknown"}
          </small>
        </div>
        <button
          className="product-add"
          disabled
          aria-label={`Purchasing disabled for ${product.name}`}
          title="Checkout is not available"
        >
          <Plus size={20} />
        </button>
      </div>
    </article>
  );
}
