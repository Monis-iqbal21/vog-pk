import {notFound,permanentRedirect,unstable_rethrow} from 'next/navigation';
import {getProductBySlug,getProductPath} from '@/lib/products';
import {dynamicCatalog,catalogProduct} from '@/lib/catalog/server';

// Compatibility with the original /products/category/product-slug card links.
export const dynamicParams=true;
export default async function LegacyProductPage({params,searchParams}){
 const {slug:category,productSlug}=await params,product=getProductBySlug(productSlug);
 if(dynamicCatalog()){try{const variant=(await searchParams)?.variant;const p=await catalogProduct(productSlug,variant);if(!p.categories.some(c=>c.slug===category))notFound();permanentRedirect(p.path+(variant?'?variant='+encodeURIComponent(variant):''));}catch(e){unstable_rethrow(e);notFound();}}
 if(!product||product.category!==category)notFound();
 permanentRedirect(getProductPath(product));
}
