"use client";
import { useEffect, useRef, useState } from "react";
import ProductCarousel from "@/components/products/ProductCarousel";
import { listSchema } from "@/lib/catalog/contracts";
import CatalogCard from "./CatalogCard";
export default function CatalogShop({ categories, initial }) {
  const [active, setActive] = useState(categories[0]?.slug ?? ""),
    [state, setState] = useState({
      slug: categories[0]?.slug,
      data: initial,
      error: "",
    }),
    request = useRef(null),
    tabs = useRef([]);
  useEffect(() => () => request.current?.abort(), []);
  async function select(slug) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setActive(slug);
    setState({ slug, data: null, error: "" });
    try {
      const response = await fetch(
        "/api/catalog-category?category=" + encodeURIComponent(slug),
        { cache: "no-store", signal: controller.signal },
      );
      if (!response.ok) throw Error("Category products are unavailable.");
      const data = listSchema.parse(await response.json());
      if (!controller.signal.aborted) setState({ slug, data, error: "" });
    } catch (error) {
      if (!controller.signal.aborted)
        setState({ slug, data: null, error: error.message });
    }
  }
  if (!categories.length) return null;
  const category = categories.find((c) => c.slug === active);
  return (
    <ProductCarousel
      id="category"
      title="Shop by Category"
      subtitle="Explore our collections"
      products={state.slug === active ? (state.data?.items ?? []) : []}
      cardComponent={CatalogCard}
      seeAllHref={category.path}
      seeAllLabel={`See All ${category.name}`}
      labelledBy={`catalog-tab-${active}`}
    >
      <div
        className="product-category-tabs"
        role="tablist"
        aria-label="Product categories"
      >
        {categories.map((c, index) => (
          <button
            key={c.id}
            ref={(el) => {
              tabs.current[index] = el;
            }}
            id={`catalog-tab-${c.slug}`}
            role="tab"
            aria-selected={active === c.slug}
            aria-controls="category-track"
            tabIndex={active === c.slug ? 0 : -1}
            onClick={() => select(c.slug)}
            onKeyDown={(e) => {
              let next;
              if (e.key === "ArrowRight")
                next = (index + 1) % categories.length;
              if (e.key === "ArrowLeft")
                next = (index - 1 + categories.length) % categories.length;
              if (e.key === "Home") next = 0;
              if (e.key === "End") next = categories.length - 1;
              if (next !== undefined) {
                e.preventDefault();
                select(categories[next].slug);
                tabs.current[next]?.focus();
              }
            }}
          >
            {c.name}
          </button>
        ))}
      </div>
      {!state.data && (
        <p role={state.error ? "alert" : "status"}>
          {state.error || "Loading category products…"}
        </p>
      )}
    </ProductCarousel>
  );
}
