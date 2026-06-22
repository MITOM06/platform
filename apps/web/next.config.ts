import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '8080', pathname: '/api/uploads/**' },
      {
        protocol: 'https',
        hostname: 'chat-service-942942821810.asia-southeast1.run.app',
        pathname: '/api/uploads/**',
      },
    ],
  },
}

export default withNextIntl(nextConfig)
