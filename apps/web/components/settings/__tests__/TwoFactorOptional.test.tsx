import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import axios from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import React from 'react'
import { toast } from 'sonner'
import { TwoFactorSection } from '@/components/settings/TwoFactorSection'
import { useAuthStore } from '@/lib/store/auth.store'

const getMe = vi.fn()
const selfMfaEnrollStart = vi.fn()
const selfMfaEnrollConfirm = vi.fn()
const selfMfaDisable = vi.fn()

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, values?: Record<string, unknown>) =>
    `${ns ? `${ns}.` : ''}${key}${values ? `:${JSON.stringify(values)}` : ''}`,
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock('@/lib/api/auth', () => ({
  authService: {
    getMe: () => getMe(),
    regenerateBackupCodes: vi.fn(),
    selfMfaEnrollStart: () => selfMfaEnrollStart(),
    selfMfaEnrollConfirm: (...a: unknown[]) => selfMfaEnrollConfirm(...a),
    selfMfaDisable: (...a: unknown[]) => selfMfaDisable(...a),
  },
}))

const user = { id: 'm1', email: 'mia@acme.com', displayName: 'Mia' }
/** A Member: 2FA is available and optional. */
const memberOff = { ...user, roleName: 'Member', mfaAvailable: true, mfaRequired: false, mfaEnabled: false }
const memberOn = { ...memberOff, mfaEnabled: true }
const SETUP = {
  otpauthUrl: 'otpauth://totp/PON:mia@acme.com?secret=JBSWY3DPEHPK3PXP',
  secret: 'JBSWY3DPEHPK3PXP',
  qrDataUrl: 'data:image/png;base64,AAAA',
}
const CODES = Array.from({ length: 10 }, (_, i) => `MIAAA${i}-MIABB${i}`)

function serverError(status: number, data: unknown) {
  const config = { headers: new axios.AxiosHeaders() } as InternalAxiosRequestConfig
  return new axios.AxiosError('x', 'ERR_BAD_REQUEST', config, null, {
    status, statusText: '', headers: {}, config, data,
  } as AxiosResponse)
}

function renderSection() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <TwoFactorSection />
    </QueryClientProvider>,
  )
}

function typeCode(code: string, scope: HTMLElement = document.body) {
  const boxes = within(within(scope).getByRole('group', { name: 'auth.mfa.codeLabel' })).getAllByRole('textbox')
  code.split('').forEach((d, i) => fireEvent.change(boxes[i], { target: { value: d } }))
}

