import { RequireCap } from '@/components/admin/require-cap'
import { AiContextEntriesPanel } from '@/components/admin/AiContextEntriesPanel'

export default function AdminAiContextPage() {
  return (
    <RequireCap cap="MANAGE_AI_CONTEXT">
      <AiContextEntriesPanel />
    </RequireCap>
  )
}
