'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { useMemberAiContext, useUpdateMemberHard } from '@/lib/hooks/use-ai-context'
import type { Member } from '@/lib/api/admin-types'

export function EditMemberAiContextModal({
  member,
  open,
  onOpenChange,
}: {
  member: Member | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations('admin')
  const { data } = useMemberAiContext(member?._id ?? '', open && !!member)
  const update = useUpdateMemberHard()
  const [jobTitle, setJobTitle] = useState('')
  const [projectsText, setProjectsText] = useState('')

  useEffect(() => {
    if (data) {
      setJobTitle(data.jobTitle ?? '')
      setProjectsText((data.projects ?? []).join('\n'))
    }
  }, [data])

  const onSubmit = () => {
    if (!member) return
    const projects = projectsText
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
    update.mutate(
      { userId: member._id, body: { jobTitle, projects } },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={t('editAiContext')}
      description={member ? member.displayName : undefined}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={onSubmit} disabled={update.isPending}>
            {t('save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4 py-2">
        <div className="space-y-1.5">
          <Label htmlFor="ai-jobtitle">{t('aiContextJobTitle')}</Label>
          <Input
            id="ai-jobtitle"
            value={jobTitle}
            maxLength={200}
            onChange={(e) => setJobTitle(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ai-projects">{t('aiContextProjects')}</Label>
          <Textarea
            id="ai-projects"
            value={projectsText}
            onChange={(e) => setProjectsText(e.target.value)}
            placeholder={t('aiContextProjectsHint')}
          />
        </div>
      </div>
    </ResponsiveModal>
  )
}
