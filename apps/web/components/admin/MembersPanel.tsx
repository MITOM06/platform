'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Pencil, Brain } from 'lucide-react'
import { EditMemberAiContextModal } from '@/components/admin/EditMemberAiContextModal'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useDepartments,
  useMembers,
  useRoles,
  useUpdateMember,
} from '@/lib/hooks/use-admin'
import { useHasCapability } from '@/lib/hooks/use-capabilities'
import type { Member } from '@/lib/api/admin-types'

const NO_ROLE = '__none__'

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

export function MembersPanel() {
  const t = useTranslations('admin')
  const { data: members = [], isLoading } = useMembers()
  const canRoles = useHasCapability('MANAGE_ROLES')
  const canDepts = useHasCapability('MANAGE_DEPARTMENTS')
  const canManageMembers = useHasCapability('MANAGE_MEMBERS')
  const { data: roles = [] } = useRoles(canRoles)
  const { data: departments = [] } = useDepartments(canDepts)
  const updateMember = useUpdateMember()

  const [editing, setEditing] = useState<Member | null>(null)
  const [open, setOpen] = useState(false)
  const [roleId, setRoleId] = useState<string>(NO_ROLE)
  const [deptIds, setDeptIds] = useState<string[]>([])
  const [aiCtxMember, setAiCtxMember] = useState<Member | null>(null)
  const [aiCtxOpen, setAiCtxOpen] = useState(false)

  const openAiContext = (m: Member) => {
    setAiCtxMember(m)
    setAiCtxOpen(true)
  }

  const openEdit = (m: Member) => {
    setEditing(m)
    setRoleId(m.roleId ?? NO_ROLE)
    setDeptIds(m.departmentIds ?? [])
    setOpen(true)
  }

  const toggleDept = (id: string) =>
    setDeptIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )

  const onSubmit = () => {
    if (!editing) return
    updateMember.mutate(
      {
        id: editing._id,
        input: {
          roleId: roleId === NO_ROLE ? undefined : roleId,
          departmentIds: deptIds,
        },
      },
      { onSuccess: () => setOpen(false) },
    )
  }

  const roleName = (id?: string) => roles.find((r) => r._id === id)?.name

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground pb-2">{t('memberHint')}</p>
      {members.map((m) => (
        <div
          key={m._id}
          className="flex items-center gap-3 rounded-lg border px-4 py-3"
        >
          <Avatar className="size-9">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {initials(m.displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{m.displayName}</p>
            <p className="text-sm text-muted-foreground truncate">{m.email}</p>
          </div>
          {roleName(m.roleId) && (
            <Badge variant="secondary">{roleName(m.roleId)}</Badge>
          )}
          {canManageMembers && (
            <Button
              variant="ghost"
              size="icon"
              className="tap"
              title={t('editAiContext')}
              onClick={() => openAiContext(m)}
            >
              <Brain className="size-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="tap" onClick={() => openEdit(m)}>
            <Pencil className="size-4" />
          </Button>
        </div>
      ))}

      <EditMemberAiContextModal
        member={aiCtxMember}
        open={aiCtxOpen}
        onOpenChange={setAiCtxOpen}
      />

      <ResponsiveModal
        open={open}
        onOpenChange={setOpen}
        title={t('memberEdit')}
        description={editing ? `${editing.displayName} · ${t('memberRevokeNote')}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={onSubmit} disabled={updateMember.isPending}>
              {t('save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          {canRoles && (
            <div className="space-y-1.5">
              <Label>{t('memberRole')}</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('memberRoleNone')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ROLE}>{t('memberRoleNone')}</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r._id} value={r._id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {canDepts && (
            <div className="space-y-1.5">
              <Label>{t('memberDepartments')}</Label>
              {departments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('deptEmpty')}
                </p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {departments.map((d) => (
                    <label
                      key={d._id}
                      className="flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={deptIds.includes(d._id)}
                        onCheckedChange={() => toggleDept(d._id)}
                      />
                      <span className="text-sm">{d.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </ResponsiveModal>
    </div>
  )
}
