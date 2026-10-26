import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export default function SeeAllCard({ href, label }) {
  return <Link href={href} className="product-see-all" aria-label={label} draggable={false}>
    <span className="product-see-all-icon"><ArrowUpRight size={26} aria-hidden="true" /></span>
    <span className="product-see-all-title">View All Products</span>
    <span className="product-see-all-description">Explore the full collection</span>
  </Link>;
}
