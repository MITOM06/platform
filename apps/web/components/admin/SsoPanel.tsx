'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { KeyRound, Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useWorkspace,
  useUpdateWorkspace,
  useRoles,
  useDepartments,
} from '@/lib/hooks/use-admin'

type Row = { group: string; value: string }

function toRows(map: Record<string, string> | undefined): Row[] {
  return Object.entries(map ?? {}).map(([group, value]) => ({ group, value }))
}

function toMap(rows: Row[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const r of rows) {
    const g = r.group.trim()
    if (g && r.value) out[g] = r.value
  }
  return out
}

/**
 * SSO (OIDC) admin config: enable toggle, allowed email domains, default role,
 * and IdP-group → role / department mappings. Provider creds stay in .env.
 */
export function SsoPanel() {
  const t = useTranslations('admin')
  const { data: ws, isLoading } = useWorkspace()
  const { data: roles = [] } = useRoles()
  const { data: departments = [] } = useDepartments()
  const save = useUpdateWorkspace()

  const [prevWs, setPrevWs] = useState(ws)
  const [enabled, setEnabled] = useState(ws?.sso?.enabled ?? false)
  const [domains, setDomains] = useState((ws?.sso?.allowedDomains ?? []).join(', '))
  const [defaultRole, setDefaultRole] = useState(ws?.sso?.defaultRole ?? '')
  const [roleRows, setRoleRows] = useState<Row[]>(toRows(ws?.sso?.groupRoleMap))
  const [deptRows, setDeptRows] = useState<Row[]>(toRows(ws?.sso?.groupDeptMap))

  if (prevWs !== ws && ws) {
    setPrevWs(ws)
    setEnabled(ws.sso?.enabled ?? false)
    setDomains((ws.sso?.allowedDomains ?? []).join(', '))
    setDefaultRole(ws.sso?.defaultRole ?? '')
    setRoleRows(toRows(ws.sso?.groupRoleMap))
    setDeptRows(toRows(ws.sso?.groupDeptMap))
  }

  const onSave = () =>
    save.mutate({
      sso: {
        enabled,
        allowedDomains: domains
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean),
        groupRoleMap: toMap(roleRows),
        groupDeptMap: toMap(deptRows),
        defaultRole: defaultRole || undefined,
      },
    })

  if (isLoading) return <Skeleton className="h-96 rounded-xl" />

  const setRow = (
    rows: Row[],
    setter: (r: Row[]) => void,
    i: number,
    patch: Partial<Row>,
  ) => setter(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const selectClass =
    'h-9 rounded-md border bg-background px-2 text-sm min-w-[10rem]'

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <KeyRound className="size-5 text-pon-cyan" /> {t('ssoTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('ssoHint')}</p>

        <div className="flex items-center justify-between rounded-lg border px-4 py-2.5">
          <span className="text-sm font-medium">{t('ssoEnabled')}</span>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sso-domains">{t('ssoAllowedDomains')}</Label>
          <Input
            id="sso-domains"
            value={domains}
            onChange={(e) => setDomains(e.target.value)}
            placeholder="acme.com, sub.acme.com"
          />
          <p className="text-xs text-muted-foreground">{t('ssoAllowedDomainsHint')}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sso-default-role">{t('ssoDefaultRole')}</Label>
          <select
            id="sso-default-role"
            className={selectClass}
            value={defaultRole}
            onChange={(e) => setDefaultRole(e.target.value)}
          >
            <option value="">{t('ssoNone')}</option>
            {roles.map((r) => (
              <option key={r._id} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Group → role mapping */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('ssoGroupRoleMap')}</h2>
        {roleRows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={row.group}
              onChange={(e) => setRow(roleRows, setRoleRows, i, { group: e.target.value })}
              placeholder={t('ssoGroupPlaceholder')}
            />
            <span className="text-muted-foreground">→</span>
            <select
              className={selectClass}
              value={row.value}
              onChange={(e) => setRow(roleRows, setRoleRows, i, { value: e.target.value })}
            >
              <option value="">{t('ssoNone')}</option>
              {roles.map((r) => (
                <option key={r._id} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRoleRows(roleRows.filter((_, idx) => idx !== i))}
              aria-label={t('ssoRemoveRow')}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRoleRows([...roleRows, { group: '', value: '' }])}
        >
          <Plus className="size-4 mr-1.5" />
          {t('ssoAddMapping')}
        </Button>
      </section>

      {/* Group → department mapping */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('ssoGroupDeptMap')}</h2>
        {deptRows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={row.group}
              onChange={(e) => setRow(deptRows, setDeptRows, i, { group: e.target.value })}
              placeholder={t('ssoGroupPlaceholder')}
            />
            <span className="text-muted-foreground">→</span>
            <select
              className={selectClass}
              value={row.value}
              onChange={(e) => setRow(deptRows, setDeptRows, i, { value: e.target.value })}
            >
              <option value="">{t('ssoNone')}</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeptRows(deptRows.filter((_, idx) => idx !== i))}
              aria-label={t('ssoRemoveRow')}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDeptRows([...deptRows, { group: '', value: '' }])}
        >
          <Plus className="size-4 mr-1.5" />
          {t('ssoAddMapping')}
        </Button>
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
