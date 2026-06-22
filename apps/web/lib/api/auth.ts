import { authApi } from './axios'
import type { AuthUser } from '@/lib/store/auth.store'
import type {
  UserSearchResult,
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
  gender?: string
  /** Legacy single privacy flag — kept for backward-compat fallback. */
  hideInfo?: boolean
  /** Per-field visibility flags (default true = visible to others). When
   *  undefined, fall back to `!hideInfo`. Only present on self responses. */
  showDateOfBirth?: boolean
  showPhoneNumber?: boolean
  showGender?: boolean
  friendsCount?: number
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

  searchUsers: (q: string) =>
    authApi.get<UserSearchResult[]>('/api/users/search', { params: { q } }).then((r) => r.data),

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

  updateProfile: (data: UpdateProfilePayload) =>
    authApi.patch<UserProfile>('/api/users/me', data).then((r) => r.data),

  changePassword: (currentPassword: string, newPassword: string) =>
    authApi.post('/api/users/me/change-password', { currentPassword, newPassword }),
}
