'use client';

import {useState,useSyncExternalStore} from 'react';
import ProductGallery from './ProductGallery';
import ProductInfo from './ProductInfo';
import ProductSpecifications from './ProductSpecifications';
import ProductContentBlocks from './ProductContentBlocks';
import {getVariantProduct,readVariantQuery,writeVariantQuery,changeOptionSelection} from '@/lib/product-options';
import {getSpecificationGroups} from '@/lib/product-specifications';

const subscribe=callback=>{
 window.addEventListener('popstate',callback);window.addEventListener('vog:variant-change',callback);
 return ()=>{window.removeEventListener('popstate',callback);window.removeEventListener('vog:variant-change',callback);};
};
const snapshot=()=>window.location.search;
const serverSnapshot=()=>null;

export default function ProductDetail({product,onAddToCart}){
 const search=useSyncExternalStore(subscribe,snapshot,serverSnapshot);
 const [quantity,setQuantity]=useState(1);
 const [notice,setNotice]=useState(null);
 const selection=readVariantQuery(product,search??'');
 const selected=selection.variant;
 const effective=getVariantProduct(product,selected);
 const features=product.features.length?product.features:getSpecificationGroups(product.category,effective.specifications).flatMap(group=>group.rows).slice(0,4).map(row=>`${row.label}: ${row.value}`);
 function selectOption(code,value){
  const changed=changeOptionSelection(product,selection.selections,code,value);if(changed.rejected)return;
  const url=new URL(window.location.href);url.search=writeVariantQuery(product,url.search,changed.selections);
  window.history.pushState(null,'',url.pathname+url.search+url.hash);
  setNotice({search:url.search,text:changed.cleared.length?`${changed.cleared.join(', ')} cleared because that combination is not offered. Please choose again.`:''});
  window.dispatchEvent(new Event('vog:variant-change'));setQuantity(1);
 }
 return <>
  <div className="pd-main-layout" data-product-interactive={search!==null?'true':'false'}>
   <ProductGallery images={effective.gallery} name={product.name} />
   <ProductInfo product={product} variantProduct={effective} selectedVariant={selected} selection={selection} selectionNotice={notice?.search===search?notice.text:''} quantity={quantity} onQuantityChange={setQuantity} onOptionSelect={selectOption} onAddToCart={onAddToCart} />
  </div>
  <nav className="pd-section-nav" aria-label="Product information sections"><a href="#product-overview">Overview</a><a href="#product-specifications">Specifications</a>{features.length||product.contentBlocks.length?<a href="#product-features">Features</a>:null}<a href="#product-warranty">Warranty & delivery</a></nav>
  <section id="product-overview" className="pd-section"><h2>Overview</h2><p>{product.overview}</p></section>
  <section id="product-specifications" className="pd-section"><h2>Technical specifications</h2><ProductSpecifications category={product.category} specifications={effective.specifications} /></section>
  {features.length||product.contentBlocks.length?<section id="product-features" className="pd-section"><h2>Product features</h2>{features.length?<ul className="pd-feature-list">{features.map((feature,index)=><li key={index}>{feature}</li>)}</ul>:null}<ProductContentBlocks blocks={product.contentBlocks} category={product.category} /></section>:null}
  <section id="product-warranty" className="pd-section"><h2>Warranty & delivery</h2><div className="pd-warranty-grid"><div><h3>Warranty</h3><p>{product.warranty??'Warranty terms for this product have not been confirmed by VOGPK. Retailer or manufacturer coverage is not automatically VOGPK coverage.'}</p></div><div><h3>Delivery</h3><p>{product.delivery??'VOGPK delivery charges, service areas and estimated delivery times will be confirmed when purchasing becomes available.'}</p></div></div></section>
  <details className="pd-sources"><summary>Product information & image credits</summary><p>{product.sourceUrl?<a href={product.sourceUrl}>Retailer reference</a>:null}{product.specificationSourceUrl?<> · <a href={product.specificationSourceUrl}>Specification source</a></>:null}{product.imageCreditUrl?<> · <a href={product.imageCreditUrl}>Image credits and usage terms</a></>:null}</p>{product.imageDevelopmentOnly?<p>Development catalogue imagery; launch asset review remains pending.</p>:null}</details>
 </>;
}
