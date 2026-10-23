'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Search, UserRound, Heart, ShoppingCart, Menu, X, ChevronDown } from 'lucide-react';
import { navigation } from '@/config/navigation';
import Brand from './Brand';

function NavigationLinks({ mobile = false, onNavigate }) {
  const pathname = usePathname();
  return navigation.map((item) => item.children ? (
    <details className="nav-dropdown" key={item.label} onKeyDown={(event) => {
      if (event.key === 'Escape') {
        event.currentTarget.open = false;
        event.currentTarget.querySelector('summary').focus();
      }
    }} onBlur={(event) => {
      if (!mobile && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
    }}>
      <summary className="nav-link">{item.label}<ChevronDown aria-hidden="true" size={14} /></summary>
      <div className="dropdown-links">{item.children.map((child) => <Link key={child.href} href={child.href} onClick={onNavigate} aria-current={pathname === child.href ? 'page' : undefined}>{child.label}</Link>)}</div>
    </details>
  ) : <Link key={item.href} href={item.href} className="nav-link" aria-current={pathname === item.href ? 'page' : undefined} onClick={onNavigate}>{item.label}</Link>);
}

export default function Navbar() {
  const dialog = useRef(null);
  const search = useRef(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const media = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (media.matches) dialog.current?.close(); };
    media.addEventListener('change', closeOnDesktop);
    return () => { document.body.style.overflow = previous; media.removeEventListener('change', closeOnDesktop); };
  }, [open]);
  const close = () => dialog.current?.close();
  return <header className="site-header">
    <div className="container main-header">
      <Brand src="/images/vog-Logo-dark.png" />
      <div className="search-field" role="search">
        <Search size={20} aria-hidden="true" />
        <input ref={search} type="search" aria-label="Search products (coming soon)" placeholder="Search products, brands, components..." />
        <kbd aria-hidden="true">Search</kbd>
      </div>
      <div className="header-actions">
        <button className="icon-button mobile-search" aria-label="Focus product search" onClick={() => search.current?.focus()}><Search /></button>
        <button className="icon-button desktop-action" disabled aria-label="Account (coming soon)" title="Account coming soon"><UserRound /></button>
        <button className="icon-button desktop-action" disabled aria-label="Wishlist (coming soon)" title="Wishlist coming soon"><Heart /></button>
        <button className="icon-button cart-button" disabled aria-label="Shopping cart (coming soon)" title="Cart coming soon"><ShoppingCart /><span className="cart-count" aria-hidden="true">—</span></button>
        <button className="icon-button mobile-menu" aria-label="Open navigation" aria-haspopup="dialog" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => { dialog.current.showModal(); setOpen(true); }}><Menu /></button>
      </div>
    </div>
    <nav className="desktop-nav" aria-label="Main navigation"><div className="container nav-items"><NavigationLinks /></div></nav>
    <dialog ref={dialog} id="mobile-navigation" className="mobile-drawer" aria-labelledby="drawer-title" onClose={() => setOpen(false)} onKeyDown={(event) => {
      if (event.key !== 'Tab') return;
      const controls = [...event.currentTarget.querySelectorAll('button, a[href], summary')].filter((element) => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div className="drawer-content">
        <div className="drawer-heading"><span id="drawer-title">Explore VOGPK</span><button className="icon-button" aria-label="Close navigation" onClick={close} autoFocus><X /></button></div>
        <nav aria-label="Mobile navigation"><NavigationLinks mobile onNavigate={close} /></nav>
        <p className="drawer-note">PC hardware. A clearer vision.</p>
      </div>
    </dialog>
  </header>;
}
