import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { ConnectorCard } from '@/components/integrations/ConnectorCard'
import type { CatalogEntry } from '@/lib/api/connector-types'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

const gmail: CatalogEntry = {
  id: 'gmail',
  name: 'Gmail',
  icon: 'gmail',
  description: 'Draft and send email on your behalf.',
  scopes: [],
  authType: 'oauth2',
  available: true,
}

function renderCard(entry: CatalogEntry) {
  return render(
    <ConnectorCard
      entry={entry}
      connection={undefined}
      connecting={false}
      canConnect
      onConnect={() => {}}
      onManage={() => {}}
    />,
  )
}

describe('ConnectorCard — workspace allow-list', () => {
  it('a connector the allow-list leaves out says so and cannot be connected', () => {
    renderCard({ ...gmail, allowedByWorkspace: false })
    expect(screen.getByText('statusNotAllowed')).toBeTruthy()
    expect(screen.queryByText('statusAvailable')).toBeNull()
    expect(screen.getByText('connectNotAllowed')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'connect' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('an allowed connector stays available and connectable', () => {
    renderCard({ ...gmail, allowedByWorkspace: true })
    expect(screen.getByText('statusAvailable')).toBeTruthy()
    expect(screen.queryByText('connectNotAllowed')).toBeNull()
    expect((screen.getByRole('button', { name: 'connect' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
