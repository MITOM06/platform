import { create } from 'zustand'

const SIDEBAR_WIDTH_KEY = 'pon-sidebar-width'

/** Minimum sidebar width — the drag floor. At this width the tab bar collapses
 *  to icon-only (`@[200px]` container-query threshold) while conversation items
 *  still show avatar + name + preview, so the rail stays readable. */
export const SIDEBAR_MIN_WIDTH = 200
/** Default expanded sidebar width. */
export const SIDEBAR_DEFAULT_WIDTH = 288

interface UiState {
  showNewChatModal: boolean
  defaultChatTab: 'direct' | 'group'
  showPublicChannelsModal: boolean
  /** Current desktop sidebar width in px. Drag-resizable via the layout drag
   *  handle. Persisted to localStorage; restored post-hydration by MainLayout to
   *  avoid SSR mismatch. */
  sidebarWidth: number
  openNewChat: (tab?: 'direct' | 'group') => void
  closeNewChat: () => void
  openPublicChannels: () => void
  closePublicChannels: () => void
  /** Set the sidebar width (drag). `persist` is false during live drag moves so
   *  we only touch localStorage once, on mouse-up. */
  setSidebarWidth: (width: number, persist?: boolean) => void
}

function persistWidth(w: number) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w))
  }
}

export const useUiStore = create<UiState>((set) => ({
  showNewChatModal: false,
  defaultChatTab: 'direct',
  showPublicChannelsModal: false,
  // Default to the expanded width on both server and first client render; the
  // real persisted value is applied in a mount effect so hydration never
  // mismatches.
  sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
  openNewChat: (tab = 'direct') => set({ showNewChatModal: true, defaultChatTab: tab }),
  closeNewChat: () => set({ showNewChatModal: false }),
  openPublicChannels: () => set({ showPublicChannelsModal: true }),
  closePublicChannels: () => set({ showPublicChannelsModal: false }),
  setSidebarWidth: (width, persist = true) =>
    set(() => {
      if (persist) persistWidth(width)
      return { sidebarWidth: width }
    }),
}))
