import { products, productCategories } from "../../data/products.js";
// Explicit compatibility mode, never a dynamic error fallback. Keep reference
// price, unknown inventory, rights and editorial assignments exactly as recorded.
export function staticCatalogSnapshot() {
  return {
    mode: "static-compatibility",
    categories: productCategories,
    products: products.map((p) => ({
      ...p,
      pricingApproved: false,
      purchasable: false,
    })),
  };
}
