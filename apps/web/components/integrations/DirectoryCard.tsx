'use client'

import { useTranslations } from 'next-intl'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { connectionState } from '@/lib/integrations/gating'
import { authModeLabelKey } from '@/lib/integrations/labels'
import { StatusPill } from './ConnectorCard'
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
      <span className="text-lg font-bold text-primary" aria-hidden>
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
          parent.innerHTML = `<span class="text-lg font-bold text-primary">${name.charAt(0).toUpperCase()}</span>`
        }
      }}
    />
  )
}

interface DirectoryCardProps {
  entry: DirectoryEntry
  connection?: ConnectionView
  connecting?: boolean
  /** The caller holds the capability this entry's tier needs. */
  canConnect: boolean
  isAdmin?: boolean
  onConnect: (entry: DirectoryEntry) => void
  /** Opens the manage dialog (details + confirm-to-disconnect). */
  onManage: (connection: ConnectionView) => void
  onEdit?: (entry: DirectoryEntry) => void
  onDelete?: (entry: DirectoryEntry) => void
}

export function DirectoryCard({
  entry,
  connection,
  connecting,
  canConnect,
  isAdmin,
  onConnect,
  onManage,
  onEdit,
  onDelete,
}: DirectoryCardProps) {
  const t = useTranslations('integrations')
  const state = connectionState(connection)
  const isConnected = state === 'connected'

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-xl border bg-card p-[18px] overflow-hidden min-h-[170px]',
        isConnected && 'border-pon-green/40',
        state === 'expired' && 'border-destructive/40',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="size-[42px] rounded-[11px] grid place-items-center bg-background border shrink-0 overflow-hidden">
          <DirectoryLogo icon={entry.icon} name={entry.name} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="m-0 text-[15.5px] font-semibold truncate">{entry.name}</h3>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="text-[11px] text-muted-foreground">
              {t(`tier_${entry.tier}` as 'tier_both')}
            </span>
            <span className="text-[11px] text-muted-foreground">
              · {t(authModeLabelKey(entry.authMode))}
            </span>
            {isConnected && <StatusPill variant="on" label={t('statusConnected')} />}
            {state === 'expired' && <StatusPill variant="warn" label={t('statusReconnect')} />}
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
          {state !== 'none' && connection?.accountLabel
            ? t('metaAccount', { label: connection.accountLabel })
            : t('metaRemote')}
        </span>
        {state !== 'none' && connection ? (
          <div className="flex items-center gap-0.5">
            {state === 'expired' && canConnect && (
              <Button size="sm" disabled={connecting} onClick={() => onConnect(entry)}>
                {connecting ? <Loader2 className="size-4 animate-spin" /> : t('reconnect')}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => onManage(connection)}
            >
              {t('manage')}
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            disabled={connecting || !canConnect || !entry.available}
            title={!canConnect ? t('connectNeedsCap') : undefined}
            onClick={() => onConnect(entry)}
          >
            {connecting ? <Loader2 className="size-4 animate-spin" /> : t('connect')}
          </Button>
        )}
      </div>
      {!canConnect && state === 'none' && (
        <p className="mt-2 text-xs text-muted-foreground">{t('connectNeedsCap')}</p>
      )}
    </div>
  )
}
