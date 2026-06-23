'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Save, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { useWorkspace, useUpdateWorkspace } from '@/lib/hooks/use-admin'
import { useCatalog } from '@/lib/hooks/use-connectors'
import {
  AI_MODEL_TIERS,
  AI_TONES,
  type AiModelTier,
  type AiTone,
  type WorkspaceAiSettings as AiSettings,
} from '@/lib/api/admin-types'

const SELECT_CLASS =
  'h-9 rounded-md border bg-background px-2 text-sm w-full max-w-xs'

/** Three-state switch value rendered as a labelled <select> (inherit/on/off). */
type TriState = 'inherit' | 'on' | 'off'

function boolToTri(v: boolean | null): TriState {
  if (v === null || v === undefined) return 'inherit'
  return v ? 'on' : 'off'
}
function triToBool(v: TriState): boolean | null {
  if (v === 'inherit') return null
  return v === 'on'
}

/**
 * Workspace-level AI assistant defaults: persona name/tone, model tier,
 * web-search & extended-thinking toggles, monthly token limit, and the AI
 * connector allow-list. Every field is nullable — empty/"inherit" = fall back
 * to the ai-service env default. Mirrors the Flutter `WorkspaceAiSettingsPanel`
 * and rides on the existing `PATCH /admin/workspace` contract.
 */
