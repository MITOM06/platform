'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Pencil, Plus, Trash2, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useDepartments,
  useDepartmentActions,
  useMembers,
} from '@/lib/hooks/use-admin'
import { useHasCapability } from '@/lib/hooks/use-capabilities'
import type { Department } from '@/lib/api/admin-types'

const NO_LEAD = '__none__'

export function DepartmentsPanel() {
  const t = useTranslations('admin')
  const { data: departments = [], isLoading } = useDepartments()
  const { create, update, remove } = useDepartmentActions()
  const canMembers = useHasCapability('MANAGE_MEMBERS')
  const { data: members = [] } = useMembers(canMembers)

  const [editing, setEditing] = useState<Department | null>(null)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [leadUserId, setLeadUserId] = useState<string>(NO_LEAD)

  const openCreate = () => {
    setEditing(null)
    setName('')
    setDescription('')
    setLeadUserId(NO_LEAD)
    setOpen(true)
  }

  const openEdit = (d: Department) => {
    setEditing(d)
    setName(d.name)
    setDescription(d.description ?? '')
    setLeadUserId(d.leadUserId ?? NO_LEAD)
    setOpen(true)
  }

  const onSubmit = () => {
    const input = {
      name: name.trim(),
      description: description.trim() || undefined,
      leadUserId: leadUserId === NO_LEAD ? undefined : leadUserId,
    }
    const done = () => setOpen(false)
    if (editing) {
      update.mutate({ id: editing._id, input }, { onSuccess: done })
    } else {
      create.mutate(input, { onSuccess: done })
    }
  }

  const leadName = (id?: string) =>
    members.find((m) => m._id === id)?.displayName

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="size-4 mr-1.5" /> {t('deptNew')}
        </Button>
      </div>

      {departments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {t('deptEmpty')}
        </p>
      ) : (
        <div className="space-y-2">
          {departments.map((d) => (
            <div
              key={d._id}
              className="flex items-center gap-3 rounded-lg border px-4 py-3"
            >
              <UsersRound className="size-5 text-pon-cyan shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{d.name}</p>
                {d.description && (
                  <p className="text-sm text-muted-foreground truncate">
                    {d.description}
                  </p>
                )}
                {d.leadUserId && leadName(d.leadUserId) && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('deptLead')}: {leadName(d.leadUserId)}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => openEdit(d)}>
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                disabled={remove.isPending}
                onClick={() => {
                  if (confirm(t('deptDeleteConfirm', { name: d.name }))) {
                    remove.mutate(d._id)
                  }
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t('deptEdit') : t('deptNew')}</DialogTitle>
            <DialogDescription>{t('deptDialogDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="dept-name">{t('deptName')}</Label>
              <Input
                id="dept-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dept-desc">{t('deptDescription')}</Label>
              <Textarea
                id="dept-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            {canMembers && (
              <div className="space-y-1.5">
                <Label>{t('deptLead')}</Label>
                <Select value={leadUserId} onValueChange={setLeadUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('deptLeadNone')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_LEAD}>{t('deptLeadNone')}</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m._id} value={m._id}>
                        {m.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={onSubmit}
              disabled={!name.trim() || create.isPending || update.isPending}
            >
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
