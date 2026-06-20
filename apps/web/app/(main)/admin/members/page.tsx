'use client'

import { RequireCap } from '@/components/admin/require-cap'
import { MembersPanel } from '@/components/admin/MembersPanel'

export default function AdminMembersPage() {
  return (
    <RequireCap cap="MANAGE_MEMBERS">
      <MembersPanel />
    </RequireCap>
  )
}
