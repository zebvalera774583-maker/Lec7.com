/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
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
