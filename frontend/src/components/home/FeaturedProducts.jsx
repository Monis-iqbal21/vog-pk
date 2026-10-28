import ProductCarousel from '@/components/products/ProductCarousel';
import { getFeaturedProducts } from '@/data/products';

export default function FeaturedProducts() {
  return <ProductCarousel id="featured" title="Featured Products" subtitle="Handpicked hardware worth checking out." products={getFeaturedProducts()} seeAllHref="/collections/featured" seeAllLabel="See All Featured Products" singleRow />;
}
