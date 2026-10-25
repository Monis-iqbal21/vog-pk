import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export default function PromoBanner({ banner, variant, preload = false, children }) {
  const isMain = variant === 'main';
  const Heading = isMain ? 'h1' : 'h2';
  return <article className={`home-hero-banner home-hero-${variant}`} aria-labelledby={`hero-${banner.id}-heading`}>
    <Image key={banner.image} src={banner.image} alt="" fill sizes={isMain ? '(min-width: 1400px) 868px, (min-width: 1024px) calc((100vw - 98px) * 2 / 3), (min-width: 400px) 92vw, calc(100vw - 32px)' : '(min-width: 1400px) 434px, (min-width: 1024px) calc((100vw - 98px) / 3), (min-width: 768px) calc((92vw - 18px) / 2), (min-width: 400px) 92vw, calc(100vw - 32px)'} preload={preload} className="home-hero-artwork" />
    <div key={banner.id} className="home-hero-content">
      <span className="home-hero-label">{banner.label}</span>
      <Heading id={`hero-${banner.id}-heading`} className="home-hero-heading">{banner.heading}</Heading>
      <p className="home-hero-description">{banner.description}</p>
      <Link href={banner.href} className="home-hero-cta">{banner.cta}<ArrowUpRight size={16} aria-hidden="true" /></Link>
    </div>
    {children}
  </article>;
}


