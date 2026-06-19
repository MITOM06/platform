'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, Check } from 'lucide-react'
import { connectorService } from '@/lib/api/connector'
import { useConnectorActions } from '@/lib/hooks/use-connectors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import type {
  ConnectorAuthType,
  McpToolPreview,
} from '@/lib/api/connector-types'

export function CustomMcpPanel() {
  const t = useTranslations('integrations')
  const { saveCustomMcp } = useConnectorActions()

  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [authType, setAuthType] = useState<ConnectorAuthType>('none')
  const [credential, setCredential] = useState('')
  const [tools, setTools] = useState<McpToolPreview[] | null>(null)

  const discover = useMutation({
    mutationFn: () =>
      connectorService.discoverCustomMcp({
        url,
        authType,
        credential: authType === 'none' ? undefined : credential || undefined,
      }),
    onSuccess: (res) => {
      setTools(res.tools)
      if (res.tools.length === 0) toast.info(t('customNoTools'))
    },
    onError: () => toast.error(t('customDiscoverError')),
  })

  const reset = () => {
    setName('')
    setUrl('')
    setAuthType('none')
    setCredential('')
    setTools(null)
  }

  const handleSave = () => {
    saveCustomMcp.mutate(
      {
        name: name.trim() || url,
        url,
        authType,
        credential: authType === 'none' ? undefined : credential || undefined,
      },
      { onSuccess: reset },
    )
  }

  return (
    <div className="mt-4 rounded-xl border border-dashed border-pon-pink/60 bg-card p-[22px]">
      <div className="flex flex-col gap-1.5 md:flex-row md:items-start md:gap-6 md:flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <h3 className="m-0 mb-1.5 text-base font-semibold">{t('customTitle')}</h3>
          <p className="m-0 text-muted-foreground text-[13.5px] max-w-[46ch]">
            {t('customSubtitle')}
          </p>
        </div>

        <div className="flex-1 min-w-[280px] space-y-3">
          <div className="space-y-1.5">
            <Label className="font-mono text-[10.5px] tracking-wide uppercase text-muted-foreground">
              {t('customNameLabel')}
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('customNamePlaceholder')}
              className="font-mono text-[13px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="font-mono text-[10.5px] tracking-wide uppercase text-muted-foreground">
              {t('customUrlLabel')}
            </Label>
            <Input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setTools(null)
              }}
              placeholder="https://mcp.your-tool.com/sse"
              className="font-mono text-[13px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="font-mono text-[10.5px] tracking-wide uppercase text-muted-foreground">
              {t('customAuthLabel')}
            </Label>
            <Select
              value={authType}
              onValueChange={(v) => setAuthType(v as ConnectorAuthType)}
            >
              <SelectTrigger className="font-mono text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('authNone')}</SelectItem>
                <SelectItem value="apikey">{t('authApiKey')}</SelectItem>
                <SelectItem value="oauth2">{t('authOauth')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {authType === 'apikey' && (
            <div className="space-y-1.5">
              <Label className="font-mono text-[10.5px] tracking-wide uppercase text-muted-foreground">
                {t('customCredentialLabel')}
              </Label>
              <Input
                type="password"
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                placeholder={t('customCredentialPlaceholder')}
                className="font-mono text-[13px]"
              />
            </div>
          )}

          {tools && tools.length > 0 && (
            <div className="rounded-lg border bg-background/60 p-3">
              <p className="font-mono text-[10.5px] uppercase tracking-wide text-pon-cyan mb-2">
                {t('customToolsFound', { count: tools.length })}
              </p>
              <ul className="space-y-1">
                {tools.map((tool) => (
                  <li
                    key={tool.name}
                    className="flex items-start gap-2 text-[12.5px]"
                  >
                    <Check className="size-3.5 mt-0.5 text-pon-green shrink-0" />
                    <span className="font-mono">{tool.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2.5 pt-1">
            {tools === null ? (
              <Button
                className="bg-gradient-to-r from-pon-cyan to-pon-blue text-black hover:opacity-90"
                disabled={!url.trim() || discover.isPending}
                onClick={() => discover.mutate()}
              >
                {discover.isPending && (
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                )}
                {t('customDiscover')}
              </Button>
            ) : (
              <Button
                className="bg-gradient-to-r from-pon-cyan to-pon-blue text-black hover:opacity-90"
                disabled={saveCustomMcp.isPending}
                onClick={handleSave}
              >
                {saveCustomMcp.isPending && (
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                )}
                {t('customSave')}
              </Button>
            )}
            <Button variant="outline" onClick={reset}>
              {t('customCancel')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
