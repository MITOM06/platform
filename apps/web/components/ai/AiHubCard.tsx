'use client'

import { ChevronRight } from 'lucide-react'

interface AiHubCardProps {
  icon: React.ReactNode
  title: string
  subtitle?: string
  onClick: () => void
}

// Reusable AI Hub destination card (icon, title, subtitle). Mirrors the
// SettingsCard visual language and the Flutter `ai_hub_tile.dart`.
// The icon tint comes from the single theme accent — the old `iconBg` prop let
// each card pass its own rgba, and two of them were passing a violet second
// accent (§2 rule 1). Same removal as Flutter's `AiHubTile.accent`.
export function AiHubCard({ icon, title, subtitle, onClick }: AiHubCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full group relative rounded-xl border bg-card p-0 transition-colors duration-200 text-left overflow-hidden hover:border-primary/30 hover:bg-accent"
    >
      <div className="relative flex items-center gap-4 px-5 py-4">
        <div className="size-10 rounded-full flex items-center justify-center shrink-0 bg-primary/10">
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
