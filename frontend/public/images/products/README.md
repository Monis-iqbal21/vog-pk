# Product image placeholders

The catalog in `src/data/products.js` contains frontend fixtures only. Names, prices, and dates are illustrative; no live inventory or discounts are claimed. Replace each product's `image` path with licensed product photography and set `imageIsPlaceholder` to false when ready.

The shared SVG is a neutral placeholder. Real photos are missing for all 19 sample entries. Supply square WebP or AVIF images, ideally 800 × 800px with transparent or neutral backgrounds and enough edge padding to retain the complete product. Cards use Next.js Image with contain sizing; never include prices or names inside images.

`ProductCard` and `ProductCarousel` accept `onAddToCart(product)` for future integration. Without a handler, the circular cart control is disabled and labeled coming soon. No cart state or success message is simulated.

Future destinations: `/products/featured`, `/products/new-arrivals`, `/products/{category}`, and `/products/{category}/{product-slug}`. These pages are not implemented in this UI phase and return 404. Category selection filters fixtures and resets only its own track. Collections are capped at eight items followed by the See All card; smaller categories are not padded with duplicate products.
