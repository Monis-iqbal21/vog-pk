import {notFound} from 'next/navigation';
import ProductListingPage from '@/components/products/ProductListingPage';
import {getListingScope,getListingMetadata,toListingSearch} from '@/lib/product-listings';
export const dynamicParams=false;
export function generateStaticParams(){return [{collection:'featured'},{collection:'new-arrivals'}];}
export async function generateMetadata({params,searchParams}){
 const {collection}=await params,scope=getListingScope('collection',collection);if(!scope)notFound();
 return getListingMetadata(scope,toListingSearch(await searchParams));
}
export default async function CollectionPage({params,searchParams}){
 const {collection}=await params,scope=getListingScope('collection',collection);if(!scope)notFound();
 return <ProductListingPage key={scope.path} scope={scope} initialSearch={toListingSearch(await searchParams)} />;
}
