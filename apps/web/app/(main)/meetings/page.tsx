'use client'

import { Suspense, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MeetingFormDialog, type MeetingFormRequest } from '@/components/meeting/MeetingFormDialog'
import { MeetingList } from '@/components/meeting/MeetingList'
import { MeetingsHeader } from '@/components/meeting/MeetingsHeader'
import type { MeetingListScope } from '@/lib/api/meeting-types'
import { useHasCapability } from '@/lib/hooks/use-capabilities'

/** /meetings — Upcoming / Past lists, "Start a meeting", "Schedule", join by code. */
export default function MeetingsPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 pb-24 md:px-6 md:pb-6">
        {/* useSearchParams needs a Suspense boundary for the static prerender. */}
        <Suspense fallback={null}>
          <MeetingsContent />
        </Suspense>
      </div>
    </div>
  )
}

function MeetingsContent() {
  const t = useTranslations('meeting')
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const canHost = useHasCapability('HOST_MEETING')
  const [dialog, setDialog] = useState<MeetingFormRequest | null>(null)
  // The tab lives in the URL (?tab=past) so back/forward and shared links keep it.
  const tab: MeetingListScope = params.get('tab') === 'past' ? 'past' : 'upcoming'

  const selectTab = (value: string) => {
    const next = new URLSearchParams(params.toString())
    if (value === 'past') next.set('tab', 'past')
    else next.delete('tab')
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <>
      <MeetingsHeader onSchedule={() => setDialog({ mode: 'create', now: new Date() })} />
      <Tabs value={tab} onValueChange={selectTab}>
        <TabsList>
          <TabsTrigger value="upcoming">{t('tabUpcoming')}</TabsTrigger>
          <TabsTrigger value="past">{t('tabPast')}</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="mt-4">
          <MeetingList scope="upcoming" canHost={canHost} />
        </TabsContent>
        <TabsContent value="past" className="mt-4">
          <MeetingList scope="past" canHost={canHost} />
        </TabsContent>
      </Tabs>
      <MeetingFormDialog request={dialog} onClose={() => setDialog(null)} />
    </>
  )
}
