'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateInvitation } from '@/lib/hooks/use-admin'
import { useCapabilities } from '@/lib/hooks/use-capabilities'
import type { Department, InvitationLocale, Role } from '@/lib/api/admin-types'

const OWNER_ROLE = 'Owner'
const MEMBER_ROLE = 'Member'
const LOCALES: readonly InvitationLocale[] = ['en', 'vi', 'zh', 'ja', 'ko', 'es', 'fr']

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Caller holds MANAGE_ROLES — role list is loaded and selectable. */
  canRoles: boolean
  /** Caller holds MANAGE_DEPARTMENTS — department list is loaded and selectable. */
  canDepts: boolean
  roles: Role[]
  departments: Department[]
}

/**
 * Invite a new member by email. Role/department pickers appear only when the
 * caller may read those lists; otherwise the server defaults to the Member role.
 * The Owner role is offered only to Owners (server enforces it as well).
 * Remount (via `key`) per open to reset the form.
 */
export function InviteMemberDialog({ open, onOpenChange, canRoles, canDepts, roles, departments }: Props) {
  const t = useTranslations('admin')
  const tAuth = useTranslations('auth')
  const locale = useLocale()
  const callerRole = useCapabilities().data?.role
  const create = useCreateInvitation()

  const selectableRoles = useMemo(
    () => roles.filter((r) => r.name !== OWNER_ROLE || callerRole === OWNER_ROLE),
    [roles, callerRole],
  )
  const defaultRoleId = selectableRoles.find((r) => r.name === MEMBER_ROLE)?._id ?? ''

  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [pickedRoleId, setPickedRoleId] = useState<string | null>(null)
  const [deptIds, setDeptIds] = useState<string[]>([])
  const roleId = pickedRoleId ?? defaultRoleId

  const toggleDept = (id: string) =>
    setDeptIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const onSubmit = () => {
    const parsed = z.string().trim().email().safeParse(email)
    if (!parsed.success) {
      setEmailError(tAuth('emailInvalid'))
      return
    }
    setEmailError(null)
    create.mutate(
      {
        email: parsed.data.toLowerCase(),
        roleId: canRoles && roleId ? roleId : undefined,
        departmentIds: canDepts ? deptIds : undefined,
        locale: (LOCALES as readonly string[]).includes(locale) ? (locale as InvitationLocale) : undefined,
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={t('inviteTitle')}
      description={t('inviteDesc')}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={onSubmit} disabled={create.isPending}>
            {t('inviteSubmit')}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4 py-2"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="invite-email">{t('inviteEmail')}</Label>
          <Input
            id="invite-email"
            type="email"
            autoComplete="off"
            placeholder={t('inviteEmailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!emailError}
          />
          {emailError && <p className="text-sm text-destructive">{emailError}</p>}
        </div>

        {canRoles && selectableRoles.length > 0 && (
          <div className="space-y-1.5">
            <Label>{t('inviteRole')}</Label>
            <Select value={roleId} onValueChange={setPickedRoleId}>
              <SelectTrigger aria-label={t('inviteRole')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {selectableRoles.map((r) => (
                  <SelectItem key={r._id} value={r._id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {canDepts && departments.length > 0 && (
          <div className="space-y-1.5">
            <Label>{t('inviteDepartments')}</Label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {departments.map((d) => (
                <label
                  key={d._id}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer hover:bg-muted/50"
                >
                  <Checkbox checked={deptIds.includes(d._id)} onCheckedChange={() => toggleDept(d._id)} />
                  <span className="text-sm">{d.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </form>
    </ResponsiveModal>
  )
}
