/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['tesseract.js'],
  },
  async redirects() {
    return [
      { source: '/biz/:slug', destination: '/~:slug', permanent: true },
    ]
  },
  async rewrites() {
    return [
      { source: '/~:slug', destination: '/biz/:slug' },
    ]
  },
}
module.exports = nextConfig
