import {productDetailGallery} from './product-detail-gallery.js';

// Only confirmed product-specific additions belong here. A technical attribute is
// not a purchasable option. Current catalogue SKUs have no confirmed variant sets
// or licensed marketing posters/banners, so those arrays remain empty by default.
export const productDetails=Object.fromEntries(Object.entries(productDetailGallery).map(([id,gallery])=>[id,{gallery}]));
