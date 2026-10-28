import ProductCarousel from '@/components/products/ProductCarousel';
import { getNewArrivals } from '@/data/products';

export default function NewArrivals() {
  return <ProductCarousel id="new-arrivals" title="New Arrivals" subtitle="Explore our curated launch collection." products={getNewArrivals()} seeAllHref="/collections/new-arrivals" seeAllLabel="Explore All New Arrivals" singleRow />;
}
