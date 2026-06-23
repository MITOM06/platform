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
      <div className="size-[42px] rounded-[11px] grid place-items-center text-xl bg-background border mb-[13px]">
        <span aria-hidden>{entry.icon}</span>
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
