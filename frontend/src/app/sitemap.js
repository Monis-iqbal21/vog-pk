import { site } from "@/config/site";
import {
  dynamicCatalog,
  catalogList,
  catalogNavigation,
} from "@/lib/catalog/server";
import { getProductSlugs } from "@/lib/products";
import { productCategories } from "@/data/products";
export default async function sitemap() {
  if (!dynamicCatalog())
    return [
      "/",
      ...productCategories.map((c) => `/products/${c.slug}`),
      ...getProductSlugs().map((p) => `/products/${p.slug}`),
    ].map((path) => ({ url: new URL(path, site.url).href }));
  const [nav, first] = await Promise.all([
    catalogNavigation(),
    catalogList({ pageSize: 24 }),
  ]);
  const pages = [first];
  for (let page = 2; page <= Math.ceil(first.total / 24) && page <= 417; page++)
    pages.push(await catalogList({ page, pageSize: 24 }));
  return [
    "/",
    ...nav.categories.map((c) => c.path),
    ...pages.flatMap((p) => p.items.map((i) => i.path)),
  ].map((path) => ({ url: new URL(path, site.url).href }));
}
