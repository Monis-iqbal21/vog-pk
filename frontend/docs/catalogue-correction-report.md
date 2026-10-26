# VOGPK catalogue correction — 27 October 2026

The active development catalogue now has 84 local PNG product images, with complete matching records and 65 model substitutions. Two processor images remain explicitly below the desired launch standard; this is not a production-ready asset clearance.

## Counts

| Measure | Count |
|---|---:|
| Products individually reviewed | 84 |
| Existing source photographs retained (reformatted/recomposed) | 5 |
| Image assignments replaced, including placeholders | 79 |
| Illustrated placeholders replaced | 62 |
| Existing photographic assignments replaced | 17 |
| Entire product models replaced with matching data | 65 |
| Existing model identities retained | 19 |
| Real product image assignments | 84 |
| Unique photographic content | 82 |
| Remaining placeholders or missing local files | 0 |
| Products with observed numeric PKR reference prices | 84 |
| Price references checked on 27 October | 66 |
| Earlier 26 October references retained for unchanged products | 18 |
| Documented image-quality exceptions | 2 |

“Retained” counts the original source photograph, not an unchanged filename: all active delivery paths now use PNG masters. Five retained photographs: kingston-fury-beast-16gb-4800, philips-evnia-27m2n3500nf-00, lenovo-legion-r27qc-30, asus-rog-strix-1200-platinum, intel-core-i9-14900k. The other 79 assignments replace 62 line illustrations and 17 existing photographic assignments. Two RAM pairs intentionally share supplier packshots for physically identical modules/kits; exact SKUs and differing capacity/speed facts are separate. See [shared packshot evidence](catalogue-shared-packshots.json). This is documented source reuse, not an accidental image assignment.

## Catalogue and content

- Exactly seven unique products in each of 12 categories.
- Featured and New Arrivals each show seven products followed by a View All card in an independent single horizontal row, following the latest display request. No overlap. Original category membership and catalogue records are preserved.
- Every replacement updates ID/slug, brand, model, original short description, reference price, retailer URL/date, SKU where available, specifications, source/licensing and image together.
- Product-specific technical facts are retained in the central dataset. Conflicting feed facts were corrected with documented primary/retailer evidence, including MSI PANO motherboard support and keyboard switch/layout variants.
- PKR amounts are observed retailer references, including sold-out/pre-order listings, not live prices. No discounts or VOGPK selling prices are invented. Selling prices and stock remain null, purchasing disabled.
- New Arrivals is a curated demo collection, not a claim of newly received inventory.

## Image preparation and rights

All active files are PNG, square 700–1000px (74 at 1000px). Source proportions and full product edges are preserved. Uniform outer-border trim and conservative whole-PCB CPU crops retain hardware details; no hardware was generated or reconstructed. Smaller canvases maintain approximately 80% subject scale without enlarging lower-resolution sources. White backgrounds are used; automatic background segmentation was avoided. ProductCard retains Next Image optimization, object-fit contain, equal containers and aligned content; only image padding changed to 8px.

77 assets come from non-private ProductImage galleries returned by the documented Open Icecat public demonstration workflow, used only for local development evaluation. Seven processor assets use CC BY 4.0 or CC BY-SA 4.0, with attribution, license links, modification notices and ShareAlike preserved. The public credits page has all 84 records and links the local Open Content License copy. Production/regular Icecat use still requires VOGPK's appropriate account/license and asset approval. All 84 are marked development-only for the user's launch review.

No restricted retailer photographs were copied. ZAH, Tech Arc, Zestro and RB Tech were searched as model/price references; exact permitted imagery took priority over brand preservation. Additional Pakistani sellers were used where the preferred sources did not list a matching SKU/price. Public search/listing evidence may lag the retailer; every reference needs reconfirmation before launch. No private Icecat galleries, credentials or restricted Full Icecat assets were accessed.

## Remaining gaps

