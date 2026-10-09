import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import axios from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import React from 'react'
import { TwoFactorSection } from '@/components/settings/TwoFactorSection'
import { useAuthStore } from '@/lib/store/auth.store'

const getMe = vi.fn()
const regenerateBackupCodes = vi.fn()

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, values?: Record<string, unknown>) =>
    `${ns ? `${ns}.` : ''}${key}${values ? `:${JSON.stringify(values)}` : ''}`,
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock('@/lib/api/auth', () => ({
  authService: {
    getMe: () => getMe(),
    regenerateBackupCodes: (...a: unknown[]) => regenerateBackupCodes(...a),
  },
}))

const me = { id: 'o1', email: 'owner@acme.com', displayName: 'Olga' }
/** Owner/Admin-like: 2FA mandatory. */
const REQUIRED = { mfaAvailable: true, mfaRequired: true }
/** Member: 2FA is their choice. */
const OPTIONAL = { mfaAvailable: true, mfaRequired: false }
const NEW_CODES = Array.from({ length: 10 }, (_, i) => `NEWAA${i}-NEWBB${i}`)

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

function buttonNames() {
  return screen.getAllByRole('button').map((b) => b.textContent?.trim())
}

function typeCode(code: string) {
  const boxes = within(screen.getByRole('group', { name: 'auth.mfa.codeLabel' })).getAllByRole('textbox')
  code.split('').forEach((d, i) => fireEvent.change(boxes[i], { target: { value: d } }))
}

describe('Settings → Security: two-factor section states (contract 15)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: me, accessToken: 'tok' })
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }) as unknown as typeof window.matchMedia
  })

  it('is hidden when the account can not use PON 2FA (SSO-enforced: the IdP does MFA)', async () => {
    getMe.mockResolvedValue({ ...me, mfaAvailable: false, mfaRequired: false, mfaEnabled: false })
    const { container } = renderSection()
    await waitFor(() => expect(getMe).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('falls back to mfaRequired on an older server without mfaAvailable', async () => {
    getMe.mockResolvedValue({ ...me, mfaRequired: false, mfaEnabled: false })
    const { container } = renderSection()
    await waitFor(() => expect(getMe).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('required by the role and on: "On" and regenerate, with no way to turn 2FA off', async () => {
    getMe.mockResolvedValue({ ...me, ...REQUIRED, mfaEnabled: true })
    renderSection()
    expect(await screen.findByTestId('two-factor-status')).toHaveTextContent('settings.security.twoFaOn')
    expect(screen.getByText('settings.security.twoFaEnabledBody')).toBeInTheDocument()
    expect(buttonNames()).toEqual(['settings.security.regenerateButton'])
  })

  it('required by the role but not set up yet: explains the setup at the next sign-in, no actions', async () => {
    getMe.mockResolvedValue({ ...me, ...REQUIRED, mfaEnabled: false })
    renderSection()
    expect(await screen.findByTestId('two-factor-status')).toHaveTextContent('settings.security.twoFaOff')
    expect(screen.getByText('settings.security.twoFaPendingBody')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('an older server (mfaRequired, no mfaAvailable) shows the required state', async () => {
    getMe.mockResolvedValue({ ...me, mfaRequired: true, mfaEnabled: false })
    renderSection()
    expect(await screen.findByText('settings.security.twoFaPendingBody')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('optional (Member) and off: the explanation and only "Turn on 2FA"', async () => {
    getMe.mockResolvedValue({ ...me, ...OPTIONAL, mfaEnabled: false })
    renderSection()
    expect(await screen.findByTestId('two-factor-status')).toHaveTextContent('settings.security.twoFaOff')
    expect(screen.getByText('settings.security.twoFaOptionalBody')).toBeInTheDocument()
    expect(buttonNames()).toEqual(['settings.security.turnOnButton'])
  })

  it('optional (Member) and on: "On", "Turn off 2FA" and regenerate', async () => {
    getMe.mockResolvedValue({ ...me, ...OPTIONAL, mfaEnabled: true })
    renderSection()
    expect(await screen.findByTestId('two-factor-status')).toHaveTextContent('settings.security.twoFaOn')
    expect(screen.getByText('settings.security.twoFaOptionalOnBody')).toBeInTheDocument()
    expect(buttonNames()).toEqual(['settings.security.turnOffButton', 'settings.security.regenerateButton'])
  })

  it('regenerates with the current code and shows the new codes once, behind the checkbox', async () => {
    getMe.mockResolvedValue({ ...me, ...REQUIRED, mfaEnabled: true })
    regenerateBackupCodes.mockResolvedValue({ backupCodes: NEW_CODES })
    renderSection()
    fireEvent.click(await screen.findByRole('button', { name: 'settings.security.regenerateButton' }))
    typeCode('246810')

    await waitFor(() => expect(screen.getAllByTestId('backup-code')).toHaveLength(10))
    expect(regenerateBackupCodes).toHaveBeenCalledWith('246810')
    const done = screen.getByRole('button', { name: 'settings.security.regenerateDone' })
    expect(done).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: 'auth.mfa.savedCheckbox' }))
    fireEvent.click(done)
    await waitFor(() => expect(screen.queryByTestId('backup-code')).toBeNull())
  })

  it('shows a wrong current code as a localized message', async () => {
    getMe.mockResolvedValue({ ...me, ...OPTIONAL, mfaEnabled: true })
    regenerateBackupCodes.mockRejectedValue(serverError(401, { code: 'MFA_CODE_INVALID', message: 'bad totp' }))
    renderSection()
    fireEvent.click(await screen.findByRole('button', { name: 'settings.security.regenerateButton' }))
    typeCode('000000')

    expect(await screen.findByRole('alert')).toHaveTextContent('auth.errMfaCodeInvalid')
    expect(screen.queryByText(/bad totp/)).not.toBeInTheDocument()
    expect(screen.queryByTestId('backup-code')).toBeNull()
  })
})
