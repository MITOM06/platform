'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Copy, Pencil, Save } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { useRoles, useRoleActions } from '@/lib/hooks/use-admin'
import { useCapabilities } from '@/lib/hooks/use-capabilities'
import { CAPABILITIES } from '@/lib/api/admin-types'
import type { Capability, PermissionMatrix, Role } from '@/lib/api/admin-types'
import { OWNER_ROLE_NAME, grantBlockers, roleEditLock } from '@/lib/admin/role-guard'
import { capabilityList } from '@/lib/admin/admin-errors'
import { RolesPanelMobile } from './RolesPanelMobile'

/**
 * Stable fallback while roles load or when the query failed: a fresh `[]` per
 * render made the "reseed on new roles" check below fire on every render — an
 * infinite render loop as soon as `/admin/roles` errored.
 */
const NO_ROLES: Role[] = []

export function RolesPanel() {
  const t = useTranslations('admin')
  const locale = useLocale()
  const { data, isLoading, isError } = useRoles()
  const roles = data ?? NO_ROLES
  const { create, update } = useRoleActions()
  const caps = useCapabilities().data
  const caller = {
    roleName: caps?.role,
    isOwner: caps?.role === OWNER_ROLE_NAME,
    perms: caps?.perms,
  }

  // Per-role pending permission matrices, seeded from the server roles.
  const [prevRoles, setPrevRoles] = useState(roles)
  const [edited, setEdited] = useState<Record<string, PermissionMatrix>>(() =>
    Object.fromEntries(roles.map((r) => [r._id, { ...r.permissions }])),
  )
  const [cloneFrom, setCloneFrom] = useState<Role | null>(null)
  const [cloneName, setCloneName] = useState('')
  const [renaming, setRenaming] = useState<Role | null>(null)
  const [newName, setNewName] = useState('')

  // Reseed when server roles change (avoids synchronous setState-in-effect lint error).
  if (prevRoles !== roles) {
    setPrevRoles(roles)
    setEdited(Object.fromEntries(roles.map((r) => [r._id, { ...r.permissions }])))
  }

  const toggle = (roleId: string, cap: Capability) =>
    setEdited((prev) => ({
      ...prev,
      [roleId]: { ...prev[roleId], [cap]: !prev[roleId]?.[cap] },
    }))

  const isDirty = (r: Role) =>
    JSON.stringify(edited[r._id] ?? {}) !== JSON.stringify(r.permissions ?? {})

  /** Capabilities that would make the server answer ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS. */
  const blockersFor = (r: Role) => grantBlockers(caller, r.permissions, edited[r._id])
  const isLocked = (r: Role) => roleEditLock(r, caller) !== null
  /** A non-Owner can't switch ON a capability they don't hold themselves. */
  const canToggle = (r: Role, cap: Capability) =>
    !isLocked(r) && (caller.isOwner || !!edited[r._id]?.[cap] || !!caller.perms?.includes(cap))

  const saveRole = (r: Role) =>
    update.mutate({ id: r._id, input: { permissions: edited[r._id] } })

  const submitClone = () => {
    if (!cloneFrom || !cloneName.trim()) return
    create.mutate(
      { name: cloneName.trim(), permissions: { ...cloneFrom.permissions } },
      {
        onSuccess: () => {
          setCloneFrom(null)
          setCloneName('')
        },
      },
    )
  }

  const submitRename = () => {
    if (!renaming || !newName.trim() || newName.trim() === renaming.name) return
    update.mutate(
      { id: renaming._id, input: { name: newName.trim() } },
      { onSuccess: () => setRenaming(null) },
    )
  }

  if (isLoading) return <Skeleton className="h-80 rounded-xl" />
  if (isError) {
    return <p className="py-8 text-center text-sm text-destructive">{t('loadError')}</p>
  }

  const cloneBlockers = cloneFrom ? grantBlockers(caller, cloneFrom.permissions) : []
  const lockHint = (r: Role) => {
    const lock = roleEditLock(r, caller)
    if (lock === 'own-role') return t('roleLockedOwn')
    const blockers = lock ? [] : blockersFor(r)
    return blockers.length > 0
      ? t('roleGrantBlocked', { capabilities: capabilityList(blockers, t, locale) })
      : null
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('roleHint')}</p>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 bg-background text-left font-medium p-2 min-w-44">
                {t('roleCapability')}
              </th>
              {roles.map((r) => (
                <th key={r._id} className="p-2 text-center min-w-32 align-top">
                  <div className="font-semibold">{r.name}</div>
                  {r.isPreset && (
                    <Badge variant="secondary" className="mt-1 text-[10px]">
                      {t('rolePreset')}
                    </Badge>
                  )}
                  <div className="mt-1 flex justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      title={t('roleClone')}
                      aria-label={t('roleClone')}
                      onClick={() => {
                        setCloneFrom(r)
                        setCloneName(t('roleCloneDefaultName', { name: r.name }))
                      }}
                    >
                      <Copy className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 disabled:opacity-40"
                      title={r.isPreset ? t('roleRenamePreset') : t('roleRename')}
                      aria-label={t('roleRename')}
                      disabled={r.isPreset || isLocked(r)}
                      onClick={() => {
                        setRenaming(r)
                        setNewName(r.name)
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    {!isLocked(r) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-primary disabled:opacity-40"
                        title={t('save')}
                        aria-label={t('save')}
                        disabled={!isDirty(r) || update.isPending || blockersFor(r).length > 0}
                        onClick={() => saveRole(r)}
                      >
                        <Save className="size-3.5" />
                      </Button>
                    )}
                  </div>
                  {lockHint(r) && (
                    <p className="mt-1 text-[11px] font-normal text-muted-foreground max-w-40 mx-auto">
                      {lockHint(r)}
                    </p>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CAPABILITIES.map((cap) => (
              <tr key={cap} className="border-t">
                <td className="sticky left-0 bg-background p-2 align-top">
                  <div className="font-medium">{t(`caps.${cap}`)}</div>
                </td>
                {roles.map((r) => (
                  <td key={r._id} className="p-2 text-center">
                    <Checkbox
                      checked={r.name === OWNER_ROLE_NAME ? true : !!edited[r._id]?.[cap]}
                      disabled={!canToggle(r, cap)}
                      onCheckedChange={() => toggle(r._id, cap)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <RolesPanelMobile
        roles={roles}
        capabilities={CAPABILITIES}
        edited={edited}
        toggle={toggle}
        isDirty={isDirty}
        saveRole={saveRole}
        capLabel={(cap) => t(`caps.${cap}`)}
        isPending={update.isPending}
        canToggle={canToggle}
        isLocked={isLocked}
        lockHint={lockHint}
        canSave={(r) => blockersFor(r).length === 0}
      />

      <ResponsiveModal
        open={!!cloneFrom}
        onOpenChange={(o) => !o && setCloneFrom(null)}
        title={t('roleCloneTitle', { name: cloneFrom?.name ?? '' })}
        description={t('roleCloneDesc')}
        footer={
          <>
            <Button variant="outline" onClick={() => setCloneFrom(null)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={submitClone}
              disabled={!cloneName.trim() || create.isPending || cloneBlockers.length > 0}
            >
              {t('roleClone')}
            </Button>
          </>
        }
      >
        <div className="space-y-1.5 py-2">
          <Label htmlFor="clone-name">{t('roleName')}</Label>
          <Input id="clone-name" value={cloneName} onChange={(e) => setCloneName(e.target.value)} />
          {cloneBlockers.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t('roleGrantBlocked', { capabilities: capabilityList(cloneBlockers, t, locale) })}
            </p>
          )}
        </div>
      </ResponsiveModal>

      <ResponsiveModal
        open={!!renaming}
        onOpenChange={(o) => !o && setRenaming(null)}
        title={t('roleRenameTitle', { name: renaming?.name ?? '' })}
        footer={
          <>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={submitRename}
              disabled={!newName.trim() || newName.trim() === renaming?.name || update.isPending}
            >
              {t('save')}
            </Button>
          </>
        }
      >
        <div className="space-y-1.5 py-2">
          <Label htmlFor="rename-role">{t('roleName')}</Label>
          <Input id="rename-role" value={newName} onChange={(e) => setNewName(e.target.value)} />
        </div>
      </ResponsiveModal>
    </div>
  )
}