1. **Intel Core i9-14900K**: exact-model clean photograph retained, but its original is only 600×575px. It is not upscaled. A higher-resolution approved packshot or a fully verified premium substitute is still needed.
2. **Intel Core i5-11400**: complete high-resolution photograph, but the photographed specimen has visible lid wear. A pristine authorized packshot or a better fully verified gaming CPU replacement is still needed. Kept outside both homepage curated collections.
3. **Production clearance**: the 77 Icecat demonstration images require the appropriate regular/production license; all assets remain launch-review pending.
4. **Pre-existing destination pages**: product detail and category listing routes return HTTP 404. Carousel controls and See All URL mappings work, but their destination pages are not implemented. These routes were already absent; no route or UI redesign was introduced in this imagery task.
5. The deployed reference site could not be retrieved by the web tool during this pass. The updated local production build is verified; no deployment or push was performed.

## Verification

- 'npm run verify:product-images': 84 valid images and complete records; zero missing/corrupt files, broken references, duplicate IDs/slugs/models, unexplained duplicate photos, invalid categories, missing numeric prices or descriptions. Two documented shared-image pairs and two quality exceptions are reported explicitly. '--require-complete' remains intentionally failing until launch clearance and quality gaps are resolved.
- Frontend lint: passed. Production build: passed.
- Browser: 112 section checks at 1440, 1280, 1024, 768, 430, 390, 375, 320px. Featured, New Arrivals and all 12 tabs at every width; every image decoded; object-fit contain, square containers, aligned brand/title/description/price/plus controls, disabled purchasing, arrow navigation, keyboard Home/End and correct See All mappings checked. Zero page errors, image failures or horizontal page overflow.
- Actual source contact sheets and rendered cards were visually inspected. Browser screenshots are local at 'C:\Users\Monis\AppData\Local\Temp\vog-catalogue-browser'; [machine-readable browser results](catalogue-browser-verification.json).
- Desktop mouse dragging and native mobile touch swiping passed separately; carousels scroll independently and dragging suppresses product-link activation. [Interaction evidence](catalogue-interaction-verification.json).
- The validation scope covers the development catalogue, not checkout/backend or the unimplemented destination pages.

## Changed implementation files

- 'src/data/products.js': collection API retained, now reads the reviewed catalogue.
- 'src/data/catalogue-products.js': all 84 complete active product records.
- 'src/data/catalogue-images.js', 'src/data/product-images.js': current source/license/image manifest.
- 'src/components/products/Products.css': image padding only.
- 'public/images/products/*.png': local masters; 'credits.html' and 'OPEN-ICECAT-LICENSE.txt': attribution and license.
- 'scripts/research-catalogue-candidates.mjs', 'research-retained-catalogue.mjs', 'review-catalogue-images.mjs', 'prepare-catalogue-masters.mjs', 'prepare-processor-masters.mjs', 'build-corrected-catalogue.mjs', 'verify-catalogue.mjs', 'verify-product-images.mjs', 'verify-catalogue-browser.cjs', 'write-catalogue-report.mjs': reproducible research/preparation/checks.
- 'docs/catalogue-*.json', 'product-image-*.json', this report and updated asset/source documentation: per-product audit, before/after, decisions, permissions, prices and verification.

Navbar, footer, hero, card structure, carousels, tab interaction, cart behavior and backend are preserved. Earlier uncommitted image-credit and research work is incorporated. The user's unassigned JPG and video are untouched.

## Full product replacement inventory

The machine-readable inventory includes all 84 reviewed slots: [catalogue-corrections.json](catalogue-corrections.json). All 65 complete model substitutions follow.

