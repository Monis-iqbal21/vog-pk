/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers(){return [{source:'/:path*',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'},{key:'Cache-Control',value:'no-store'},{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'same-origin'},{key:'X-Frame-Options',value:'DENY'},{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'}]}];},
  turbopack: {
    rules: { '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' } },
  },
};
export default nextConfig;
