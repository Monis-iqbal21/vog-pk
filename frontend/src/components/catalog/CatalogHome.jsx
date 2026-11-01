import { unstable_rethrow } from "next/navigation";
import { catalogList, catalogNavigation } from "@/lib/catalog/server";
import ProductCarousel from "@/components/products/ProductCarousel";
import CatalogCard from "./CatalogCard";
import CatalogShop from "./CatalogShop";
import { Unavailable } from "./CatalogPages";
async function loadHome() {
  const [featured, arrivals, navigation] = await Promise.all([
    catalogList({ collection: "featured", pageSize: 7, facets: "omit" }),
    catalogList({ collection: "new-arrivals", pageSize: 7, facets: "omit" }),
    catalogNavigation(),
  ]);
  const categories = navigation.categories.filter((c) => c.inNavigation);
  const initial = categories.length
    ? await catalogList({
        category: categories[0].slug,
        pageSize: 7,
        facets: "omit",
      })
    : null;
  return { featured, arrivals, navigation, categories, initial };
}
export default async function CatalogHome() {
  const data = await loadHome().catch((error) => {
    unstable_rethrow(error);
    return { error };
  });
  if (data.error) return <Unavailable error={data.error} />;
  const { featured, arrivals, categories, initial } = data;
  return (
    <>
      <div className="container product-catalog-note">
        <p>
          Development catalog · Approved store offers. Purchasing is not
          enabled.
        </p>
      </div>
      <ProductCarousel
        id="featured"
        title="Featured Products"
        subtitle="Selected products"
        products={featured.items}
        cardComponent={CatalogCard}
        seeAllHref="/collections/featured"
        seeAllLabel="See All Featured Products"
        singleRow
      />
      <ProductCarousel
        id="new-arrivals"
        title="New Arrivals"
        subtitle="Our latest selection"
        products={arrivals.items}
        cardComponent={CatalogCard}
        seeAllHref="/collections/new-arrivals"
        seeAllLabel="See All New Arrivals"
        singleRow
      />
      <CatalogShop categories={categories} initial={initial} />
    </>
  );
}
