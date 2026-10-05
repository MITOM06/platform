'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import {
  useConnections,
  useConnectorActions,
  useDirectory,
  useDirectoryAdmin,
} from '@/lib/hooks/use-connectors'
import { useCapabilities, useHasCapability } from '@/lib/hooks/use-capabilities'
import { useOAuthPopup, useOAuthReturnNotice } from '@/lib/hooks/use-oauth-popup'
import { connectorService } from '@/lib/api/connector'
import { connectorErrorKey } from '@/lib/integrations/connector-errors'
import { canConnect } from '@/lib/integrations/gating'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { DirectoryCard } from './DirectoryCard'
import { DirectoryAdminDialog } from './DirectoryAdminDialog'
import { DirectoryKeyDialog } from './DirectoryKeyDialog'
import { ConnectionManageDialog } from './ConnectionManageDialog'
import type { DirectoryEntry, ConnectionView } from '@/lib/api/connector-types'

/**
 * The dynamic MCP directory section: a searchable 1-click connect grid backed
 * by the DB-driven directory. OAuth entries connect via popup; apikey entries
 * via a key dialog; "none" entries connect instantly. Admins (MANAGE_WORKSPACE)
 * can add/edit/delete entries. Mirrors the Flutter directory screen.
 */
export function DirectorySection() {
  const t = useTranslations('integrations')
  const isAdmin = useHasCapability('MANAGE_WORKSPACE')
  const perms = useCapabilities().data?.perms

  const { data: directory = [], isLoading } = useDirectory()
  const { data: connections = [] } = useConnections()
  const { disconnect, invalidateConnections } = useConnectorActions()
  const { remove } = useDirectoryAdmin()

  const notifyOAuth = useOAuthReturnNotice()
  const { connectingId, open, reset } = useOAuthPopup((result) => {
    invalidateConnections()
    if (result) notifyOAuth(result)
  })
  const [query, setQuery] = useState('')
  const [managing, setManaging] = useState<ConnectionView | null>(null)
  const [deleting, setDeleting] = useState<DirectoryEntry | null>(null)
  const [editEntry, setEditEntry] = useState<DirectoryEntry | null>(null)
  const [adminOpen, setAdminOpen] = useState(false)
  const [keyEntry, setKeyEntry] = useState<DirectoryEntry | null>(null)

  const connByProvider = useMemo(
    () => new Map(connections.map((c) => [c.provider, c])),
    [connections],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return directory
    return directory.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.slug.toLowerCase().includes(q),
    )
  }, [directory, query])

  const handleConnect = async (entry: DirectoryEntry) => {
    try {
      const res = await connectorService.startDirectoryOAuth(entry.slug)
      if (res.mode === 'oauth') {
        open(res.authorizeUrl, entry.slug)
      } else if (res.mode === 'apikey') {
        setKeyEntry(entry)
      } else {
        invalidateConnections()
        toast.success(t('connectSuccess', { provider: entry.name }))
      }
    } catch (err) {
      toast.error(t(connectorErrorKey(err, 'connectError')))
      reset()
    }
  }

  const managingName =
    directory.find((e) => e.slug === managing?.provider)?.name ?? t('connectorFallbackName')

  const openCreate = () => {
    setEditEntry(null)
    setAdminOpen(true)
  }
  const openEdit = (entry: DirectoryEntry) => {
    setEditEntry(entry)
    setAdminOpen(true)
  }

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="font-mono text-primary text-xs tracking-[2px]">
            {t('sectionDirectoryNum')}
          </div>
          <h2 className="text-xl font-bold tracking-tight mt-1">
            {t('sectionDirectoryTitle')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('sectionDirectoryDesc')}
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={openCreate}>
            <Plus className="size-4 mr-1.5" /> {t('directoryAdd')}
          </Button>
        )}
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('directorySearch')}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[170px] rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {t('directoryEmpty')}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((entry) => {
            const connection = connByProvider.get(entry.slug)
            return (
              <DirectoryCard
                key={entry.id}
                entry={entry}
                connection={connection}
                connecting={connectingId === entry.slug}
                canConnect={canConnect(entry.tier, perms)}
                isAdmin={isAdmin}
                onConnect={handleConnect}
                onManage={setManaging}
                onEdit={openEdit}
                onDelete={setDeleting}
              />
            )
          })}
        </div>
      )}

      {isAdmin && (
        <DirectoryAdminDialog
          open={adminOpen}
          onOpenChange={setAdminOpen}
          entry={editEntry}
        />
      )}
      <ConnectionManageDialog
        name={managingName}
        connection={managing}
        onOpenChange={(o) => !o && setManaging(null)}
        disconnecting={disconnect.isPending}
        onDisconnect={(c) => disconnect.mutate(c.id, { onSuccess: () => setManaging(null) })}
        onReconnect={() => {
          const entry = directory.find((e) => e.slug === managing?.provider)
          setManaging(null)
          if (entry) void handleConnect(entry)
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t('directoryDelete')}
        description={t('directoryDeleteConfirm', { name: deleting?.name ?? '' })}
        confirmLabel={t('directoryDelete')}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
      <DirectoryKeyDialog
        entry={keyEntry}
        onOpenChange={(o) => !o && setKeyEntry(null)}
        onConnected={() => {
          invalidateConnections()
          setKeyEntry(null)
        }}
      />
    </section>
  )
}
