import HeroSection from '@/components/home/HeroSection';
import FeaturedProducts from '@/components/home/FeaturedProducts';
import NewArrivals from '@/components/home/NewArrivals';
import ShopByCategory from '@/components/home/ShopByCategory';
import {dynamicCatalog} from '@/lib/catalog/server';
import CatalogHome from '@/components/catalog/CatalogHome';

export default function Home() {
  return <>
    <HeroSection />
    {dynamicCatalog()?<CatalogHome/>:<>
    <div className="container product-catalog-note"><p>Development catalog · Retailer reference prices checked 26 October 2026; not VOGPK offers or confirmed inventory. New Arrivals is our launch selection, not a release-date claim. Purchasing is not enabled.</p></div>
    <FeaturedProducts />
    <NewArrivals />
    <ShopByCategory />
    </>}
  </>;
}
