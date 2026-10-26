import {notFound,permanentRedirect} from 'next/navigation';
import {products} from '@/data/products';
import {getProductBySlug,getProductPath} from '@/lib/products';

// Compatibility with the original /products/category/product-slug card links.
export const dynamicParams=false;
export function generateStaticParams(){return products.filter(product=>product.active).map(product=>({slug:product.category,productSlug:product.slug}));}
export default async function LegacyProductPage({params}){
 const {slug:category,productSlug}=await params,product=getProductBySlug(productSlug);
 if(!product||product.category!==category)notFound();
 permanentRedirect(getProductPath(product));
}
