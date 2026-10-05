/**
 * Workspace feature flags are free-form keys (`features: Record<string, boolean>`)
 * set per deployment; no flag key is defined by the platform itself, so there is
 * nothing to translate. Instead of the raw code ("meeting_room", "aiBeta"), show
 * it as words ("Meeting room", "Ai beta").
 */
export function humanizeFlagKey(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : key
}
