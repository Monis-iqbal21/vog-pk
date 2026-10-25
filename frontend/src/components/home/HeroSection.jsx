'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { heroSlides } from '@/config/heroSlides';
import PromoBanner from './PromoBanner';
import './HeroSection.css';

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
function subscribeMotion(callback) {
  const media = window.matchMedia(reducedMotionQuery);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}
function subscribeVisibility(callback) {
  document.addEventListener('visibilitychange', callback);
  return () => document.removeEventListener('visibilitychange', callback);
}
const getReducedMotion = () => window.matchMedia(reducedMotionQuery).matches;
const getHidden = () => document.hidden;
const getServerPaused = () => true;

export default function HeroSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [rotationReset, setRotationReset] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const touchStart = useRef(null);
  const reducedMotion = useSyncExternalStore(subscribeMotion, getReducedMotion, getServerPaused);
  const hidden = useSyncExternalStore(subscribeVisibility, getHidden, getServerPaused);
  const shouldPlay = heroSlides.length > 1 && !hovered && !focused && !hidden && !reducedMotion;
  const activeSlide = heroSlides[activeIndex];

  useEffect(() => {
    if (!shouldPlay) return;
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % heroSlides.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [shouldPlay, rotationReset]);

  function selectSlide(index) {
    const next = (index + heroSlides.length) % heroSlides.length;
    setActiveIndex(next);
    setRotationReset((value) => value + 1);
    setAnnouncement(`Promotion ${next + 1} of ${heroSlides.length}: ${heroSlides[next].name}.`);
  }

  function handleTouchStart(event) {
    if (event.touches.length !== 1 || event.target.closest('a, button')) {
      touchStart.current = null;
      return;
    }
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(event) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || !event.changedTouches.length) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) >= 56 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      selectSlide(activeIndex + (dx < 0 ? 1 : -1));
    }
  }

  const controls = <div className="home-hero-controls" role="group" aria-label="Promotion controls">
    <button type="button" aria-label="Previous promotion" onClick={() => selectSlide(activeIndex - 1)}><ChevronLeft size={18} aria-hidden="true" /></button>
    <div className="home-hero-dots" role="group" aria-label="Choose a promotion">
      {heroSlides.map((slide, index) => <button key={slide.id} type="button" aria-label={`Show promotion ${index + 1}: ${slide.name}`} aria-current={index === activeIndex ? 'true' : undefined} onClick={() => selectSlide(index)}><span /></button>)}
    </div>
    <button type="button" aria-label="Next promotion" onClick={() => selectSlide(activeIndex + 1)}><ChevronRight size={18} aria-hidden="true" /></button>
  </div>;

  return <section className="container home-hero-section" aria-label="Featured promotions" aria-roledescription="carousel"
    onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHovered(true); }} onPointerLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
    onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onTouchCancel={() => { touchStart.current = null; }}>
    <div className="home-hero-grid" aria-live="off" data-slide={activeSlide.id}>
      <PromoBanner banner={activeSlide.main} variant="main" preload={activeIndex === 0}>{controls}</PromoBanner>
      <PromoBanner banner={activeSlide.topRight} variant="light" />
      <PromoBanner banner={activeSlide.bottomRight} variant="dark" />
    </div>
    <p className="home-hero-sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
  </section>;
}

