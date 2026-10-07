'use client'

import { useId, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { meetingPath, parseMeetingCodeInput } from '@/lib/meetings/meeting-code'
import { cn } from '@/lib/utils'

/** "Meeting code or link" + Join. Accepts any case, spaces, missing dashes or a whole link. */
export function JoinByCodeForm({ className }: { className?: string }) {
  const t = useTranslations('meeting')
  const router = useRouter()
  const errorId = useId()
  const [value, setValue] = useState('')
  const [invalid, setInvalid] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const code = parseMeetingCodeInput(value)
    if (!code) {
      setInvalid(true)
      return
    }
    router.push(meetingPath(code))
  }

  return (
    <form onSubmit={submit} noValidate className={cn('flex flex-col gap-1', className)}>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setInvalid(false)
          }}
          aria-label={t('joinByCodeLabel')}
          placeholder={t('joinByCodePlaceholder')}
          inputMode="text"
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          className="text-base md:text-sm"
        />
        <Button type="submit" variant="outline" disabled={!value.trim()}>
          {t('joinByCode')}
        </Button>
      </div>
      {invalid ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {t('codeInvalid')}
        </p>
      ) : null}
    </form>
  )
}
