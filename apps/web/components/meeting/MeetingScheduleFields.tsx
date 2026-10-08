'use client'

import { useId } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { durationLabel } from '@/lib/meetings/display'
import {
  durationOptions,
  parseLocalDate,
  timeZoneLabel,
  toLocalDateString,
  type LocalSchedule,
} from '@/lib/meetings/schedule'
import { cn } from '@/lib/utils'

interface Props {
  scheduled: boolean
  schedule: LocalSchedule
  onScheduledChange: (scheduled: boolean) => void
  onScheduleChange: (schedule: LocalSchedule) => void
  /** "Start now" is impossible once a meeting has a schedule (the contract cannot clear it). */
  allowNow: boolean
  /** A LIVE meeting's schedule cannot change. */
  disabled?: boolean
  error?: string
  /** Taken when the dialog opened — never `new Date()` during render. */
  now: Date
}

function WhenToggle({ scheduled, onChange, allowNow, disabled }: {
  scheduled: boolean
  onChange: (scheduled: boolean) => void
  allowNow: boolean
  disabled?: boolean
}) {
  const t = useTranslations('meeting')
  const options = allowNow ? [false, true] : [true]
  return (
    <div role="radiogroup" aria-label={t('fieldWhen')} className="inline-flex rounded-lg bg-muted p-1">
      {options.map((value) => (
        <button
          key={String(value)}
          type="button"
          role="radio"
          aria-checked={scheduled === value}
          disabled={disabled}
          onClick={() => onChange(value)}
          className={cn(
            'rounded-md px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
            scheduled === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
          )}
        >
          {value ? t('whenLater') : t('whenNow')}
        </button>
      ))}
    </div>
  )
}

function DateField({ date, onChange, now, disabled }: {
  date: string
  onChange: (date: string) => void
  now: Date
  disabled?: boolean
}) {
  const t = useTranslations('meeting')
  const locale = useLocale()
  const selected = parseLocalDate(date)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return (
    <div className="space-y-1.5">
      <Label>{t('fieldDate')}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" disabled={disabled} className="w-full justify-start font-normal">
            <CalendarIcon className="size-4 text-muted-foreground" />
            {selected ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(selected) : t('fieldDate')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(d) => d && onChange(toLocalDateString(d))}
            disabled={{ before: today }}
            defaultMonth={selected ?? today}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

function DurationField({ minutes, onChange, disabled }: {
  minutes: number
  onChange: (minutes: number) => void
  disabled?: boolean
}) {
  const t = useTranslations('meeting')
  return (
    <div className="space-y-1.5">
      <Label>{t('fieldDuration')}</Label>
      <Select value={String(minutes)} onValueChange={(v) => onChange(Number(v))} disabled={disabled}>
        <SelectTrigger className="w-full" aria-label={t('fieldDuration')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {durationOptions(minutes).map((m) => (
            <SelectItem key={m} value={String(m)}>
              {durationLabel(t, m)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function MeetingScheduleFields(props: Props) {
  const { scheduled, schedule, onScheduleChange, disabled, error, now } = props
  const t = useTranslations('meeting')
  const locale = useLocale()
  const timeId = useId()
  const errorId = useId()

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-sm font-medium">{t('fieldWhen')}</p>
        <WhenToggle
          scheduled={scheduled}
          onChange={props.onScheduledChange}
          allowNow={props.allowNow}
          disabled={disabled}
        />
      </div>
      {scheduled ? (
        <div className="space-y-2">
          <div className="grid gap-3 sm:grid-cols-3">
            <DateField
              date={schedule.date}
              onChange={(date) => onScheduleChange({ ...schedule, date })}
              now={now}
              disabled={disabled}
            />
            <div className="space-y-1.5">
              <Label htmlFor={timeId}>{t('fieldTime')}</Label>
              <Input
                id={timeId}
                type="time"
                step={300}
                value={schedule.time}
                disabled={disabled}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                onChange={(e) => onScheduleChange({ ...schedule, time: e.target.value })}
                className="text-base md:text-sm"
              />
            </div>
            <DurationField
              minutes={schedule.durationMinutes}
              onChange={(durationMinutes) => onScheduleChange({ ...schedule, durationMinutes })}
              disabled={disabled}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t('timeZoneHint', { zone: timeZoneLabel(locale, now) })}
          </p>
          {error ? (
            <p id={errorId} role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
