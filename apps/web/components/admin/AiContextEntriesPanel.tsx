'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDepartments } from '@/lib/hooks/use-admin'
import { useHasCapability } from '@/lib/hooks/use-capabilities'
import {
  useContextEntries,
  useCreateEntry,
  useDeleteEntry,
  useUpdateEntry,
} from '@/lib/hooks/use-ai-context'
import {
  capabilityToTier,
  tierToCapability,
  type AiContextEntry,
  type ContextTier,
} from '@/lib/api/ai-context'

type Scope = 'company' | 'department'
const TIERS: ContextTier[] = ['public', 'internal', 'confidential']

export function AiContextEntriesPanel() {
  const t = useTranslations('admin')
  const canDepts = useHasCapability('MANAGE_DEPARTMENTS')
  const { data: departments = [] } = useDepartments(canDepts)

  const [scope, setScope] = useState<Scope>('company')
  const [deptId, setDeptId] = useState<string>('')
  const scopeId = scope === 'department' ? deptId || undefined : undefined
  const { data: entries = [], isLoading } = useContextEntries(scope, scopeId)

  const createEntry = useCreateEntry()
  const updateEntry = useUpdateEntry()
  const deleteEntry = useDeleteEntry()

  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [text, setText] = useState('')
  const [tier, setTier] = useState<ContextTier>('public')

  const openCreate = () => {
    setEditingId(null)
    setLabel('')
    setText('')
    setTier('public')
    setOpen(true)
  }
  const openEdit = (e: AiContextEntry) => {
    setEditingId(e._id)
    setLabel(e.label)
    setText(e.text)
    setTier(capabilityToTier(e.requiredCapability))
    setOpen(true)
  }

  const onSubmit = () => {
    if (scope === 'department' && !deptId) return
    const dto = {
      scope,
      scopeId: scope === 'department' ? deptId : null,
      label,
      text,
      requiredCapability: tierToCapability(tier),
    }
    const done = { onSuccess: () => setOpen(false) }
    if (editingId) updateEntry.mutate({ id: editingId, dto }, done)
    else createEntry.mutate(dto, done)
  }

  const tierLabel = (tr: ContextTier) =>
    tr === 'confidential' ? t('tierConfidential') : tr === 'internal' ? t('tierInternal') : t('tierPublic')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="company">{t('scopeCompany')}</SelectItem>
            <SelectItem value="department">{t('scopeDepartment')}</SelectItem>
          </SelectContent>
        </Select>
        {scope === 'department' && (
          <Select value={deptId} onValueChange={setDeptId}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder={t('memberDepartments')} />
            </SelectTrigger>
            <SelectContent>
              {departments.map((d) => (
                <SelectItem key={d._id} value={d._id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button className="ml-auto" onClick={openCreate} disabled={scope === 'department' && !deptId}>
          <Plus className="mr-2 size-4" />
          {t('createEntry')}
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t('aiContextEntriesEmpty')}</p>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e._id} className="flex items-start gap-3 rounded-lg border px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{e.label}</span>
                  <Badge variant="secondary">{tierLabel(capabilityToTier(e.requiredCapability))}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{e.text}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => openEdit(e)}>
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteEntry.mutate(e._id)}
                aria-label={t('deleteEntry')}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <ResponsiveModal
        open={open}
        onOpenChange={setOpen}
        title={editingId ? t('editEntry') : t('createEntry')}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={onSubmit}
              disabled={!label || !text || createEntry.isPending || updateEntry.isPending}
            >
              {t('save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="entry-label">{t('entryLabel')}</Label>
            <Input id="entry-label" value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entry-text">{t('entryText')}</Label>
            <Textarea id="entry-text" value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('entryTier')}</Label>
            <Select value={tier} onValueChange={(v) => setTier(v as ContextTier)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIERS.map((tr) => (
                  <SelectItem key={tr} value={tr}>
                    {tierLabel(tr)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </ResponsiveModal>
    </div>
  )
}
