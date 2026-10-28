import ProductCarousel from './ProductCarousel';
import {getRelatedProducts} from '@/lib/products';
import {getCategoryPath} from '@/lib/product-listings';

export default function RelatedProducts({product}){
 const related=getRelatedProducts(product);
 if(!related.length)return null;
 return <ProductCarousel id="related" title="Related products" subtitle={`More ${product.categoryName.toLowerCase()} to explore.`} products={related} seeAllHref={getCategoryPath(product.category)} seeAllLabel={`See All ${product.categoryName}`} singleRow />;
}
