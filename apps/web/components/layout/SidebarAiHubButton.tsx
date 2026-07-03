'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Bot, ChevronRight } from 'lucide-react'

/**
 * AI Hub launcher pinned to the bottom of the messaging sidebar (desktop),
 * sitting directly above the account bar so the two read as one cohesive
 * bottom cluster. Mobile reaches the AI Hub via its own surfaces, so this
 * is `md` and up only — mirroring SidebarProfileBar.
 */
export function SidebarAiHubButton() {
  const router = useRouter()
  const t = useTranslations('aiHub')

  return (
    <div className="hidden md:block shrink-0 border-t bg-background/95 backdrop-blur-md px-2.5 pt-2.5">
      <button
        type="button"
        onClick={() => router.push('/ai-hub')}
        className="group relative flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pon-cyan/50 justify-center @[200px]:justify-start"
      >
        {/* Gradient icon badge — same PON gradient as the account avatar ring */}
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pon-cyan via-pon-peach to-pon-pink shadow-[0_0_12px_-2px] shadow-pon-peach/40">
          <Bot className="size-5 text-white" />
        </span>

        <span className="hidden @[200px]:block min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold leading-tight">
            {t('title')}
          </span>
          <span className="block truncate text-xs leading-tight text-muted-foreground">
            {t('subtitle')}
          </span>
        </span>

        <ChevronRight className="hidden @[200px]:block size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
      </button>
    </div>
  )
}
