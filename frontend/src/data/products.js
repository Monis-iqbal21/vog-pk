import { catalogueProducts } from './catalogue-products.js';

export const HOMEPAGE_PRODUCT_LIMIT = 7;
export const productCategories = [
  ['graphics-cards', 'Graphics Cards'], ['processors', 'Processors'], ['motherboards', 'Motherboards'],
  ['ram', 'RAM'], ['storage', 'Storage'], ['keyboards', 'Keyboards'], ['gaming-mice', 'Gaming Mice'],
  ['monitors', 'Monitors'], ['power-supplies', 'Power Supplies'], ['pc-cases', 'PC Cases'],
  ['cooling', 'Cooling'], ['accessories', 'Gaming Accessories'],
].map(([slug, name]) => ({ slug, name }));

// Full-record replacements preserve the original category and editorial collection slot.
export const products = catalogueProducts;

export const getFeaturedProducts = () => products.filter((product) => product.active && product.featured).slice(0, HOMEPAGE_PRODUCT_LIMIT);
export const getNewArrivals = () => products.filter((product) => product.active && product.newArrival).slice(0, HOMEPAGE_PRODUCT_LIMIT);
export const getCategoryProducts = (category) => products.filter((product) => product.active && product.category === category).slice(0, HOMEPAGE_PRODUCT_LIMIT);
