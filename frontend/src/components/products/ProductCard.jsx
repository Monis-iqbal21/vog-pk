import Image from 'next/image';
import Link from 'next/link';
import { Plus } from 'lucide-react';

const rupees = new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 });

export default function ProductCard({ product, onAddToCart }) {
  const approvedPrice = product.pricingApproved === true && Number.isFinite(product.price) && product.price > 0;
  const discounted = approvedPrice && product.promotionApproved === true && Number.isFinite(product.regularPrice) && Number.isFinite(product.salePrice) && product.salePrice > 0 && product.salePrice < product.regularPrice;
  const referencePrice = Number.isFinite(product.referencePricePKR) && product.referencePricePKR > 0;
  const displayPrice = approvedPrice ? (discounted ? product.salePrice : product.price) : referencePrice ? product.referencePricePKR : null;
  const available = product.inventoryVerified === true && Number.isFinite(product.stock) && product.stock > 0;
  const canAdd = Boolean(onAddToCart) && available && approvedPrice;
  return <article className="product-card">
    <Link href={`/products/${product.category}/${product.slug}`} className="product-card-link" draggable={false}>
      <div className="product-image-wrap">
        <Image src={product.image} alt={product.imageAlt || product.name} fill sizes="(min-width: 1400px) 317px, (min-width: 1280px) 23vw, (min-width: 768px) 30vw, 45vw" className="product-image" draggable={false} />
        {product.imageIsPlaceholder ? <span className="product-image-note">Image coming soon</span> : null}
      </div>
      <span className="product-brand">{product.brand}</span>
      <h3 className="product-name" title={product.name}>{product.name}</h3>
      <p className="product-description" title={product.shortDescription}>{product.shortDescription}</p>
    </Link>
    {product.imageCreditUrl ? <a href={product.imageCreditUrl} className="product-image-credit" aria-label={`Photo credit and license for ${product.name}`} title={product.imageDevelopmentOnly ? 'Development image: retail replacement pending. View photo credit and license.' : 'Photo credit, license and image changes'}>{product.imageDevelopmentOnly ? 'Development image' : 'Photo credit'}</a> : null}
    <div className="product-card-bottom">
      <div className="product-price-block">
        <span className="product-regular-price" title={!approvedPrice ? `Retailer reference checked ${product.sourceCheckedAt}; not an approved VOGPK selling price` : undefined}>{discounted ? <del>Rs. {rupees.format(product.regularPrice)}</del> : !approvedPrice ? 'Reference' : null}</span>
        <span className="product-price">{displayPrice == null ? 'Price pending' : `Rs. ${rupees.format(displayPrice)}`}</span>
      </div>
      <button type="button" className="product-add" disabled={!canAdd} aria-label={`Add ${product.name} to cart${!canAdd ? ' (not available for purchase)' : ''}`} title={!canAdd ? 'Purchasing pending approved pricing, inventory, and cart integration' : 'Add to cart'} onClick={() => { if (canAdd) onAddToCart(product); }}><Plus size={20} aria-hidden="true" /></button>
    </div>
  </article>;
}
