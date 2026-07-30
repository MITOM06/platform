'use client'

import { ChevronRight } from 'lucide-react'

interface AiHubCardProps {
  icon: React.ReactNode
  iconBg: string
  title: string
  subtitle?: string
  onClick: () => void
}

// Reusable AI Hub destination card (icon, title, subtitle). Mirrors the
// SettingsCard visual language and the Flutter `ai_hub_tile.dart`.
export function AiHubCard({ icon, iconBg, title, subtitle, onClick }: AiHubCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full group relative rounded-xl border bg-card p-0 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] text-left overflow-hidden hover:border-primary/30"
    >
      <div className="absolute inset-0 rounded-xl pointer-events-none opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-accent/60" />
      <div className="relative flex items-center gap-4 px-5 py-4">
        <div
          className="size-10 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
          style={{ background: iconBg }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  )
}
