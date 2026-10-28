import ProductListingPage from '@/components/products/ProductListingPage';
import {getListingScope,getListingMetadata,toListingSearch} from '@/lib/product-listings';
const scope=getListingScope();
export async function generateMetadata({searchParams}){return getListingMetadata(scope,toListingSearch(await searchParams));}
export default async function AllProductsPage({searchParams}){
 return <ProductListingPage scope={scope} initialSearch={toListingSearch(await searchParams)} />;
}
