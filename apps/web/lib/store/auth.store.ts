import { create } from 'zustand'

export interface AuthUser {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
  bio?: string
  coverPhoto?: string
  /** True if the user has set a local password (vs. OAuth-only). */
  hasPassword?: boolean
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  setAuth: (user: AuthUser, accessToken: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  setAuth: (user, accessToken) => set({ user, accessToken }),
  clearAuth: () => set({ user: null, accessToken: null }),
}))
