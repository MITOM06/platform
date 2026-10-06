import { getTranslations } from 'next-intl/server'
import { AuthShowcasePanel } from '@/components/auth/AuthShowcasePanel'
import { PageTransition } from '@/components/layout/PageTransition'
import { PonLogo } from '@/components/layout/PonLogo'

/**
 * Two-column frame shared by the sign-in pages `(auth)` and the post-sign-in
 * onboarding step `(onboarding)`: decorative showcase on the left (desktop
 * only), the form column on the right (the only column on mobile/tablet).
 */
export async function AuthShell({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('auth')
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-2">
      {/* Left — decorative showcase, desktop only */}
      <AuthShowcasePanel />

      {/* Right — form column (also the ONLY column on mobile/tablet) */}
      <div className="relative flex flex-col items-center justify-center overflow-hidden bg-background p-4 min-h-dvh lg:min-h-0">
        {/* Brand mark — shown here too since the showcase panel is hidden below `lg`. */}
        <div className="relative z-10 mb-8 flex flex-col items-center gap-2 motion-safe:pon-stagger lg:hidden">
          <PonLogo className="size-16" />
          <span className="text-3xl font-black tracking-tight text-primary">PON</span>
          <span className="text-sm text-muted-foreground">{t('tagline')}</span>
        </div>

        <PageTransition className="relative z-10 w-full max-w-md motion-safe:pon-enter">
          {children}
        </PageTransition>
      </div>
    </div>
  )
}
