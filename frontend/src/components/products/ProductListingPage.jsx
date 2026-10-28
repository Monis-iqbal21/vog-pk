'use client';
import Link from 'next/link';
import {useSyncExternalStore,useRef,useState} from 'react';
import {queryListing,serializeListingState} from '@/lib/product-listings';
import ProductFilters from './ProductFilters';
import MobileFilterDrawer from './MobileFilterDrawer';
import ProductSort from './ProductSort';
import ActiveFilterChips from './ActiveFilterChips';
import ProductGrid from './ProductGrid';
import ProductPagination from './ProductPagination';
import './Products.css';
import './ProductListing.css';

const subscribe=callback=>{window.addEventListener('popstate',callback);window.addEventListener('vog:listing-change',callback);return ()=>{window.removeEventListener('popstate',callback);window.removeEventListener('vog:listing-change',callback);};};
const snapshot=()=>window.location.search;
const subscribeHydration=()=>()=>{};
export default function ProductListingPage({scope,initialSearch=''}){
 const search=useSyncExternalStore(subscribe,snapshot,()=>initialSearch),heading=useRef(null);
 const hydrated=useSyncExternalStore(subscribeHydration,()=>true,()=>false);
 const [priceReset,setPriceReset]=useState(0);
 const result=queryListing(scope,search),{state}=result;
 const activeCount=Object.values(state.filters).reduce((total,values)=>total+values.length,0)+Number(state.min!==null)+Number(state.max!==null);
 function update(changes,scroll=false){
  const next={...state,page:1,...changes},query=serializeListingState(next),url=scope.path+(query?`?${query}`:'');
  window.history.pushState(null,'',url);window.dispatchEvent(new Event('vog:listing-change'));
  if(scroll){heading.current?.scrollIntoView({block:'start',behavior:'instant'});heading.current?.focus({preventScroll:true});}
 }
 function toggle(code,value){const current=state.filters[code]??[];const values=current.includes(value)?current.filter(item=>item!==value):[...current,value];update({filters:{...state.filters,[code]:values}});}
 const clear=()=>{setPriceReset(value=>value+1);update({filters:{},min:null,max:null});};
 const onPrice=(min,max)=>update({min,max});
 const filters=<ProductFilters facets={result.facets} state={state} priceReset={priceReset} onToggle={toggle} onPrice={onPrice} onClear={clear} />;
 return <section className="container pl-page" data-listing-scope={scope.type} data-listing-slug={scope.slug??'all'} data-listing-ready={hydrated?'true':'false'}>
  <nav className="pl-breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span>{scope.type!=='all'?<><Link href="/products">{scope.type==='collection'?'Products':'All Products'}</Link><span aria-hidden="true">/</span></>:null}<span aria-current="page">{scope.title}</span></nav>
  <header className="pl-heading"><h1 ref={heading} tabIndex={-1}>{scope.title}</h1><p>{scope.description}</p><p className="pl-reference-note">Development catalogue · Prices are retailer references, not approved VOGPK offers.</p></header>
  <div className="pl-layout"><aside className="pl-sidebar" aria-label="Filter products">{filters}</aside><div className="pl-results">
   <div className="pl-toolbar"><p role="status" aria-live="polite" data-result-count={result.total}><strong>{result.total}</strong> {result.total===1?'product':'products'}{result.total?` · ${result.start}–${result.end}`:''}</p><MobileFilterDrawer total={result.total} activeCount={activeCount}>{filters}</MobileFilterDrawer><ProductSort value={state.sort} onChange={sort=>update({sort})} /></div>
   <ActiveFilterChips facets={result.facets} state={state} onRemove={(code,value)=>code==='min'||code==='max'?update({[code]:null}):toggle(code,value)} onClear={clear} />
   {state.ignored.length?<p className="pl-query-note" role="status">Some unsupported or invalid query values were ignored: {state.ignored.join(', ')}.</p>:null}
   {result.items.length?<ProductGrid products={result.items} />:<div className="pl-empty"><h2>{result.eligibleCount?'No products match your selected filters.':'No products are listed here yet.'}</h2><p>{result.eligibleCount?'Try removing a filter or widening the reference price range.':'Explore the rest of the hardware catalogue.'}</p>{result.eligibleCount?<button type="button" className="pl-primary-button" onClick={clear}>Clear filters</button>:<Link href="/products" className="pl-primary-button">Browse all products</Link>}</div>}
   <ProductPagination page={result.page} pageCount={result.pageCount} onPage={page=>update({page},true)} hrefForPage={page=>`${scope.path}?${serializeListingState({...state,page})}`} />
  </div></div>
 </section>;
}
