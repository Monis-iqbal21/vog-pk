import Link from 'next/link';
import { Mail, Phone, MapPin } from 'lucide-react';
import { footerGroups } from '@/config/navigation';
import { site } from '@/config/site';
import Brand from './Brand';

function Facebook() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 22v-9h3l.5-4H14V7c0-1.2.3-2 2-2h2V1.5A25 25 0 0 0 15 1c-3 0-5 1.8-5 5v3H7v4h3v9z" /></svg>;
}
function Instagram() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>;
}
function WhatsApp() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a9 9 0 0 1-13.3 8L3 21l1.5-4.7A9 9 0 1 1 21 11.5Z" /><path d="m8 7 2 3-1 1c1 2 2 3 4 4l1-1 3 2c-1 3-4 1-6 0s-5-5-4-7Z" /></svg>;
}

export default function Footer() {
  return <footer className="site-footer">
    <div className="container footer-grid">
      <div className="footer-brand"><Brand /><p>{site.description}</p></div>
      {footerGroups.map((group) => <div key={group.label}><h2>{group.label}</h2><ul>{group.links.map((link) => <li key={link.href}><Link href={link.href}>{link.label}</Link></li>)}</ul></div>)}
      <div className="footer-contact"><h2>Contact & Social</h2>
        <p><Mail size={16} aria-hidden="true" />{site.contact.email ? <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a> : <span>Email coming soon</span>}</p>
        <p><Phone size={16} aria-hidden="true" />{site.contact.phone ? <a href={`tel:${site.contact.phone}`}>{site.contact.phone}</a> : <span>Phone coming soon</span>}</p>
        <p><MapPin size={16} aria-hidden="true" />{site.contact.location}</p>
        <div className="social-links">{[['facebook', Facebook], ['instagram', Instagram], ['whatsapp', WhatsApp]].map(([name, Icon]) => site.socials[name] ? <a key={name} href={site.socials[name]} aria-label={name}><Icon /></a> : <span key={name} className="social-placeholder" role="img" aria-label={`${name} link coming soon`} title={`${name} link coming soon`}><Icon /></span>)}</div>
        <span className="contact-note">Contact details coming soon.</span>
      </div>
    </div>
    <div className="container footer-bottom"><p>© {new Date().getFullYear()} {site.name}. All rights reserved.</p><span>Vision of Gamers · Pakistan</span></div>
  </footer>;
}
