import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import axios from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import React from 'react'
import MfaPage from '@/app/(auth)/mfa/page'
import { useAuthStore } from '@/lib/store/auth.store'
import {
  MFA_CODES_PENDING_TTL_MS,
  clearPendingMfa,
  markMfaCodesPending,
  readPendingMfa,
  savePendingMfa,
} from '@/lib/auth/mfa'

const replace = vi.fn()
const push = vi.fn()
const mfaVerify = vi.fn()
const mfaEnrollStart = vi.fn()
const mfaEnrollConfirm = vi.fn()
const mfaEnrollCodes = vi.fn()
const mfaEnrollComplete = vi.fn()
const toastWarning = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push }) }))
// Values are echoed so assertions can see e.g. the remaining-attempt count.
vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, values?: Record<string, unknown>) =>
    `${ns ? `${ns}.` : ''}${key}${values ? `:${JSON.stringify(values)}` : ''}`,
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: (m: string) => toastWarning(m) },
}))
vi.mock('@/lib/notifications', () => ({ maybeRequestNotificationPermission: vi.fn() }))
vi.mock('@/lib/api/auth', () => ({
  authService: {
    mfaVerify: (...a: unknown[]) => mfaVerify(...a),
    mfaEnrollStart: (...a: unknown[]) => mfaEnrollStart(...a),
    mfaEnrollConfirm: (...a: unknown[]) => mfaEnrollConfirm(...a),
    mfaEnrollCodes: (...a: unknown[]) => mfaEnrollCodes(...a),
    mfaEnrollComplete: (...a: unknown[]) => mfaEnrollComplete(...a),
  },
}))

const user = { id: 'o1', email: 'owner@acme.com', displayName: 'Olga' }
const signedIn = { code: 'LOGIN_SUCCESS', accessToken: 'acc', refreshToken: 'ref', sid: 'sid', user }
const BACKUP_CODES = Array.from({ length: 10 }, (_, i) => `AAAA${i}-BBBB${i}`)

function park(enrollmentRequired: boolean, now?: number) {
  savePendingMfa({ code: 'MFA_REQUIRED', mfaToken: 'mfa-tok', enrollmentRequired, user }, now)
}

/** F5: module memory is gone, the tab's sessionStorage survives. */
function simulateReload() {
  const stored = sessionStorage.getItem('pon:auth:mfa')
  clearPendingMfa()
  if (stored) sessionStorage.setItem('pon:auth:mfa', stored)
}

function serverError(status: number, data: unknown) {
  const config = { headers: new axios.AxiosHeaders() } as InternalAxiosRequestConfig
  return new axios.AxiosError('x', 'ERR_BAD_REQUEST', config, null, {
    status, statusText: '', headers: {}, config, data,
  } as AxiosResponse)
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MfaPage />
    </QueryClientProvider>,
  )
}

function codeBoxes() {
  return within(screen.getByRole('group', { name: 'auth.mfa.codeLabel' })).getAllByRole('textbox')
}

function typeCode(code: string) {
  code.split('').forEach((digit, i) => fireEvent.change(codeBoxes()[i], { target: { value: digit } }))
}

