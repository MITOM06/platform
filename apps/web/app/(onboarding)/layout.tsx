import { AuthShell } from '@/components/auth/AuthShell'
import { SetPasswordGate } from '@/components/auth/SetPasswordGate'

/**
 * Signed-in onboarding steps that must be finished before the app shell
 * (sidebar, STOMP, conversations) is reachable. Authenticated like `(main)`
 * — the middleware sends a cookie-less visitor to /login — but framed like the
 * sign-in pages, with no main navigation.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthShell>
      <SetPasswordGate inline>{children}</SetPasswordGate>
    </AuthShell>
  )
}