describe('Settings → Security: optional 2FA for Members (contract 15)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    getMe.mockReset()
    useAuthStore.setState({ user, accessToken: 'tok' })
    fetchMock.mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }) as unknown as typeof window.matchMedia
  })
  afterEach(() => vi.unstubAllGlobals())

  describe('turn on', () => {
    it('QR + key → one code → backup codes once behind the checkbox → On, with no session change', async () => {
      getMe.mockResolvedValueOnce(memberOff).mockResolvedValue(memberOn)
      selfMfaEnrollStart.mockResolvedValue(SETUP)
      selfMfaEnrollConfirm.mockResolvedValue({ code: 'MFA_BACKUP_CODES_ISSUED', backupCodes: CODES })
      renderSection()

      fireEvent.click(await screen.findByRole('button', { name: 'settings.security.turnOnButton' }))
      // Step 1: the QR and the manual key (grouped by four for typing).
      expect(await screen.findByAltText('auth.mfa.qrAlt')).toHaveAttribute('src', SETUP.qrDataUrl)
      expect(screen.getByTestId('mfa-secret')).toHaveTextContent('JBSW Y3DP EHPK 3PXP')
      expect(selfMfaEnrollStart).toHaveBeenCalledTimes(1)

      // Step 2: the sixth digit confirms.
      typeCode('123456')
      await waitFor(() => expect(screen.getAllByTestId('backup-code')).toHaveLength(10))
      expect(selfMfaEnrollConfirm).toHaveBeenCalledWith('123456')
      // The codes can only be left through the checkbox + Done.
      expect(screen.queryByTestId('two-factor-status')).toBeNull()
      const done = screen.getByRole('button', { name: 'settings.security.turnOnDone' })
      expect(done).toBeDisabled()
      fireEvent.click(screen.getByRole('checkbox', { name: 'auth.mfa.savedCheckbox' }))
      fireEvent.click(done)

      expect(await screen.findByTestId('two-factor-status')).toHaveTextContent('settings.security.twoFaOn')
      expect(screen.getByText('settings.security.twoFaOptionalOnBody')).toBeInTheDocument()
      expect(screen.queryByTestId('backup-code')).toBeNull()
      expect(toast.success).toHaveBeenCalledWith('settings.security.turnOnSuccess')
      expect(screen.getByRole('button', { name: 'settings.security.turnOffButton' })).toBeInTheDocument()
      // No session change: no cookie call, same token in memory.
      expect(fetchMock).not.toHaveBeenCalled()
      expect(useAuthStore.getState().accessToken).toBe('tok')
    })

    it('a wrong code stays in the flow with a localized count; Cancel goes back without changes', async () => {
      getMe.mockResolvedValue(memberOff)
      selfMfaEnrollStart.mockResolvedValue(SETUP)
      selfMfaEnrollConfirm.mockRejectedValue(
        serverError(400, { code: 'MFA_CODE_INVALID', params: { remaining: 4 }, message: 'bad totp' }),
      )
      renderSection()
      fireEvent.click(await screen.findByRole('button', { name: 'settings.security.turnOnButton' }))
      await screen.findByTestId('two-factor-enroll')
      typeCode('000000')

      expect(await screen.findByRole('alert')).toHaveTextContent('auth.errMfaCodeInvalidWithRemaining:{"remaining":4}')
      expect(screen.queryByText(/bad totp/)).toBeNull()
      expect(screen.getByTestId('mfa-secret')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))
      expect(await screen.findByTestId('two-factor-status')).toHaveTextContent('settings.security.twoFaOff')
      expect(screen.getByRole('button', { name: 'settings.security.turnOnButton' })).toBeInTheDocument()
    })

    it('too many wrong codes: a temporary lockout message, the same QR stays on screen', async () => {
      getMe.mockResolvedValue(memberOff)
      selfMfaEnrollStart.mockResolvedValue(SETUP)
      selfMfaEnrollConfirm.mockRejectedValue(serverError(400, { code: 'MFA_TOO_MANY_ATTEMPTS' }))
      renderSection()
      fireEvent.click(await screen.findByRole('button', { name: 'settings.security.turnOnButton' }))
      await screen.findByTestId('two-factor-enroll')
      typeCode('111111')

      expect(await screen.findByRole('alert')).toHaveTextContent('auth.mfa.rateLimited')
      expect(screen.getByTestId('two-factor-enroll')).toBeInTheDocument()
    })

    it('an expired setup (no pending secret) closes the flow and asks to start again', async () => {
      getMe.mockResolvedValue(memberOff)
      selfMfaEnrollStart.mockResolvedValue(SETUP)
      selfMfaEnrollConfirm.mockRejectedValue(serverError(400, { code: 'MFA_NOT_ENROLLED' }))
      renderSection()
      fireEvent.click(await screen.findByRole('button', { name: 'settings.security.turnOnButton' }))
      await screen.findByTestId('two-factor-enroll')
      typeCode('222222')

      expect(await screen.findByRole('alert')).toHaveTextContent('auth.mfa.setupExpired')
      expect(screen.queryByTestId('two-factor-enroll')).toBeNull()
      expect(screen.getByRole('button', { name: 'settings.security.turnOnButton' })).toBeInTheDocument()
    })

    it('already on elsewhere: explains it and re-reads /me instead of a sign-in message', async () => {
      getMe.mockResolvedValueOnce(memberOff).mockResolvedValue(memberOn)
      selfMfaEnrollStart.mockRejectedValue(serverError(400, { code: 'MFA_ALREADY_ENROLLED' }))
      renderSection()
      fireEvent.click(await screen.findByRole('button', { name: 'settings.security.turnOnButton' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('auth.mfa.stateChanged')
      await waitFor(() => expect(screen.getByTestId('two-factor-status')).toHaveTextContent('settings.security.twoFaOn'))
      expect(getMe).toHaveBeenCalledTimes(2)
      expect(screen.queryByText('auth.errMfaAlreadyEnrolled')).toBeNull()
    })
  })

  describe('turn off', () => {
    async function openTurnOff() {
      fireEvent.click(await screen.findByRole('button', { name: 'settings.security.turnOffButton' }))
      return screen.findByRole('dialog')
    }

    it('with a current authenticator code: 2FA is off and "Turn on 2FA" is back', async () => {
      getMe.mockResolvedValueOnce(memberOn).mockResolvedValue(memberOff)
      selfMfaDisable.mockResolvedValue({ success: true })
      renderSection()
      const dialog = await openTurnOff()
      expect(within(dialog).getByText('settings.security.turnOffTitle')).toBeInTheDocument()

      // No auto-submit on the sixth digit: turning off is an explicit choice.
      typeCode('654321', dialog)
      expect(selfMfaDisable).not.toHaveBeenCalled()
      fireEvent.click(within(dialog).getByRole('button', { name: 'settings.security.turnOffSubmit' }))

      await waitFor(() => expect(selfMfaDisable).toHaveBeenCalledWith({ code: '654321' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(toast.success).toHaveBeenCalledWith('settings.security.turnOffSuccess')
      expect(await screen.findByTestId('two-factor-status')).toHaveTextContent('settings.security.twoFaOff')
      expect(screen.getByRole('button', { name: 'settings.security.turnOnButton' })).toBeInTheDocument()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('with a backup code instead (normalised to XXXXX-XXXXX)', async () => {
      getMe.mockResolvedValueOnce(memberOn).mockResolvedValue(memberOff)
      selfMfaDisable.mockResolvedValue({ success: true })
      renderSection()
      const dialog = await openTurnOff()
      fireEvent.click(within(dialog).getByRole('button', { name: 'auth.mfa.useBackupCode' }))
      const input = within(dialog).getByLabelText('auth.mfa.backupCodeLabel')
      fireEvent.change(input, { target: { value: 'abcde 12345' } })
      expect(input).toHaveValue('ABCDE-12345')
      fireEvent.click(within(dialog).getByRole('button', { name: 'settings.security.turnOffSubmit' }))

      await waitFor(() => expect(selfMfaDisable).toHaveBeenCalledWith({ backupCode: 'ABCDE-12345' }))
    })

    it('validates locally before calling the server', async () => {
      getMe.mockResolvedValue(memberOn)
      renderSection()
      const dialog = await openTurnOff()
      fireEvent.click(within(dialog).getByRole('button', { name: 'settings.security.turnOffSubmit' }))
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('auth.mfa.codeIncomplete')

      fireEvent.click(within(dialog).getByRole('button', { name: 'auth.mfa.useBackupCode' }))
      fireEvent.change(within(dialog).getByLabelText('auth.mfa.backupCodeLabel'), { target: { value: 'ABC' } })
      fireEvent.click(within(dialog).getByRole('button', { name: 'settings.security.turnOffSubmit' }))
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('auth.mfa.backupCodeFormat')
      expect(selfMfaDisable).not.toHaveBeenCalled()
    })

    it('a wrong code stays in the dialog, localized — 2FA stays on', async () => {
      getMe.mockResolvedValue(memberOn)
      selfMfaDisable.mockRejectedValue(serverError(400, { code: 'MFA_CODE_INVALID', message: 'Invalid TOTP' }))
      renderSection()
      const dialog = await openTurnOff()
      typeCode('000000', dialog)
      fireEvent.click(within(dialog).getByRole('button', { name: 'settings.security.turnOffSubmit' }))

      expect(await within(dialog).findByRole('alert')).toHaveTextContent('auth.errMfaCodeInvalid')
      expect(screen.queryByText(/Invalid TOTP/)).toBeNull()
      expect(screen.getByTestId('two-factor-status')).toHaveTextContent('settings.security.twoFaOn')
      expect(toast.success).not.toHaveBeenCalled()
    })

    it('MFA_REQUIRED_BY_ROLE (promoted meanwhile): explains it and the section turns into the required state', async () => {
      getMe
        .mockResolvedValueOnce(memberOn)
        .mockResolvedValue({ ...memberOn, roleName: 'Admin', mfaRequired: true })
      selfMfaDisable.mockRejectedValue(serverError(400, { code: 'MFA_REQUIRED_BY_ROLE' }))
      renderSection()
      const dialog = await openTurnOff()
      typeCode('123123', dialog)
      fireEvent.click(within(dialog).getByRole('button', { name: 'settings.security.turnOffSubmit' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('auth.errMfaRequiredByRole')
      await waitFor(() => expect(screen.getByText('settings.security.twoFaEnabledBody')).toBeInTheDocument())
      expect(screen.queryByRole('button', { name: 'settings.security.turnOffButton' })).toBeNull()
    })
  })
})
