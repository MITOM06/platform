import { AuthShell } from '@/components/auth/AuthShell'
import { GuestOnly } from '@/components/auth/GuestOnly'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <GuestOnly>
      <AuthShell>{children}</AuthShell>
    </GuestOnly>
  )
}
