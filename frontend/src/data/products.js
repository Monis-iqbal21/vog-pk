import { productImages } from './product-images.js';

export const HOMEPAGE_PRODUCT_LIMIT = 8;
export const productCategories = [
  ['graphics-cards', 'Graphics Cards'], ['processors', 'Processors'], ['motherboards', 'Motherboards'],
  ['ram', 'RAM'], ['storage', 'Storage'], ['keyboards', 'Keyboards'], ['gaming-mice', 'Gaming Mice'],
  ['monitors', 'Monitors'], ['power-supplies', 'Power Supplies'], ['pc-cases', 'PC Cases'],
  ['cooling', 'Cooling'], ['accessories', 'Gaming Accessories'],
].map(([slug, name]) => ({ slug, name }));

const retailer = 'https://zahcomputers.pk';
const categorySources = {
  'graphics-cards': 'graphics-cards', processors: 'processors', motherboards: 'motherboard-chipset',
  ram: 'memory-module-ram', storage: 'sata-ssd', keyboards: 'keyboards', 'gaming-mice': 'mouse',
  monitors: 'monitors', 'power-supplies': 'power-supplies', 'pc-cases': 'casing',
  cooling: 'cooling-solutions', accessories: 'mouse-pad',
};

// Editorial selection from public reference pages, not a live inventory feed.
// Rows: stable model ID, brand, exact selected model, observed PKR reference, original specification summary.
const catalogue = {
  'graphics-cards': [
    ['rog-strix-rtx5070ti-o16g', 'ASUS', 'ROG Strix GeForce RTX 5070 Ti OC 16GB', 450000, '16GB GDDR7; Axial-tech cooling and a vapor chamber.'],
    ['aorus-rtx5080-master-ice-16g', 'GIGABYTE', 'AORUS GeForce RTX 5080 MASTER ICE 16G', 610000, '16GB GDDR7 graphics card with WINDFORCE cooling.'],
    ['nitro-rx9070xt-phantomlink-polar', 'SAPPHIRE', 'NITRO+ Radeon RX 9070 XT OC PhantomLink Polar Edition', 339000, '16GB GDDR6 graphics memory; PhantomLink connection design.'],
    ['proart-rtx5080-16g', 'ASUS', 'ProArt GeForce RTX 5080 16GB', 495000, '16GB GDDR7 graphics card in a 2.5-slot design.'],
    ['zotac-rtx5080-solid-oc-white', 'ZOTAC', 'GAMING GeForce RTX 5080 SOLID OC White Edition', 475000, '16GB GDDR7 graphics memory with IceStorm 3.0 cooling.'],
    ['palit-rtx5070ti-gamingpro-s', 'Palit', 'GeForce RTX 5070 Ti GamingPro-S 16GB', 355000, '16GB GDDR7 graphics memory on a GeForce RTX 5070 Ti.'],
    ['asus-dual-rtx5060ti-16g', 'ASUS', 'Dual GeForce RTX 5060 Ti 16GB', 275000, '16GB GDDR7 graphics memory with Axial-tech cooling.'],
  ],
  processors: [
    ['amd-ryzen7-9800x3d', 'AMD', 'Ryzen 7 9800X3D', 132000, '8 cores, 16 threads; AM5 socket and 3D V-Cache.'],
    ['intel-core-ultra9-285k', 'Intel', 'Core Ultra 9 285K', 159999, '24 cores and 24 threads; up to 5.7GHz turbo.'],
    ['amd-ryzen9-9950x3d', 'AMD', 'Ryzen 9 9950X3D', 185000, '16-core AM5 processor with AMD 3D V-Cache.'],
    ['intel-core-ultra7-265k', 'Intel', 'Core Ultra 7 265K', 100000, '20 cores and 20 threads; unlocked desktop processor.'],
    ['intel-core-i9-14900k', 'Intel', 'Core i9-14900K', 136000, '24-core desktop processor for the LGA 1700 socket.'],
    ['intel-core-i7-14700k', 'Intel', 'Core i7-14700K', 123000, '20-core desktop processor for the LGA 1700 socket.'],
    ['amd-ryzen9-9900x-tray', 'AMD', 'Ryzen 9 9900X (Tray)', 109999, '12-core AM5 processor with a 4.4GHz base clock.'],
  ],
  ram: [
    ['lexar-ares-gen2-32gb-8000', 'Lexar', 'ARES RGB 2nd Gen DDR5 32GB (2×16GB) 8000', 172000, '32GB dual-module DDR5 kit; 8000MT/s with RGB lighting.'],
    ['kingston-fury-beast-16gb-4800', 'Kingston', 'FURY Beast DDR5 16GB 4800', 66000, '16GB DDR5-4800 desktop memory with a heat spreader.'],
    ['lexar-thor-rgb-gen2-64gb-6000', 'Lexar', 'THOR RGB 2nd Gen DDR5 64GB (2×32GB) 6000', 315000, '64GB dual-module DDR5-6000 desktop memory with RGB lighting.'],
    ['xpg-spectrix-d35g-32gb-3200-black', 'XPG', 'SPECTRIX D35G RGB 32GB (2×16GB) DDR4-3200 Black', 71999, '32GB DDR4-3200 kit with CL16 timings and RGB lighting.'],
    ['crucial-ct32g48c40u5', 'Crucial', 'CT32G48C40U5 32GB DDR5-4800', 115000, '32GB DDR5-4800 desktop UDIMM; CL40 timings.'],
    ['corsair-vengeance-lpx-32gb-3200', 'Corsair', 'VENGEANCE LPX 32GB (2×16GB) DDR4-3200', 70000, '32GB dual-module desktop DDR4-3200 memory kit.'],
    ['lexar-ddr5-32gb-5600-udimm', 'Lexar', '32GB DDR5-5600 UDIMM', 128000, 'Single 32GB DDR5-5600 desktop memory module.'],
  ],
  'gaming-mice': [
    ['razer-deathadder-v4-pro-black', 'Razer', 'DeathAdder V4 Pro Black', 62500, 'Wireless mouse with a Focus Pro 45K Gen-2 optical sensor.'],
    ['logitech-pro-x2-superstrike', 'Logitech G', 'PRO X2 SUPERSTRIKE', 57999, 'LIGHTSPEED wireless mouse with HITS adjustable click actuation.'],
    ['bloody-w95-ultra-stone-black', 'Bloody', 'W95 Ultra Stone Black', 4799, 'Wired gaming mouse with an Alpha 20K sensor.'],
    ['bloody-r73-pro-black', 'Bloody', 'R73 Pro Black', 8500, 'Wireless gaming mouse with a PAW3395 sensor.'],
    ['aula-sc380pro-black', 'AULA', 'SC380Pro Black', 5900, 'Tri-mode mouse with a PAW3311 sensor and charging dock.'],
    ['attack-shark-rs3-ultra-white', 'ATTACK SHARK', 'RS3 ULTRA Carbon Fiber White', 26000, 'Wireless gaming mouse with a PAW3955MAX sensor.'],
    ['fantech-kanata-s-vx9s', 'Fantech', 'Kanata S VX9S', 3000, 'Wired mouse with six programmable buttons and RGB lighting.'],
  ],
  keyboards: [
    ['logitech-g915-tkl-tactile-carbon', 'Logitech G', 'G915 TKL Tactile Carbon Black', 24999, 'Low-profile tactile mechanical keys with LIGHTSPEED wireless connectivity.'],
    ['asus-rog-azoth-m701-nx-red', 'ASUS', 'ROG Azoth M701 NX Red Black', 64999, 'Wireless mechanical keyboard with NX Red switches and OLED display.'],
    ['attack-shark-r98-he-moonlight', 'ATTACK SHARK', 'R98 HE Moonlight', 19500, 'Hall-effect gaming keyboard with rapid-trigger input.'],
    ['aula-f2088-air-red-white', 'AULA', 'F2088 Air Red Switch White', 7500, '98-key mechanical keyboard with tri-mode connectivity and hot-swap sockets.'],
    ['aula-f75-retro-white', 'AULA', 'F75 Retro White Milk White Switch', 12800, '75% hot-swappable mechanical keyboard with a multimedia knob.'],
    ['aula-win68-he-max', 'AULA', 'WIN68 HE Max Grey & Yellow', 11800, '68-key Hall-effect keyboard with 8000Hz polling.'],
    ['aula-win60-he-max', 'AULA', 'WIN60 HE Max White & Blue', 10800, '61-key Hall-effect keyboard with 8000Hz polling.'],
  ],
  motherboards: [
    ['asus-rog-crosshair-x870e-dark-hero', 'ASUS', 'ROG Crosshair X870E Dark Hero', 298000, 'AM5 ATX motherboard with DDR5 slots and WiFi 7.'],
    ['asus-tuf-b850-plus-wifi', 'ASUS', 'TUF Gaming B850-PLUS WIFI', 88000, 'AM5 ATX motherboard with DDR5 and PCIe 5.0 support.'],
    ['gigabyte-z890-aorus-pro-ice', 'GIGABYTE', 'Z890 AORUS PRO ICE', 145000, 'LGA 1851 ATX motherboard with DDR5 and WiFi 7.'],
    ['asus-prime-b850-plus-wifi-csm', 'ASUS', 'PRIME B850-PLUS WIFI-CSM', 60000, 'AM5 ATX motherboard with DDR5 and three M.2 slots.'],
    ['asus-prime-b850m-f-csm', 'ASUS', 'PRIME B850M-F-CSM', 42000, 'AM5 micro-ATX motherboard with DDR5 and dual M.2 slots.'],
    ['asus-x870-max-gaming-wifi7', 'ASUS', 'X870 MAX GAMING WIFI7', 96800, 'AM5 ATX motherboard with four DDR5 slots and WiFi 7.'],
    ['gigabyte-z890m-gaming-x', 'GIGABYTE', 'Z890M GAMING X', 72699, 'LGA 1851 micro-ATX motherboard with DDR5 and PCIe 5.0.'],
  ],
  storage: [
    ['corsair-mp600-mini-1tb', 'Corsair', 'MP600 MINI 1TB', 51000, '1TB M.2 2230 NVMe SSD with PCIe 4.0 x4 interface.'],
    ['corsair-mp700-elite-1tb-heatsink', 'Corsair', 'MP700 ELITE 1TB with Heatsink', 65000, '1TB M.2 2280 NVMe SSD with PCIe 5.0 interface.'],
    ['kingston-kc3000-1tb', 'Kingston', 'KC3000 1TB', 47500, '1TB PCIe 4.0 NVMe SSD with TLC NAND and DRAM cache.'],
    ['lexar-nq780-512gb', 'Lexar', 'NQ780 512GB', 26500, '512GB M.2 2280 NVMe SSD with PCIe 4.0 x4 interface.'],
    ['lexar-nq780-2tb', 'Lexar', 'NQ780 2TB', 79000, '2TB M.2 2280 NVMe SSD with PCIe 4.0 x4 interface.'],
    ['lexar-sl500-1tb-black', 'Lexar', 'SL500 1TB Black', 44000, '1TB portable SSD with a USB 3.2 Gen 2×2 interface.'],
    ['lenovo-ln950-4tb', 'Lenovo', 'LN950 4TB (5SD1P69443)', 135000, '4TB internal M.2 NVMe SSD with PCIe 4.0 x4 interface.'],
  ],
  monitors: [
    ['lg-ultragear-27gx790b-b', 'LG', 'UltraGear 27GX790B-B', 420000, '26.5-inch QHD OLED gaming monitor; 540Hz mode.'],
    ['ktc-m27t6', 'KTC', 'M27T6', 82000, '27-inch WQHD Mini LED gaming display with 180Hz refresh.'],
    ['lenovo-legion-r45w-30', 'Lenovo', 'Legion R45W-30', 250000, '44.5-inch curved DQHD gaming display; 170Hz refresh.'],
    ['msi-mag-274qp-qd-oled-x24', 'MSI', 'MAG 274QP QD-OLED X24', 195000, '26.5-inch WQHD QD-OLED gaming display with 240Hz refresh.'],
    ['philips-evnia-27m2n3500nf-00', 'Philips', 'Evnia 27M2N3500NF/00', 53000, '27-inch QHD IPS gaming display with 144Hz refresh.'],
    ['lenovo-legion-r27qc-30', 'Lenovo', 'Legion R27QC-30', 67500, '27-inch curved QHD VA gaming display; 180Hz refresh.'],
    ['acer-ed273-x0', 'Acer', 'ED273 X0', 48000, '27-inch curved Full HD VA gaming display with 200Hz refresh.'],
  ],
  'power-supplies': [
    ['lian-li-edge-platinum-v2-1350-black', 'Lian Li', 'EDGE Platinum V2 1350W Black', 75000, '1350W fully modular ATX 3.1 power supply; Platinum rated.'],
    ['asus-tuf-1000g-evo', 'ASUS', 'TUF Gaming 1000G EVO', 43000, '1000W fully modular ATX 3.1 power supply; Gold rated.'],
    ['asus-tuf-850g-evo', 'ASUS', 'TUF Gaming 850G EVO', 35000, '850W fully modular ATX 3.1 power supply; Gold rated.'],
    ['msi-pag-g850ls-pcie5', 'MSI', 'PAG G850LS PCIE5', 33999, '850W fully modular ATX 3.1 power supply; Gold rated.'],
    ['msi-pag-g750ls-pcie5', 'MSI', 'PAG G750LS PCIE5', 25000, '750W fully modular ATX 3.1 power supply; Gold rated.'],
    ['cooler-master-elite-gold-1000-black', 'Cooler Master', 'Elite Gold 1000W Black', 39999, '1000W fully modular ATX 3.1 power supply; Gold rated.'],
    ['asus-rog-strix-1200-platinum', 'ASUS', 'ROG Strix 1200W Platinum', 95000, '1200W modular power supply with 80 PLUS Platinum rating.'],
  ],
  'pc-cases': [
    ['cougar-omnyx-black', 'Cougar', 'OmnyX Black', 33000, 'Mid-tower gaming chassis with an omnidirectional layout.'],
    ['lian-li-o11-vision-m-black', 'Lian Li', 'O11 VISION-M Black', 22499, 'Dual-chamber micro-ATX case with three glass panels.'],
    ['lian-li-vector-v150-inf-black', 'Lian Li', 'VECTOR V150 INF Black', 24500, 'Micro-ATX case with dual chambers and a USB-C port.'],
    ['gigabyte-c201-panoramic-white', 'GIGABYTE', 'C201 PANORAMIC White', 17999, 'Mid-tower gaming case with a panoramic-panel design.'],
    ['cougar-airface-180-white', 'Cougar', 'Airface 180 White', 16499, 'Mid-tower PC chassis in a white finish.'],
    ['cougar-mx600-air-pro-black', 'Cougar', 'MX600 Air Pro Black', 18500, 'Tower gaming chassis in a black finish.'],
    ['cougar-mx600-mini-v2-pro-white', 'Cougar', 'MX600 Mini V2 Pro White', 15000, 'Compact tower gaming chassis in a white finish.'],
  ],
  cooling: [
    ['lian-li-hydroshift-ii-lcd-c-360r-black', 'Lian Li', 'HydroShift II LCD-C 360R Black', 48500, '360mm all-in-one liquid CPU cooler with ARGB lighting.'],
    ['thermalright-frozen-horizon-360-digital', 'Thermalright', 'Frozen Horizon 360 Digital ARGB Black', 22000, '360mm liquid CPU cooler with a digital display.'],
    ['lian-li-hydroshift-ii-lcd-s-360', 'Lian Li', 'HydroShift II LCD-S 360 Black', 47000, '360mm liquid CPU cooler with a 3.4-inch IPS display.'],
    ['id-cooling-sl360-v2-space-white', 'ID-COOLING', 'SL360 V2 Space LCD White', 37500, '360mm all-in-one liquid CPU cooler with an LCD display.'],
    ['id-cooling-se214xt-df-black', 'ID-COOLING', 'SE-214-XT DF ARGB Black', 5000, 'Air cooler with dual 120mm fans and four heat pipes.'],
    ['thermalright-magic-qube-360-black', 'Thermalright', 'Magic Qube 360 ARGB Black', 23999, '360mm liquid CPU cooler with an infinity-mirror pump design.'],
    ['cougar-poseidon-vistek-pro-360-black', 'Cougar', 'Poseidon Vistek Pro ARGB 360 Black', 30000, '360mm all-in-one liquid CPU cooler with ARGB lighting.'],
  ],
  accessories: [
    ['steelseries-qck-performance-xl-control', 'SteelSeries', 'QcK Performance XL Control', 14999, 'XL gaming mousepad with a control-focused surface.'],
    ['steelseries-qck-performance-balance', 'SteelSeries', 'QcK Performance Balance', 13499, 'Gaming mousepad with a balance-focused surface.'],
    ['attack-shark-cm03-rainbow', 'ATTACK SHARK', 'CM03 eSport Rainbow Coated', 4500, '450×400mm gaming mousepad with a 4mm-thick surface.'],
    ['attack-shark-cm05-glass-black-contours', 'ATTACK SHARK', 'CM05 Glass Black Contours', 10950, '450×400mm gaming mousepad made from tempered glass.'],
    ['logitech-g740', 'Logitech G', 'G740', 8450, 'Large gaming mousepad with a thick cloth surface.'],
    ['corsair-mm100', 'Corsair', 'MM100', 3300, 'Cloth gaming mousepad for a desktop setup.'],
    ['steelseries-qck-xxl', 'SteelSeries', 'QcK XXL', 9500, 'XXL cloth gaming mousepad with a non-slip base.'],
  ],
};

