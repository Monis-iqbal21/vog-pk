import { Inter } from 'next/font/google';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { site } from '@/config/site';
import './globals.css';
import {dynamicCatalog,catalogNavigation} from '@/lib/catalog/server';
import {unstable_rethrow} from 'next/navigation';
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
export const metadata = { title: `${site.name} | Vision of Gamers`, description: site.description,...(dynamicCatalog()?{robots:{index:false,follow:true}}:{}) };
export default async function RootLayout({ children }) {
  let items;
  if(dynamicCatalog()){items=[{label:'Home',href:'/'},{label:'All Products',href:'/products'}];try{const data=await catalogNavigation();items.push(...data.categories.filter(c=>c.inNavigation&&!c.parentId).map(c=>{const children=data.categories.filter(s=>s.parentId===c.id&&s.inNavigation);return children.length?{label:c.name,children:[{label:`All ${c.name}`,href:c.path},...children.map(s=>({label:s.name,href:s.path}))]}:{label:c.name,href:c.path};}));}catch(error){unstable_rethrow(error);/* Catalog pages display the unavailable state; base navigation stays usable. */}}
  return <html lang="en" className={inter.variable}><body><a className="skip-link" href="#main-content">Skip to content</a><Navbar items={items}/><main id="main-content" tabIndex={-1}>{children}</main><Footer shopLinks={items?.flatMap(i=>i.children??[i]).slice(0,12)}/></body></html>;
}
