'use client'

/**
 * Local-only cosmetic avatar for the assistant wizard/settings.
 * Shows the chosen emoji, or the first letter of the name. The backend
 * `setup` body has no avatar field — this is preview-only on both platforms.
 */
export function AssistantPreviewAvatar({
  emoji,
  name,
  className = 'size-16 text-2xl',
}: {
  emoji: string
  name: string
  className?: string
}) {
  const glyph = emoji || name.trim()[0]?.toUpperCase() || '🤖'
  return (
    <div
      className={`rounded-full bg-gradient-to-br from-violet-500 to-teal-400
                  flex items-center justify-center text-white font-bold shrink-0
                  overflow-hidden ${className}`}
    >
      <span className="relative">{glyph}</span>
    </div>
  )
}

export const ASSISTANT_EMOJI_CHOICES = [
  '🤖',
  '✨',
  '🧠',
  '🚀',
  '💡',
  '🦾',
  '🌟',
  '🎯',
] as const
