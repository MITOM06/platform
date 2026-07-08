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

  async headers() {
    return [
      {
        // Apply security headers to all routes.
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // HSTS — production only (Vercel is always HTTPS). Next.js does not
          // add this automatically, so set it explicitly.
          ...(process.env.NODE_ENV === 'production'
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=31536000; includeSubDomains; preload',
                },
              ]
            : []),
          // Baseline CSP. 'unsafe-inline'/'unsafe-eval' are a temporary tradeoff
          // for Next.js + shadcn inline styles/scripts; tighten as the app stabilises.
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://apis.google.com",
              "style-src 'self' 'unsafe-inline'",
              `img-src 'self' data: blob: ${process.env.NEXT_PUBLIC_CHAT_URL ?? ''} https://lh3.googleusercontent.com https://images.unsplash.com`,
              // media-src is required for <audio>/<video> (voice messages, video, AI voice
              // replies). Without it these fall back to default-src 'self' and get blocked.
              `media-src 'self' data: blob: ${process.env.NEXT_PUBLIC_CHAT_URL ?? ''} ${process.env.NEXT_PUBLIC_AI_URL ?? ''}`,
              `connect-src 'self' ${process.env.NEXT_PUBLIC_AUTH_URL ?? ''} ${process.env.NEXT_PUBLIC_CHAT_URL ?? ''} ${process.env.NEXT_PUBLIC_AI_URL ?? ''} wss: ws:`,
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
