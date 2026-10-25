'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ProductCard from './ProductCard';
import SeeAllCard from './SeeAllCard';
import './Products.css';

export default function ProductCarousel({ id, title, subtitle, products, seeAllHref, seeAllLabel, children, onAddToCart, labelledBy }) {
  const track = useRef(null);
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const element = track.current;
    element.scrollTo({ left: 0, behavior: 'instant' });
    const measure = () => {
      const start = element.scrollLeft <= 2;
      const end = element.scrollLeft + element.clientWidth >= element.scrollWidth - 2;
      setEdges((previous) => previous.start === start && previous.end === end ? previous : { start, end });
    };
    measure();
    element.addEventListener('scroll', measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => { element.removeEventListener('scroll', measure); observer.disconnect(); };
  }, [products]);

  function move(direction) {
    const element = track.current;
    const gap = parseFloat(getComputedStyle(element).columnGap) || 0;
    element.scrollBy({ left: direction * (element.clientWidth + gap), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }

  function endDrag(event) {
    if (!drag.current || event.pointerId !== drag.current.id) return;
    const moved = drag.current.moved;
    drag.current = null;
    track.current.classList.remove('is-dragging');
    if (track.current.hasPointerCapture(event.pointerId)) track.current.releasePointerCapture(event.pointerId);
    if (moved) {
      const element = track.current;
      const gap = parseFloat(getComputedStyle(element).columnGap) || 0;
      const step = element.firstElementChild.getBoundingClientRect().width + gap;
      element.scrollTo({ left: Math.round(element.scrollLeft / step) * step, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
  }

  return <section className="container product-section" aria-labelledby={`${id}-title`}>
    <div className="product-section-header">
      <div><h2 id={`${id}-title`}>{title}</h2><p>{subtitle}</p></div>
      <div className="product-carousel-arrows" role="group" aria-label={`${title} navigation`}>
        <button type="button" aria-label={`Previous ${title}`} aria-controls={`${id}-track`} disabled={edges.start} onClick={() => move(-1)}><ChevronLeft size={20} aria-hidden="true" /></button>
        <button type="button" aria-label={`Next ${title}`} aria-controls={`${id}-track`} disabled={edges.end} onClick={() => move(1)}><ChevronRight size={20} aria-hidden="true" /></button>
      </div>
    </div>
    {children}
    <div id={`${id}-track`} ref={track} className="product-track" role={labelledBy ? 'tabpanel' : 'region'} aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : `${title} products. Use left and right arrow keys to scroll.`} tabIndex={0}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1); }
        if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); track.current.scrollTo({ left: event.key === 'Home' ? 0 : track.current.scrollWidth, behavior: 'instant' }); }
      }}
      onPointerDown={(event) => {
        suppressClick.current = false;
        if (event.pointerType !== 'mouse' || event.button !== 0 || event.target.closest('button')) return;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, scroll: track.current.scrollLeft, moved: false };
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (!start || start.id !== event.pointerId) return;
        const dx = event.clientX - start.x;
        if (!start.moved && (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(event.clientY - start.y))) return;
        start.moved = true;
        suppressClick.current = true;
        track.current.setPointerCapture(event.pointerId);
        track.current.classList.add('is-dragging');
        track.current.scrollLeft = start.scroll - dx;
        event.preventDefault();
      }} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={() => { drag.current = null; track.current?.classList.remove('is-dragging'); }}
      onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}
      onDragStart={(event) => event.preventDefault()}>
      {products.slice(0, 8).map((product) => <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} />)}
      <SeeAllCard href={seeAllHref} label={seeAllLabel} />
    </div>
  </section>;
}