| Old product | New product | New reference PKR | PNG image in public/images/products | Source URL |
|---|---|---:|---|---|
| SAPPHIRE NITRO+ Radeon RX 9070 XT OC PhantomLink Polar Edition | ASUS ROG Astral GeForce RTX 5080 OC 16GB | 680,000 | `asus-rog-astral-rtx5080-oc-16gb.png` | [Retail reference](https://zestrogaming.com/shop/) |
| ZOTAC GAMING GeForce RTX 5080 SOLID OC White Edition | ASUS Prime GeForce RTX 5080 OC 16GB | 550,000 | `asus-prime-rtx5080-oc-16gb.png` | [Retail reference](https://zahcomputers.pk/brand/asus/?category=604) |
| Palit GeForce RTX 5070 Ti GamingPro-S 16GB | ASUS Prime GeForce RTX 5070 OC 12GB White | 228,000 | `asus-prime-rtx5070-oc-12gb-white.png` | [Retail reference](https://zahcomputers.pk/product/asus-prime-geforce-rtx-5070-oc-12gb-graphics-card-white-edition/) |
| ASUS Dual GeForce RTX 5060 Ti 16GB | ASUS Dual GeForce RTX 5070 OC 12GB | 269,999 | `asus-dual-rtx5070-oc-12gb.png` | [Retail reference](https://rbtechngames.com/product-category/computers/graphics-card/) |
| AMD Ryzen 7 9800X3D | AMD Ryzen 9 9950X (Tray) | 149,999 | `amd-ryzen9-9950x.png` | [Retail reference](https://www.zahcomputers.pk/product/amd-ryzen-9-9950x-4-3-ghz-16-core-am5-gaming-processor-tray/) |
| Intel Core Ultra 9 285K | Intel Core i7-13700K (Tray) | 99,999 | `intel-core-i7-13700k-tray.png` | [Retail reference](https://www.shophive.com/intel-core-i7-13700k-5-4ghz-16-core-tray-processor/) |
| AMD Ryzen 9 9950X3D | Intel Core i5-13600K | 81,999 | `intel-core-i5-13600k.png` | [Retail reference](https://www.shophive.com/intel-core-i5-13600k-5-10ghz-14-core-processor/) |
| Intel Core Ultra 7 265K | Intel Core i7-12700K (Tray) | 75,000 | `intel-core-i7-12700k-tray.png` | [Retail reference](https://zahcomputers.pk/product/intel-core-i7-12700k-core-i7-12th-gen-alder-lake-12-core-8p4e-3-6-ghz-lga-1700-125w-intel-uhd-graphics-770-desktop-processor-tray/) |
| Intel Core i7-14700K | Intel Core i7-12700KF (Tray) | 70,000 | `intel-core-i7-12700kf-tray.png` | [Retail reference](https://zahcomputers.pk/page/3/?filter_category=projector%2Cmac-studio%2Cdesktop-computers%2Cprocessors%2Cpre-builds&post_type=product&shop_view=list) |
| AMD Ryzen 9 9900X (Tray) | Intel Core i5-11400 | 44,999 | `intel-core-i5-11400.png` | [Retail reference](https://www.shophive.com/intel-core-i5-11400-processor) |
| Lexar ARES RGB 2nd Gen DDR5 32GB (2×16GB) 8000 | Kingston FURY Beast DDR5 16GB 6000 CL36 Black | 24,799 | `kingston-fury-beast-ddr5-16gb-6000.png` | [Retail reference](https://www.tejar.pk/kingston-fury-beast-ddr5-memory) |
| Lexar THOR RGB 2nd Gen DDR5 64GB (2×32GB) 6000 | Kingston FURY Beast DDR5 16GB 5600 CL40 Black | 54,999 | `kingston-fury-beast-ddr5-16gb-5600.png` | [Retail reference](https://rbtechngames.com/shop-2/computers/rams/kingston-fury-beast-16gb-1x16gb-5600mt-s-cl40-ddr5-desktop-memory-black/) |
| Crucial CT32G48C40U5 32GB DDR5-4800 | XPG SPECTRIX D35G RGB 16GB (2x8GB) DDR4-3200 White | 45,000 | `xpg-spectrix-d35g-16gb-3200-white.png` | [Retail reference](https://zahcomputers.pk/category/memory-module-ram/) |
| Corsair VENGEANCE LPX 32GB (2×16GB) DDR4-3200 | XPG LANCER BLADE RGB DDR5 32GB (2x16GB) 6000 Black | 60,499 | `xpg-lancer-blade-rgb-32gb-6000.png` | [Retail reference](https://www.tejar.pk/xpg-lancer-blade-rgb-ddr5-memory) |
| Lexar 32GB DDR5-5600 UDIMM | XPG SPECTRIX D35G RGB 32GB (2x16GB) DDR4-3600 White | 71,499 | `xpg-spectrix-d35g-32gb-3600-white.png` | [Retail reference](https://zahcomputers.pk/product/xpg-spectrix-d35g-rgb-32gb-2x16gb-3600mhz-c18-ddr4-dram-desktop-memory-white/) |
| Razer DeathAdder V4 Pro Black | ASUS ROG Harpe Ace Aim Lab Edition | 29,499 | `asus-rog-harpe-ace-aim-lab.png` | [Retail reference](https://zahcomputers.pk/product/asus-rog-harpe-ace-aim-lab-edition-gaming-mouse/) |
| Logitech G PRO X2 SUPERSTRIKE | ASUS ROG Keris II Ace Black | 32,999 | `asus-rog-keris-ii-ace-black.png` | [Retail reference](https://zahcomputers.pk/category/mouse/?brand=2945) |
| Bloody W95 Ultra Stone Black | ASUS ROG Gladius III Wireless Black | 26,999 | `asus-rog-gladius-iii-wireless.png` | [Retail reference](https://zahcomputers.pk/product/asus-rog-gladius-iii-wireless-2-4ghz-and-bluetooth-gaming-mouse/) |
| Bloody R73 Pro Black | ASUS ROG Chakram X Origin | 37,499 | `asus-rog-chakram-x-origin.png` | [Retail reference](https://zahcomputers.pk/product/asus-rog-chakram-x-p708-origin-gaming-mouse/) |
| AULA SC380Pro Black | ASUS ROG Strix Impact III Black | 10,500 | `asus-rog-strix-impact-iii.png` | [Retail reference](https://zahcomputers.pk/product/asus-rog-strix-impact-iii-p518-gaming-mouse/) |
| ATTACK SHARK RS3 ULTRA Carbon Fiber White | ASUS TUF Gaming M4 Air | 9,499 | `asus-tuf-m4-air.png` | [Retail reference](https://zahcomputers.pk/category/mouse/?brand=2945) |
| Fantech Kanata S VX9S | ASUS ROG Spatha X | 37,500 | `asus-rog-spatha-x.png` | [Retail reference](https://zahcomputers.pk/product/asus-rog-spatha-x-p707-wireless-gaming-mouse/) |
| Logitech G G915 TKL Tactile Carbon Black | ASUS ROG Strix Scope II 96 Wireless NX Snow | 39,499 | `asus-rog-scope-ii-96-wireless-nx-snow.png` | [Retail reference](https://zahcomputers.pk/product/asus-rog-strix-scope-ii-96-wireless-gaming-keyboard-nx-snow-linear-switches/) |
| ASUS ROG Azoth M701 NX Red Black | ASUS ROG Falchion RX Low Profile RX Red | 39,499 | `asus-rog-falchion-rx-low-profile-red.png` | [Retail reference](https://rbtechngames.com/shop-2/gaming-gear-peripherals/keyboards/asus-rog-falchion-rx-low-profile-m603-65-compact-gaming-keyboard-rx-red-switches-with-abs-keycaps/) |
| ATTACK SHARK R98 HE Moonlight | ASUS ROG Strix Scope RX Red | 25,200 | `asus-rog-scope-rx-red.png` | [Retail reference](https://www.dynamiccomputer.pk/keyboard/asus-keyboards/asus-rog-strix-scope-rx-rgb-mechanical-gaming-keyboard-red-switch) |
| AULA F2088 Air Red Switch White | ASUS ROG Strix Scope RX TKL Wireless Deluxe RX Red Black | 44,500 | `asus-rog-scope-rx-tkl-wireless-red.png` | [Retail reference](https://www.pakbyte.pk/products/asus-rog-strix-scope-rx-tkl-wireless-deluxe-gaming-keyboard) |
| AULA F75 Retro White Milk White Switch | ASUS TUF Gaming K3 Red US | 20,499 | `asus-tuf-k3-red-us.png` | [Retail reference](https://zahcomputers.pk/product/asus-tuf-gaming-k3-rgb-wired-mechanical-keyboard/) |
| AULA WIN68 HE Max Grey & Yellow | ASUS ROG Falchion Ace NX Red | 28,500 | `asus-rog-falchion-ace-nx-red.png` | [Retail reference](https://zahcomputers.pk/product/asus-rog-falchion-ace-m602-65-rgb-compact-gaming-mechanical-keyboard/) |
| AULA WIN60 HE Max White & Blue | ASUS TUF Gaming K1 US English | 11,490 | `asus-tuf-k1.png` | [Retail reference](https://www.pakbyte.pk/collections/keyboards?page=5) |
| ASUS PRIME B850M-F-CSM | MSI MAG B650 TOMAHAWK WIFI | 67,999 | `msi-mag-b650-tomahawk-wifi.png` | [Retail reference](https://redtech.pk/product/msi-mag-b650-tomahawk-wifi-am5-amd-motherboard/) |
| Corsair MP600 MINI 1TB | Kingston FURY Renegade 2TB NVMe SSD | 58,000 | `kingston-fury-renegade-2tb.png` | [Retail reference](https://zahcomputers.pk/product/kingston-fury-renegade-2tb-pcie-gen-4-0-nvme-m-2-internal-gaming-ssd-up-to-7300-mb-s-graphene-heat-spreader-3d-tlc-nand-works-with-ps5-solid-state-drive/) |
| Corsair MP700 ELITE 1TB with Heatsink | Kingston NV2 1TB NVMe SSD | 16,500 | `kingston-nv2-1tb.png` | [Retail reference](https://www.muscatcomputer.pk/kingston-ssds) |
| Lexar NQ780 512GB | Kingston NV3 1TB NVMe SSD | 39,000 | `kingston-nv3-1tb.png` | [Retail reference](https://www.czone.com.pk/solid-state-drives-ssd-kingston-ssds-kingston-nv3-1tb-m-2-2280-pcie-4-0-nvme-ssd-snv3s-1000g-6000mb-s-pakistan-p.17447.aspx) |
| Lexar NQ780 2TB | Kingston NV3 2TB NVMe SSD | 66,500 | `kingston-nv3-2tb.png` | [Retail reference](https://www.muscatcomputer.pk/kingston-ssds) |
| Lexar SL500 1TB Black | Kingston FURY Renegade 1TB NVMe SSD | 45,000 | `kingston-fury-renegade-1tb.png` | [Retail reference](https://www.alb.net.pk/product/kingston-fury-renegade-1tb-pcie-gen-40-nvme-m2-solid-state-drive) |
| Lenovo LN950 4TB (5SD1P69443) | Kingston NV3 500GB | 27,200 | `kingston-nv3-500gb.png` | [Retail reference](https://www.muscatcomputer.pk/kingston-ssds) |
| LG UltraGear 27GX790B-B | ASUS ROG Strix OLED XG27ACDNG | 310,000 | `asus-rog-strix-xg27acdng.png` | [Retail reference](https://zahcomputers.pk/product/asus-rog-strix-oled-xg27acdng-27-2560x1440-2k-360hz-0-03ms-qd-oled-gaming-monitor/) |
| KTC M27T6 | ASUS TUF Gaming VG27AQ3A | 65,500 | `asus-tuf-vg27aq3a.png` | [Retail reference](https://www.czone.com.pk/asus-tuf-gaming-vg27aq3a-27-inch-qhd-monitor) |
| Acer ED273 X0 | MSI G274QPF E2 | 71,999 | `msi-g274qpf-e2.png` | [Retail reference](https://rbtechngames.com/shop-2/computers/monitors/msi-g274qpf-e2-27-2k-2560x1440-wqhd-180hz-1ms-rapid-ips-gaming-monitor/) |
| Lian Li EDGE Platinum V2 1350W Black | ASUS ROG THOR 1000W Platinum II | 92,000 | `asus-rog-thor-1000p2.png` | [Retail reference](https://zahcomputers.pk/product/asus-rog-thor-1000w-platinum-ii-fully-modular-power-supply-1000-watt-80-platinum-lambda-a-certified-rog-heatsinks-135mm-pwm-fan-0db-mode-oled-panel-sleeved-cables-aura-sync/) |
| ASUS TUF Gaming 1000G EVO | ASUS ROG Strix 1000W Gold Aura Edition | 62,000 | `asus-rog-strix-1000g-aura.png` | [Retail reference](https://zahcomputers.pk/product/asus-rog-strix-1000w-gold-aura-edition-fully-modular-power-supply/) |
| MSI PAG G850LS PCIE5 | MSI MAG A850GL PCIE5 | 28,499 | `msi-mag-a850gl-pcie5.png` | [Retail reference](https://rbtechngames.com/shop-2/computers/power-supplies/msi-mag-a850gl-pcie5-850w-80-plus-gold-power-supply-fully-modular/) |
| MSI PAG G750LS PCIE5 | MSI MAG A750GL PCIE5 | 28,500 | `msi-mag-a750gl-pcie5.png` | [Retail reference](https://zahcomputers.pk/product/msi-mag-a750gl-pcie-5-0-80-gold-fully-modular-gaming-psu-12vhpwr-cable-atx-3-0-compatible-750w-power-supply/) |
| Cooler Master Elite Gold 1000W Black | MSI MPG A1000G PCIE5 | 52,000 | `msi-mpg-a1000g-pcie5.png` | [Retail reference](https://atreboot.com/product/msi-mpg-a1000g-pcie5-power-supply/) |
| Cougar OmnyX Black | ASUS ROG Hyperion GR701 Black | 144,999 | `asus-rog-hyperion-gr701-black.png` | [Retail reference](https://zahcomputers.pk/product/asus-rog-hyperion-gr701-e-atx-420-mm-dual-radiator-support-four-140-mm-fans-metal-gpu-holder-component-storage-argb-fan-hub-60w-fast-charging-gaming-case/) |
| Lian Li O11 VISION-M Black | ASUS ProArt PA602 Black | 75,000 | `asus-proart-pa602-black.png` | [Retail reference](https://zahcomputers.pk/product/asus-proart-pa602-e-atx-computer-case-420mm-radiator-support-dual-200mm-built-in-fans-front-panel-ir-dust-indicator-power-lock-latch-tool-less-pcie-mounting-gpu-holder-20gbps-usb-c-front-i-o/) |
| Lian Li VECTOR V150 INF Black | MSI MAG PANO M100R PZ Black | 29,899 | `msi-mag-pano-m100r-pz-black.png` | [Retail reference](https://zahcomputers.pk/product/msi-mag-pano-m100r-pz-premium-mid-tower-gaming-pc-case-black/) |
| GIGABYTE C201 PANORAMIC White | ASUS TUF Gaming GT501 Black | 47,500 | `asus-tuf-gt501-black.png` | [Retail reference](https://zestelectronics.pk/product/asus-tuf-gt501-gaming-case-black/) |
| Cougar Airface 180 White | MSI MAG FORGE 320R AIRFLOW Black | 20,000 | `msi-mag-forge-320r-airflow.png` | [Retail reference](https://www.buyerspk.com/products/msi-gaming-pc-case-mag-forge-320r-airflow-price-in-pakistan) |
| Cougar MX600 Air Pro Black | ASUS Prime AP201 Tempered Glass Black | 19,000 | `asus-prime-ap201-tg-black.png` | [Retail reference](https://zahcomputers.pk/product/asus-prime-ap201-tempered-glass-micro-atx-gaming-case-black/) |
| Cougar MX600 Mini V2 Pro White | MSI MAG FORGE M100A Black | 9,899 | `msi-mag-forge-m100a-black.png` | [Retail reference](https://www.zahcomputers.pk/product/msi-mag-forge-m100a-m-atx-tower-gaming-case/) |
| Lian Li HydroShift II LCD-C 360R Black | ASUS ROG Ryujin III 360 ARGB Black | 108,000 | `asus-rog-ryujin-iii-360-argb.png` | [Retail reference](https://zahcomputers.pk/product/asus-rog-ryujin-iii-360-argb-all-in-one-liquid-cpu-cooler-black/) |
| Thermalright Frozen Horizon 360 Digital ARGB Black | ASUS ROG Ryuo III 360 ARGB Black | 99,800 | `asus-rog-ryuo-iii-360-argb.png` | [Retail reference](https://www.pakbyte.pk/collections/hot-products?page=28) |
| Lian Li HydroShift II LCD-S 360 Black | ASUS ROG Strix LC III 360 ARGB Black | 65,000 | `asus-rog-strix-lc-iii-360-argb.png` | [Retail reference](https://zahcomputers.pk/product/asus-rog-strix-lc-iii-360-argb-all-in-one-cpu-liquid-cooler-black/) |
| ID-COOLING SL360 V2 Space LCD White | MSI MAG CORELIQUID A13 360 Black | 21,999 | `msi-mag-coreliquid-a13-360-black.png` | [Retail reference](https://zahcomputers.pk/category/cooling-solutions/) |
| ID-COOLING SE-214-XT DF ARGB Black | ASUS ROG Strix LC II 240 ARGB Black | 39,500 | `asus-rog-strix-lc-ii-240-argb.png` | [Retail reference](https://www.pakbyte.pk/products/asus-rog-strix-lc-ii-240-argb-cpu-liquid-cooler) |
| Thermalright Magic Qube 360 ARGB Black | MSI MAG CORELIQUID E360 Black | 28,000 | `msi-mag-coreliquid-e360-black.png` | [Retail reference](https://www.xtra.pk/msi-mag-coreliquid-e360-black-aio-argb-cpu-liquid-cooler-rotating-cap-design-360mm-radiator-triple-1) |
| Cougar Poseidon Vistek Pro ARGB 360 Black | MSI MAG CORELIQUID I360 Black | 33,000 | `msi-mag-coreliquid-i360-black.png` | [Retail reference](https://zahcomputers.pk/product/msi-mag-coreliquid-i360-black-aio-argb-cpu-liquid-cooler-infinity-mirror-design-uni-bracket-360mm-radiator-triple-120mm-argb-pwm-fans-lga-1700-1851-am5-am4-compatible/) |
| SteelSeries QcK Performance XL Control | ASUS ROG Scabbard II | 3,950 | `asus-rog-scabbard-ii.png` | [Retail reference](https://desmo.pk/product/asus-rog-scabbard-ii-mouse-pad-medium/) |
| SteelSeries QcK Performance Balance | ASUS ROG Sheath II XXL | 21,799 | `asus-rog-sheath-ii-xxl.png` | [Retail reference](https://www.tejar.pk/asus-rog-sheath-ii-xxl-gaming-mouse-pad) |
| ATTACK SHARK CM03 eSport Rainbow Coated | ASUS ROG Hone Ace Aim Lab Edition | 9,499 | `asus-rog-hone-ace-aim-lab.png` | [Retail reference](https://ojtech.pk/products/asus-rog-hone-ace-aim-lab) |
| ATTACK SHARK CM05 Glass Black Contours | ASUS TUF Gaming P1 | 2,499 | `asus-tuf-p1.png` | [Retail reference](https://ojtech.pk/products?brand=ASUS&group=asus-accessories&sort=price-desc) |
| Logitech G G740 | ASUS ROG Scabbard II Arctic Gray XXL | 30,999 | `asus-rog-scabbard-ii-arctic-gray-xxl.png` | [Retail reference](https://www.tejar.pk/asus-nc18-rog-scabbard-ii-arctic-gray-xxl-gaming-mouse-pad) |
| Corsair MM100 | ASUS ROG Balteus Qi | 28,000 | `asus-rog-balteus-qi.png` | [Retail reference](https://www.zahcomputers.pk/product/asus-rog-balteus-qi-nh01-vertical-gaming-mouse-pad/) |
| SteelSeries QcK XXL | ASUS ROG Herculx Graphics Card Holder | 14,999 | `asus-rog-herculx.png` | [Retail reference](https://rbtechngames.com/product-category/computers/graphics-card/) |
