'use client'

import { useTranslations } from 'next-intl'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { DirectoryEntry, ConnectionView } from '@/lib/api/connector-types'

const DIRECTORY_LOGO_URLS: Record<string, string> = {
  notion: 'https://www.notion.so/front-static/favicon.ico',
  linear: 'https://linear.app/favicon.ico',
  sentry: 'https://sentry.io/favicon.ico',
  atlassian: 'https://atlassian.com/favicon.ico',
  github: 'https://github.com/favicon.ico',
  stripe: 'https://stripe.com/favicon.ico',
  huggingface: 'https://huggingface.co/favicon.ico',
  asana: 'https://asana.com/favicon.ico',
  gmail: 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico',
  calendar: 'https://calendar.google.com/googlecalendar/images/favicon_v2018_256.png',
  drive: 'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png',
}

function DirectoryLogo({ icon, name }: { icon: string; name: string }) {
  const url = DIRECTORY_LOGO_URLS[icon.toLowerCase()]
  if (!url) {
    return (
      <span className="text-lg font-bold text-pon-cyan" aria-hidden>
        {name.charAt(0).toUpperCase()}
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={name}
      width={26}
      height={26}
      className="object-contain"
      onError={(e) => {
        // Fallback to monogram on load error
        const parent = (e.target as HTMLElement).parentElement
        if (parent) {
          parent.innerHTML = `<span class="text-lg font-bold text-pon-cyan">${name.charAt(0).toUpperCase()}</span>`
        }
      }}
    />
  )
}

interface DirectoryCardProps {
  entry: DirectoryEntry
  connection?: ConnectionView
  connecting?: boolean
  disconnecting?: boolean
  isAdmin?: boolean
  onConnect: (entry: DirectoryEntry) => void
  onDisconnect: (connection: ConnectionView) => void
  onEdit?: (entry: DirectoryEntry) => void
  onDelete?: (entry: DirectoryEntry) => void
}

export function DirectoryCard({
  entry,
  connection,
  connecting,
  disconnecting,
  isAdmin,
  onConnect,
  onDisconnect,
  onEdit,
  onDelete,
}: DirectoryCardProps) {
  const t = useTranslations('integrations')
  const isConnected = connection?.status === 'active'

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-xl border p-[18px] overflow-hidden min-h-[170px]',
        'bg-gradient-to-b from-card to-muted/40',
        isConnected &&
          'border-pon-green/40 shadow-[0_0_0_1px_rgba(67,232,166,0.12),0_14px_40px_-22px_rgba(67,232,166,0.5)]',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="size-[42px] rounded-[11px] grid place-items-center bg-background border shrink-0 overflow-hidden">
          <DirectoryLogo icon={entry.icon} name={entry.name} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="m-0 text-[15.5px] font-semibold truncate">{entry.name}</h3>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide">
              {t(`tier_${entry.tier}` as 'tier_both')}
            </span>
            <span className="font-mono text-[10px] text-pon-peach/80 uppercase tracking-wide">
              · {entry.authMode}
            </span>
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-0.5 -mr-1.5 -mt-1">
            <Button
              size="icon"
              variant="ghost"
              className="size-7 text-muted-foreground"
              aria-label={t('directoryEdit')}
              onClick={() => onEdit?.(entry)}
            >
              <Pencil className="size-3.5" />
            </Button>
            {!entry.builtin && (
              <Button
                size="icon"
                variant="ghost"
                className="size-7 text-muted-foreground hover:text-destructive"
                aria-label={t('directoryDelete')}
                onClick={() => onDelete?.(entry)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      <p className="mt-2.5 mb-0 text-muted-foreground text-[13px] flex-1 line-clamp-3">
        {entry.description}
      </p>

      <div className="flex items-center justify-between mt-3.5 gap-2.5">
        <span className="font-mono text-[10.5px] text-muted-foreground/70 tracking-wide truncate">
          {isConnected && connection?.accountLabel
            ? t('metaAccount', { label: connection.accountLabel })
            : t('metaRemote')}
        </span>
        {isConnected ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            disabled={disconnecting}
            onClick={() => connection && onDisconnect(connection)}
          >
            {disconnecting ? <Loader2 className="size-4 animate-spin" /> : t('manage')}
          </Button>
        ) : (
          <Button
            size="sm"
            className="bg-gradient-to-r from-pon-cyan to-pon-blue text-black hover:opacity-90 shadow-[0_0_20px_-4px_rgba(61,224,255,0.6)]"
            disabled={connecting}
            onClick={() => onConnect(entry)}
          >
            {connecting ? <Loader2 className="size-4 animate-spin" /> : t('connect')}
          </Button>
        )}
      </div>
    </div>
  )
}
