'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Server, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useConnectorActions, useCustomMcpServers } from '@/lib/hooks/use-connectors'
import type { CustomMcpServer } from '@/lib/api/connector-types'

const AUTH_KEYS: Record<CustomMcpServer['authType'], string> = {
  none: 'authNone',
  apikey: 'authApiKey',
  oauth2: 'authOauth',
}

/**
 * The caller's own custom MCP servers (`GET /custom-mcp`) with delete. Listing
 * and deleting need no capability, so a member who lost ADD_CUSTOM_MCP can still
 * clean up. The server URL is internal configuration and is not shown.
 */
export function CustomMcpList() {
  const t = useTranslations('integrations')
  const { data: servers = [], isLoading, isError } = useCustomMcpServers()
  const { deleteCustomMcp } = useConnectorActions()
  const [deleting, setDeleting] = useState<CustomMcpServer | null>(null)

  if (isLoading) return null
  if (isError) {
    return <p className="mt-4 text-sm text-destructive">{t('customListError')}</p>
  }
  if (servers.length === 0) return null

  return (
    <div className="mt-4 space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t('customListTitle')}
      </h3>
      {servers.map((server) => (
        <div
          key={server.id}
          className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
          data-testid="custom-mcp-row"
        >
          <Server className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{server.name}</p>
            <p className="text-xs text-muted-foreground">
              {t(AUTH_KEYS[server.authType] ?? 'authNone')} ·{' '}
              {t('customToolsFound', { count: server.toolsPreview.length })}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="tap text-muted-foreground hover:text-destructive"
            aria-label={t('customDelete')}
            disabled={deleteCustomMcp.isPending && deleteCustomMcp.variables === server.id}
            onClick={() => setDeleting(server)}
          >
            {deleteCustomMcp.isPending && deleteCustomMcp.variables === server.id ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
          </Button>
        </div>
      ))}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t('customDelete')}
        description={t('customDeleteConfirm', { name: deleting?.name ?? '' })}
        confirmLabel={t('customDelete')}
        onConfirm={() => deleting && deleteCustomMcp.mutate(deleting.id)}
      />
    </div>
  )
}
