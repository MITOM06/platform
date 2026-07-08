'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ConnectorPermissionsDialog } from './ConnectorPermissionsDialog'
import type { CatalogEntry, ConnectionView } from '@/lib/api/connector-types'

interface ConnectorCardProps {
  entry: CatalogEntry
  connection?: ConnectionView
  connecting?: boolean
  disconnecting?: boolean
  onConnect: (entry: CatalogEntry) => void
  onDisconnect: (connection: ConnectionView) => void
}

/** Inline SVG brand logos by catalog provider id. */
function ConnectorLogo({ id, size = 26 }: { id: string; size?: number }) {
  const dim = size
  switch (id) {
    case 'notion':
      return (
        <svg width={dim} height={dim} viewBox="0 0 24 24" fill="currentColor" aria-label="Notion">
          <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.373.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
        </svg>
      )
    case 'gmail':
      return (
        <svg width={dim} height={dim} viewBox="0 0 24 24" aria-label="Gmail">
          <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.147C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335"/>
        </svg>
      )
    case 'calendar':
      return (
        <svg width={dim} height={dim} viewBox="0 0 24 24" aria-label="Google Calendar">
          <rect width="24" height="24" rx="3" fill="#fff"/>
          <rect x="2" y="2" width="20" height="20" rx="2" fill="white" stroke="#E0E0E0" strokeWidth="0.5"/>
          <rect x="2" y="2" width="20" height="6" rx="2" fill="#1a73e8"/>
          <rect x="2" y="6" width="20" height="2" fill="#1a73e8"/>
          <text x="12" y="18.5" textAnchor="middle" fill="#1a73e8" fontSize="8" fontWeight="bold" fontFamily="sans-serif">CAL</text>
          <line x1="8" y1="2" x2="8" y2="6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="16" y1="2" x2="16" y2="6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      )
    case 'drive':
      return (
        <svg width={dim} height={dim} viewBox="0 0 24 24" aria-label="Google Drive">
          <path d="M1.004 16.428l2 3.464A2 2 0 0 0 4.732 21h14.536a2 2 0 0 0 1.728-1l2-3.464.004-.008L16.27 7H7.73L1 16.42l.004.008z" fill="#0066DA"/>
          <path d="M7.73 7L4 13.5 1 16.42 7.73 7z" fill="#00AC47"/>
          <path d="M16.27 7L23 16.42 20 13.5 16.27 7z" fill="#FFBA00"/>
          <path d="M7.73 7h8.54l2.73 4.5H5L7.73 7z" fill="#00832D"/>
          <path d="M1 16.42L4 13.5h16l3 2.92-1 1.58a2 2 0 0 1-1.732 1H4.732A2 2 0 0 1 3 18L1 16.42z" fill="#2684FC"/>
        </svg>
      )
    default:
      // Fallback: first letter of the provider id in a muted circle.
      return (
        <span className="text-sm font-bold text-muted-foreground uppercase">
          {id.charAt(0)}
        </span>
      )
  }
}

function StatusPill({
  variant,
  label,
}: {
  variant: 'on' | 'off' | 'beta'
  label: string
}) {
  return (
    <span
      className={cn(
        'font-mono text-[10px] tracking-wide px-2 py-0.5 rounded-full uppercase font-semibold border',
        variant === 'on' &&
          'text-pon-green bg-pon-green/10 border-pon-green/30',
        variant === 'off' && 'text-muted-foreground bg-background border-border',
        variant === 'beta' && 'text-pon-peach bg-pon-peach/10 border-pon-peach/30',
      )}
    >
      {label}
    </span>
  )
}

export function ConnectorCard({
  entry,
  connection,
  connecting,
  disconnecting,
  onConnect,
  onDisconnect,
}: ConnectorCardProps) {
  const t = useTranslations('integrations')
  const [permsOpen, setPermsOpen] = useState(false)
  const isConnected = connection?.status === 'active'

  const metaLabel = isConnected
    ? connection?.accountLabel
      ? t('metaAccount', { label: connection.accountLabel })
      : t('metaRemote')
    : entry.available
      ? t('metaRemote')
      : t('metaComingSoon')

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-xl border p-[18px] overflow-hidden min-h-[158px]',
        'bg-gradient-to-b from-card to-muted/40',
        isConnected &&
          'border-pon-green/40 shadow-[0_0_0_1px_rgba(67,232,166,0.12),0_14px_40px_-22px_rgba(67,232,166,0.5)]',
      )}
    >
      <div className="size-[42px] rounded-[11px] grid place-items-center bg-background border mb-[13px] overflow-hidden">
        <ConnectorLogo id={entry.icon} size={26} />
      </div>

      <h3 className="m-0 text-[15.5px] font-semibold flex items-center gap-2">
        {entry.name}
        {isConnected ? (
          <StatusPill variant="on" label={t('statusConnected')} />
        ) : entry.available ? (
          <StatusPill variant="off" label={t('statusAvailable')} />
        ) : (
          <StatusPill variant="beta" label={t('statusComingSoon')} />
        )}
      </h3>

      <p className="mt-1.5 mb-0 text-muted-foreground text-[13px] flex-1">
        {entry.description}
      </p>

      {entry.scopes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-[11px]">
          {entry.scopes.map((scope) => (
            <span
              key={scope}
              className="font-mono text-[10px] text-pon-cyan bg-pon-cyan/10 border border-pon-cyan/20 px-[7px] py-0.5 rounded-md"
            >
              {scope}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-3.5 gap-2.5">
        <span className="font-mono text-[10.5px] text-muted-foreground/70 tracking-wide truncate">
          {metaLabel}
        </span>
        {isConnected ? (
          <div className="flex items-center gap-0.5">
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => setPermsOpen(true)}
            >
              <ShieldCheck className="size-4 mr-1" />
              {t('permManage')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              disabled={disconnecting}
              onClick={() => connection && onDisconnect(connection)}
            >
              {disconnecting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                t('manage')
              )}
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            className="bg-gradient-to-r from-pon-cyan to-pon-blue text-black hover:opacity-90 shadow-[0_0_20px_-4px_rgba(61,224,255,0.6)]"
            disabled={!entry.available || connecting}
            onClick={() => onConnect(entry)}
          >
            {connecting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t('connect')
            )}
          </Button>
        )}
      </div>

      {isConnected && connection && permsOpen && (
        <ConnectorPermissionsDialog
          open={permsOpen}
          onOpenChange={setPermsOpen}
          connection={connection}
        />
      )}
    </div>
  )
}
