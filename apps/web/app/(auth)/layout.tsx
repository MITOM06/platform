function PonLogo({ className = 'size-20' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="ponAuthGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6AC9FF" />
          <stop offset="50%" stopColor="#FBB68B" />
          <stop offset="100%" stopColor="#FF85B3" />
        </linearGradient>
      </defs>
      <path
        d="M12 2C6.48 2 2 6.48 2 12C2 14.52 2.93 16.82 4.46 18.6L3 21L5.8 20.3C7.54 21.37 9.6 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 18C8.69 18 6 15.31 6 12C6 8.69 8.69 6 12 6C15.31 6 18 8.69 18 12C18 15.31 15.31 18 12 18Z"
        fill="url(#ponAuthGradient)"
      />
      <circle cx="12" cy="12" r="3" fill="url(#ponAuthGradient)" />
    </svg>
  )
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-background p-4">
      {/* Ambient neon glow background — mirrors the Flutter login screen */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-32 size-80 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(106,201,255,0.20), transparent 70%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-28 size-96 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(255,133,179,0.18), transparent 70%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 -right-32 size-80 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(251,182,139,0.14), transparent 70%)' }}
      />

      {/* Brand */}
      <div className="relative z-10 mb-8 flex flex-col items-center gap-2">
        <PonLogo className="size-20 drop-shadow-[0_0_18px_rgba(106,201,255,0.45)]" />
        <span className="text-4xl font-black tracking-tight pon-gradient-text">PON</span>
        <span className="text-sm text-muted-foreground">Connect &amp; Chat</span>
      </div>

      <div className="relative z-10 w-full max-w-sm">{children}</div>
    </div>
  )
}
