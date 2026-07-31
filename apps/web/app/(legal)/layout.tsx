import { PageTransition } from '@/components/layout/PageTransition'

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh bg-background overflow-auto">
      {/* Ambient glow orbs removed — the redesign carries depth with flat
          background-shade steps + hairline borders instead. */}
      <PageTransition className="relative z-10">{children}</PageTransition>
    </div>
  )
}
