import ProductListingPage from '@/components/products/ProductListingPage';
import {getListingScope,getListingMetadata,toListingSearch} from '@/lib/product-listings';
const scope=getListingScope();
import {dynamicCatalog} from '@/lib/catalog/server';
import {DynamicListingPage} from '@/components/catalog/CatalogPages';
export async function generateMetadata({searchParams}){if(dynamicCatalog())return {title:'Products | VOGPK',alternates:{canonical:'/products'},robots:{index:false,follow:true}};return getListingMetadata(scope,toListingSearch(await searchParams));}
export default async function AllProductsPage({searchParams}){
 if(dynamicCatalog())return <DynamicListingPage search={await searchParams}/>;
 return <ProductListingPage scope={scope} initialSearch={toListingSearch(await searchParams)} />;
}
