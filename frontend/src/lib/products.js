import {products,productCategories} from '../data/products.js';
import {productDetails} from '../data/productDetails.js';
import {productImages} from '../data/product-images.js';

const catalogueBySlug=new Map(products.map(product=>[product.slug,product]));
export const getProductBySlug=slug=>catalogueBySlug.get(slug)?.active?catalogueBySlug.get(slug):null;
export const getProductPath=product=>`/products/${encodeURIComponent(product.slug)}`;
export const getProductSlugs=()=>products.filter(product=>product.active).map(product=>({slug:product.slug}));

export function getProductDetailBySlug(slug){
 const product=getProductBySlug(slug);if(!product)return null;
 const detail=productDetails[product.id]??{},image=productImages[product.id];
 const primary={id:`${product.id}-primary`,src:product.image,alt:product.imageAlt??product.name,width:image?.width??product.imageWidth,height:image?.height??product.imageHeight,creditUrl:product.imageCreditUrl};
 const gallery=[...(product.gallery??[primary]),...(detail.gallery??[])];
 const specifications={...product.specifications,...detail.specifications};
 return {...product,categoryName:productCategories.find(category=>category.slug===product.category)?.name??product.category,specifications,gallery,optionDefinitions:detail.optionDefinitions??product.optionDefinitions,options:detail.options??product.options??[],variants:detail.variants??product.variants??[],contentBlocks:detail.contentBlocks??product.contentBlocks??[],overview:detail.overview??product.overview??product.shortDescription,features:detail.features??product.features??[],warranty:detail.warranty??product.warranty??null,delivery:detail.delivery??product.delivery??null};
}

export function getRelatedProducts(product,limit=6){
 return products.filter(candidate=>candidate.active&&candidate.category===product.category&&candidate.id!==product.id).slice(0,limit);
}
