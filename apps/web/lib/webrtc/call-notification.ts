/**
 * OS notification for an incoming call while the tab is hidden. Returns a
 * function that closes it, or null when none was shown. Never throws: some
 * browsers (Android Chrome) only allow notifications from a service worker and
 * throw "Illegal constructor" here — the in-page prompt still shows.
 */
export function showCallNotification(title: string, body: string): (() => void) | null {
  if (typeof document === 'undefined' || document.visibilityState !== 'hidden') return null
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return null
  try {
    const n = new Notification(title, { body, tag: 'pon-incoming-call' })
    n.onclick = () => {
      window.focus()
      n.close()
    }
    return () => n.close()
  } catch {
    return null
  }
}
