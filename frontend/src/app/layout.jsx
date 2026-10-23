import { Inter } from 'next/font/google';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { site } from '@/config/site';
import './globals.css';
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
export const metadata = { title: `${site.name} | Vision of Gamers`, description: site.description };
export default function RootLayout({ children }) {
  return <html lang="en" className={inter.variable}><body><a className="skip-link" href="#main-content">Skip to content</a><Navbar /><main id="main-content" tabIndex={-1}>{children}</main><Footer /></body></html>;
}
