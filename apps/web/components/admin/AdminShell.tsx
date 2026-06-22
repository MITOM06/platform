'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import {
  ArrowLeft,
  Building2,
  ClipboardList,
  KeyRound,
  ShieldCheck,
  Users,
  UsersRound,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  useCanAccessAdmin,
  useCapabilities,
} from '@/lib/hooks/use-capabilities'
import type { Capability } from '@/lib/api/admin-types'

interface AdminSection {
  href: string
  cap: Capability
  labelKey: string
  icon: typeof Building2
}

/** Admin console sections, in nav order. Each is gated by one capability. */
export const ADMIN_SECTIONS: AdminSection[] = [
  { href: '/admin/workspace', cap: 'MANAGE_WORKSPACE', labelKey: 'navWorkspace', icon: Building2 },
  { href: '/admin/sso', cap: 'MANAGE_WORKSPACE', labelKey: 'navSso', icon: KeyRound },
  { href: '/admin/departments', cap: 'MANAGE_DEPARTMENTS', labelKey: 'navDepartments', icon: UsersRound },
  { href: '/admin/members', cap: 'MANAGE_MEMBERS', labelKey: 'navMembers', icon: Users },
  { href: '/admin/roles', cap: 'MANAGE_ROLES', labelKey: 'navRoles', icon: ShieldCheck },
  { href: '/admin/audit', cap: 'VIEW_AUDIT_LOG', labelKey: 'navAudit', icon: ClipboardList },
]

/**
 * Admin console chrome: back button, title, and the capability-filtered section
 * tabs. Redirects to /conversations if the caller has no admin capabilities at
 * all (defence-in-depth on top of the backend's per-route enforcement).
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('admin')
  const pathname = usePathname()
  const router = useRouter()
  const { isLoading } = useCapabilities()
  const canAccess = useCanAccessAdmin()
  const { data } = useCapabilities()

  useEffect(() => {
    if (!isLoading && !canAccess) router.replace('/conversations')
  }, [isLoading, canAccess, router])

  const visibleSections = ADMIN_SECTIONS.filter(
    (s) => data?.perms.includes(s.cap),
  )

  if (isLoading || !canAccess) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        {t('loading')}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background/50 overflow-y-auto">
      <div className="border-b px-6 py-4 bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="md:hidden" aria-label={t('back')}>
            <Link href="/settings">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="text-pon-cyan size-6" /> {t('title')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
          </div>
        </div>

        <nav className="flex gap-1 mt-4 overflow-x-auto">
          {visibleSections.map((s) => {
            const active = pathname === s.href
            const Icon = s.icon
            return (
              <Link
                key={s.href}
                href={s.href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors',
                  active
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                <Icon className="size-4" />
                {t(s.labelKey)}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="p-6 pb-24 md:pb-6 max-w-5xl w-full mx-auto">{children}</div>
    </div>
  )
}
