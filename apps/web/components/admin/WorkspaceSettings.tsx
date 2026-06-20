'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Building2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { useWorkspace, useUpdateWorkspace } from '@/lib/hooks/use-admin'
import { useCatalog } from '@/lib/hooks/use-connectors'

/** Workspace settings: name, branding, feature flags, connector allow-list. */
export function WorkspaceSettings() {
  const t = useTranslations('admin')
  const { data: ws, isLoading } = useWorkspace()
  const { data: catalog = [] } = useCatalog()
  const save = useUpdateWorkspace()

  const [name, setName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#00e5ff')
  const [features, setFeatures] = useState<Record<string, boolean>>({})
  const [allowList, setAllowList] = useState<string[]>([])

  useEffect(() => {
    if (!ws) return
    setName(ws.name ?? '')
    setLogoUrl(ws.logoUrl ?? '')
    setPrimaryColor(ws.primaryColor ?? '#00e5ff')
    setFeatures(ws.features ?? {})
    setAllowList(ws.connectorAllowList ?? [])
  }, [ws])

  const toggleAllow = (id: string) =>
    setAllowList((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )

  const onSave = () =>
    save.mutate({
      name: name.trim(),
      logoUrl: logoUrl.trim() || undefined,
      primaryColor,
      features,
      connectorAllowList: allowList,
    })

  if (isLoading) {
    return <Skeleton className="h-96 rounded-xl" />
  }

  const featureKeys = Object.keys(features)

  return (
    <div className="space-y-8">
      {/* Identity & branding */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="size-5 text-pon-cyan" /> {t('wsIdentity')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ws-name">{t('wsName')}</Label>
            <Input
              id="ws-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('wsNamePlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-logo">{t('wsLogoUrl')}</Label>
            <Input
              id="ws-logo"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-color">{t('wsPrimaryColor')}</Label>
            <div className="flex items-center gap-2">
              <input
                id="ws-color"
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-9 w-12 rounded border bg-transparent cursor-pointer"
              />
              <Input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Feature flags */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('wsFeatures')}</h2>
        {featureKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('wsNoFeatures')}</p>
        ) : (
          <div className="space-y-2">
            {featureKeys.map((key) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg border px-4 py-2.5"
              >
                <span className="text-sm font-medium">{key}</span>
                <Switch
                  checked={features[key]}
                  onCheckedChange={(v) =>
                    setFeatures((prev) => ({ ...prev, [key]: v }))
                  }
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Connector allow-list */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('wsAllowList')}</h2>
        <p className="text-sm text-muted-foreground">{t('wsAllowListDesc')}</p>
        {catalog.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('wsNoCatalog')}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {catalog.map((entry) => (
              <label
                key={entry.id}
                className="flex items-center gap-3 rounded-lg border px-4 py-2.5 cursor-pointer hover:bg-muted/50"
              >
                <Checkbox
                  checked={allowList.includes(entry.id)}
                  onCheckedChange={() => toggleAllow(entry.id)}
                />
                <span className="text-sm font-medium">{entry.name}</span>
              </label>
            ))}
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={save.isPending || !name.trim()}>
          <Save className="size-4 mr-1.5" />
          {save.isPending ? t('saving') : t('save')}
        </Button>
      </div>
    </div>
  )
}
