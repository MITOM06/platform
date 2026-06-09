import { authApi } from './axios'
import type { AuthUser } from '@/lib/store/auth.store'

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

export const authService = {
  login: (email: string, password: string) =>
    authApi.post<LoginResponse>('/auth/login', { email, password }),

  register: (email: string, password: string, displayName: string) =>
    authApi.post<RegisterResponse>('/auth/register', { email, password, displayName }),

  verifyOtp: (email: string, otp: string) =>
    authApi.post<VerifyOtpResponse>('/auth/verify-otp', { email, otp }),

  resendOtp: (email: string) =>
    authApi.post('/auth/resend-otp', { email }),

  logout: () =>
    authApi.post('/auth/logout').catch(() => {}),
}
