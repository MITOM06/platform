'use client'

import { useTranslations } from 'next-intl'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { DepartmentOption } from '@/lib/api/meeting-types'

// Radix Select cannot hold '' as a value.
const NONE = '__none__'

interface Props {
  /** '' = none */
  value: string
  onChange: (departmentId: string) => void
  departments: DepartmentOption[]
}

/** "Department" select — inviting a whole department (gap B1: the caller's own departments). */
export function MeetingDepartmentField({ value, onChange, departments }: Props) {
  const t = useTranslations('meeting')
  return (
    <div className="space-y-1.5">
      <Label>{t('fieldDepartment')}</Label>
      <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? '' : v)}>
        <SelectTrigger className="w-full" aria-label={t('fieldDepartment')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{t('departmentNone')}</SelectItem>
          {departments.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{t('departmentHint')}</p>
    </div>
  )
}
