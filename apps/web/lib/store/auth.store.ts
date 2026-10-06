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
  /**
   * True only for an account created by accepting an invitation with Google
   * that has not created its PON password yet. While set, every app route
   * sends the user to `/set-password` (see `lib/auth/set-password-gate.ts`).
   * Absent (older server) = false.
   */
  mustSetPassword?: boolean
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  setAuth: (user: AuthUser, accessToken: string) => void
  /** Merge fresh profile fields into the signed-in user (no-op when signed out). */
  updateUser: (patch: Partial<AuthUser>) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  setAuth: (user, accessToken) => set({ user, accessToken }),
  updateUser: (patch) => set((s) => (s.user ? { user: { ...s.user, ...patch } } : {})),
  clearAuth: () => set({ user: null, accessToken: null }),
}))
