# Hero image preparation guide

Measured in the rendered production application on 25 October 2026. Dimensions are CSS pixels, rounded to one decimal; source recommendations are physical pixels at 2× device density, rounded up to even widths. Top-right and bottom-right banners have identical dimensions. The 1320px content cap means 1920px does not require wider artwork than 1440px.

| Viewport | Main displayed / ratio | Each side displayed / ratio | Main source at 2× | Each side source at 2× |
| --- | --- | --- | --- | --- |
| 1920px | 868.0 × 618 (1.40:1) | 434.0 × 300 (1.45:1) | 1736 × 1236 | 868 × 600 |
| 1440px | 868.0 × 618 (1.40:1) | 434.0 × 300 (1.45:1) | 1736 × 1236 | 868 × 600 |
| 1366px | 845.3 × 618 (1.37:1) | 422.7 × 300 (1.41:1) | 1692 × 1236 | 846 × 600 |
| 1024px | 617.3 × 618 (1.00:1) | 308.7 × 300 (1.03:1) | 1236 × 1236 | 618 × 600 |
| 768px | 706.6 × 580 (1.22:1) | 344.3 × 310 (1.11:1) | 1414 × 1160 | 690 × 620 |
| 430px | 395.6 × 570 (0.69:1) | 395.6 × 310 (1.28:1) | 792 × 1140 | 792 × 620 |
| 390px | 358.0 × 570 (0.63:1) | 358.0 × 310 (1.15:1) | 716 × 1140 | 716 × 620 |
| 375px | 343.0 × 570 (0.60:1) | 343.0 × 310 (1.11:1) | 686 × 1140 | 686 × 620 |
| 320px | 288.0 × 570 (0.51:1) | 288.0 × 310 (0.93:1) | 576 × 1140 | 576 × 620 |

## Practical export presets

- Large desktop main: 1736 × 1236 (1.40:1); each side: 868 × 600 (1.45:1).
- Small laptop main: 1236 × 1236 (1:1); each side: 618 × 600 (1.03:1).
- Tablet at 768px main: 1414 × 1160 (1.22:1); each side: 690 × 620 (1.11:1). At the top of the tablet range, allow up to 1884 × 1160 for the main and 924 × 620 per side.
- Mobile master for widths through 430px: 792 × 1140 (0.69:1) main; 792 × 620 (1.28:1) side. For all widths below the 768px breakpoint, a larger master up to 1412 × 1140 main and 1412 × 620 side covers 2× density.

These are full banner canvas export sizes, not requirements to stretch the product. Preserve product proportions. A 2× master and Next.js responsive optimization cover ordinary 1× and 2× displays; a 3× export is optional, with higher transfer cost.

## Shared artwork versus separate compositions

All current diagrams can be shared across devices because every image now uses contain. Matching card backgrounds absorb letterboxing. This keeps the whole source image visible; it cannot make a landscape composition fill a portrait card. No extra source variants are required for the present placeholders.

For final photographic artwork, prepare desktop, near-square laptop/tablet, and portrait mobile main compositions if you want the scene to fill its banner. The main card varies from 1.40:1 to 0.51:1; a single scene cannot fill every ratio without cropping or letterboxing. Side compositions vary from 1.45:1 to 0.93:1 at the measured widths. One right-weighted side composition can be shared using contain; use a second near-square version when a full-bleed presentation matters. The table gives exact export targets for each measured width.

Keep main hardware in the upper area, with the bottom-left clear for HTML text and a lower control strip. Keep side products entirely inside the rightmost 35–40% of the canvas and leave the left 60–65% clear. Include at least 5% edge padding around fans, monitor frames, stands, and connectors. Do not bake text into images.

Keep future variants on each banner object in src/config/heroSlides.js; when supplied, art-direct them with picture/source plus Next.js getImageProps at the existing 768/1024px breakpoints. The current configuration intentionally has one shared image per banner, since alternate artwork has not been provided.

## Current assets and corrections

All nine banners still use lightweight SVG placeholders, not real product photographs. The premium GPU, motherboard, keyboard, and mouse drawings had shapes extending beyond their SVG viewboxes; these diagram compositions were reduced/repositioned to keep the complete products inside the source bounds. CSS alone cannot recover content missing from a photograph. Replace any clipped future source with a new composition.

Final assets needed: monitors, graphics card, premium hardware, gaming PC, processor, motherboard, accessories, keyboard, and gaming mouse. Prefer WebP or AVIF for photographs; retain SVG for diagrams. Use opaque backgrounds matching the light-blue or navy card. Start near 80% quality and compare real outputs; avoid upscaling a low-resolution source.

## Runtime behavior and verification

Only the active group renders, with the first main image prioritized. Responsive sizes reflect the capped container, padding, and grid gaps. Contain prevents cropping and distortion. Banner heights stay fixed across slide changes. The three banners change together every four seconds. Previous/next controls and dots remain; the play/pause button was removed. Manual input resets the four-second countdown, and hover, focus, hidden tabs, and reduced motion still pause rotation. Future product URLs remain unimplemented.

All nine viewport widths were measured across all three groups with no horizontal overflow or height shifts. Desktop/tablet/mobile screenshots were captured for visual checks.
