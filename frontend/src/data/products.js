// Frontend fixtures only: illustrative names and prices, not live inventory.
export const productCategories = [
  ['graphics-cards', 'Graphics Cards'], ['processors', 'Processors'],
  ['motherboards', 'Motherboards'], ['ram', 'RAM'], ['storage', 'Storage'],
  ['keyboards', 'Keyboards'], ['gaming-mice', 'Gaming Mice'], ['monitors', 'Monitors'],
  ['power-supplies', 'Power Supplies'], ['pc-cases', 'PC Cases'],
  ['cooling', 'Cooling'], ['accessories', 'Gaming Accessories'],
].map(([slug, name]) => ({ slug, name }));

const fixtures = [
  ['dual-fan-graphics-card', 'Dual-Fan Graphics Card', 'graphics-cards', 95000],
  ['triple-fan-graphics-card', 'Triple-Fan Graphics Card with Performance Cooling', 'graphics-cards', 157000],
  ['compact-graphics-card', 'Compact Graphics Card', 'graphics-cards', 78000],
  ['creator-graphics-card', 'Creator Graphics Card for Gaming and Creative Work', 'graphics-cards', 210000],
  ['performance-graphics-card', 'Performance Graphics Card', 'graphics-cards', 185000],
  ['quiet-graphics-card', 'Quiet-Cooling Graphics Card', 'graphics-cards', 125000],
  ['premium-graphics-card', 'Premium Graphics Card with Triple-Fan Cooling', 'graphics-cards', 317000],
  ['everyday-graphics-card', 'Everyday Gaming Graphics Card', 'graphics-cards', 65000],
  ['desktop-processor', 'Desktop Processor', 'processors', 62000],
  ['gaming-motherboard', 'Gaming Motherboard with Expansion Slots', 'motherboards', 48000],
  ['desktop-memory', 'Desktop Memory Kit', 'ram', 24000],
  ['solid-state-storage', 'Solid State Storage Drive', 'storage', 28000],
  ['mechanical-keyboard', 'Mechanical Gaming Keyboard', 'keyboards', 18500],
  ['lightweight-mouse', 'Lightweight Gaming Mouse', 'gaming-mice', 9500],
  ['gaming-monitor', 'Gaming Monitor with Adjustable Stand', 'monitors', 85000],
  ['modular-power-supply', 'Modular Power Supply', 'power-supplies', 32000],
  ['airflow-case', 'Airflow PC Case', 'pc-cases', 22000],
  ['tower-cooler', 'Tower CPU Cooler', 'cooling', 14500],
  ['desk-mat', 'Extended Gaming Desk Mat', 'accessories', 4500],
];

export const products = fixtures.map(([slug, name, category, price], index) => ({
  id: `sample-${index + 1}`, slug, name, category, price,
  brand: 'Sample Hardware', image: '/images/products/product-placeholder.svg',
  imageIsPlaceholder: true, salePrice: null, stock: null, active: true,
  featured: index < 8, createdAt: `2026-10-${String(index + 1).padStart(2, '0')}`,
}));

export const getFeaturedProducts = () => products.filter((product) => product.active && product.featured).slice(0, 8);
export const getNewArrivals = () => products.filter((product) => product.active)
  .toSorted((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 8);
export const getCategoryProducts = (category) => products.filter((product) => product.active && product.category === category).slice(0, 8);
