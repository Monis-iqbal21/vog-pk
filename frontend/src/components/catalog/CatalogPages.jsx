import Link from "next/link";
import { notFound, permanentRedirect, unstable_rethrow } from "next/navigation";
import {
  catalogList,
  catalogProduct,
  catalogRoute,
  CatalogError,
} from "@/lib/catalog/server";
import CatalogListing from "./CatalogListing";
import CatalogProduct from "./CatalogProduct";
import CatalogCard from "./CatalogCard";
import { site } from "@/config/site";
import "./catalog.css";
import "@/components/products/ProductListing.css";
import "@/components/products/ProductDetail.css";
import "@/components/products/Products.css";
export function listingParameters(search = {}, extra = {}) {
  const allowed = new Set(["page", "pageSize", "sort", "search"]),
    params = { ...extra },
    filters = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (key.startsWith("f."))
      for (const v of Array.isArray(value) ? value : [value])
        filters.append(key.slice(2), v);
    else if (allowed.has(key) && !Array.isArray(value)) params[key] = value;
    else throw new CatalogError(400);
  }
  if (filters.size) params.filters = filters.toString();
  return params;
}
export function Unavailable({ error }) {
  return (
    <section className="container pl-page">
      <h1>
        {error?.status === 400
          ? "Invalid catalog selection"
          : "Catalog unavailable"}
      </h1>
      <p>
        {error?.status === 400
          ? "Check the filters and try again."
          : "Please try again shortly. Current prices and availability could not be verified."}
      </p>
      <Link href="/products">View products</Link>
    </section>
  );
}
export async function DynamicListingPage({ search, category, collection }) {
  let data;
  try {
    data = await catalogList(
      listingParameters(search, { category, collection }),
    );
  } catch (e) {
    if (e instanceof CatalogError) {
      if (e.status === 404) notFound();
      return <Unavailable error={e} />;
    }
    throw e;
  }
  return (
    <CatalogListing
      key={`${category ?? collection ?? "all"}-${data.canonicalFilters}`}
      data={data}
    />
  );
}
export async function DynamicCatalogPage({ slug, search = {} }) {
  let route;
  try {
    route = await catalogRoute(slug);
  } catch (e) {
    if (e instanceof CatalogError) {
      if (e.status === 404) notFound();
      return <Unavailable error={e} />;
    }
    throw e;
  }
  if (route.redirect) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(search))
      for (const v of Array.isArray(value) ? value : [value])
        params.append(key, v);
    permanentRedirect(
      route.path + (params.size ? "?" + params.toString() : ""),
    );
  }
  if (route.kind === "category")
    return <DynamicListingPage category={route.slug} search={search} />;
  let product, related;
  try {
    if (
      Object.keys(search).some((k) => k !== "variant") ||
      Array.isArray(search.variant)
    )
      throw new CatalogError(400);
    product = await catalogProduct(route.slug, search.variant);
    related = await catalogList({ related: route.slug, pageSize: 4 });
  } catch (e) {
    if (e instanceof CatalogError) {
      if (e.status === 404) notFound();
      return <Unavailable error={e} />;
    }
    throw e;
  }
  // No live Offers structured data until purchasing exists. A reference price
  // must never be advertised as an executable commerce offer.
  const structured = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    url: new URL(product.path, site.url).href,
    ...(product.brand
      ? { brand: { "@type": "Brand", name: product.brand } }
      : {}),
  };
  return (
    <>
      <CatalogProduct key={product.id} product={product} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structured).replace(/</g, "\\u003c"),
        }}
      />
      {related.items.length > 0 && (
        <section className="container product-section">
          <h2>Related products</h2>
          <div className="pl-grid">
            {related.items.map((p) => (
              <CatalogCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
export async function dynamicMetadata(slug, search = {}) {
  try {
    const route = await catalogRoute(slug);
    const value =
      route.kind === "product"
        ? await catalogProduct(route.slug, search.variant)
        : await catalogList({ category: route.slug, pageSize: 1 });
    return {
      title:
        value.seo?.title ||
        value.category?.seo?.title ||
        value.name ||
        value.category?.name,
      description:
        value.seo?.description ||
        value.category?.description ||
        value.description,
      alternates: { canonical: new URL(route.path, site.url).href },
      robots: { index: false, follow: true },
    };
  } catch (error) {
    unstable_rethrow(error);
    return {
      title: "Catalog unavailable",
      robots: { index: false, follow: false },
    };
  }
}
