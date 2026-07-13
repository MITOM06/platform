'use client'

import { useTranslations } from 'next-intl'
import { Building2, Users } from 'lucide-react'
import { capabilityToTier, type AiContextEntry, type ContextTier } from '@/lib/api/ai-context'
import { Badge } from '@/components/ui/badge'

function TierBadge({ tier }: { tier: ContextTier }) {
  const t = useTranslations('aiContext')
  const label =
    tier === 'confidential' ? t('tierConfidential') : tier === 'internal' ? t('tierInternal') : t('tierPublic')
  const variant = tier === 'confidential' ? 'destructive' : tier === 'internal' ? 'default' : 'secondary'
  return <Badge variant={variant as never}>{label}</Badge>
}

function EntryList({ entries }: { entries: AiContextEntry[] }) {
  return (
    <div className="space-y-2">
      {entries.map((e) => (
        <div key={e._id} className="rounded-lg border bg-background/50 p-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{e.label}</span>
            <TierBadge tier={capabilityToTier(e.requiredCapability)} />
          </div>
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{e.text}</p>
        </div>
      ))}
    </div>
  )
}

export function CompanyContextSection({ entries }: { entries: AiContextEntry[] }) {
  const t = useTranslations('aiContext')
  const company = entries.filter((e) => e.scope === 'company')
  const department = entries.filter((e) => e.scope === 'department')
  if (company.length === 0 && department.length === 0) return null
  return (
    <div className="space-y-4">
      {company.length > 0 && (
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Building2 className="size-4 text-muted-foreground" />
            {t('companyContextTitle')}
          </h2>
          <EntryList entries={company} />
        </section>
      )}
      {department.length > 0 && (
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Users className="size-4 text-muted-foreground" />
            {t('departmentContextTitle')}
          </h2>
          <EntryList entries={department} />
        </section>
      )}
    </div>
  )
}
