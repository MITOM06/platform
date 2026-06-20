'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ADMIN_SECTIONS } from '@/components/admin/AdminShell'
import { useCapabilities } from '@/lib/hooks/use-capabilities'

/**
 * Admin index — bounces to the first section the caller can access. The shell
 * (in the layout) handles the no-access redirect, so here we only route to the
 * best landing section.
 */
export default function AdminIndexPage() {
  const router = useRouter()
  const { data, isLoading } = useCapabilities()

  useEffect(() => {
    if (isLoading || !data) return
    const first = ADMIN_SECTIONS.find((s) => data.perms.includes(s.cap))
    router.replace(first ? first.href : '/conversations')
  }, [data, isLoading, router])

  return null
}
