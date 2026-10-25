import ProductCarousel from '@/components/products/ProductCarousel';
import { getNewArrivals } from '@/data/products';

export default function NewArrivals() {
  return <ProductCarousel id="new-arrivals" title="New Arrivals" subtitle="Explore the latest additions to our store." products={getNewArrivals()} seeAllHref="/products/new-arrivals" seeAllLabel="Explore All New Arrivals" />;
}
