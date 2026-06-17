export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background overflow-auto">
      {/* Ambient neon glow orbs — matches the app aesthetic (softer than auth) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-32 size-80 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(106,201,255,0.12), transparent 70%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-28 size-96 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(255,133,179,0.10), transparent 70%)' }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
