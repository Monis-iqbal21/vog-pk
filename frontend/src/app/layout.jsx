import { Inter } from "next/font/google";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { site } from "@/config/site";
import "./globals.css";
import { dynamicCatalog, catalogNavigation } from "@/lib/catalog/server";
import { unstable_rethrow } from "next/navigation";
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
export const metadata = {
  title: `${site.name} | Vision of Gamers`,
  description: site.description,
  ...(dynamicCatalog() ? { robots: { index: false, follow: true } } : {}),
};
export default async function RootLayout({ children }) {
  let items, shopLinks;
  if (dynamicCatalog()) {
    items = [
      { label: "Home", href: "/" },
      { label: "All Products", href: "/products" },
    ];
    try {
      const data = await catalogNavigation();
      shopLinks = data.categories
        .filter((c) => c.inNavigation)
        .map((c) => ({ label: c.name, href: c.path }));
      const roots = data.categories.filter(
        (c) => c.inNavigation && !c.parentId,
      );
      // An unbounded number of flat categories cannot fit a desktop navigation
      // row. The existing accessible dropdown keeps every category reachable.
      if (roots.length > 6)
        items.push({ label: "Shop by Category", children: shopLinks });
      else
        items.push(
          ...roots.map((c) => {
            const children = data.categories.filter(
              (s) => s.parentId === c.id && s.inNavigation,
            );
            return children.length
              ? {
                  label: c.name,
                  children: [
                    { label: `All ${c.name}`, href: c.path },
                    ...children.map((s) => ({ label: s.name, href: s.path })),
                  ],
                }
              : { label: c.name, href: c.path };
          }),
        );
    } catch (error) {
      unstable_rethrow(error); /* Catalog pages display unavailable state. */
    }
  }
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <Navbar items={items} />
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <Footer shopLinks={shopLinks} />
      </body>
    </html>
  );
}
