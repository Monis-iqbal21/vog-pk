import Image from "next/image";
import { unstable_rethrow } from "next/navigation";
import { catalogHomepage, catalogList, catalogNavigation } from "@/lib/catalog/server";
import ProductCarousel from "@/components/products/ProductCarousel";
import CatalogCard from "./CatalogCard";
import CatalogShop from "./CatalogShop";
import { Unavailable } from "./CatalogPages";

async function loadHome() {
  const [homepage, navigation] = await Promise.all([catalogHomepage(), catalogNavigation()]);
  if (homepage.revision && (homepage.slides.length || homepage.sections.length)) {
    const sections = await Promise.all(homepage.sections.map(async (section, index) => {
      const query = section.kind === "CATEGORY" ? { category: section.category.slug } : { collection: section.kind === "FEATURED" ? "featured" : "new-arrivals" };
      return { ...section, id: `managed-home-${index}`, data: await catalogList({ ...query, pageSize: 7, facets: "omit" }) };
    }));
    return { homepage, sections, navigation, managed: true };
  }
  const [featured, arrivals] = await Promise.all([
    catalogList({ collection: "featured", pageSize: 7, facets: "omit" }),
    catalogList({ collection: "new-arrivals", pageSize: 7, facets: "omit" }),
  ]);
  const categories = navigation.categories.filter((category) => category.inNavigation);
  const initial = categories.length ? await catalogList({ category: categories[0].slug, pageSize: 7, facets: "omit" }) : null;
  return { homepage, featured, arrivals, navigation, categories, initial, managed: false };
}

function HeroSlides({ slides }) {
  if (!slides.length) return null;
  return <section className="container cms-hero" aria-label="Store highlights">
    {slides.map((slide, index) => <article key={`${slide.imageUrl}-${index}`} className="cms-hero-slide">
      <Image src={slide.imageUrl} alt="" width={1280} height={640} priority={index === 0} unoptimized />
      <div className="cms-hero-copy">{slide.eyebrow && <p>{slide.eyebrow}</p>}<h1>{slide.title}</h1><p>{slide.description}</p>{slide.href && slide.buttonLabel && <a className="button button-primary" href={slide.href}>{slide.buttonLabel}</a>}</div>
    </article>)}
  </section>;
}

export default async function CatalogHome() {
  const data = await loadHome().catch((error) => { unstable_rethrow(error); return { error }; });
  if (data.error) return <Unavailable error={data.error} />;
  return <>
    <HeroSlides slides={data.homepage.slides} />
    <div className="container product-catalog-note"><p>Current offers and verified availability are shown from this store. Final price and stock are checked again at checkout.</p></div>
    {data.managed ? data.sections.map((section) => <ProductCarousel key={section.id} id={section.id} title={section.title} subtitle={section.kind === "CATEGORY" ? `Shop ${section.category.name}` : "Explore our collection"} products={section.data.items} cardComponent={CatalogCard} seeAllHref={section.kind === "CATEGORY" ? section.category.path : section.kind === "FEATURED" ? "/collections/featured" : "/collections/new-arrivals"} seeAllLabel={`View all ${section.title}`} singleRow />) : <>
      <ProductCarousel id="featured" title="Featured Products" subtitle="Selected products" products={data.featured.items} cardComponent={CatalogCard} seeAllHref="/collections/featured" seeAllLabel="See All Featured Products" singleRow />
      <ProductCarousel id="new-arrivals" title="New Arrivals" subtitle="Our latest selection" products={data.arrivals.items} cardComponent={CatalogCard} seeAllHref="/collections/new-arrivals" seeAllLabel="See All New Arrivals" singleRow />
      <CatalogShop categories={data.categories} initial={data.initial} />
    </>}
  </>;
}
