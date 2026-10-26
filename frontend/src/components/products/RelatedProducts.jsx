import ProductCarousel from './ProductCarousel';
import {getRelatedProducts} from '@/lib/products';

export default function RelatedProducts({product}){
 const related=getRelatedProducts(product);
 if(!related.length)return null;
 return <ProductCarousel id="related" title="Related products" subtitle={`More ${product.categoryName.toLowerCase()} to explore.`} products={related} seeAllHref="/#category-title" seeAllLabel="Browse hardware categories" singleRow />;
}
