import type { MeetingPerson } from '@/lib/api/meeting-types'
import { safeDisplayName } from '@/lib/chat/names'
import type { Translate } from './meeting-errors'

/** A person's name for display — never their id (`fallback` is a localized generic label). */
export function personName(
  p: Pick<MeetingPerson, 'userId' | 'displayName'> | undefined,
  fallback: string,
): string {
  return safeDisplayName(p?.displayName, p?.userId) ?? fallback
}

/** "45 min" / "2 hours" / "1 h 30 min" (`t` = the `meeting` namespace). */
export function durationLabel(t: Translate, minutes: number): string {
  if (minutes < 60) return t('durationMinutes', { count: minutes })
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0
    ? t('durationHours', { count: hours })
    : t('durationHoursMinutes', { hours, minutes: rest })
}
