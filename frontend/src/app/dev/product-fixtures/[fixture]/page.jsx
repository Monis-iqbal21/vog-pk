import {notFound} from 'next/navigation';
import Link from 'next/link';
import ProductDetail from '@/components/products/ProductDetail';
import {fixtureProducts} from '@/dev/productDetailFixtures';
import '@/components/products/ProductDetail.css';

export const metadata={title:'Development fixtures — not store products',robots:{index:false,follow:false}};
export default async function FixturePage({params}){
 if(process.env.NODE_ENV!=='development'||process.env.VOG_ENABLE_DETAIL_FIXTURES!=='1')notFound();
 const {fixture}=await params,product=Object.hasOwn(fixtureProducts,fixture)?fixtureProducts[fixture]:null;if(!product)notFound();
 return <article className="container pd-page"><div className="pd-fixture-notice">Development fixture only. Fictional products, prices, SKUs and stock for automated tests. Never available for purchase.</div><nav className="pd-fixture-links" aria-label="Development fixtures">{Object.keys(fixtureProducts).map(key=><Link key={key} href={`/dev/product-fixtures/${key}`}>{key==='case'?'PC case':key==='mouse'?'Mouse':'Keyboard'} fixture</Link>)}</nav><ProductDetail product={product} /></article>;
}
