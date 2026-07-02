import { create } from 'zustand'

const SIDEBAR_COLLAPSED_KEY = 'pon-sidebar-collapsed'

interface UiState {
  showNewChatModal: boolean
  defaultChatTab: 'direct' | 'group'
  showPublicChannelsModal: boolean
  /** Desktop conversation sidebar collapsed (hidden) state. Persisted to
   *  localStorage; restored post-hydration by MainLayout to avoid SSR mismatch. */
  sidebarCollapsed: boolean
  openNewChat: (tab?: 'direct' | 'group') => void
  closeNewChat: () => void
  openPublicChannels: () => void
  closePublicChannels: () => void
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  showNewChatModal: false,
  defaultChatTab: 'direct',
  showPublicChannelsModal: false,
  // Default to expanded on both server and first client render; the real
  // persisted value is applied in a mount effect so hydration never mismatches.
  sidebarCollapsed: false,
  openNewChat: (tab = 'direct') => set({ showNewChatModal: true, defaultChatTab: tab }),
  closeNewChat: () => set({ showNewChatModal: false }),
  openPublicChannels: () => set({ showPublicChannelsModal: true }),
  closePublicChannels: () => set({ showPublicChannelsModal: false }),
  toggleSidebar: () =>
    set((s) => {
      const next = !s.sidebarCollapsed
      if (typeof window !== 'undefined') {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
      }
      return { sidebarCollapsed: next }
    }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
}))
