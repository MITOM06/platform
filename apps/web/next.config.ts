import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

// Build the allow-list of hosts the Next.js Image Optimizer may fetch from.
// The chat-service host changes between deployments (Cloud Run revisions get new
// URLs), so derive it from NEXT_PUBLIC_CHAT_URL at build time instead of
// hardcoding a single revision. A stale entry here makes /_next/image return 400
// and inline images silently fail to render (they only open via the raw URL).
type RemotePattern = NonNullable<NonNullable<NextConfig['images']>['remotePatterns']>[number]

const remotePatterns: RemotePattern[] = [
  // Local dev chat-service.
  { protocol: 'http', hostname: 'localhost', port: '8080', pathname: '/api/uploads/**' },
  // Known prod hosts kept as explicit fallbacks.
  {
    protocol: 'https',
    hostname: 'chat-service-942942821810.asia-southeast1.run.app',
    pathname: '/api/uploads/**',
  },
  {
    protocol: 'https',
    hostname: 'chat-service-lwnzrufcxa-as.a.run.app',
    pathname: '/api/uploads/**',
  },
]

// Whatever NEXT_PUBLIC_CHAT_URL points at this build, make sure its host is allowed.
const chatUrl = process.env.NEXT_PUBLIC_CHAT_URL
if (chatUrl) {
  try {
    const { protocol, hostname, port } = new URL(chatUrl)
    const proto = protocol.replace(':', '') as 'http' | 'https'
    const already = remotePatterns.some(
      (p) => p.hostname === hostname && (p.port ?? '') === (port ?? ''),
    )
    if (!already) {
      remotePatterns.push({
        protocol: proto,
        hostname,
        ...(port ? { port } : {}),
        pathname: '/api/uploads/**',
      })
    }
  } catch {
    // Ignore a malformed NEXT_PUBLIC_CHAT_URL — fall back to the static list above.
  }
}

const nextConfig: NextConfig = {
  output: 'standalone',
  images: { remotePatterns },
}

export default withNextIntl(nextConfig)
