import { toast } from 'sonner'

/**
 * Shows an incoming notice the way every realtime banner does: an OS notification
 * when the tab is in the background and permission is granted, otherwise an in-app
 * toast with an "Open" action. Used by chat messages and meetings alike.
 */
export function presentNotice(title: string, body: string, open: () => void, actionLabel: string): void {
  if (
    typeof Notification !== 'undefined' &&
    Notification.permission === 'granted' &&
    document.visibilityState === 'hidden'
  ) {
    const n = new Notification(title, { body })
    n.onclick = () => {
      window.focus()
      open()
    }
    return
  }
  toast(title, { description: body, action: { label: actionLabel, onClick: open } })
}
