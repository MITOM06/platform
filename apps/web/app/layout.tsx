import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import NextTopLoader from 'nextjs-toploader'
import './globals.css'
import { Providers } from '@/components/providers'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getLocale, getTranslations } from 'next-intl/server'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return {
    title: {
      default: 'PON',
      template: '%s | PON',
    },
    description: t('description'),
    icons: {
      icon: '/icon.svg',
    },
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Thin top progress bar during route navigation (YouTube/GitHub style).
            Uses the burgundy accent token; no glow (see the "no shadows for
            elevation" rule in docs/superpowers/UI-REDESIGN-DIRECTION.md §2). */}
        <NextTopLoader
          color="var(--primary)"
          height={3}
          showSpinner={false}
          shadow={false}
          initialPosition={0.1}
          crawlSpeed={200}
        />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