const featuredIds = new Set(['rog-strix-rtx5070ti-o16g', 'aorus-rtx5080-master-ice-16g', 'nitro-rx9070xt-phantomlink-polar', 'amd-ryzen7-9800x3d', 'intel-core-ultra9-285k', 'lexar-ares-gen2-32gb-8000', 'razer-deathadder-v4-pro-black', 'logitech-g915-tkl-tactile-carbon']);
const arrivalIds = new Set(['proart-rtx5080-16g', 'zotac-rtx5080-solid-oc-white', 'palit-rtx5070ti-gamingpro-s', 'amd-ryzen9-9950x3d', 'intel-core-ultra7-265k', 'kingston-fury-beast-16gb-4800', 'logitech-pro-x2-superstrike', 'asus-rog-azoth-m701-nx-red']);

const manufacturerReferences = {
  "rog-strix-rtx5070ti-o16g": [
    "https://rog.asus.com/us/graphics-cards/graphics-cards/rog-strix/rog-strix-rtx5070ti-o16g-gaming/",
    "ROG-STRIX-RTX5070TI-O16G-GAMING"
  ],
  "aorus-rtx5080-master-ice-16g": [
    "https://www.gigabyte.com/it/Graphics-Card/GV-N5080AORUSM-ICE-16GD",
    "GV-N5080AORUSM-ICE-16GD"
  ],
  "nitro-rx9070xt-phantomlink-polar": [
    "https://www.sapphiretech.com/en/consumer/nitro-radeon-rx-9070-xt-ple-16g-gddr6",
    null
  ],
  "proart-rtx5080-16g": [
    "https://www.asus.com/us/motherboards-components/graphics-cards/proart/proart-rtx5080-16g/techspec/",
    "PROART-RTX5080-16G"
  ],
  "amd-ryzen7-9800x3d": [
    "https://www.amd.com/en/partner/articles/ryzen-9000-series-processors.html",
    null
  ],
  "amd-ryzen9-9950x3d": [
    "https://www.amd.com/en/partner/articles/ryzen-9000-series-processors.html",
    null
  ],
  "intel-core-ultra9-285k": [
    "https://www.intel.com/content/www/us/en/products/sku/241060/intel-core-ultra-9-processor-285k-36m-cache-up-to-5-70-ghz/specifications.html",
    null
  ],
  "intel-core-ultra7-265k": [
    "https://www.intel.com/content/www/us/en/ark/products/series/241071/intel-core-ultra-processors-series-2.html",
    null
  ],
  "lexar-ares-gen2-32gb-8000": [
    "https://www.lexar.com/global/products/Lexar-ARES-RGB-2nd-Gen-DDR5-Desktop-Memory/",
    null
  ],
  "kingston-fury-beast-16gb-4800": [
    "https://www.kingston.com/en/memory/gaming/kingston-fury-beast-ddr5-memory",
    null
  ],
  "razer-deathadder-v4-pro-black": [
    "https://press.razer.com/product-news/razer-unveils-the-ultra-lightweight-deathadder-v4-pro/",
    null
  ],
  "logitech-pro-x2-superstrike": [
    "https://www.logitechg.com/en-us/shop/p/pro-x2-superstrike-mouse",
    null
  ]
};
const detailReferences = {
  "amd-ryzen7-9800x3d": "https://zahcomputers.pk/product/amd-ryzen-7-9800x3d-4-7-ghz-eight-core-am5-processor/",
  "logitech-g915-tkl-tactile-carbon": "https://zahcomputers.pk/product/logitech-g915-tkl-tactile-lightspeed-wireless-rgb-mechanical-gaming-keyboard-carbon-black/",
  "asus-rog-azoth-m701-nx-red": "https://zahcomputers.pk/product/asus-republic-of-gamers-azoth-m701-wireless-gaming-keyboard-black/"
};

