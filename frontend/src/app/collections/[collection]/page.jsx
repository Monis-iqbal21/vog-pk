import {notFound} from 'next/navigation';
import ProductListingPage from '@/components/products/ProductListingPage';
import {getListingScope,getListingMetadata,toListingSearch} from '@/lib/product-listings';
import {dynamicCatalog} from '@/lib/catalog/server';
import {DynamicListingPage} from '@/components/catalog/CatalogPages';
export const dynamicParams=false;
export function generateStaticParams(){return [{collection:'featured'},{collection:'new-arrivals'}];}
export async function generateMetadata({params,searchParams}){
 if(dynamicCatalog())return {title:(await params).collection==='featured'?'Featured Products':'New Arrivals',robots:{index:false,follow:true}};
 const {collection}=await params,scope=getListingScope('collection',collection);if(!scope)notFound();
 return getListingMetadata(scope,toListingSearch(await searchParams));
}
export default async function CollectionPage({params,searchParams}){
 if(dynamicCatalog()){const {collection}=await params;if(!['featured','new-arrivals'].includes(collection))notFound();return <DynamicListingPage collection={collection} search={await searchParams}/>;}
 const {collection}=await params,scope=getListingScope('collection',collection);if(!scope)notFound();
 return <ProductListingPage key={scope.path} scope={scope} initialSearch={toListingSearch(await searchParams)} />;
}
