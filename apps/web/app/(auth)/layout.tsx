export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 gap-6">
      <div className="flex flex-col items-center gap-1">
        <span className="text-5xl font-black tracking-tight pon-gradient-text">PON</span>
        <span className="text-sm text-muted-foreground">Connect &amp; Chat</span>
      </div>
      {children}
    </div>
  )
}
