'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plug, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  useCatalog,
  useConnections,
  useConnectorActions,
} from '@/lib/hooks/use-connectors'
import { useOAuthPopup, useOAuthReturnNotice } from '@/lib/hooks/use-oauth-popup'
import { useCapabilities } from '@/lib/hooks/use-capabilities'
import { connectorService } from '@/lib/api/connector'
import { connectorErrorKey, parseOAuthReturn } from '@/lib/integrations/connector-errors'
import { canConnect } from '@/lib/integrations/gating'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConnectorCard } from '@/components/integrations/ConnectorCard'
import { CustomMcpPanel } from '@/components/integrations/CustomMcpPanel'
import { CustomMcpList } from '@/components/integrations/CustomMcpList'
import { ConnectionManageDialog } from '@/components/integrations/ConnectionManageDialog'
import { DirectorySection } from '@/components/integrations/DirectorySection'
import type { CatalogEntry, ConnectionView } from '@/lib/api/connector-types'

export default function IntegrationsPage() {
  const t = useTranslations('integrations')
  const router = useRouter()
  const searchParams = useSearchParams()
  const perms = useCapabilities().data?.perms
  const canAddCustomMcp = !!perms?.includes('ADD_CUSTOM_MCP')

  const { data: catalog = [], isLoading: loadingCatalog } = useCatalog()
  const { data: connections = [], isLoading: loadingConnections } = useConnections()
  const { disconnect, invalidateConnections } = useConnectorActions()
  const notifyOAuth = useOAuthReturnNotice()
  const { connectingId, open, reset } = useOAuthPopup((result) => {
    invalidateConnections()
    if (result) notifyOAuth(result)
  })
  const [managing, setManaging] = useState<ConnectionView | null>(null)

  // The OAuth callback redirects to `?connected=<slug>` or `?error=<CODE>&provider=`.
  // The popup flow reads it from the popup; landing here with it means the popup
  // was blocked (same-tab fallback) — report it once and clean the URL.
  useEffect(() => {
    const result = parseOAuthReturn(searchParams)
    if (!result) return
    invalidateConnections()
    notifyOAuth(result)
    router.replace('/integrations')
    // run once per return; the helpers are stable enough for that
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const handleConnect = async (entry: CatalogEntry) => {
    try {
      const { authorizeUrl } = await connectorService.startOAuth(entry.id)
      open(authorizeUrl, entry.id)
    } catch (err) {
      // INSUFFICIENT_PERMISSION / CONNECTOR_NOT_ALLOWED / CONNECTOR_UNAVAILABLE…
      toast.error(t(connectorErrorKey(err, 'connectError')))
      reset()
    }
  }

  const connectionByProvider = new Map(connections.map((c) => [c.provider, c]))
  const isLoading = loadingCatalog || loadingConnections

  return (
    <div className="flex-1 flex flex-col h-full bg-background/50 overflow-y-auto">
      <div className="border-b px-6 py-4 bg-background sticky top-0 z-10 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          asChild
          aria-label={t('back')}
        >
          <Link href="/settings">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Plug className="text-primary size-6" /> {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" asChild className="ml-auto">
          <Link href="/skills">
            <Sparkles className="size-4 mr-1.5" /> {t('skillsLink')}
          </Link>
        </Button>
      </div>

      <div className="p-6 pb-tabbar md:pb-6 max-w-5xl w-full mx-auto space-y-8">
        <DirectorySection />

        <section>
          <div className="mb-4">
            <div className="font-mono text-primary text-xs tracking-[2px]">
              {t('sectionConnectorsNum')}
            </div>
            <h2 className="text-xl font-bold tracking-tight mt-1">
              {t('sectionConnectorsTitle')}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t('sectionConnectorsDesc')}
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[158px] rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {catalog.map((entry) => (
                <ConnectorCard
                  key={entry.id}
                  entry={entry}
                  connection={connectionByProvider.get(entry.id)}
                  connecting={connectingId === entry.id}
                  canConnect={canConnect(entry.tier, perms)}
                  onConnect={handleConnect}
                  onManage={setManaging}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-1">
            <div className="font-mono text-primary text-xs tracking-[2px]">
              {t('sectionCustomNum')}
            </div>
            <h2 className="text-xl font-bold tracking-tight mt-1">
              {t('sectionCustomTitle')}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t('sectionCustomDesc')}
            </p>
          </div>
          <CustomMcpList />
          {canAddCustomMcp ? (
            <CustomMcpPanel />
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">{t('customNeedsCap')}</p>
          )}
        </section>

        <ConnectionManageDialog
          name={
            catalog.find((e) => e.id === managing?.provider)?.name ?? t('connectorFallbackName')
          }
          connection={managing}
          onOpenChange={(o) => !o && setManaging(null)}
          disconnecting={disconnect.isPending}
          onDisconnect={(c) => disconnect.mutate(c.id, { onSuccess: () => setManaging(null) })}
          onReconnect={() => {
            const entry = catalog.find((e) => e.id === managing?.provider)
            setManaging(null)
            if (entry) void handleConnect(entry)
          }}
        />
      </div>
    </div>
  )
}
