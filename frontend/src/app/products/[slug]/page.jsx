import Link from 'next/link';
import {notFound} from 'next/navigation';
import ProductDetail from '@/components/products/ProductDetail';
import RelatedProducts from '@/components/products/RelatedProducts';
import {getProductDetailBySlug,getProductPath,getProductSlugs} from '@/lib/products';
import {site} from '@/config/site';
import '@/components/products/ProductDetail.css';

export const dynamicParams=false;
export const generateStaticParams=getProductSlugs;

export async function generateMetadata({params}){
 const {slug}=await params,product=getProductDetailBySlug(slug);
 if(!product)notFound();
 const url=new URL(getProductPath(product),site.url).href;
 const image=product.gallery[0];
 return {title:`${product.name} | ${site.name}`,description:product.shortDescription,alternates:{canonical:url},openGraph:{title:product.name,description:product.shortDescription,url,type:'website',images:image?[{url:new URL(image.src,site.url).href,width:image.width,height:image.height,alt:image.alt}]:[]}};
}

export default async function ProductPage({params}){
 const {slug}=await params,product=getProductDetailBySlug(slug);
 if(!product)notFound();
 const structuredData={'@context':'https://schema.org','@type':'Product',name:product.name,description:product.shortDescription,sku:product.manufacturerSku??product.id,model:product.modelIdentifier,brand:{'@type':'Brand',name:product.brand},category:product.categoryName,url:new URL(getProductPath(product),site.url).href,image:product.gallery.map(image=>new URL(image.src,site.url).href),additionalProperty:Object.entries(product.specifications).map(([name,value])=>({'@type':'PropertyValue',name,value}))};
 return <>
  <article className="container pd-page" data-product-id={product.id}>
   <nav className="pd-breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><Link href="/#category-title">{product.categoryName}</Link><span aria-hidden="true">/</span><span aria-current="page">{product.modelIdentifier}</span></nav>
   <ProductDetail product={product} />
   <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structuredData).replace(/</g,'\\u003c')}} />
  </article>
  <RelatedProducts product={product} />
 </>;
}
