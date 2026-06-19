'use client'

import { useEffect, useRef, useState } from 'react'
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
import { connectorService } from '@/lib/api/connector'
import { useAuthStore } from '@/lib/store/auth.store'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConnectorCard } from '@/components/integrations/ConnectorCard'
import { CustomMcpPanel } from '@/components/integrations/CustomMcpPanel'
import type { CatalogEntry, ConnectionView } from '@/lib/api/connector-types'

const POPUP_FEATURES = 'width=520,height=720,menubar=no,toolbar=no'

export default function IntegrationsPage() {
  const t = useTranslations('integrations')
  const router = useRouter()
  const searchParams = useSearchParams()
  const userId = useAuthStore((s) => s.user?.id)

  const { data: catalog = [], isLoading: loadingCatalog } = useCatalog()
  const { data: connections = [], isLoading: loadingConnections } = useConnections()
  const { disconnect, invalidateConnections } = useConnectorActions()

  const [connectingId, setConnectingId] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Backend redirects the OAuth popup to `?connected=<provider>`. If we land
  // back here with that param (popup blocked → same-tab fallback), refresh.
  useEffect(() => {
    const connected = searchParams.get('connected')
    if (connected) {
      invalidateConnections()
      toast.success(t('connectSuccess', { provider: connected }))
      router.replace('/integrations')
    }
    // run once on the connected param changing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const handleConnect = async (entry: CatalogEntry) => {
    if (!userId) return
    setConnectingId(entry.id)
    try {
      const { authorizeUrl } = await connectorService.startOAuth(entry.id, userId)
      const popup = window.open(authorizeUrl, 'pon-oauth', POPUP_FEATURES)
      if (!popup) {
        // Popup blocked — fall back to same-tab redirect.
        window.location.href = authorizeUrl
        return
      }
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(() => {
        try {
          // Same-origin once the backend redirects back to CLIENT_REDIRECT_URL.
          if (popup.closed) {
            clearInterval(pollRef.current!)
            setConnectingId(null)
            invalidateConnections()
            return
          }
          const search = popup.location.search
          if (search.includes('connected=')) {
            popup.close()
            clearInterval(pollRef.current!)
            setConnectingId(null)
            invalidateConnections()
            toast.success(t('connectSuccess', { provider: entry.name }))
          }
        } catch {
          // Cross-origin while on the provider's domain — ignore until redirect.
        }
      }, 600)
    } catch {
      toast.error(t('connectError'))
      setConnectingId(null)
    }
  }

  const handleDisconnect = (connection: ConnectionView) => {
    disconnect.mutate(connection.id)
  }

  const connectionByProvider = new Map(connections.map((c) => [c.provider, c]))
  const isLoading = loadingCatalog || loadingConnections

  return (
    <div className="flex-1 flex flex-col h-full bg-background/50 overflow-y-auto">
      <div className="border-b px-6 py-4 bg-background/80 backdrop-blur-md sticky top-0 z-10 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="md:hidden"
          aria-label={t('back')}
        >
          <Link href="/settings">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Plug className="text-pon-cyan size-6" /> {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" asChild className="ml-auto">
          <Link href="/skills">
            <Sparkles className="size-4 mr-1.5" /> {t('skillsLink')}
          </Link>
        </Button>
      </div>

      <div className="p-6 pb-24 md:pb-6 max-w-5xl w-full mx-auto space-y-8">
        <section>
          <div className="mb-4">
            <div className="font-mono text-pon-pink text-xs tracking-[2px]">
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
                  disconnecting={
                    disconnect.isPending &&
                    disconnect.variables ===
                      connectionByProvider.get(entry.id)?.id
                  }
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-1">
            <div className="font-mono text-pon-pink text-xs tracking-[2px]">
              {t('sectionCustomNum')}
            </div>
            <h2 className="text-xl font-bold tracking-tight mt-1">
              {t('sectionCustomTitle')}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t('sectionCustomDesc')}
            </p>
          </div>
          <CustomMcpPanel />
        </section>
      </div>
    </div>
  )
}
