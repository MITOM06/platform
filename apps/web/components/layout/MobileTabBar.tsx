'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { MessageSquare, Users, Compass, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { key: 'chat', href: '/conversations', icon: MessageSquare, labelKey: 'tabChat' },
  { key: 'friends', href: '/friends', icon: Users, labelKey: 'tabFriends' },
  { key: 'explore', href: '/explore', icon: Compass, labelKey: 'navExplore' },
  { key: 'settings', href: '/settings', icon: Settings, labelKey: 'menuSettings' },
] as const

export function MobileTabBar() {
  const pathname = usePathname()
  const t = useTranslations('layout')

  function isActive(href: string) {
    if (href === '/conversations') return pathname === '/conversations' || pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 border-t bg-background/95 backdrop-blur-md flex items-stretch"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map(({ key, href, icon: Icon, labelKey }) => {
        const active = isActive(href)
        return (
          <Link
            key={key}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors',
              active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className={cn('size-5 shrink-0', active && 'drop-shadow-[0_0_6px_currentColor]')} />
            <span className="leading-none">{t(labelKey)}</span>
          </Link>
        )
      })}
    </nav>
  )
}
