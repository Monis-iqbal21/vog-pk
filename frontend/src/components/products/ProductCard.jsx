import Image from 'next/image';
import Link from 'next/link';
import { Plus } from 'lucide-react';

const rupees = new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 });

export default function ProductCard({ product, onAddToCart }) {
  const discounted = product.salePrice != null && product.salePrice >= 0 && product.salePrice < product.price;
  const available = product.stock == null || product.stock > 0;
  const canAdd = Boolean(onAddToCart) && available;
  return <article className="product-card">
    <Link href={`/products/${product.category}/${product.slug}`} className="product-card-link" draggable={false}>
      <div className="product-image-wrap">
        <Image src={product.image} alt={product.imageIsPlaceholder ? `Product image placeholder for ${product.name}` : product.name} fill sizes="(min-width: 1400px) 317px, (min-width: 1280px) 23vw, (min-width: 768px) 30vw, 45vw" className="product-image" draggable={false} />
        {product.imageIsPlaceholder ? <span className="product-image-note">Image coming soon</span> : null}
      </div>
      <span className="product-brand">{product.brand}</span>
      <h3 className="product-name" title={product.name}>{product.name}</h3>
    </Link>
    <div className="product-card-bottom">
      <div className="product-price-block">
        <span className="product-regular-price">{discounted ? <del>Rs. {rupees.format(product.price)}</del> : null}</span>
        <span className="product-price">Rs. {rupees.format(discounted ? product.salePrice : product.price)}</span>
      </div>
      <button type="button" className="product-add" disabled={!canAdd} aria-label={`Add ${product.name} to cart${!onAddToCart ? ' (coming soon)' : !available ? ' (out of stock)' : ''}`} title={!onAddToCart ? 'Cart coming soon' : !available ? 'Out of stock' : 'Add to cart'} onClick={() => onAddToCart?.(product)}><Plus size={20} aria-hidden="true" /></button>
    </div>
  </article>;
}
