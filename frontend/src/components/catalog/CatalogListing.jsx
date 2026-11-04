"use client";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition, useOptimistic } from "react";
import CatalogCard from "./CatalogCard";
import { categoryTrail } from "@/lib/catalog/breadcrumbs";
export default function CatalogListing({ data }) {
  const router = useRouter(),
    pathname = usePathname(),
    query = useSearchParams(),
    [pending, startTransition] = useTransition(),
    [optimisticFilters, setOptimisticFilters] = useOptimistic(
      data.canonicalFilters,
      (_current, next) => next,
    ),
    selected = new URLSearchParams(optimisticFilters);
  function navigate(next) {
    const params = new URLSearchParams(query);
    params.delete("page");
    for (const key of [...params.keys()])
      if (key.startsWith("f.")) params.delete(key);
    for (const [key, value] of next) params.append("f." + key, value);
    startTransition(() => {
      setOptimisticFilters(next.toString());
      router.push(pathname + "?" + params.toString(), { scroll: false });
    });
  }
  function set(code, values) {
    const next = new URLSearchParams(selected);
    next.delete(code);
    for (const value of values) if (value !== "") next.append(code, value);
    navigate(next);
  }
  function page(n) {
    const p = new URLSearchParams(query);
    p.set("page", String(n));
    return pathname + "?" + p.toString();
  }
  return (
    <article className="container pl-page" aria-busy={pending}>
      <nav className="pl-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href="/products">All Products</Link>
        {categoryTrail(data.category, data.categories)
          .slice(0, -1)
          .map((c) => (
            <Link key={c.id} href={c.path}>
              {c.name}
            </Link>
          ))}
        {data.category && (
          <>
            <span>/</span>
            <span>{data.category.name}</span>
          </>
        )}
      </nav>
      <header className="pl-heading">
        {data.category?.image && (
          <picture>
            <img
              src={data.category.image.src}
              alt={data.category.image.alt}
              width="1200"
              height="320"
              style={{ maxWidth: "100%", height: "auto" }}
            />
          </picture>
        )}
        <h1>{data.category?.name ?? "Products"}</h1>
        <p>{data.category?.description}</p>
        <p className="pl-reference-note">
          Approved store offers only. Purchasing is not enabled.
        </p>
      </header>
      <nav className="catalog-category-links" aria-label="Subcategories">
        {data.categories
          .filter((c) => c.parentId === (data.category?.id ?? null))
          .map((c) => (
            <Link key={c.id} href={c.path}>
              {c.name}
            </Link>
          ))}
      </nav>
      <div className="pl-layout">
        <aside className="catalog-filters">
          <details open>
            <summary>Filters</summary>
            {data.filters.map((f) => (
              <fieldset
                disabled={pending}
                className="pl-filter-group"
                key={f.code}
              >
                <legend>
                  {f.label}
                  {f.displayUnit ? ` (${f.displayUnit})` : ""}
                </legend>
                {f.control === "number_range" ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const d = new FormData(e.currentTarget);
                      set(
                        f.code,
                        d.get("min") || d.get("max")
                          ? [`${d.get("min")}..${d.get("max")}`]
                          : [],
                      );
                    }}
                  >
                    <label>
                      Minimum {f.label}
                      <input
                        name="min"
                        inputMode="decimal"
                        defaultValue={
                          selected.get(f.code)?.split("..")[0] ?? ""
                        }
                      />
                    </label>
                    <label>
                      Maximum {f.label}
                      <input
                        name="max"
                        inputMode="decimal"
                        defaultValue={
                          selected.get(f.code)?.split("..")[1] ?? ""
                        }
                      />
                    </label>
                    <button disabled={pending}>Apply {f.label}</button>
                  </form>
                ) : ["single_select", "boolean_toggle"].includes(f.control) ? (
                  <label>
                    {f.label}
                    <select
                      value={selected.get(f.code) ?? ""}
                      onChange={(e) => set(f.code, [e.target.value])}
                    >
                      <option value="">Any</option>
                      {f.values.map((v) => (
                        <option key={v.code} value={v.code}>
                          {v.label} (
                          {data.facets
                            .find((c) => c.code === f.code)
                            ?.values.find((c) => c.code === v.code)?.count ?? 0}
                          )
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  f.values.map((v) => (
                    <label key={v.code}>
                      <input
                        type="checkbox"
                        checked={selected.getAll(f.code).includes(v.code)}
                        onChange={(e) =>
                          set(
                            f.code,
                            e.target.checked
                              ? [...selected.getAll(f.code), v.code]
                              : selected
                                  .getAll(f.code)
                                  .filter((x) => x !== v.code),
                          )
                        }
                      />
                      {v.label}{" "}
                      <span>
                        (
                        {data.facets
                          .find((c) => c.code === f.code)
                          ?.values.find((c) => c.code === v.code)?.count ?? 0}
                        )
                      </span>
                    </label>
                  ))
                )}
              </fieldset>
            ))}
            <button
              disabled={pending}
              onClick={() => navigate(new URLSearchParams())}
            >
              Clear filters
            </button>
          </details>
        </aside>
        <section className="pl-results">
          <div className="pl-toolbar">
            <p role="status">
              {pending ? "Updating products…" : `${data.total} products`}
            </p>
            <label className="pl-sort">
              Sort
              <select
                value={data.sort}
                onChange={(e) => {
                  const p = new URLSearchParams(query);
                  p.set("sort", e.target.value);
                  p.delete("page");
                  startTransition(() =>
                    router.push(pathname + "?" + p.toString()),
                  );
                }}
              >
                {[
                  ["editorial", "Featured order"],
                  ["name", "Name"],
                  ["price-asc", "Price: low to high"],
                  ["price-desc", "Price: high to low"],
                  ["newest", "Newest"],
                ].map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {data.items.length ? (
            <div className="pl-grid">
              {data.items.map((product) => (
                <CatalogCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="pl-empty">
              <h2>No matching products</h2>
              <p>Try fewer filters or a different category.</p>
            </div>
          )}
          <nav className="pl-pagination" aria-label="Product pages">
            {data.page > 1 && <Link href={page(data.page - 1)}>Previous</Link>}
            <span>
              Page {data.page} of{" "}
              {Math.max(1, Math.ceil(data.total / data.pageSize))}
            </span>
            {data.page * data.pageSize < data.total && (
              <Link href={page(data.page + 1)}>Next</Link>
            )}
          </nav>
        </section>
      </div>
    </article>
  );
}
