import HeroSection from '@/components/home/HeroSection';
import FeaturedProducts from '@/components/home/FeaturedProducts';
import NewArrivals from '@/components/home/NewArrivals';
import ShopByCategory from '@/components/home/ShopByCategory';

export default function Home() {
  return <>
    <HeroSection />
    <div className="container product-catalog-note"><p>Sample catalog · Illustrative products and prices. Purchasing is not enabled.</p></div>
    <FeaturedProducts />
    <NewArrivals />
    <ShopByCategory />
  </>;
}
