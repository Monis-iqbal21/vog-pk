import ProductCard from './ProductCard';
export default function ProductGrid({products}){
 return <div className="pl-grid" aria-label="Product results">{products.map(product=><ProductCard key={product.id} product={product} />)}</div>;
}
