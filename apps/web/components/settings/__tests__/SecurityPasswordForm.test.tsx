import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import axios from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { toast } from 'sonner'
import SecurityPage from '@/app/(main)/settings/security/page'
import { useAuthStore } from '@/lib/store/auth.store'

const changePassword = vi.fn()

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/settings/TwoFactorSection', () => ({ TwoFactorSection: () => null }))
vi.mock('@/lib/api/auth', () => ({
  authService: {
    changePassword: (...a: unknown[]) => changePassword(...a),
    getMe: () => Promise.resolve({ id: 'u1', email: 'alice@acme.com', displayName: 'Alice', hasPassword: true }),
  },
}))

const T = 'settings.security'
const GOOD = 'Secret#123'

function httpErr(data: unknown) {
  const config = { headers: new axios.AxiosHeaders() } as InternalAxiosRequestConfig
  return new axios.AxiosError('x', 'ERR_BAD_REQUEST', config, null, {
    status: 400, statusText: '', headers: {}, config, data,
  } as AxiosResponse)
}

const current = () => screen.getByLabelText(`${T}.currentLabel`)
const next = () => screen.getByLabelText(`${T}.newLabel`)
const confirm = () => screen.getByLabelText(`${T}.confirmLabel`)
const type = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } })
const submit = () => fireEvent.click(screen.getByRole('button', { name: `${T}.changeButton` }))

/** The message rendered under an input (its aria-describedby target). */
function errorOf(input: HTMLElement): string | null {
  const id = input.getAttribute('aria-describedby')
  return id ? document.getElementById(id)?.textContent ?? null : null
}

describe('Settings → Security: password form validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      user: { id: 'u1', email: 'alice@acme.com', displayName: 'Alice', hasPassword: true },
      accessToken: 'tok',
    })
    render(<SecurityPage />)
  })

  it('shows nothing before the first submit', () => {
    type(current(), 'old')
    type(next(), 'a')
    expect(errorOf(next())).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('an empty submit marks each empty input under itself and sends nothing', () => {
    submit()
    expect(errorOf(current())).toBe(`${T}.currentRequired`)
    expect(errorOf(next())).toBe(`${T}.newRequired`)
    expect(errorOf(confirm())).toBeNull()
    expect(current()).toHaveAttribute('aria-invalid', 'true')
    expect(current()).toHaveFocus()
    // Not the strength checklist's "≥8 characters" chip, and no form-wide banner.
    expect(screen.queryByRole('alert')).toBeNull()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('after a submit, each input is re-checked as the user types', () => {
    type(current(), 'old-password')
    submit()
    expect(errorOf(current())).toBeNull()

    type(next(), 'secret#123')
    expect(errorOf(next())).toBe(`${T}.needUppercase`)
    type(next(), GOOD)
    expect(errorOf(next())).toBeNull()
    expect(errorOf(confirm())).toBe(`${T}.mismatch`)
    type(confirm(), GOOD)
    expect(errorOf(confirm())).toBeNull()
  })

  it('a wrong current password is shown under that input and cleared by editing it', async () => {
    changePassword.mockRejectedValue(httpErr({ code: 'CURRENT_PASSWORD_INCORRECT' }))
    type(current(), 'wrong-password')
    type(next(), GOOD)
    type(confirm(), GOOD)
    submit()

    await waitFor(() => expect(errorOf(current())).toBe(`${T}.incorrectCurrent`))
    expect(changePassword).toHaveBeenCalledWith('wrong-password', GOOD)
    expect(screen.queryByRole('alert')).toBeNull()
    await waitFor(() => expect(current()).toHaveFocus())

    type(current(), 'wrong-password2')
    expect(errorOf(current())).toBeNull()
  })

  it('a network failure is a form-wide message', async () => {
    changePassword.mockRejectedValue(new axios.AxiosError('Network Error', 'ERR_NETWORK'))
    type(current(), 'old-password')
    type(next(), GOOD)
    type(confirm(), GOOD)
    submit()

    expect(await screen.findByRole('alert')).toHaveTextContent(`${T}.networkError`)
    expect(errorOf(current())).toBeNull()
  })

  it('after a successful change the form is empty again, without "required" errors', async () => {
    changePassword.mockResolvedValue(undefined)
    type(current(), 'old-password')
    type(next(), GOOD)
    type(confirm(), GOOD)
    submit()

    await waitFor(() => expect(next()).toHaveValue(''))
    expect(errorOf(current())).toBeNull()
    expect(errorOf(next())).toBeNull()
  })

  it('a successful change stays confirmed in the card until the form is touched again', async () => {
    changePassword.mockResolvedValue(undefined)
    type(current(), 'old-password')
    type(next(), GOOD)
    type(confirm(), GOOD)
    submit()

    const done = await screen.findByRole('status')
    expect(done).toHaveTextContent(`${T}.changeSuccess`)
    expect(done).toHaveTextContent(`${T}.changeDoneBody`)
    // In the card, not a toast that fades out.
    expect(toast.success).not.toHaveBeenCalled()

    type(current(), 'o')
    expect(screen.queryByRole('status')).toBeNull()
  })
})
