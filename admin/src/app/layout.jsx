import {Inter} from 'next/font/google';
import '@/styles/admin.css';
const inter=Inter({subsets:['latin'],variable:'--font-inter',display:'swap'});
export const metadata={title:'VOGPK Admin',robots:{index:false,follow:false}};
export default function RootLayout({children}){return <html lang="en" className={inter.variable}><body><a href="#admin-main" className="skip-link">Skip to content</a>{children}</body></html>;}
