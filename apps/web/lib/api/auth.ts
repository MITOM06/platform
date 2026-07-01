import { authApi } from './axios'
import type { AuthUser } from '@/lib/store/auth.store'
import type {
  UserSearchResult,
  UserSearchResponse,
  LoginRequest,
  RegisterRequest,
  VerifyOtpRequest,
} from './types'

/** Profile gender — kept as a loose string union to mirror the auth-service
 *  schema (`gender: string`), with the values the UI selector offers. */
export type Gender = 'male' | 'female' | 'other' | ''

/** Public/own user profile shape returned by auth-service `/api/users/:id`
 *  and `/api/users/me`. When viewing another user with `hideInfo=true`, the
 *  server strips email/phoneNumber/dateOfBirth/gender/bio. */
export interface UserProfile extends AuthUser {
  avatarUrl?: string
  bio?: string
  coverPhoto?: string
  dateOfBirth?: string
  phoneNumber?: string
  /** True once the phone number has been confirmed via SMS OTP. Self-only. */
  phoneVerified?: boolean
  gender?: string
  /** Legacy single privacy flag — kept for backward-compat fallback. */
  hideInfo?: boolean
  /** Per-field visibility flags (default true = visible to others). When
   *  undefined, fall back to `!hideInfo`. Only present on self responses. */
  showDateOfBirth?: boolean
  showPhoneNumber?: boolean
  showGender?: boolean
  friendsCount?: number
  /** Workspace role name (Owner/Admin/Manager/Member or custom). Null/undefined
   *  = user has no assigned role → client renders the default "Member". Always
   *  public (no privacy gate), but omitted on blocked-by-owner minimal profiles. */
  roleName?: string | null
  /** True when the profile owner has blocked the viewer. The server returns a
   *  minimal profile (name/email/avatar/cover only) and sets this flag so the
   *  client can render a "profile not available" banner instead of full info. */
  isBlockedByOwner?: boolean
}

/** Fields accepted by `PATCH /api/users/me`. */
export interface UpdateProfilePayload {
  displayName?: string
  avatarUrl?: string
  bio?: string
  coverPhoto?: string
  dateOfBirth?: string
  phoneNumber?: string | null  // null = clear the field; '' would violate sparse unique index
  gender?: string
  hideInfo?: boolean
  showDateOfBirth?: boolean
  showPhoneNumber?: boolean
  showGender?: boolean
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  sid: string
  user: AuthUser
}

export interface RegisterResponse {
  message: string
}

export interface VerifyOtpResponse {
  message: string
}

export interface SsoInfo {
  enabled: boolean
  loginUrl: string | null
  buttonLabel: string
}

export const authService = {
  // Request bodies are typed from the OpenAPI-derived DTOs (see lib/api/types.ts)
  // so the client payloads stay in lockstep with the auth-service contract.
  login: (email: string, password: string) =>
    authApi.post<LoginResponse>('/auth/login', { email, password } satisfies LoginRequest),

  register: (email: string, password: string, displayName: string) =>
    authApi.post<RegisterResponse>(
      '/auth/register',
      { email, password, displayName } satisfies RegisterRequest,
    ),

  verifyOtp: (email: string, otp: string) =>
    authApi.post<VerifyOtpResponse>('/auth/verify-otp', { email, otp } satisfies VerifyOtpRequest),

  resendOtp: (email: string) =>
    authApi.post('/auth/resend-otp', { email }),

  forgotPassword: (email: string) =>
    authApi.post('/auth/forgot-password', { email }).then((r) => r.data),

  resetPassword: (email: string, otp: string, password: string) =>
    authApi.post('/auth/reset-password', { email, otp, password }).then((r) => r.data),

  exchangeCode: (code: string, deviceId?: string) =>
    authApi.post<LoginResponse>('/auth/exchange', { code, deviceId: deviceId ?? 'web', platform: 'web' }),

  // Public: tells the login page whether to render the "Sign in with SSO" button.
  getSsoInfo: () => authApi.get<SsoInfo>('/auth/sso/info').then((r) => r.data),

  logout: () =>
    authApi.post('/auth/logout').catch(() => {}),

  searchUsers: (q: string): Promise<UserSearchResponse> =>
    authApi
      .get<UserSearchResponse>('/api/users/search', { params: { q } })
      .then((r) => r.data),

  getMe: () =>
    authApi.get<UserProfile>('/api/users/me').then((r) => r.data),

  getOnlineFriends: () =>
    authApi.get<UserSearchResult[]>('/api/users/friends/online').then((r) => r.data),

  getRelationship: (userId: string) =>
    authApi.get<{
      friendStatus: 'none' | 'outgoing' | 'incoming' | 'accepted'
      iBlocked: boolean
      blockedMe: boolean
    }>(`/api/users/${userId}/relationship`).then((r) => r.data),

  blockUser: (targetId: string) =>
    authApi.post(`/api/users/block/${targetId}`).then((r) => r.data),

  unblockUser: (targetId: string) =>
    authApi.post(`/api/users/unblock/${targetId}`).then((r) => r.data),

  getUser: (id: string) =>
    authApi.get<UserProfile>(`/api/users/${id}`).then((r) => r.data),

  /**
   * Batch-fetch user profiles by id. Backed by `GET /api/users?ids=a,b,c`
   * (auth-guarded, max 100 ids per call). Chunks the input into batches of
   * <=100 and merges the results — kills the per-id N+1 that triggered 429s.
   */
  getUsers: async (ids: string[]): Promise<UserProfile[]> => {
    const unique = [...new Set(ids.filter(Boolean))]
    if (unique.length === 0) return []
    const CHUNK = 100
    const chunks: string[][] = []
    for (let i = 0; i < unique.length; i += CHUNK) {
      chunks.push(unique.slice(i, i + CHUNK))
    }
    const results = await Promise.all(
      chunks.map((chunk) =>
        authApi
          .get<UserProfile[]>('/api/users', { params: { ids: chunk.join(',') } })
          .then((r) => r.data),
      ),
    )
    return results.flat()
  },

  updateProfile: (data: UpdateProfilePayload) =>
    authApi.patch<UserProfile>('/api/users/me', data).then((r) => r.data),

  // Phone verification: Firebase verifies the SMS OTP client-side and issues an
  // ID token; the backend verifies that token via Firebase Admin and persists
  // phoneNumber + phoneVerified=true. Phone is never set through PATCH /api/users/me.
  verifyFirebasePhoneToken: (firebaseIdToken: string) =>
    authApi
      .post<{ success: boolean; phoneNumber: string; phoneVerified: boolean }>(
        '/api/users/me/phone/verify',
        { firebaseIdToken },
      )
      .then((r) => r.data),

  // `currentPassword` is optional: OAuth-only users setting their first password
  // omit it (the endpoint only requires it when a local password already exists).
  changePassword: (currentPassword: string | undefined, newPassword: string) =>
    authApi.post('/api/users/me/change-password', { currentPassword, newPassword }),
}
