import Link from "next/link";
import { dynamicCatalog } from "@/lib/catalog/server";
import { DynamicListingPage } from "@/components/catalog/CatalogPages";
import "@/components/products/ProductListing.css";

export const metadata = {
  title: "Deals | VOGPK",
  description: "Current approved promotions from VOGPK.",
  robots: { index: false, follow: true },
};

export default function DealsPage({ searchParams }) {
  if (dynamicCatalog())
    return <DynamicListingPage collection="deals" search={searchParams} emptyTitle="No active deals" />;
  return (
    <section className="container pl-page" data-route="deals">
      <nav className="pl-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span>/</span><span aria-current="page">Deals</span>
      </nav>
      <header className="pl-heading"><h1>Deals</h1><p>Only currently active, approved store promotions appear here.</p></header>
      <div className="pl-empty"><h2>No active deals</h2><p>There are no approved promotions available right now.</p><Link href="/products" className="pl-primary-button">Browse all products</Link></div>
    </section>
  );
}
