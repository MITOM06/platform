import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import axios from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import React from 'react'
import { SsoPanel } from '@/components/admin/SsoPanel'
import type { UpdateWorkspaceInput, Workspace } from '@/lib/api/admin-types'

type MutateOptions = { onError?: (err: unknown) => void }

const state = vi.hoisted(() => ({ workspace: undefined as Workspace | undefined }))
const mutate = vi.hoisted(() => vi.fn<(input: UpdateWorkspaceInput, opts?: MutateOptions) => void>())

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}))
// The panel lets only an Owner map groups to Owner; these tests run as one.
vi.mock('@/lib/hooks/use-capabilities', () => ({
  useCapabilities: () => ({ data: { role: 'Owner', perms: [] } }),
}))
vi.mock('@/lib/hooks/use-admin', () => ({
  useWorkspace: () => ({ data: state.workspace, isLoading: false }),
  useUpdateWorkspace: () => ({ mutate, isPending: false }),
  useRoles: () => ({ data: [] }),
  useDepartments: () => ({ data: [] }),
}))

function workspace(sso: Partial<NonNullable<Workspace['sso']>>): Workspace {
  return {
    _id: 'ws',
    name: 'Acme',
    features: {},
    connectorAllowList: [],
    sso: { enabled: true, allowedDomains: ['acme.com'], groupRoleMap: {}, groupDeptMap: {}, ...sso },
  }
}

function serverError(status: number, data: unknown) {
  const config = { headers: new axios.AxiosHeaders() } as InternalAxiosRequestConfig
  return new axios.AxiosError('x', 'ERR_BAD_REQUEST', config, null, {
    status, statusText: '', headers: {}, config, data,
  } as AxiosResponse)
}

// `hidden: true`: while the confirm dialog is open the rest of the page is aria-hidden.
const requireSso = () => screen.getByRole('switch', { name: 'admin.ssoEnforced', hidden: true })
const save = () => fireEvent.click(screen.getByRole('button', { name: /admin\.save/ }))
const savedSso = () => mutate.mock.calls.at(-1)?.[0].sso

describe('Admin → SSO: "Require SSO for these domains" (contract 13 C)', () => {
  beforeEach(() => {
    mutate.mockReset()
    state.workspace = workspace({})
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }) as unknown as typeof window.matchMedia
  })

  it('asks for confirmation, spelling out every consequence, before turning it on', () => {
    render(<SsoPanel />)
    expect(requireSso()).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(requireSso())

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('admin.ssoEnforceConfirmTitle')).toBeInTheDocument()
    const items = within(within(dialog).getByTestId('sso-enforce-consequences')).getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual([
      'admin.ssoEnforceConfirmPasswords',
      'admin.ssoEnforceConfirmOwners',
      'admin.ssoEnforceConfirmSessions',
      'admin.ssoEnforceConfirmRestore',
    ])
    // Not switched on until confirmed.
    expect(requireSso()).toHaveAttribute('aria-checked', 'false')
  })

  it('cancelling leaves it off and saves nothing', () => {
    render(<SsoPanel />)
    fireEvent.click(requireSso())
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'admin.cancel' }))

    expect(requireSso()).toHaveAttribute('aria-checked', 'false')
    expect(mutate).not.toHaveBeenCalled()
  })

  it('confirming turns it on (pending until Save) and Save sends enforced: true', () => {
    render(<SsoPanel />)
    fireEvent.click(requireSso())
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'admin.ssoEnforceConfirm' }))

    expect(requireSso()).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('sso-enforce-unsaved')).toHaveTextContent('admin.ssoEnforceSaveHint')
    expect(mutate).not.toHaveBeenCalled()

    save()
    expect(savedSso()).toMatchObject({ enabled: true, enforced: true, allowedDomains: ['acme.com'] })
  })

  it('is refused locally (no dialog) while SSO is off or no domain is listed', () => {
    state.workspace = workspace({ enabled: true, allowedDomains: [] })
    render(<SsoPanel />)
    fireEvent.click(requireSso())

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(requireSso()).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByTestId('sso-enforce-error')).toHaveTextContent('auth.errSsoEnforceNotReady')
  })

  it('shows SSO_ENFORCE_NOT_READY from the server next to the switch (localized, never raw)', () => {
    mutate.mockImplementation((_input, opts) =>
      opts?.onError?.(serverError(400, { code: 'SSO_ENFORCE_NOT_READY', message: 'OIDC not configured' })),
    )
    render(<SsoPanel />)
    fireEvent.click(requireSso())
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'admin.ssoEnforceConfirm' }))
    save()

    expect(screen.getByTestId('sso-enforce-error')).toHaveTextContent('auth.errSsoEnforceNotReady')
    expect(screen.queryByText(/OIDC not configured/)).toBeNull()
  })

  it('turning it off needs no confirmation and saves enforced: false', () => {
    state.workspace = workspace({ enforced: true })
    render(<SsoPanel />)
    expect(requireSso()).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(requireSso())
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(requireSso()).toHaveAttribute('aria-checked', 'false')

    save()
    expect(savedSso()).toMatchObject({ enforced: false })
  })

  it('turning SSO itself off releases "Require SSO" too', () => {
    state.workspace = workspace({ enforced: true })
    render(<SsoPanel />)
    const [enableSso] = screen.getAllByRole('switch')
    fireEvent.click(enableSso)

    expect(requireSso()).toHaveAttribute('aria-checked', 'false')
    save()
    expect(savedSso()).toMatchObject({ enabled: false, enforced: false })
  })
})
