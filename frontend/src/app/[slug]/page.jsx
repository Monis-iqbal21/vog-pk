import Link from "next/link";
import { notFound } from "next/navigation";
import { site } from "@/config/site";

const pages = {
  contact: { title: "Contact Us", description: "VOGPK contact details are not configured yet.", body: "For your safety, do not send payment details through an unverified channel. Contact options will be published here when they are available." },
  shipping: { title: "Shipping Information", description: "Shipping information for VOGPK customers.", body: "Delivery coverage, charges and timing have not been published yet. Please confirm delivery terms with VOGPK before placing an order." },
  "returns-warranty": { title: "Returns & Warranty", description: "Returns and warranty information.", body: "Product-specific return and warranty terms are not published yet. Confirm the applicable terms before ordering." },
  faq: { title: "Frequently Asked Questions", description: "Answers to common VOGPK customer questions.", body: "Store policies and support details are being prepared. Product availability and checkout totals are verified again when an order is submitted." },
  "track-order": { title: "Track Order", description: "Order tracking information.", body: "Order lookup and courier tracking are not available yet. Keep the order number from your confirmation for future support." },
  about: { title: "About VOGPK", description: "Vision of Gamers Pakistan.", body: "VOGPK is a gaming hardware storefront. Listings and checkout availability depend on currently approved store data." },
  "privacy-policy": { title: "Privacy Policy", description: "VOGPK privacy information.", body: "A complete privacy policy has not been published. Please avoid submitting personal information until the policy and support contact are available." },
  terms: { title: "Terms & Conditions", description: "VOGPK terms and conditions.", body: "Store terms have not been published yet. Please review the terms before making a purchase." },
  "refund-policy": { title: "Refund Policy", description: "VOGPK refund information.", body: "Refund and cancellation terms have not been published yet. Confirm them with VOGPK before ordering." },
};

export const dynamicParams = false;
export function generateStaticParams() { return Object.keys(pages).map((slug) => ({ slug })); }
export async function generateMetadata({ params }) {
  const page = pages[(await params).slug];
  if (!page) return { title: site.name };
  return { title: `${page.title} | ${site.name}`, description: page.description };
}
export default async function InformationPage({ params }) {
  const page = pages[(await params).slug];
  if (!page) notFound();
  return <main className="container pl-page" data-information-route={page.title}>
    <nav className="pl-breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><span aria-current="page">{page.title}</span></nav>
    <header className="pl-heading"><h1>{page.title}</h1><p>{page.description}</p></header>
    <section className="pl-empty"><p>{page.body}</p><Link href="/products" className="pl-primary-button">Browse products</Link></section>
  </main>;
}
