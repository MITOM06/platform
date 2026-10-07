/** Meeting keyboard shortcuts, like Meet: ⌘/Ctrl+D mic, ⌘/Ctrl+E camera, ⌘/Ctrl+Alt+H hand. */

export type ShortcutAction = 'toggleMic' | 'toggleCamera' | 'toggleHand'

export interface KeyLike {
  code: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
  isComposing?: boolean
  repeat?: boolean
}

const BINDINGS: Record<string, { action: ShortcutAction; alt: boolean; letter: string }> = {
  KeyD: { action: 'toggleMic', alt: false, letter: 'D' },
  KeyE: { action: 'toggleCamera', alt: false, letter: 'E' },
  KeyH: { action: 'toggleHand', alt: true, letter: 'H' },
}

/** Uses `e.code` — on macOS Alt rewrites `e.key` (⌥H = "˙"). */
export function matchShortcut(e: KeyLike, isMac: boolean): ShortcutAction | null {
  if (e.repeat || e.isComposing || e.shiftKey) return null
  const primary = isMac ? e.metaKey : e.ctrlKey
  const other = isMac ? e.ctrlKey : e.metaKey
  if (!primary || other) return null
  const binding = BINDINGS[e.code]
  if (!binding || binding.alt !== e.altKey) return null
  return binding.action
}

export function shortcutLabel(action: ShortcutAction, isMac: boolean): string {
  const binding = Object.values(BINDINGS).find((b) => b.action === action)
  if (!binding) return ''
  if (isMac) return `${binding.alt ? '⌥' : ''}⌘${binding.letter}`
  return `Ctrl+${binding.alt ? 'Alt+' : ''}${binding.letter}`
}

export function isMacPlatform(
  nav: { platform?: string; userAgent?: string } | undefined = typeof navigator === 'undefined'
    ? undefined
    : navigator,
): boolean {
  const s = `${nav?.platform ?? ''} ${nav?.userAgent ?? ''}`
  return /Mac|iPhone|iPad|iPod/i.test(s)
}
