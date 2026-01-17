/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/~:slug',
        destination: '/u/:slug',
      },
    ]
  },
}
module.exports = nextConfig
