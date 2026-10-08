'use client'

import { useTranslations } from 'next-intl'
import { CalendarDays, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { MeetingListScope } from '@/lib/api/meeting-types'
import { useMeetingList } from '@/lib/hooks/use-meetings'
import { MeetingRow } from './MeetingRow'

export function MeetingList({ scope, canHost }: { scope: MeetingListScope; canHost: boolean }) {
  const t = useTranslations('meeting')
  const tCommon = useTranslations('common')
  const query = useMeetingList(scope)

  if (query.isPending) {
    return (
      <div className="space-y-2" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[72px] w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm text-muted-foreground">{t('listError')}</p>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
          {tCommon('retry')}
        </Button>
      </div>
    )
  }

  const rows = query.data.pages.flatMap((p) => p.content)
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <CalendarDays className="size-10 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">
          {scope === 'upcoming' ? t('emptyUpcoming') : t('emptyPast')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <ul role="list" className="space-y-1">
        {rows.map((m) => (
          <MeetingRow key={m.id} meeting={m} canHost={canHost} />
        ))}
      </ul>
      {query.hasNextPage ? (
        <Button
          variant="outline"
          className="w-full"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? <Loader2 className="size-4 animate-spin" /> : null}
          {t('loadMore')}
        </Button>
      ) : null}
    </div>
  )
}
