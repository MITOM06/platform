import { redirect } from 'next/navigation'

// Old route — the page was renamed to /ai-context (P3). Permanent in-app redirect.
export default function AiMemoryRedirect() {
  redirect('/ai-context')
}
