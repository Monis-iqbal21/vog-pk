const category = (label, slug) => ({ label, href: `/products/${slug}` });
export const components = [
  category('Graphics Cards', 'graphics-cards'), category('Processors', 'processors'),
  category('Motherboards', 'motherboards'), category('RAM', 'ram'),
  category('Storage', 'storage'), category('Power Supplies', 'power-supplies'),
  category('PC Cases', 'pc-cases'), category('Cooling', 'cooling'),
];
export const peripherals = [
  category('Keyboards', 'keyboards'), category('Gaming Mice', 'gaming-mice'),
  category('Headsets', 'headsets'), category('Mousepads', 'mousepads'), category('Controllers', 'controllers'),
];
export const navigation = [
  { label: 'Home', href: '/' }, { label: 'All Products', href: '/products' },
  { label: 'PC Components', children: components }, category('Gaming PCs', 'gaming-pcs'),
  category('Monitors', 'monitors'), category('Laptops', 'laptops'),
  { label: 'Peripherals', children: peripherals }, { label: 'Deals', href: '/deals' },
];
export const footerGroups = [
  { label: 'Shop', links: [navigation[1], ...components.slice(0, 3), navigation[3], navigation[4], category('Gaming Accessories', 'accessories')] },
  { label: 'Customer Support', links: [
    { label: 'Contact Us', href: '/contact' }, { label: 'Shipping Information', href: '/shipping' },
    { label: 'Returns & Warranty', href: '/returns-warranty' }, { label: 'Frequently Asked Questions', href: '/faq' },
    { label: 'Track Order', href: '/track-order' },
  ] },
  { label: 'Information', links: [
    { label: 'About Us', href: '/about' }, { label: 'Privacy Policy', href: '/privacy-policy' },
    { label: 'Terms & Conditions', href: '/terms' }, { label: 'Refund Policy', href: '/refund-policy' },
  ] },
];
