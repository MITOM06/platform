'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAuthStore } from '@/lib/store/auth.store'
import { setPasswordRedirect } from '@/lib/auth/set-password-gate'

/**
 * Keeps a Google-invited member on `/set-password` until they create their PON
 * password, and sends everyone else away from it. Mounted by the `(main)` and
 * `(onboarding)` layouts. While a redirect is pending it renders a spinner
 * INSTEAD of `children`, so the app shell (STOMP, conversation list, …) never
 * mounts for a gated user.
 */
export function SetPasswordGate({
  children,
  inline = false,
}: {
  children: React.ReactNode
  /** Spinner sized for a content column instead of the full viewport. */
  inline?: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()
  const tCommon = useTranslations('common')
  const user = useAuthStore((s) => s.user)
  const target = setPasswordRedirect(pathname, user)

  useEffect(() => {
    if (target) router.replace(target)
  }, [target, router])

  if (target) {
    return (
      <div
        className={`${inline ? 'py-16' : 'h-dvh bg-background'} w-full flex items-center justify-center`}
        role="status"
      >
        <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
        <span className="sr-only">{tCommon('loading')}</span>
      </div>
    )
  }

  return <>{children}</>
}
