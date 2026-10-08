'use client'

import { useId } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface Props {
  title: string
  description: string
  onTitle: (title: string) => void
  onDescription: (description: string) => void
  titleError?: string
  descriptionError?: string
  limits: { title: number; description: number }
}

/** Title + description, with a counter once they get close to the limit. */
export function MeetingTextFields(props: Props) {
  const { title, description, limits } = props
  const t = useTranslations('meeting')
  const titleId = useId()
  const descId = useId()
  // No hard maxLength: the validation message explains the limit instead of eating keystrokes.
  const titleCount = title.trim().length
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={titleId}>{t('fieldTitle')}</Label>
        <Input
          id={titleId}
          value={title}
          onChange={(e) => props.onTitle(e.target.value)}
          placeholder={t('fieldTitlePlaceholder')}
          aria-invalid={props.titleError ? true : undefined}
          aria-describedby={props.titleError ? `${titleId}-err` : undefined}
          className="text-base md:text-sm"
        />
        <FieldFooter
          id={`${titleId}-err`}
          error={props.titleError}
          counter={titleCount > limits.title - 20 ? t('charCounter', { count: titleCount, max: limits.title }) : null}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={descId}>{t('fieldDescription')}</Label>
        <Textarea
          id={descId}
          rows={3}
          value={description}
          onChange={(e) => props.onDescription(e.target.value)}
          placeholder={t('fieldDescriptionPlaceholder')}
          aria-invalid={props.descriptionError ? true : undefined}
          aria-describedby={props.descriptionError ? `${descId}-err` : undefined}
          className="text-base md:text-sm"
        />
        <FieldFooter
          id={`${descId}-err`}
          error={props.descriptionError}
          counter={
            description.length > limits.description - 200
              ? t('charCounter', { count: description.length, max: limits.description })
              : null
          }
        />
      </div>
    </div>
  )
}

function FieldFooter({ id, error, counter }: { id: string; error?: string; counter: string | null }) {
  if (!error && !counter) return null
  return (
    <div className="flex justify-between gap-2 text-xs">
      <span id={id} role={error ? 'alert' : undefined} className="text-destructive">
        {error}
      </span>
      {counter ? <span className="tabular-nums text-muted-foreground">{counter}</span> : null}
    </div>
  )
}