export function WorkspaceAiSettings() {
  const t = useTranslations('admin')
  const { data: ws, isLoading } = useWorkspace()
  const { data: catalog = [] } = useCatalog()
  const save = useUpdateWorkspace()

  const [prevWs, setPrevWs] = useState(ws)
  const [personaName, setPersonaName] = useState('')
  const [tone, setTone] = useState<AiTone | ''>('')
  const [tier, setTier] = useState<AiModelTier | ''>('')
  const [webSearch, setWebSearch] = useState<TriState>('inherit')
  const [thinking, setThinking] = useState<TriState>('inherit')
  const [dailyDigest, setDailyDigest] = useState<TriState>('inherit')
  // '' = inherit env default; otherwise '0'..'23'.
  const [digestHour, setDigestHour] = useState('')
  const [tokenLimit, setTokenLimit] = useState('')
  // null = inherit connectorAllowList; otherwise an explicit (possibly empty) list.
  const [restrictConnectors, setRestrictConnectors] = useState(false)
  const [allowed, setAllowed] = useState<string[]>([])

  // Reseed local state when the server workspace doc loads / changes.
  if (prevWs !== ws && ws) {
    setPrevWs(ws)
    const ai = ws.aiSettings
    setPersonaName(ai?.personaName ?? '')
    setTone(ai?.defaultTone ?? '')
    setTier(ai?.modelTier ?? '')
    setWebSearch(boolToTri(ai?.webSearchEnabled ?? null))
    setThinking(boolToTri(ai?.thinkingEnabled ?? null))
    setDailyDigest(boolToTri(ai?.dailyDigestEnabled ?? null))
    setDigestHour(
      ai?.dailyDigestHour === null || ai?.dailyDigestHour === undefined
        ? ''
        : String(ai.dailyDigestHour),
    )
    setTokenLimit(
      ai?.monthlyTokenLimit === null || ai?.monthlyTokenLimit === undefined
        ? ''
        : String(ai.monthlyTokenLimit),
    )
    const list = ai?.allowedConnectors ?? null
    setRestrictConnectors(list !== null)
    setAllowed(list ?? [])
  }

  // The AI allow-list can only narrow the workspace connector allow-list.
  const allowList = ws?.connectorAllowList ?? []
  const selectableConnectors = catalog.filter((c) => allowList.includes(c.id))

  const toggleConnector = (id: string) =>
    setAllowed((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )

  const parseLimit = (): number | null => {
    const raw = tokenLimit.trim()
    if (raw === '') return null
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null
  }

  // '' (inherit) → null; otherwise the clamped 0..23 hour.
  const parseDigestHour = (): number | null => {
    if (digestHour === '') return null
    const n = Number(digestHour)
    if (!Number.isFinite(n)) return null
    return Math.min(23, Math.max(0, Math.floor(n)))
  }

  const onSave = () => {
    const aiSettings: AiSettings = {
      personaName: personaName.trim() || null,
      defaultTone: tone || null,
      modelTier: tier || null,
      webSearchEnabled: triToBool(webSearch),
      thinkingEnabled: triToBool(thinking),
      dailyDigestEnabled: triToBool(dailyDigest),
      dailyDigestHour: parseDigestHour(),
      monthlyTokenLimit: parseLimit(),
      // Restrict OFF ⇒ null (inherit). Restrict ON ⇒ explicit list (may be []).
      allowedConnectors: restrictConnectors
        ? allowed.filter((id) => allowList.includes(id))
        : null,
    }
    save.mutate({ aiSettings })
  }

  if (isLoading) return <Skeleton className="h-96 rounded-xl" />

  return (
    <div className="space-y-8">
      {/* Persona defaults */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="size-5 text-pon-cyan" /> {t('aiPersonaTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('aiInheritHint')}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ai-persona">{t('aiPersonaName')}</Label>
            <Input
              id="ai-persona"
              value={personaName}
              onChange={(e) => setPersonaName(e.target.value)}
              placeholder={t('aiPersonaNamePlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-tone">{t('aiTone')}</Label>
            <select
              id="ai-tone"
              className={SELECT_CLASS}
              value={tone}
              onChange={(e) => setTone(e.target.value as AiTone | '')}
            >
              <option value="">{t('aiDefaultOption')}</option>
              {AI_TONES.map((x) => (
                <option key={x} value={x}>
                  {t(`aiTone_${x}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Model & capabilities */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t('aiModelTitle')}</h2>

        <div className="space-y-1.5">
          <Label htmlFor="ai-tier">{t('aiModelTier')}</Label>
          <select
            id="ai-tier"
            className={SELECT_CLASS}
            value={tier}
            onChange={(e) => setTier(e.target.value as AiModelTier | '')}
          >
            <option value="">{t('aiDefaultOption')}</option>
            {AI_MODEL_TIERS.map((x) => (
              <option key={x} value={x}>
                {t(`aiTier_${x}`)}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{t('aiModelTierHint')}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ai-websearch">{t('aiWebSearch')}</Label>
          <select
            id="ai-websearch"
            className={SELECT_CLASS}
            value={webSearch}
            onChange={(e) => setWebSearch(e.target.value as TriState)}
          >
            <option value="inherit">{t('aiDefaultOption')}</option>
            <option value="on">{t('aiEnabled')}</option>
            <option value="off">{t('aiDisabled')}</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ai-thinking">{t('aiThinking')}</Label>
          <select
            id="ai-thinking"
            className={SELECT_CLASS}
            value={thinking}
            onChange={(e) => setThinking(e.target.value as TriState)}
          >
            <option value="inherit">{t('aiDefaultOption')}</option>
            <option value="on">{t('aiEnabled')}</option>
            <option value="off">{t('aiDisabled')}</option>
          </select>
          <p className="text-xs text-muted-foreground">{t('aiThinkingHint')}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ai-daily-digest">{t('aiDailyDigest')}</Label>
          <select
            id="ai-daily-digest"
            className={SELECT_CLASS}
            value={dailyDigest}
            onChange={(e) => setDailyDigest(e.target.value as TriState)}
          >
            <option value="inherit">{t('aiDefaultOption')}</option>
            <option value="on">{t('aiEnabled')}</option>
            <option value="off">{t('aiDisabled')}</option>
          </select>
          <p className="text-xs text-muted-foreground">{t('aiDailyDigestHint')}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ai-digest-hour">{t('aiDailyDigestHour')}</Label>
          <select
            id="ai-digest-hour"
            className={SELECT_CLASS}
            value={digestHour}
            disabled={dailyDigest === 'off'}
            onChange={(e) => setDigestHour(e.target.value)}
          >
            <option value="">{t('aiDefaultOption')}</option>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={String(h)}>
                {String(h).padStart(2, '0')}:00
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            {t('aiDailyDigestHourHint')}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ai-token-limit">{t('aiTokenLimit')}</Label>
          <Input
            id="ai-token-limit"
            type="number"
            min={0}
            value={tokenLimit}
            onChange={(e) => setTokenLimit(e.target.value)}
            placeholder={t('aiTokenLimitPlaceholder')}
            className="max-w-xs"
          />
          <p className="text-xs text-muted-foreground">{t('aiTokenLimitHint')}</p>
        </div>
      </section>

      {/* AI connector allow-list */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('aiConnectorsTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('aiConnectorsHint')}</p>

        <div className="flex items-center justify-between rounded-lg border px-4 py-2.5">
          <div>
            <span className="text-sm font-medium">{t('aiRestrictConnectors')}</span>
            <p className="text-xs text-muted-foreground">
              {t('aiRestrictConnectorsHint')}
            </p>
          </div>
          <Switch
            checked={restrictConnectors}
            onCheckedChange={setRestrictConnectors}
          />
        </div>

        {restrictConnectors &&
          (selectableConnectors.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('aiNoConnectors')}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {selectableConnectors.map((entry) => (
                <label
                  key={entry.id}
                  className="flex items-center gap-3 rounded-lg border px-4 py-2.5 cursor-pointer hover:bg-muted/50"
                >
                  <Checkbox
                    checked={allowed.includes(entry.id)}
                    onCheckedChange={() => toggleConnector(entry.id)}
                  />
                  <span className="text-sm font-medium">{entry.name}</span>
                </label>
              ))}
            </div>
          ))}
      </section>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={save.isPending}>
          <Save className="size-4 mr-1.5" />
          {save.isPending ? t('saving') : t('save')}
        </Button>
      </div>
    </div>
  )
}
