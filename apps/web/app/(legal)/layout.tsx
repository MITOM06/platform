export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background overflow-auto">
      {/* Ambient glow orbs removed — the redesign carries depth with flat
          background-shade steps + hairline borders instead. */}
      <div className="relative z-10">{children}</div>
    </div>
  )
}
