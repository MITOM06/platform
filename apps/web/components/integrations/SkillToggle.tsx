'use client'

import { useTranslations } from 'next-intl'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { SkillDef } from '@/lib/skills'
import type { CatalogEntry } from '@/lib/api/connector-types'
import { StatusPill } from '@/components/integrations/ConnectorCard'

interface SkillToggleProps {
  skill: SkillDef
  enabled: boolean
  pending?: boolean
  /** Catalog entries the skill requires, resolved to display names. */
  requiredConnectors: CatalogEntry[]
  /** Required connectors not connected yet (`[]` = ready); `null` while connections load. */
  missingConnectors: CatalogEntry[] | null
  onToggle: (skillId: string, enabled: boolean) => void
}

export function SkillToggle({
  skill,
  enabled,
  pending,
  requiredConnectors,
  missingConnectors,
  onToggle,
}: SkillToggleProps) {
  const t = useTranslations('skills')

  const needLabel = requiredConnectors.map((c) => c.name).join(' · ')
  const missingLabel = (missingConnectors ?? []).map((c) => c.name).join(' · ')

  return (
    <div className="flex items-start gap-3.5 rounded-xl border bg-card p-4">
      <div className="size-10 grid place-items-center rounded-[11px] bg-background border text-[22px] shrink-0">
        <span aria-hidden>{skill.icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="m-0 text-[15px] font-semibold">
          {t(`${skill.id}Name`)}
        </h4>
        <p className="mt-1 mb-0 text-muted-foreground text-[13px]">
          {t(`${skill.id}Desc`)}
        </p>
        {needLabel && (
          <p className="mt-2 mb-0 font-mono text-[10.5px] text-muted-foreground/70">
            {t('needs', { connectors: needLabel })}
          </p>
        )}
        {needLabel && missingConnectors && (
          <div className="mt-2">
            {missingConnectors.length === 0 ? (
              <StatusPill variant="on" label={t('ready')} />
            ) : (
              <StatusPill variant="off" label={t('missing', { connectors: missingLabel })} />
            )}
          </div>
        )}
      </div>
      <Switch
        checked={enabled}
        disabled={pending}
        onCheckedChange={(v) => onToggle(skill.id, v)}
        className={cn(
          'mt-1 data-[state=checked]:bg-primary',
        )}
        aria-label={t(`${skill.id}Name`)}
      />
    </div>
  )
}
