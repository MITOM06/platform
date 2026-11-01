import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { toast } from 'sonner'
import { BackupCodesPanel } from '@/components/auth/mfa/BackupCodesPanel'
import { stubClipboard } from './backup-codes-helpers'

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, values?: Record<string, unknown>) =>
    `${ns ? `${ns}.` : ''}${key}${values ? `:${JSON.stringify(values)}` : ''}`,
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

const CODES = ['AAAA1-BBBB1', 'AAAA2-BBBB2']
const HINT = 'auth.mfa.copyOrDownloadFirst'

const savedBox = () => screen.getByRole('checkbox', { name: 'auth.mfa.savedCheckbox' })
const continueBtn = () => screen.getByRole('button', { name: 'Continue' })
const copyBtn = () => screen.getByRole('button', { name: 'auth.mfa.copyCodes' })
const downloadBtn = () => screen.getByRole('button', { name: 'auth.mfa.downloadCodes' })

describe('BackupCodesPanel: the checkbox is locked until the codes were taken', () => {
  const onContinue = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    stubClipboard(undefined)
    render(<BackupCodesPanel codes={CODES} accountEmail="owner@acme.com" continueLabel="Continue" onContinue={onContinue} />)
  })
  afterEach(() => vi.restoreAllMocks())

  /** Download with the browser's file save replaced: jsdom has neither blob URLs nor navigation. */
  function stubDownload() {
    URL.createObjectURL = vi.fn().mockReturnValue('blob:codes')
    URL.revokeObjectURL = vi.fn()
    return vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  }

  it('starts locked: the hint is visible and neither the box nor its label can tick it', () => {
    expect(savedBox()).toBeDisabled()
    expect(continueBtn()).toBeDisabled()
    expect(screen.getByText(HINT)).toBeInTheDocument()
    expect(savedBox()).toHaveAccessibleDescription(HINT)

    fireEvent.click(savedBox())
    fireEvent.click(screen.getByText('auth.mfa.savedCheckbox'))

    expect(savedBox()).not.toBeChecked()
    expect(continueBtn()).toBeDisabled()
  })

  it('a successful Copy unlocks it; ticking then enables Continue', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard({ writeText })

    fireEvent.click(copyBtn())
    await waitFor(() => expect(savedBox()).toBeEnabled())

    expect(writeText).toHaveBeenCalledWith(CODES.join('\n'))
    expect(toast.success).toHaveBeenCalledWith('auth.mfa.codesCopied')
    expect(screen.queryByText(HINT)).not.toBeInTheDocument()
    // Unlocked is not ticked: the user still has to confirm.
    expect(savedBox()).not.toBeChecked()
    expect(continueBtn()).toBeDisabled()

    fireEvent.click(savedBox())
    fireEvent.click(continueBtn())
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('clicking Download .txt unlocks it', () => {
    const clicked = stubDownload()

    fireEvent.click(downloadBtn())

    expect(clicked).toHaveBeenCalledTimes(1)
    expect(savedBox()).toBeEnabled()
    expect(screen.queryByText(HINT)).not.toBeInTheDocument()
  })

  it('a failed Copy stays locked and shows the localized error, never the raw one', async () => {
    stubClipboard({ writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError: raw browser text')) })

    fireEvent.click(copyBtn())
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('auth.mfa.copyFailed'))

    expect(toast.success).not.toHaveBeenCalled()
    expect(savedBox()).toBeDisabled()
    expect(screen.getByText(HINT)).toBeInTheDocument()
    expect(screen.queryByText(/NotAllowedError/)).not.toBeInTheDocument()
  })

  it('a browser without the Clipboard API (plain HTTP) stays locked, and Download is the way out', async () => {
    const clicked = stubDownload()

    fireEvent.click(copyBtn())
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('auth.mfa.copyFailed'))
    expect(savedBox()).toBeDisabled()

    fireEvent.click(downloadBtn())
    expect(clicked).toHaveBeenCalledTimes(1)
    expect(savedBox()).toBeEnabled()
  })
})
