// Browser notification-permission helper.
//
// The OS-level prompt must only appear right after a *successful* login or
// registration — never on the landing/login page, and never re-nagged on every
// authenticated session load. We persist a "prompted" flag in localStorage so a
// user who already answered (granted OR denied) is not asked again.

const PROMPTED_FLAG = 'pon_notif_prompted'

/**
 * Request browser notification permission once, after a successful auth event.
 * No-op when: the API is unavailable (SSR / unsupported browser), the user has
 * already been prompted, or a decision (granted/denied) already exists.
 */
export async function maybeRequestNotificationPermission(): Promise<void> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return

  // Already granted or explicitly denied → respect it, don't nag.
  if (Notification.permission !== 'default') return

  // Already asked in a previous session → don't ask again.
  try {
    if (localStorage.getItem(PROMPTED_FLAG)) return
  } catch {
    // localStorage unavailable (private mode) — fall through and prompt once.
  }

  try {
    localStorage.setItem(PROMPTED_FLAG, '1')
  } catch {
    // ignore persistence failure
  }

  try {
    await Notification.requestPermission()
  } catch {
    // ignore — browsers may throw if called outside a user gesture
  }
}
