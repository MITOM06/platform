'use client'

import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, Search, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { authService } from '@/lib/api/auth'
import type { MeetingPerson, UserSearchResult } from '@/lib/api/types'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { useAuthStore } from '@/lib/store/auth.store'
import { personName } from '@/lib/meetings/display'
import { PersonAvatar } from './PersonAvatar'

interface Props {
  invitees: MeetingPerson[]
  onChange: (invitees: MeetingPerson[]) => void
  error?: string
}

const userIdOf = (u: UserSearchResult) => u._id ?? u.id ?? ''

/** Search people (auth-service) and collect them as chips. Names only — never ids. */
export function InviteePicker({ invitees, onChange, error }: Props) {
  const t = useTranslations('meeting')
  const myId = useAuthStore((s) => s.user?.id)
  const inputId = useId()
  const errorId = useId()
  const [query, setQuery] = useState('')
  const q = useDebounce(query.trim(), 400)

  const search = useQuery({
    queryKey: ['meeting-invitee-search', q],
    queryFn: () => authService.searchUsers(q),
    enabled: q.length > 0,
    staleTime: 30_000,
  })

  const chosen = new Set(invitees.map((p) => p.userId))
  const results = (q ? (search.data?.results ?? []) : []).filter((u) => {
    const id = userIdOf(u)
    return id && id !== myId && !chosen.has(id)
  })

  const add = (u: UserSearchResult) => {
    onChange([...invitees, { userId: userIdOf(u), displayName: u.displayName, avatarUrl: u.avatarUrl ?? undefined }])
    setQuery('')
  }
  const remove = (userId: string) => onChange(invitees.filter((p) => p.userId !== userId))

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="text-sm font-medium">
        {t('fieldInvitees')}
      </label>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id={inputId}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('inviteeSearchPlaceholder')}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="pl-8 text-base md:text-sm"
        />
        {search.isFetching ? (
          <Loader2 className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
      </div>
      <SearchResults
        show={q.length > 0 && !search.isFetching}
        failed={search.isError}
        results={results}
        onPick={add}
      />
      <p className="text-xs text-muted-foreground">
        {invitees.length ? t('inviteeCount', { count: invitees.length }) : t('inviteeNone')}
      </p>
      {invitees.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {invitees.map((p) => (
            <InviteeChip key={p.userId} person={p} onRemove={() => remove(p.userId)} />
          ))}
        </ul>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function InviteeChip({ person, onRemove }: { person: MeetingPerson; onRemove: () => void }) {
  const t = useTranslations('meeting')
  const name = personName(person, t('participantFallback'))
  return (
    <li>
      <Badge variant="secondary" className="gap-1 py-1 pl-1 pr-1">
        <PersonAvatar name={name} avatarUrl={person.avatarUrl} className="size-5" />
        <span className="max-w-40 truncate">{name}</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('removeInvitee', { name })}
          className="rounded-full p-0.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3" />
        </button>
      </Badge>
    </li>
  )
}

function SearchResults({ show, failed, results, onPick }: {
  show: boolean
  failed: boolean
  results: UserSearchResult[]
  onPick: (u: UserSearchResult) => void
}) {
  const t = useTranslations('meeting')
  if (!show) return null
  if (failed) return <p className="text-xs text-muted-foreground">{t('searchFailed')}</p>
  if (results.length === 0) return <p className="text-xs text-muted-foreground">{t('searchNoResults')}</p>
  return (
    <ul role="listbox" aria-label={t('fieldInvitees')} className="max-h-48 overflow-y-auto rounded-lg border border-border/60">
      {results.map((u) => {
        const name = personName({ userId: userIdOf(u), displayName: u.displayName }, t('participantFallback'))
        return (
          <li key={userIdOf(u)} role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => onPick(u)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            >
              <PersonAvatar name={name} avatarUrl={u.avatarUrl} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{name}</span>
                <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
