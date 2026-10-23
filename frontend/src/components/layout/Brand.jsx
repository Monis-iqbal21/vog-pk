import Link from 'next/link';
import Image from 'next/image';
import { site } from '@/config/site';

export default function Brand({ src = '/images/vog-Logo.png' }) {
  return <Link href="/" className="brand" aria-label={`${site.name} home`}>
    <Image src={src} alt={`${site.name} — ${site.tagline}`} width={1774} height={887} sizes="180px" loading="eager" className="brand-logo" />
  </Link>;
}
