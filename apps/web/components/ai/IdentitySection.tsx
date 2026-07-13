'use client'

import { useTranslations } from 'next-intl'
import { UserCog } from 'lucide-react'
import type { AiUserContext } from '@/lib/api/ai-context'
import { Badge } from '@/components/ui/badge'

export function IdentitySection({
  identity,
  context,
}: {
  identity: { role: string | null; departmentNames: string[] }
  context: AiUserContext
}) {
  const t = useTranslations('aiContext')
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-right">{value}</span>
    </div>
  )
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <UserCog className="size-4 text-muted-foreground" />
        {t('identityTitle')}
      </h2>
      {row(t('labelRole'), identity.role ?? t('roleUnknown'))}
      {row(
        t('labelDepartment'),
        identity.departmentNames.length ? identity.departmentNames.join(', ') : t('noDepartment'),
      )}
      {row(t('labelJobTitle'), context.jobTitle || t('notSet'))}
      {row(
        t('labelProjects'),
        context.projects.length ? (
          <span className="flex flex-wrap justify-end gap-1">
            {context.projects.map((p) => (
              <Badge key={p} variant="secondary">
                {p}
              </Badge>
            ))}
          </span>
        ) : (
          t('notSet')
        ),
      )}
      <p className="mt-3 text-[11px] text-muted-foreground/60">{t('identityManagedBySuperior')}</p>
    </section>
  )
}
