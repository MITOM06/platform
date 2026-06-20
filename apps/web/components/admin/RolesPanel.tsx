'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Copy, Save } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useRoles, useRoleActions } from '@/lib/hooks/use-admin'
import { CAPABILITIES } from '@/lib/api/admin-types'
import type { PermissionMatrix, Role } from '@/lib/api/admin-types'

const OWNER = 'Owner'

export function RolesPanel() {
  const t = useTranslations('admin')
  const { data: roles = [], isLoading } = useRoles()
  const { create, update } = useRoleActions()

  // Per-role pending permission matrices, seeded from the server roles.
  const [prevRoles, setPrevRoles] = useState(roles)
  const [edited, setEdited] = useState<Record<string, PermissionMatrix>>(() =>
    Object.fromEntries(roles.map((r) => [r._id, { ...r.permissions }])),
  )
  const [cloneFrom, setCloneFrom] = useState<Role | null>(null)
  const [cloneName, setCloneName] = useState('')

  // Reseed when server roles change (avoids synchronous setState-in-effect lint error).
  if (prevRoles !== roles) {
    setPrevRoles(roles)
    setEdited(Object.fromEntries(roles.map((r) => [r._id, { ...r.permissions }])))
  }

  const toggle = (roleId: string, cap: string) =>
    setEdited((prev) => ({
      ...prev,
      [roleId]: { ...prev[roleId], [cap]: !prev[roleId]?.[cap as keyof PermissionMatrix] },
    }))

  const isDirty = (r: Role) =>
    JSON.stringify(edited[r._id] ?? {}) !== JSON.stringify(r.permissions ?? {})

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

  if (isLoading) return <Skeleton className="h-80 rounded-xl" />

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('roleHint')}</p>

      <div className="overflow-x-auto">
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
                      onClick={() => {
                        setCloneFrom(r)
                        setCloneName(`${r.name} copy`)
                      }}
                    >
                      <Copy className="size-3.5" />
                    </Button>
                    {r.name !== OWNER && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-pon-cyan disabled:opacity-40"
                        title={t('save')}
                        disabled={!isDirty(r) || update.isPending}
                        onClick={() => saveRole(r)}
                      >
                        <Save className="size-3.5" />
                      </Button>
                    )}
                  </div>
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
                {roles.map((r) => {
                  const readOnly = r.name === OWNER
                  return (
                    <td key={r._id} className="p-2 text-center">
                      <Checkbox
                        checked={
                          readOnly
                            ? true
                            : !!edited[r._id]?.[cap as keyof PermissionMatrix]
                        }
                        disabled={readOnly}
                        onCheckedChange={() => toggle(r._id, cap)}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!cloneFrom} onOpenChange={(o) => !o && setCloneFrom(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('roleCloneTitle', { name: cloneFrom?.name ?? '' })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="clone-name">{t('roleName')}</Label>
            <Input
              id="clone-name"
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloneFrom(null)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={submitClone}
              disabled={!cloneName.trim() || create.isPending}
            >
              {t('roleClone')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
