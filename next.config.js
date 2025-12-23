/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'v5.airtableusercontent.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' }
    ],
  },
  // For App Router: body size limit settes i route.ts filer
  // ikke her i next.config.js
};

module.exports = nextConfig;