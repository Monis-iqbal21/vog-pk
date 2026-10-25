'use client';

import { useRef, useState } from 'react';
import ProductCarousel from '@/components/products/ProductCarousel';
import { getCategoryProducts, productCategories } from '@/data/products';

export default function ShopByCategory() {
  const [activeCategory, setActiveCategory] = useState('graphics-cards');
  const tabs = useRef([]);
  const category = productCategories.find((item) => item.slug === activeCategory);
  return <ProductCarousel id="category" title="Shop by Category" subtitle="Find the right components for your setup." products={getCategoryProducts(activeCategory)} seeAllHref={`/products/${activeCategory}`} seeAllLabel={`See All ${category.name}`} labelledBy={`category-tab-${activeCategory}`}>
    <div className="product-category-tabs" role="tablist" aria-label="Product categories">
      {productCategories.map((item, index) => <button key={item.slug} ref={(element) => { tabs.current[index] = element; }} id={`category-tab-${item.slug}`} type="button" role="tab" aria-selected={item.slug === activeCategory} aria-controls="category-track" tabIndex={item.slug === activeCategory ? 0 : -1}
        onClick={() => setActiveCategory(item.slug)} onKeyDown={(event) => {
          let next;
          if (event.key === 'ArrowRight') next = (index + 1) % productCategories.length;
          if (event.key === 'ArrowLeft') next = (index - 1 + productCategories.length) % productCategories.length;
          if (event.key === 'Home') next = 0;
          if (event.key === 'End') next = productCategories.length - 1;
          if (next == null) return;
          event.preventDefault();
          setActiveCategory(productCategories[next].slug);
          tabs.current[next]?.focus({ preventScroll: true });
          tabs.current[next]?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
        }}>{item.name}</button>)}
    </div>
  </ProductCarousel>;
}
