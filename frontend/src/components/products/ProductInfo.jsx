import {Minus,Plus,ShoppingCart} from 'lucide-react';
import ProductOptions from './ProductOptions';
import {getSpecificationGroups} from '@/lib/product-specifications';
import {getPurchaseState,getStartingPrice,getCartItem,getOptionDefinitions} from '@/lib/product-options';

const money=value=>`Rs. ${new Intl.NumberFormat('en-PK',{maximumFractionDigits:0}).format(value)}`;
export default function ProductInfo({product,variantProduct,selectedVariant,selection,selectionNotice,quantity,onQuantityChange,onOptionSelect,onAddToCart}){
 const purchase=getPurchaseState(variantProduct,Boolean(onAddToCart));
 const starting=!selectedVariant&&selection.status==='incomplete'?getStartingPrice(product,selection.selections):null;
 const highlights=getSpecificationGroups(product.category,variantProduct.specifications).flatMap(group=>group.rows).slice(0,4);
 const currentQuantity=Math.min(Math.max(1,quantity),purchase.quantityLimit);
 return <div className="pd-info">
  <p className="pd-brand">{product.brand} <span> / {product.categoryName}</span></p>
  <h1>{product.name}</h1>
  <p className="pd-model">Model: {product.modelIdentifier}</p>
  {variantProduct.manufacturerSku?<p className="pd-sku">SKU: <span data-product-sku>{variantProduct.manufacturerSku}</span></p>:null}
  <p className="pd-description">{variantProduct.shortDescription}</p>
  {highlights.length?<dl className="pd-highlights">{highlights.map(row=><div key={row.key}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>:null}
  <div className="pd-price-box" aria-live="polite">
   <span className="pd-price-label">{starting?(starting.isReference?'Retailer reference prices from':'VOGPK prices starting from'):purchase.isReference?'Retailer reference price':purchase.approved?'VOGPK price':'Price pending'}</span>
   {starting?<p className="pd-price" data-starting-price>{money(starting.value)}</p>:null}
   {purchase.displayPrice!=null?<p className="pd-price" data-product-price>{purchase.discounted?<del>{money(variantProduct.regularPrice)}</del>:null}{money(purchase.displayPrice)}</p>:null}
   {purchase.isReference||starting?.isReference?<p className="pd-price-note">For reference only; not an approved VOGPK offer.{variantProduct.sourceCheckedAt?` Checked ${variantProduct.sourceCheckedAt}.`:''}</p>:null}
  </div>
  <ProductOptions product={product} selections={selection.selections} onSelect={onOptionSelect} />
  <div className="pd-selection-message" role="status" data-selection-state={selection.status}>
   {selectionNotice?<p>{selectionNotice}</p>:null}
   {selection.status==='incomplete'?<p>Choose {selection.missing.join(', ')} to select a configuration.</p>:null}
   {selection.status==='invalid'?<p>{selection.message??'This combination is not offered. Please choose a valid configuration.'}</p>:null}
   {selectedVariant?<p>Selected configuration: {getOptionDefinitions(product).map(option=>`${option.label}: ${option.values.find(item=>item.value===selectedVariant.selections[option.code])?.label??selectedVariant.selections[option.code]}`).join(' · ')}</p>:null}
  </div>
  <p className="pd-availability" role="status">{purchase.availability}</p>
  <div className="pd-purchase-controls">
   <div className="pd-quantity" role="group" aria-label="Product quantity">
    <button type="button" aria-label="Decrease quantity" disabled={!purchase.canPurchase||currentQuantity<=1} onClick={()=>onQuantityChange(currentQuantity-1)}><Minus size={16} aria-hidden="true" /></button>
    <input type="number" aria-label="Quantity" min={1} max={purchase.quantityLimit} value={currentQuantity} disabled={!purchase.canPurchase} onChange={event=>onQuantityChange(Math.min(purchase.quantityLimit,Math.max(1,Number(event.target.value)||1)))} />
    <button type="button" aria-label="Increase quantity" disabled={!purchase.canPurchase||currentQuantity>=purchase.quantityLimit} onClick={()=>onQuantityChange(currentQuantity+1)}><Plus size={16} aria-hidden="true" /></button>
   </div>
   <button type="button" className="pd-add-to-cart" disabled={!purchase.canPurchase} onClick={()=>{const item=getCartItem(product,selectedVariant,currentQuantity);if(purchase.canPurchase&&item)onAddToCart(item);}}><ShoppingCart size={18} aria-hidden="true" /> Add to Cart</button>
  </div>
  {!purchase.canPurchase?<p className="pd-purchase-note">Purchasing is not enabled. VOGPK pricing, stock and ordering must be confirmed first.</p>:null}
  <div className="pd-fulfilment-summary"><p><strong>Warranty</strong><span>{product.warranty??'VOGPK warranty coverage is not yet confirmed.'}</span></p><p><strong>Delivery</strong><span>{product.delivery??'Delivery options and timing will be confirmed when ordering is available.'}</span></p></div>
 </div>;
}
