import { authApi } from './axios'
import type { AuthUser } from '@/lib/store/auth.store'
import type {
  UserSearchResult,
  UserSearchResponse,
  LoginRequest,
  VerifyOtpRequest,
  ChangePasswordRequest,
  AcceptInvitationRequest,
  InvitationPreview,
  MfaChallenge,
  MfaEnrollStartRequest,
  MfaEnrollStartResponse,
  MfaEnrollConfirmRequest,
  MfaEnrollConfirmResponse,
  MfaEnrollCodesRequest,
  MfaEnrollCodesResponse,
  MfaEnrollCompleteRequest,
  MfaVerifyRequest,
  MfaBackupCodesResponse,
  RegenerateBackupCodesRequest,
} from './types'
import type { DepartmentOption } from './meeting-types'

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
  /** Self only: 2FA (authenticator app) is set up for this account. */
  mfaEnabled?: boolean
  /** Self only: the role is privileged, so every sign-in needs a 2FA code. */
  mfaRequired?: boolean
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
  code?: string
  accessToken: string
  refreshToken: string
  sid: string
  user: AuthUser
}

/**
 * `POST /auth/login` / `POST /auth/exchange`: tokens, or — for a privileged
 * user — a 2FA challenge to finish on `/mfa` (see `lib/auth/mfa.ts`).
 */
export type SignInResponse = LoginResponse | MfaChallenge

/** `POST /auth/mfa/verify`: a normal sign-in plus how many backup codes are left. */
export type MfaVerifyResponse = LoginResponse & { backupCodesRemaining?: number }

/** Second-step proof for `POST /auth/mfa/verify`: an authenticator code or a backup code. */
export type MfaProof = { code: string } | { backupCode: string }

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
    authApi.post<SignInResponse>('/auth/login', { email, password } satisfies LoginRequest),

  // ── Two-factor authentication (public, no JWT — the mfaToken is the proof) ──
  mfaEnrollStart: (mfaToken: string) =>
    authApi
      .post<MfaEnrollStartResponse>('/auth/mfa/enroll/start', { mfaToken } satisfies MfaEnrollStartRequest)
      .then((r) => r.data),

  /** Turns 2FA on and returns the 10 backup codes — no session yet (see `mfaEnrollComplete`). */
  mfaEnrollConfirm: (mfaToken: string, code: string) =>
    authApi
      .post<MfaEnrollConfirmResponse>('/auth/mfa/enroll/confirm', {
        mfaToken,
        code,
      } satisfies MfaEnrollConfirmRequest)
      .then((r) => r.data),

  /** The same backup codes again while the enrollment waits for `complete` (reload of `/mfa`). */
  mfaEnrollCodes: (mfaToken: string) =>
    authApi
      .post<MfaEnrollCodesResponse>('/auth/mfa/enroll/codes', { mfaToken } satisfies MfaEnrollCodesRequest)
      .then((r) => r.data),

  /** The codes were acknowledged: issue the session. Single use. */
  mfaEnrollComplete: (mfaToken: string) =>
    authApi
      .post<LoginResponse>('/auth/mfa/enroll/complete', {
        mfaToken,
        deviceId: 'web',
        platform: 'web',
      } satisfies MfaEnrollCompleteRequest)
      .then((r) => r.data),

  mfaVerify: (mfaToken: string, proof: MfaProof) =>
    authApi
      .post<MfaVerifyResponse>('/auth/mfa/verify', {
        mfaToken,
        ...proof,
        deviceId: 'web',
        platform: 'web',
      } satisfies MfaVerifyRequest)
      .then((r) => r.data),

  /** Replace the backup codes (needs the current authenticator code). JWT-authenticated. */
  regenerateBackupCodes: (code: string) =>
    authApi
      .post<MfaBackupCodesResponse>('/api/users/me/mfa/backup-codes', { code } satisfies RegenerateBackupCodesRequest)
      .then((r) => r.data),

  // ── Invitations (public, no JWT) ──────────────────────────────────────────
  // The raw token only travels in the path (URL-encoded); it is never logged.
  getInvitation: (token: string) =>
    authApi
      .get<InvitationPreview>(`/auth/invitations/${encodeURIComponent(token)}`)
      .then((r) => r.data),

  /** Accept by choosing a display name + password → same body as login (+ `code`). */
  acceptInvitation: (token: string, displayName: string, password: string) =>
    authApi
      .post<LoginResponse & { code?: string }>(
        `/auth/invitations/${encodeURIComponent(token)}/accept-password`,
        { displayName, password, deviceId: 'web', platform: 'web' } satisfies AcceptInvitationRequest,
      )
      .then((r) => r.data),

  verifyOtp: (email: string, otp: string) =>
    authApi.post<VerifyOtpResponse>('/auth/verify-otp', { email, otp } satisfies VerifyOtpRequest),

  resendOtp: (email: string) =>
    authApi.post('/auth/resend-otp', { email }),

  forgotPassword: (email: string) =>
    authApi.post('/auth/forgot-password', { email }).then((r) => r.data),

  resetPassword: (email: string, otp: string, password: string) =>
    authApi.post('/auth/reset-password', { email, otp, password }).then((r) => r.data),

  exchangeCode: (code: string, deviceId?: string) =>
    authApi.post<SignInResponse>('/auth/exchange', { code, deviceId: deviceId ?? 'web', platform: 'web' }),

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

  /**
   * Departments the caller can attach a meeting to — all of them with
   * MANAGE_DEPARTMENTS, otherwise their own. Malformed rows are dropped.
   */
  getMyDepartments: (): Promise<DepartmentOption[]> =>
    authApi.get<unknown>('/api/users/me/departments').then((r) =>
      Array.isArray(r.data)
        ? r.data.filter(
            (d): d is DepartmentOption =>
              !!d &&
              typeof d === 'object' &&
              typeof (d as DepartmentOption).id === 'string' &&
              typeof (d as DepartmentOption).name === 'string',
          )
        : [],
    ),

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
    authApi.post('/api/users/me/change-password', { currentPassword, newPassword } satisfies ChangePasswordRequest),
}
