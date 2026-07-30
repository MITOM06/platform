import { getTranslations } from 'next-intl/server'
import { AuthShowcasePanel } from '@/components/auth/AuthShowcasePanel'

function PonLogo({ className = 'size-9' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`text-primary ${className}`}
    >
      <path
        d="M12 2C6.48 2 2 6.48 2 12C2 14.52 2.93 16.82 4.46 18.6L3 21L5.8 20.3C7.54 21.37 9.6 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 18C8.69 18 6 15.31 6 12C6 8.69 8.69 6 12 6C15.31 6 18 8.69 18 12C18 15.31 15.31 18 12 18Z"
        fill="currentColor"
      />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  )
}

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('auth')
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* Left — decorative showcase, desktop only */}
      <AuthShowcasePanel />

      {/* Right — form column (also the ONLY column on mobile/tablet) */}
      <div className="relative flex flex-col items-center justify-center overflow-hidden bg-background p-4 min-h-screen lg:min-h-0">
        {/* Brand mark — shown here too since the showcase panel is hidden below `lg`. */}
        <div className="relative z-10 mb-8 flex flex-col items-center gap-2 motion-safe:pon-stagger lg:hidden">
          <PonLogo className="size-16" />
          <span className="text-3xl font-black tracking-tight text-primary">PON</span>
          <span className="text-sm text-muted-foreground">{t('tagline')}</span>
        </div>

        <div className="relative z-10 w-full max-w-md motion-safe:pon-enter">{children}</div>
      </div>
    </div>
  )
}
