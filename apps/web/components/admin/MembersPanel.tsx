'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { UserPlus } from 'lucide-react'
import { EditMemberAiContextModal } from '@/components/admin/EditMemberAiContextModal'
import { InviteMemberDialog } from '@/components/admin/InviteMemberDialog'
import { MemberRow } from '@/components/admin/MemberRow'
import { PendingInvitationsList } from '@/components/admin/PendingInvitationsList'
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
  useSetMemberStatus,
  useUpdateMember,
} from '@/lib/hooks/use-admin'
import { useCapabilities, useHasCapability } from '@/lib/hooks/use-capabilities'
import { OWNER_ROLE_NAME, assignableRoles, memberRoleLock } from '@/lib/admin/role-guard'
import { isEmptyMemberUpdate, memberUpdateDiff } from '@/lib/admin/member-diff'
import { useAuthStore } from '@/lib/store/auth.store'
import type { Member } from '@/lib/api/admin-types'

const NO_ROLE = '__none__'

export function MembersPanel() {
  const t = useTranslations('admin')
  const { data: members = [], isLoading, isError } = useMembers()
  const canRoles = useHasCapability('MANAGE_ROLES')
  const canDepts = useHasCapability('MANAGE_DEPARTMENTS')
  const canManageMembers = useHasCapability('MANAGE_MEMBERS')
  const { data: roles = [] } = useRoles(canRoles)
  const { data: departments = [] } = useDepartments(canDepts)
  const updateMember = useUpdateMember()
  const setMemberStatus = useSetMemberStatus()
  const selfId = useAuthStore((s) => s.user?.id)
  const callerIsOwner = useCapabilities().data?.role === OWNER_ROLE_NAME

  const [editing, setEditing] = useState<Member | null>(null)
  const [open, setOpen] = useState(false)
  const [roleId, setRoleId] = useState<string>(NO_ROLE)
  const [deptIds, setDeptIds] = useState<string[]>([])
  const [aiCtxMember, setAiCtxMember] = useState<Member | null>(null)
  const [aiCtxOpen, setAiCtxOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  // Bumped per open so the invite dialog remounts with a fresh form.
  const [inviteKey, setInviteKey] = useState(0)
  const [statusTarget, setStatusTarget] = useState<Member | null>(null)

  const openInvite = () => {
    setInviteKey((k) => k + 1)
    setInviteOpen(true)
  }

  const targetBlocked = statusTarget?.status === 'blocked'
  const confirmStatus = () => {
    if (!statusTarget) return
    setMemberStatus.mutate(
      { id: statusTarget._id, status: targetBlocked ? 'active' : 'blocked' },
      { onSettled: () => setStatusTarget(null) },
    )
  }

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

  const roleName = (id?: string) => roles.find((r) => r._id === id)?.name

  // Own row and (for non-Owners) an Owner's row: role is read-only, departments
  // stay editable. Owner option is offered to Owners only.
  const roleLock = editing
    ? memberRoleLock({
        isSelf: editing._id === selfId,
        targetIsOwner: roleName(editing.roleId) === OWNER_ROLE_NAME,
        callerIsOwner,
      })
    : null
  // A locked picker still lists every role so the current one (maybe Owner) renders.
  const roleOptions = roleLock ? roles : assignableRoles(roles, callerIsOwner)

  const onSubmit = () => {
    if (!editing) return
    // Only what really changed (and what this admin may set); a locked row never
    // sends a role. Nothing changed ⇒ no request at all.
    const input = memberUpdateDiff(
      editing,
      { roleId: roleId === NO_ROLE ? null : roleId, departmentIds: deptIds },
      { canRoles, canDepts, roleLocked: !!roleLock },
    )
    if (isEmptyMemberUpdate(input)) {
      setOpen(false)
      return
    }
    updateMember.mutate({ id: editing._id, input }, { onSuccess: () => setOpen(false) })
  }

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />
  if (isError) {
    return <p className="py-8 text-center text-sm text-destructive">{t('loadError')}</p>
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
        <p className="text-sm text-muted-foreground">{t('memberHint')}</p>
        {canManageMembers && (
          <Button size="sm" className="gap-1.5" onClick={openInvite}>
            <UserPlus className="size-4" />
            {t('inviteMember')}
          </Button>
        )}
      </div>
      {canManageMembers && <PendingInvitationsList />}
      {members.map((m) => (
        <MemberRow
          key={m._id}
          member={m}
          roleName={roleName(m.roleId)}
          isSelf={m._id === selfId}
          canManageMembers={canManageMembers}
          onEdit={openEdit}
          onAiContext={openAiContext}
          onToggleBlock={setStatusTarget}
        />
      ))}

      {canManageMembers && (
        <InviteMemberDialog
          key={inviteKey}
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          canRoles={canRoles}
          canDepts={canDepts}
          roles={roles}
          departments={departments}
        />
      )}

      <ResponsiveModal
        open={!!statusTarget}
        onOpenChange={(o) => !o && setStatusTarget(null)}
        title={t(targetBlocked ? 'memberUnblock' : 'memberBlock')}
        description={
          statusTarget
            ? t(targetBlocked ? 'memberUnblockConfirm' : 'memberBlockConfirm', {
                name: statusTarget.displayName,
              })
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setStatusTarget(null)}>
              {t('cancel')}
            </Button>
            <Button
              variant={targetBlocked ? 'default' : 'destructive'}
              onClick={confirmStatus}
              disabled={setMemberStatus.isPending}
            >
              {t(targetBlocked ? 'memberUnblock' : 'memberBlock')}
            </Button>
          </>
        }
      />

      <EditMemberAiContextModal
        member={aiCtxMember}
        open={aiCtxOpen}
        onOpenChange={setAiCtxOpen}
      />

      <ResponsiveModal
        open={open}
        onOpenChange={setOpen}
        title={t('memberEdit')}
        description={editing ? `${editing.displayName} · ${t('memberClaimsNote')}` : undefined}
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
              <Select value={roleId} onValueChange={setRoleId} disabled={!!roleLock}>
                <SelectTrigger data-testid="member-role-select">
                  <SelectValue placeholder={t('memberRoleNone')} />
                </SelectTrigger>
                <SelectContent>
                  {/* A member can't be set back to "no role" (they fall back to
                      Member); the item only renders a member who has none yet. */}
                  <SelectItem value={NO_ROLE} disabled>
                    {t('memberRoleNone')}
                  </SelectItem>
                  {roleOptions.map((r) => (
                    <SelectItem key={r._id} value={r._id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {roleLock && (
                <p className="text-xs text-muted-foreground" data-testid="member-role-locked">
                  {t(roleLock === 'self' ? 'memberRoleLockedSelf' : 'memberRoleLockedOwner')}
                </p>
              )}
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
