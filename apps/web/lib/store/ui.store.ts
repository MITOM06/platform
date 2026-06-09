import { create } from 'zustand'

interface UiState {
  showNewChatModal: boolean
  defaultChatTab: 'direct' | 'group'
  showPublicChannelsModal: boolean
  openNewChat: (tab?: 'direct' | 'group') => void
  closeNewChat: () => void
  openPublicChannels: () => void
  closePublicChannels: () => void
}

export const useUiStore = create<UiState>((set) => ({
  showNewChatModal: false,
  defaultChatTab: 'direct',
  showPublicChannelsModal: false,
  openNewChat: (tab = 'direct') => set({ showNewChatModal: true, defaultChatTab: tab }),
  closeNewChat: () => set({ showNewChatModal: false }),
  openPublicChannels: () => set({ showPublicChannelsModal: true }),
  closePublicChannels: () => set({ showPublicChannelsModal: false }),
}))
