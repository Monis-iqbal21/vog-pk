# Development product imagery

The catalogue in `src/data/products.js` contains 84 named hardware models/variants selected from public reference pages. Reference prices are third-party observations, not VOGPK selling prices or inventory. See `frontend/docs/product-sources.md` for the complete register and verification limits.

Four exact-model CPU photographs are downloaded and integrated under documented Creative Commons licenses; 80 product photographs remain missing. See `frontend/docs/product-image-assets.md` for the full asset register, `credits.html` for attribution, and `frontend/docs/product-image-files.json` for verified dimensions, download URLs and hashes. Existing unused placeholder files are retained. `catalogue/*-placeholder.svg` files are original category diagrams, not representations of exact product appearance; each filename and accessible label identifies the intended product. No competitor photography is copied or hotlinked. The unidentified user-supplied `51WgWUay7CL.jpg` remains untouched and unassigned.

For approved photography, use exact-model images with documented reuse permission, preferably 800 × 800 WebP or AVIF. Replace the record's image path, provide product-specific alt text, and set imageIsPlaceholder to false. Keep the full hardware inside the image with contain sizing.

ProductCard and ProductCarousel expose onAddToCart(product). A callback alone does not enable purchases: approved selling prices and verified positive stock are also required. All demo records have price null, inventoryVerified false, stock null, and no approved discounts.

Featured and New Arrivals each contain eight distinct, non-overlapping products plus a final View All Products card. Each category currently has seven products followed by View All. Smaller collections remain consecutive without empty slots. Future routes are /products/featured, /products/new-arrivals, /products/{category}, and /products/{category}/{slug}; these pages are not implemented yet.
