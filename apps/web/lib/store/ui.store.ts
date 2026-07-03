import { create } from 'zustand'

const SIDEBAR_WIDTH_KEY = 'pon-sidebar-width'

/** Minimum sidebar width — icon-only "compact" rail. */
export const SIDEBAR_MIN_WIDTH = 68
/** Default expanded sidebar width. */
export const SIDEBAR_DEFAULT_WIDTH = 288
/** At/under this width the sidebar reads as collapsed (icon-only). Container
 *  queries switch the sidebar content to compact mode at 200px, so the toggle
 *  treats anything at the floor as "collapsed". */
export const SIDEBAR_COLLAPSE_THRESHOLD = SIDEBAR_MIN_WIDTH + 8

interface UiState {
  showNewChatModal: boolean
  defaultChatTab: 'direct' | 'group'
  showPublicChannelsModal: boolean
  /** Current desktop sidebar width in px. Drag-resizable (layout drag handle)
   *  and toggle-collapsible (ConversationHeader button). Persisted to
   *  localStorage; restored post-hydration by MainLayout to avoid SSR mismatch. */
  sidebarWidth: number
  /** Last width the sidebar had while expanded — used to restore it when the
   *  toggle un-collapses the rail. */
  sidebarExpandedWidth: number
  openNewChat: (tab?: 'direct' | 'group') => void
  closeNewChat: () => void
  openPublicChannels: () => void
  closePublicChannels: () => void
  /** Set the sidebar width (drag). `persist` is false during live drag moves so
   *  we only touch localStorage once, on mouse-up. */
  setSidebarWidth: (width: number, persist?: boolean) => void
  /** Collapse to the icon-only floor when expanded, or restore the last
   *  expanded width when already collapsed. */
  toggleSidebar: () => void
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
  sidebarExpandedWidth: SIDEBAR_DEFAULT_WIDTH,
  openNewChat: (tab = 'direct') => set({ showNewChatModal: true, defaultChatTab: tab }),
  closeNewChat: () => set({ showNewChatModal: false }),
  openPublicChannels: () => set({ showPublicChannelsModal: true }),
  closePublicChannels: () => set({ showPublicChannelsModal: false }),
  setSidebarWidth: (width, persist = true) =>
    set(() => {
      if (persist) persistWidth(width)
      // Track the last expanded width so the toggle can restore it.
      return width > SIDEBAR_COLLAPSE_THRESHOLD
        ? { sidebarWidth: width, sidebarExpandedWidth: width }
        : { sidebarWidth: width }
    }),
  toggleSidebar: () =>
    set((s) => {
      const collapsed = s.sidebarWidth <= SIDEBAR_COLLAPSE_THRESHOLD
      const next = collapsed ? s.sidebarExpandedWidth : SIDEBAR_MIN_WIDTH
      persistWidth(next)
      return { sidebarWidth: next }
    }),
}))