export const products = Object.entries(catalogue).flatMap(([category, rows]) => rows.map(([id, brand, model, referencePricePKR, shortDescription]) => ({
  id, slug: id, brand, name: `${brand} ${model}`, modelIdentifier: model, shortDescription, category,
  image: productImages[id] ? `/images/products/${id}.webp` : `/images/products/catalogue/${id}-placeholder.svg`,
  imageAlt: productImages[id]?.alt ?? `Image pending for ${brand} ${model}`, imageIsPlaceholder: !productImages[id],
  imageCreditUrl: productImages[id] ? `/images/products/credits.html#${id}` : null,
  referencePricePKR, price: null, regularPrice: null, salePrice: null, pricingApproved: false,
  featured: featuredIds.has(id), newArrival: arrivalIds.has(id), active: true,
  sourceUrl: `${retailer}/category/${categorySources[category]}/`, sourceCheckedAt: '2026-10-26',
  sourceAvailability: 'unknown', sourceVerification: 'retailer-listing',
  referencePriceVerification: 'observed-on-public-reference-page; reconfirm-before-launch',
  manufacturerUrl: manufacturerReferences[id]?.[0] ?? null, manufacturerSku: manufacturerReferences[id]?.[1] ?? null,
  detailSourceUrl: detailReferences[id] ?? null,
  specificationVerification: manufacturerReferences[id] ? 'manufacturer-reference-consulted; exact-variant-confirmation-pending' : 'retailer-listed-basic-features; manufacturer-check-pending',
  inventoryVerified: false, stock: null, status: 'demo',
  imageSourceUrl: productImages[id]?.sourceUrl ?? null,
  imageUsageStatus: productImages[id] ? `licensed-photograph; ${productImages[id].license}; attribution-required` : 'original-placeholder; photography-permission-pending',
})));

export const getFeaturedProducts = () => products.filter((product) => product.active && product.featured).slice(0, HOMEPAGE_PRODUCT_LIMIT);
export const getNewArrivals = () => products.filter((product) => product.active && product.newArrival).slice(0, HOMEPAGE_PRODUCT_LIMIT);
export const getCategoryProducts = (category) => products.filter((product) => product.active && product.category === category).slice(0, HOMEPAGE_PRODUCT_LIMIT);
