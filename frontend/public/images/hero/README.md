# Hero artwork placeholders

These local SVG illustrations are intentional placeholders, not product photography. They contain no promotional text. Replace them with licensed, optimized WebP images and update the three image paths in `src/config/heroSlides.js`.

- `hero-monitors.webp`: recommended 1600 × 1200; three gaming monitors on elevated platforms, central display higher, blue/purple screen art. Keep hardware in the upper half and the lower-left area clear for HTML copy.
- `graphics-card.webp`: recommended 900 × 650; triple-fan graphics card on the right, pale gray/blue background, left two-thirds clear for copy.
- `premium-hardware.webp`: recommended 900 × 650; GPU close-up on the right, dark navy setting with restrained blue/purple lighting, left two-thirds clear for copy.

A reference screenshot was supplied for layout, but no separate hero photographs are available. The screenshot is not used as a background.

## Carousel groups

All three groups are configured in `src/config/heroSlides.js`. The six additional SVGs are category-specific diagram placeholders: gaming PC, processor, motherboard, accessories, keyboard, and gaming mouse. Replace each with licensed artwork using the same main/side compositions above; do not substitute unrelated product photos.

The carousel advances every four seconds. Hover, keyboard focus, hidden tabs, and reduced-motion preferences pause rotation. Manual arrows, dots, or swipes reset the countdown. There is no play/pause button. Swipes require 56px of horizontal movement and ignore link/button touches.

All nine CTA destinations are future routes under `/products/`: `monitors`, `graphics-cards`, `featured`, `gaming-pcs`, `processors`, `motherboards`, `accessories`, `keyboards`, and `gaming-mice`. Product listing pages are outside this task and currently return 404.

See [IMAGE-SIZES.md](./IMAGE-SIZES.md) for measured dimensions, export resolutions, aspect ratios, and responsive composition guidance.
