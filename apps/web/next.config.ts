import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'
import { AUTH_URL, CHAT_URL, AI_URL, CONNECTOR_URL, usesSameOriginFallback } from './lib/config/env'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

// Every backend address comes from lib/config/env.ts, so this file names no host.
// A hardcoded host here was the last one left in web source: it outlived two
// deployments (the Cloud Run URLs it pinned no longer exist) while looking
// authoritative. Whatever this build targets is derived below instead.
type RemotePattern = NonNullable<NonNullable<NextConfig['images']>['remotePatterns']>[number]

// Only absolute URLs mean anything to the image optimizer and to CSP; the
// same-origin fallback ('/api/chat') is already covered by 'self'.
const absolute = (url: string): string => (url.startsWith('http') ? url : '')

// Build the allow-list of hosts the Next.js Image Optimizer may fetch from.
// A stale entry makes /_next/image return 400 and inline images silently fail to
// render (they only open via the raw URL).
const remotePatterns: RemotePattern[] = [
  // Local dev chat-service.
  { protocol: 'http', hostname: 'localhost', port: '8080', pathname: '/api/uploads/**' },
]

const chatUrl = absolute(CHAT_URL)
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
    // Ignore a malformed URL — fall back to the static list above.
  }
}

// A production build that names no backend is only correct when the web app is
// served from the same origin as the API (self-host behind Caddy). On Vercel in
// front of a separate backend it means the environment was never configured, and
// every request 404s against the Next.js app itself. Say so at build time — that
// is the only moment anyone is looking.
if (process.env.NODE_ENV === 'production' && usesSameOriginFallback) {
  console.warn(
    '\n[env] This production build has no NEXT_PUBLIC_API_BASE and no ' +
      'NEXT_PUBLIC_AUTH_URL: it will call /api/* on its own origin.\n' +
      '      Correct for single-domain self-host; wrong anywhere the backend is a ' +
      'separate host (Vercel + tunnel / Cloud Run).\n' +
      '      See docs/environments.md.\n',
  )
}

const connectSrc = [AUTH_URL, CHAT_URL, AI_URL, CONNECTOR_URL].map(absolute).filter(Boolean)
const mediaSrc = [CHAT_URL, AI_URL].map(absolute).filter(Boolean)

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
              `img-src 'self' data: blob: ${chatUrl} https://lh3.googleusercontent.com https://images.unsplash.com https://www.notion.so https://linear.app https://sentry.io https://atlassian.com https://github.com https://stripe.com https://huggingface.co https://asana.com https://ssl.gstatic.com https://calendar.google.com`,
              // media-src is required for <audio>/<video> (voice messages, video, AI voice
              // replies). Without it these fall back to default-src 'self' and get blocked.
              `media-src 'self' data: blob: ${mediaSrc.join(' ')}`,
              `connect-src 'self' ${connectSrc.join(' ')} wss: ws:`,
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
