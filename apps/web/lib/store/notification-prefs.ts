import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// App-level notification ON/OFF preference (mirrors Flutter
// `notificationsEnabledProvider` + SharedPreferences key `notifications_enabled`).
// Persisted to localStorage so the choice survives reloads. Default `true` to
// match the mobile default (a fresh user behaves identically on both platforms).
//
// This is the app-level gate layered on top of the browser permission: when
// `enabled === false` the receive handler still keeps unread counts live but
// suppresses the OS notification and the in-app toast.

interface NotificationPrefsState {
  enabled: boolean
  setEnabled: (enabled: boolean) => void
}

export const useNotificationPrefs = create<NotificationPrefsState>()(
  persist(
    (set) => ({
      enabled: true,
      setEnabled: (enabled) => set({ enabled }),
    }),
    {
      name: 'pon_notifications_enabled',
    },
  ),
)
