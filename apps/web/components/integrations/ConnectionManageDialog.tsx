'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCapabilities } from '@/lib/hooks/use-capabilities'
import { canDisconnect, connectionState } from '@/lib/integrations/gating'
import type { ConnectionView } from '@/lib/api/connector-types'

interface Props {
  /** Connector display name (never the provider slug). */
  name: string
  connection: ConnectionView | null
  onOpenChange: (open: boolean) => void
  disconnecting: boolean
  onDisconnect: (connection: ConnectionView) => void
  /** Restart the OAuth flow (shown when the connection expired). */
  onReconnect?: () => void
}

/**
 * "Manage" for an established connection: who it belongs to, its state, and a
 * disconnect that asks first — it used to disconnect on the first click. A
 * workspace connection is shared, so disconnecting it needs
 * CONNECT_WORKSPACE_CONNECTOR (the server answers 403 otherwise).
 */
export function ConnectionManageDialog({
  name,
  connection,
  onOpenChange,
  disconnecting,
  onDisconnect,
  onReconnect,
}: Props) {
  const t = useTranslations('integrations')
  const locale = useLocale()
  const perms = useCapabilities().data?.perms
  const [confirming, setConfirming] = useState(false)

  const close = (open: boolean) => {
    if (!open) setConfirming(false)
    onOpenChange(open)
  }

  if (!connection) return null
  const state = connectionState(connection)
  const workspace = connection.scope === 'workspace'
  const allowed = canDisconnect(connection, perms)

  return (
    <ResponsiveModal
      open={!!connection}
      onOpenChange={close}
      title={t('manageTitle', { name })}
      description={confirming ? t('disconnectConfirm', { name }) : t('manageDesc')}
      desktopClassName="sm:max-w-[440px]"
      footer={
        confirming ? (
          <>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={disconnecting}>
              {t('customCancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={disconnecting}
              onClick={() => onDisconnect(connection)}
            >
              {disconnecting && <Loader2 className="size-4 animate-spin" />}
              {t('disconnect')}
            </Button>
          </>
        ) : (
          <>
            {state === 'expired' && onReconnect && (
              <Button variant="outline" onClick={onReconnect}>
                {t('reconnect')}
              </Button>
            )}
            <Button
              variant="destructive"
              disabled={!allowed || disconnecting}
              onClick={() => setConfirming(true)}
            >
              {t('disconnect')}
            </Button>
          </>
        )
      }
    >
      {!confirming && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 py-2 text-sm">
          <dt className="text-muted-foreground">{t('manageStatus')}</dt>
          <dd>
            <Badge variant={state === 'expired' ? 'destructive' : 'secondary'}>
              {state === 'expired' ? t('statusReconnect') : t('statusConnected')}
            </Badge>
          </dd>
          <dt className="text-muted-foreground">{t('manageScope')}</dt>
          <dd>{workspace ? t('scopeWorkspace') : t('scopePersonal')}</dd>
          {connection.accountLabel && (
            <>
              <dt className="text-muted-foreground">{t('manageAccount')}</dt>
              <dd className="min-w-0 break-words">{connection.accountLabel}</dd>
            </>
          )}
          {connection.lastUsedAt && (
            <>
              <dt className="text-muted-foreground">{t('manageLastUsed')}</dt>
              <dd>
                {new Date(connection.lastUsedAt).toLocaleString(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </dd>
            </>
          )}
          {workspace && !allowed && (
            <p className="col-span-2 text-xs text-muted-foreground">
              {t('workspaceDisconnectNeedsCap')}
            </p>
          )}
        </dl>
      )}
    </ResponsiveModal>
  )
}
