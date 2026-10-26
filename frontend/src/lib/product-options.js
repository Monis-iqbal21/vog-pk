import {getOptionDisplay} from '../config/productOptions.js';

export const optionStatusLabels={not_offered:'Not offered',out_of_stock:'Out of stock',unconfirmed:'Inventory unconfirmed',available:'Available'};
export function getOptionDefinitions(product){
 return (product.optionDefinitions??product.options??[]).map(option=>({...getOptionDisplay(product.category,option),values:(option.values??[]).map(item=>typeof item==='object'?{...item,value:String(item.value),label:item.label??String(item.value)}:{value:String(item),label:String(item)})}));
}
const enabled=variant=>variant.active!==false&&variant.archived!==true;
const matches=(variant,selections)=>Object.entries(selections).every(([code,value])=>variant.selections?.[code]===value);
const stockOf=product=>product.stockQuantity??product.stock;
export function getInventoryState(product){
 const stock=stockOf(product),verified=product.inventoryVerified===true&&Number.isInteger(stock)&&stock>=0;
 if(!verified||product.availability==='unconfirmed')return 'unconfirmed';
 if(stock===0)return 'out_of_stock';
 return product.availability==='out_of_stock'?'unconfirmed':'available';
}
export function validateVariantConfiguration(product){
 const options=getOptionDefinitions(product),variants=(product.variants??[]).filter(enabled),errors=[];
 const codes=new Set(),ids=new Set(),skus=new Set(),combinations=new Set();
 for(const option of options){
  if(!option.code||codes.has(option.code)||!option.values.length)errors.push('Invalid or repeated option definition');
  codes.add(option.code);
  if(new Set(option.values.map(value=>value.value)).size!==option.values.length)errors.push(`Repeated value for ${option.code}`);
 }
 for(const variant of variants){
  const key=JSON.stringify(options.map(option=>variant.selections?.[option.code]));
  if(!variant.id||ids.has(variant.id))errors.push('Missing or repeated variant ID');
  if(!variant.sku||skus.has(variant.sku))errors.push('Missing or repeated variant SKU');
  if(combinations.has(key))errors.push('Ambiguous variant combination');
  if(!options.length||options.some(option=>!option.values.some(value=>value.value===variant.selections?.[option.code]))||Object.keys(variant.selections??{}).some(code=>!codes.has(code)))errors.push(`Invalid selections for ${variant.id}`);
  ids.add(variant.id);skus.add(variant.sku);combinations.add(key);
 }
 return errors;
}
export function getActiveVariants(product){
 return validateVariantConfiguration(product).length?[]:(product.variants??[]).filter(enabled);
}
export function resolveVariant(product,variantId){
 if(!variantId)return null;
 return getActiveVariants(product).find(variant=>variant.id===variantId)??null;
}
export function getSelectionState(product,selections={}){
 const options=getOptionDefinitions(product),variants=getActiveVariants(product);
 if(!(product.variants?.length))return {status:'single',variant:null,selections:{},missing:[]};
 const missing=options.filter(option=>!Object.hasOwn(selections,option.code)).map(option=>option.label);
 const candidates=variants.filter(variant=>matches(variant,selections));
 if(!candidates.length)return {status:'invalid',variant:null,selections,missing};
 // A sole verified configuration needs no choice controls.
 if(variants.length===1&&!Object.keys(selections).length)return {status:'complete',variant:variants[0],selections:{...variants[0].selections},missing:[]};
 if(missing.length)return {status:'incomplete',variant:null,selections,missing};
 return {status:candidates.length===1?'complete':'invalid',variant:candidates.length===1?candidates[0]:null,selections,missing};
}
// Earlier dimensions constrain later ones. Later choices never lock an earlier
// dimension: changing it clears only the now-conflicting choices.
export function getOptionValueState(product,selections,code,value){
 const options=getOptionDefinitions(product),index=options.findIndex(option=>option.code===code);
 if(index<0||!options[index].values.some(item=>item.value===value))return {status:'not_offered',candidates:[]};
 const prefix=Object.fromEntries(options.slice(0,index).filter(option=>Object.hasOwn(selections,option.code)).map(option=>[option.code,selections[option.code]]));
 const candidates=getActiveVariants(product).filter(variant=>matches(variant,{...prefix,[code]:value}));
 const states=candidates.map(getInventoryState);
 const status=!states.length?'not_offered':states.includes('available')?'available':states.includes('unconfirmed')?'unconfirmed':'out_of_stock';
 return {status,candidates};
}
export function changeOptionSelection(product,current,code,value){
 const options=getOptionDefinitions(product),index=options.findIndex(option=>option.code===code);
 if(index<0||getOptionValueState(product,current,code,value).status==='not_offered')return {selections:current,cleared:[],rejected:true};
 const selections=Object.fromEntries(options.slice(0,index).filter(option=>Object.hasOwn(current,option.code)).map(option=>[option.code,current[option.code]]));
 selections[code]=value;
 const cleared=[];
 for(const option of options.slice(index+1)){
  if(!Object.hasOwn(current,option.code))continue;
  const proposed={...selections,[option.code]:current[option.code]};
  if(getActiveVariants(product).some(variant=>matches(variant,proposed)))selections[option.code]=current[option.code];
  else cleared.push(option.label);
 }
 return {selections,cleared,rejected:false};
}
// Compatibility helper, now strict: never auto-select a downstream value.
export function getOptionVariant(product,current,code,value){
 const changed=changeOptionSelection(product,current?.selections??{},code,value);
 return changed.rejected?null:getSelectionState(product,changed.selections).variant;
}
export function readVariantQuery(product,search=''){
 const params=new URLSearchParams(search),id=params.get('variant');
 if(params.has('variant')){
  const variant=resolveVariant(product,id);
  return variant?getSelectionState(product,variant.selections):{status:'invalid',variant:null,selections:{},missing:[],message:'This variant link is invalid or no longer offered. Please choose a configuration.'};
 }
 const selections={};
 for(const option of getOptionDefinitions(product)){
  const key=`option.${option.code}`;
  if(params.has(key))selections[option.code]=params.get(key);
 }
 return getSelectionState(product,selections);
}
export function writeVariantQuery(product,search,selections){
 const params=new URLSearchParams(search);params.delete('variant');
 for(const key of [...params.keys()])if(key.startsWith('option.'))params.delete(key);
 const state=getSelectionState(product,selections);
 if(state.variant)params.set('variant',state.variant.id);
 else for(const [code,value] of Object.entries(selections))params.set(`option.${code}`,value);
 return params.toString();
}
export function getVariantProduct(product,variant){
 if(!(product.variants?.length))return product;
 const selected=variant&&resolveVariant(product,variant.id);
 const ownGallery=selected?.gallery?.length?selected.gallery:selected?.images?.length?selected.images:selected?.imageIds?.length?product.gallery.filter(image=>selected.imageIds.includes(image.id)):[];
 return {...product,requiresVariant:true,selectedVariantId:selected?.id??null,
  manufacturerSku:selected?.sku??null,shortDescription:selected?.shortDescription??product.shortDescription,
  referencePricePKR:selected?.referencePricePKR??null,sourceCheckedAt:selected?.sourceCheckedAt??null,sourceUrl:selected?.sourceUrl??null,
  price:selected?.pricePKR??selected?.price??null,regularPrice:selected?.regularPrice??null,salePrice:selected?.salePrice??null,
  pricingApproved:selected?.pricingApproved===true,promotionApproved:selected?.promotionApproved===true,
  stock:selected?stockOf(selected)??null:null,inventoryVerified:selected?.inventoryVerified===true,availability:selected?.availability??null,
  specifications:{...product.specifications,...selected?.specifications},gallery:ownGallery.length?ownGallery:product.gallery};
}
export function getPurchaseState(product,hasCart=false){
 const approved=product.pricingApproved===true&&Number.isFinite(product.price)&&product.price>0;
 const discounted=approved&&product.promotionApproved===true&&Number.isFinite(product.regularPrice)&&Number.isFinite(product.salePrice)&&product.salePrice>0&&product.salePrice<product.regularPrice;
 const reference=Number.isFinite(product.referencePricePKR)&&product.referencePricePKR>0;
 const inventory=getInventoryState(product),inStock=inventory==='available';
 const complete=!product.requiresVariant||Boolean(product.selectedVariantId);
 return {approved,discounted,isReference:!approved&&reference,displayPrice:approved?(discounted?product.salePrice:product.price):reference?product.referencePricePKR:null,inventory,
  availability:inventory==='available'?'Confirmed stock available':inventory==='out_of_stock'?'Out of stock':'Stock not yet confirmed',
  canPurchase:Boolean(hasCart)&&approved&&inStock&&complete,quantityLimit:inStock?stockOf(product):1};
}
export function getStartingPrice(product,selections={}){
 const candidates=getActiveVariants(product).filter(variant=>matches(variant,selections));
 const states=candidates.map(variant=>getPurchaseState(getVariantProduct(product,variant)));
 if(!states.length)return null;
 const approved=states.every(state=>state.approved),reference=states.every(state=>state.isReference);
 if(!approved&&!reference)return null;
 const values=states.map(state=>state.displayPrice);
 if(new Set(values).size<2)return null;
 return {value:Math.min(...values),isReference:reference};
}
export function getCartItem(product,variant,quantity){
 const actual=variant?resolveVariant(product,variant.id):null;
 if(product.variants?.length&&!actual)return null;
 const effective=getVariantProduct(product,actual),purchase=getPurchaseState(effective,true);
 if(!purchase.canPurchase||!Number.isInteger(quantity)||quantity<1||quantity>purchase.quantityLimit)return null;
 return {productId:product.id,variantId:actual?.id??null,quantity};
}
