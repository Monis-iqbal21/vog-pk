import {products,productCategories} from '../data/products.js';
import {categoryFilters,categoryDescriptions} from '../config/categoryFilters.js';
import {site} from '../config/site.js';

export const LISTING_PAGE_SIZE=12;
export const listingSorts=[['default','Curated order'],['price-asc','Price: Low to High'],['price-desc','Price: High to Low'],['name-asc','Name: A to Z'],['name-desc','Name: Z to A']];
const collator=new Intl.Collator('en',{numeric:true,sensitivity:'base'});
export const getCategory=slug=>productCategories.find(category=>category.slug===slug)??null;
export const getCategoryPath=slug=>`/products/${encodeURIComponent(slug)}`;
export function getListingScope(type='all',slug){
 if(type==='category'){
  const category=getCategory(slug);return category?{type,slug,title:category.name,description:categoryDescriptions[slug],path:getCategoryPath(slug)}:null;
 }
 if(type==='collection'){
  if(slug==='featured')return {type,slug,title:'Featured Products',description:'Explore the complete curated selection of featured hardware.',path:'/collections/featured'};
  if(slug==='new-arrivals')return {type,slug,title:'New Arrivals',description:'Explore our curated development launch collection.',path:'/collections/new-arrivals'};
  return null;
 }
 return type==='all'?{type:'all',title:'All Products',description:'Browse the complete gaming hardware development catalogue.',path:'/products'}:null;
}
export function getListingProducts(scope,source=products){
 return source.filter(product=>product.active&&(scope.type!=='category'||product.category===scope.slug)&&(scope.type!=='collection'||(scope.slug==='featured'?product.featured:product.newArrival)));
}
export function getFacetDefinitions(scope){
 return [{code:'brand',label:'Brand',field:'brand'},...(scope.type==='category'?(categoryFilters[scope.slug]??[]):[{code:'category',label:'Category',field:'category'}])];
}
export function getFacetValues(product,definition){
 const value=definition.field?product[definition.field]:definition.keys.map(key=>product.specifications?.[key]).find(value=>value!==null&&value!==undefined&&value!=='');
 const values=Array.isArray(value)?value:typeof value==='string'&&definition.split?value.split(','):[value];
 return [...new Set(values.filter(value=>['string','number','boolean'].includes(typeof value)&&String(value).trim()!=='').map(value=>String(value).trim()))];
}
export const getListingPrice=product=>Number.isFinite(product.referencePricePKR)&&product.referencePricePKR>=0?product.referencePricePKR:null;
export function getFacetOptions(dataset,definitions){
 return definitions.map(definition=>({...definition,values:[...new Set(dataset.flatMap(product=>getFacetValues(product,definition)))].sort(collator.compare).map(value=>({value,label:definition.code==='category'?getCategory(value)?.name??value:value}))})).filter(definition=>definition.values.length);
}
export function toListingSearch(searchParams={}){
 const params=new URLSearchParams();for(const [key,value] of Object.entries(searchParams))for(const item of Array.isArray(value)?value:[value])if(item!==undefined)params.append(key,String(item));return params.toString();
}
export function parseListingState(search,facets){
 const params=new URLSearchParams(search),filters={},ignored=[];
 const permitted=new Set(['sort','page','min','max',...facets.map(facet=>facet.code)]);
 for(const key of params.keys())if(!permitted.has(key))ignored.push(key);
 for(const facet of facets){
  const values=[...new Set(params.getAll(facet.code))];
  const valid=values.filter(value=>facet.values.some(option=>option.value===value));
  if(valid.length)filters[facet.code]=valid;
  if(valid.length!==values.length)ignored.push(facet.code);
 }
 const sort=listingSorts.some(([code])=>code===params.get('sort'))?params.get('sort'):'default';
 if(params.has('sort')&&sort!==params.get('sort'))ignored.push('sort');
 const parsePrice=key=>{const text=params.get(key);if(text===null||text==='')return null;if(!/^\d+(\.\d{1,2})?$/.test(text)||!Number.isFinite(Number(text))||Number(text)>Number.MAX_SAFE_INTEGER){ignored.push(key);return null;}return Number(text);};
 let min=parsePrice('min'),max=parsePrice('max');
 if(min!==null&&max!==null&&min>max){min=null;max=null;ignored.push('price range');}
 const rawPage=params.get('page'),page=rawPage!==null&&/^[1-9]\d*$/.test(rawPage)&&Number.isSafeInteger(Number(rawPage))?Number(rawPage):1;
 if(rawPage!==null&&String(page)!==rawPage)ignored.push('page');
 return {filters,min,max,sort,page,ignored:[...new Set(ignored)]};
}
export function filterProducts(dataset,state,definitions,excludeCode){
 return dataset.filter(product=>{
  const price=getListingPrice(product);
  if((state.min!==null||state.max!==null)&&(price===null||(state.min!==null&&price<state.min)||(state.max!==null&&price>state.max)))return false;
  return definitions.every(definition=>definition.code===excludeCode||!state.filters[definition.code]?.length||state.filters[definition.code].some(value=>getFacetValues(product,definition).includes(value)));
 });
}
export function sortProducts(dataset,sort='default'){
 return dataset.map((product,index)=>({product,index})).sort((a,b)=>{
  let delta=0;
  if(sort.startsWith('price-')){const pa=getListingPrice(a.product),pb=getListingPrice(b.product);delta=pa===null?(pb===null?0:1):pb===null?-1:(pa-pb)*(sort==='price-desc'?-1:1);}
  if(sort.startsWith('name-'))delta=collator.compare(a.product.name,b.product.name)*(sort==='name-desc'?-1:1);
  return delta||a.index-b.index;
 }).map(item=>item.product);
}
export function paginateProducts(dataset,page=1,pageSize=LISTING_PAGE_SIZE){
 const total=dataset.length,pageCount=Math.max(1,Math.ceil(total/pageSize)),currentPage=Math.min(Math.max(1,Number.isSafeInteger(page)?page:1),pageCount),offset=(currentPage-1)*pageSize;
 return {items:dataset.slice(offset,offset+pageSize),total,pageCount,page:currentPage,pageSize,start:total?offset+1:0,end:Math.min(offset+pageSize,total)};
}
export function queryListing(scope,search='',source=products){
 const dataset=getListingProducts(scope,source),definitions=getFacetDefinitions(scope),options=getFacetOptions(dataset,definitions),state=parseListingState(search,options);
 const filtered=filterProducts(dataset,state,definitions),sorted=sortProducts(filtered,state.sort),pagination=paginateProducts(sorted,state.page);
 const facets=options.map(facet=>{const candidates=filterProducts(dataset,state,definitions,facet.code);return {...facet,values:facet.values.map(value=>({...value,count:candidates.filter(product=>getFacetValues(product,facet).includes(value.value)).length}))};});
 return {scope,state,facets,...pagination,eligibleCount:dataset.length};
}
export function serializeListingState(state){
 const params=new URLSearchParams();for(const [code,values] of Object.entries(state.filters))for(const value of values)params.append(code,value);
 if(state.min!==null)params.set('min',String(state.min));if(state.max!==null)params.set('max',String(state.max));
 if(state.sort!=='default')params.set('sort',state.sort);if(state.page>1)params.set('page',String(state.page));return params.toString();
}
export function getListingMetadata(scope,search=''){
 const title=scope.type==='category'?`${scope.title} in Pakistan | VOGPK`:`${scope.title} | VOGPK`,url=new URL(scope.path,site.url).href;
 return {title,description:scope.description,alternates:{canonical:url},robots:new URLSearchParams(search).size?{index:false,follow:true}:{index:true,follow:true},openGraph:{title,description:scope.description,url,type:'website'}};
}
export function getFilterCoverage(){
 return productCategories.map(category=>{const scope=getListingScope('category',category.slug),dataset=getListingProducts(scope);return {category:category.slug,products:dataset.length,attributes:(categoryFilters[category.slug]??[]).map(definition=>({code:definition.code,label:definition.label,sourceKeys:definition.keys,covered:dataset.filter(product=>getFacetValues(product,definition).length).length,missing:dataset.filter(product=>!getFacetValues(product,definition).length).map(product=>product.id)}))};});
}