describe('/mfa page', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    clearPendingMfa()
    sessionStorage.clear()
    useAuthStore.setState({ user: null, accessToken: null })
    fetchMock.mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends a visitor without a pending challenge back to /login', async () => {
    renderPage()
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'))
  })

  describe('verify mode', () => {
    it('auto-submits the 6th digit and signs in exactly like a password login', async () => {
      park(false)
      mfaVerify.mockResolvedValue({ ...signedIn, backupCodesRemaining: 10 })
      renderPage()
      expect(screen.getByText('auth.mfa.verifyTitle')).toBeInTheDocument()
      typeCode('123456')

      await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
      expect(mfaVerify).toHaveBeenCalledTimes(1)
      expect(mfaVerify).toHaveBeenCalledWith('mfa-tok', { code: '123456' })
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/set-cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: 'acc', refreshToken: 'ref', sid: 'sid' }),
      })
      expect(useAuthStore.getState()).toMatchObject({ accessToken: 'acc', user: { id: 'o1' } })
      expect(readPendingMfa()).toBeNull()
      expect(toastWarning).not.toHaveBeenCalled()
    })

    it('keeps the set-password gate: a flagged account lands on /set-password', async () => {
      park(false)
      mfaVerify.mockResolvedValue({ ...signedIn, user: { ...user, mustSetPassword: true } })
      renderPage()
      typeCode('123456')
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/set-password'))
    })

    it('accepts a backup code instead of the authenticator code', async () => {
      park(false)
      mfaVerify.mockResolvedValue({ ...signedIn, backupCodesRemaining: 4 })
      renderPage()
      fireEvent.click(screen.getByRole('button', { name: 'auth.mfa.useBackupCode' }))
      expect(screen.getByText('auth.mfa.backupModeSubtitle')).toBeInTheDocument()

      const input = screen.getByLabelText('auth.mfa.backupCodeLabel')
      fireEvent.change(input, { target: { value: 'abcde23456' } })
      expect(input).toHaveValue('ABCDE-23456')
      fireEvent.click(screen.getByRole('button', { name: 'auth.mfa.verifyButton' }))

      await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
      expect(mfaVerify).toHaveBeenCalledWith('mfa-tok', { backupCode: 'ABCDE-23456' })
      expect(toastWarning).toHaveBeenCalledWith('auth.mfa.backupCodesRemaining:{"count":4}')
    })

    it('rejects an incomplete backup code locally', () => {
      park(false)
      renderPage()
      fireEvent.click(screen.getByRole('button', { name: 'auth.mfa.useBackupCode' }))
      fireEvent.change(screen.getByLabelText('auth.mfa.backupCodeLabel'), { target: { value: 'ABC' } })
      fireEvent.click(screen.getByRole('button', { name: 'auth.mfa.verifyButton' }))
      expect(screen.getByRole('alert')).toHaveTextContent('auth.mfa.backupCodeFormat')
      expect(mfaVerify).not.toHaveBeenCalled()
    })

    it('shows the localized remaining-attempts message on a wrong code and lets the user retry', async () => {
      park(false)
      mfaVerify.mockRejectedValueOnce(
        serverError(401, { code: 'MFA_CODE_INVALID', params: { remaining: 3 }, message: 'Invalid TOTP' }),
      )
      renderPage()
      typeCode('000000')

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('auth.errMfaCodeInvalidWithRemaining:{"remaining":3}')
      expect(screen.queryByText(/Invalid TOTP/)).not.toBeInTheDocument()
      expect(replace).not.toHaveBeenCalled()
      // Boxes are cleared for the next attempt, which goes through again.
      codeBoxes().forEach((box) => expect(box).toHaveValue(''))
      mfaVerify.mockResolvedValueOnce(signedIn)
      typeCode('123456')
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    })

    it('goes back to /login with the reason when the challenge expired', async () => {
      park(false)
      mfaVerify.mockRejectedValue(serverError(401, { code: 'MFA_TOKEN_INVALID' }))
      renderPage()
      typeCode('123456')

      await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?reason=MFA_TOKEN_INVALID'))
      expect(readPendingMfa()).toBeNull()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('goes back to /login after too many wrong codes', async () => {
      park(false)
      mfaVerify.mockRejectedValue(serverError(401, { code: 'MFA_TOO_MANY_ATTEMPTS' }))
      renderPage()
      typeCode('123456')
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?reason=MFA_TOO_MANY_ATTEMPTS'))
    })

    it('"Back to sign in" abandons the challenge', async () => {
      park(false)
      renderPage()
      fireEvent.click(screen.getByRole('button', { name: 'auth.mfa.backToLogin' }))
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'))
      expect(readPendingMfa()).toBeNull()
      expect(replace).toHaveBeenCalledTimes(1)
    })
  })

  describe('enroll mode', () => {
    const issued = { code: 'MFA_BACKUP_CODES_ISSUED', backupCodes: BACKUP_CODES }

    beforeEach(() => {
      mfaEnrollStart.mockResolvedValue({
        otpauthUrl: 'otpauth://totp/PON:owner%40acme.com?secret=JBSWY3DPEHPK3PXP&issuer=PON',
        secret: 'JBSWY3DPEHPK3PXP',
        qrDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      })
    })

    const savedBox = () => screen.getByRole('checkbox', { name: 'auth.mfa.savedCheckbox' })
    const continueBtn = () => screen.getByRole('button', { name: 'auth.mfa.continue' })

    async function confirmEnrollment() {
      await screen.findByAltText('auth.mfa.qrAlt')
      typeCode('654321')
      await screen.findByText('auth.mfa.backupTitle')
    }

    it('confirm shows the codes without any session; Continue (after the checkbox) completes the sign-in', async () => {
      park(true)
      mfaEnrollConfirm.mockResolvedValue(issued)
      mfaEnrollComplete.mockResolvedValue(signedIn)
      renderPage()

      const qr = await screen.findByAltText('auth.mfa.qrAlt')
      expect(qr).toHaveAttribute('src', 'data:image/png;base64,iVBORw0KGgo=')
      expect(screen.getByTestId('mfa-secret')).toHaveTextContent('JBSW Y3DP EHPK 3PXP')
      expect(mfaEnrollStart).toHaveBeenCalledWith('mfa-tok')

      typeCode('654321')
      expect(await screen.findByText('auth.mfa.backupTitle')).toBeInTheDocument()
      expect(mfaEnrollConfirm).toHaveBeenCalledWith('mfa-tok', '654321')
      expect(screen.getAllByTestId('backup-code').map((li) => li.textContent)).toEqual(BACKUP_CODES)
      // No session yet: no cookie, no token; the stage (never the codes) is parked for a reload.
      expect(fetchMock).not.toHaveBeenCalled()
      expect(useAuthStore.getState().accessToken).toBeNull()
      expect(readPendingMfa()).toMatchObject({ mfaToken: 'mfa-tok', stage: 'codes_pending' })
      expect(sessionStorage.getItem('pon:auth:mfa')).not.toContain(BACKUP_CODES[0])
      expect(mfaEnrollCodes).not.toHaveBeenCalled()

      expect(continueBtn()).toBeDisabled()
      fireEvent.click(continueBtn())
      expect(mfaEnrollComplete).not.toHaveBeenCalled()

      fireEvent.click(savedBox())
      expect(continueBtn()).toBeEnabled()
      fireEvent.click(continueBtn())

      await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
      expect(mfaEnrollComplete).toHaveBeenCalledTimes(1)
      expect(mfaEnrollComplete).toHaveBeenCalledWith('mfa-tok')
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/set-cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: 'acc', refreshToken: 'ref', sid: 'sid' }),
      })
      expect(useAuthStore.getState()).toMatchObject({ accessToken: 'acc', user: { id: 'o1' } })
      expect(readPendingMfa()).toBeNull()
    })

    it('keeps the set-password gate after complete', async () => {
      park(true)
      mfaEnrollConfirm.mockResolvedValue(issued)
      mfaEnrollComplete.mockResolvedValue({ ...signedIn, user: { ...user, mustSetPassword: true } })
      renderPage()
      await confirmEnrollment()
      fireEvent.click(savedBox())
      fireEvent.click(continueBtn())
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/set-password'))
    })

    it('a reload at the codes step re-fetches the same codes and stays on /mfa', async () => {
      park(true)
      markMfaCodesPending()
      simulateReload()
      mfaEnrollCodes.mockResolvedValue({ backupCodes: BACKUP_CODES })
      mfaEnrollComplete.mockResolvedValue(signedIn)
      renderPage()

      expect(await screen.findAllByTestId('backup-code')).toHaveLength(10)
      expect(mfaEnrollCodes).toHaveBeenCalledWith('mfa-tok')
      expect(mfaEnrollStart).not.toHaveBeenCalled()
      expect(replace).not.toHaveBeenCalled()
      expect(fetchMock).not.toHaveBeenCalled()
      expect(continueBtn()).toBeDisabled()

      fireEvent.click(savedBox())
      fireEvent.click(continueBtn())
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
      expect(useAuthStore.getState().accessToken).toBe('acc')
    })

    it('a reload after the server dropped the codes goes back to /login with the reason', async () => {
      park(true)
      markMfaCodesPending()
      simulateReload()
      mfaEnrollCodes.mockRejectedValue(serverError(401, { code: 'MFA_TOKEN_INVALID' }))
      renderPage()
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?reason=MFA_TOKEN_INVALID'))
      expect(readPendingMfa()).toBeNull()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('a parked codes step older than its 10 minutes restarts sign-in without calling the server', async () => {
      const longAgo = Date.now() - MFA_CODES_PENDING_TTL_MS - 1000
      park(true, longAgo)
      markMfaCodesPending(longAgo)
      simulateReload()
      renderPage()
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?reason=MFA_TOKEN_INVALID'))
      expect(mfaEnrollCodes).not.toHaveBeenCalled()
    })

    it('a failed complete keeps the codes on screen and can be retried; a used token restarts', async () => {
      park(true)
      mfaEnrollConfirm.mockResolvedValue(issued)
      mfaEnrollComplete.mockRejectedValueOnce(new Error('Network Error'))
      renderPage()
      await confirmEnrollment()
      fireEvent.click(savedBox())
      fireEvent.click(continueBtn())

      expect(await screen.findByRole('alert')).toHaveTextContent('auth.errGeneric')
      expect(screen.queryByText(/Network Error/)).not.toBeInTheDocument()
      expect(screen.getAllByTestId('backup-code')).toHaveLength(10)
      await waitFor(() => expect(continueBtn()).toBeEnabled())
      expect(replace).not.toHaveBeenCalled()

      mfaEnrollComplete.mockRejectedValueOnce(serverError(401, { code: 'MFA_TOKEN_INVALID' }))
      fireEvent.click(continueBtn())
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?reason=MFA_TOKEN_INVALID'))
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('shows a wrong confirmation code inline and stays on the setup step', async () => {
      park(true)
      mfaEnrollConfirm.mockRejectedValue(serverError(401, { code: 'MFA_CODE_INVALID', params: { remaining: 4 } }))
      renderPage()
      await screen.findByAltText('auth.mfa.qrAlt')
      typeCode('111111')

      expect(await screen.findByRole('alert')).toHaveTextContent('auth.errMfaCodeInvalidWithRemaining:{"remaining":4}')
      expect(screen.queryByText('auth.mfa.backupTitle')).not.toBeInTheDocument()
      expect(readPendingMfa()?.stage).toBeUndefined()
      expect(replace).not.toHaveBeenCalled()
    })

    it('restarts sign-in when the setup cannot start (expired challenge)', async () => {
      park(true)
      mfaEnrollStart.mockRejectedValue(serverError(401, { code: 'MFA_TOKEN_INVALID' }))
      renderPage()
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?reason=MFA_TOKEN_INVALID'))
    })
  })
})
