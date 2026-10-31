import { fireEvent, screen, waitFor } from '@testing-library/react'
import { expect, vi } from 'vitest'

/** jsdom has no Clipboard API. Pass `undefined` for a browser without one (plain HTTP). */
export function stubClipboard(clipboard?: { writeText: (text: string) => Promise<void> }) {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard })
}

/** A successful Copy: the step that unlocks "I saved my backup codes". */
export async function copyBackupCodes() {
  stubClipboard({ writeText: vi.fn().mockResolvedValue(undefined) })
  fireEvent.click(screen.getByRole('button', { name: 'auth.mfa.copyCodes' }))
  await waitFor(() => expect(screen.getByRole('checkbox', { name: 'auth.mfa.savedCheckbox' })).toBeEnabled())
}
