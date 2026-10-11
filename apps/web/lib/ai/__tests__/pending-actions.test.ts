import { describe, it, expect } from 'vitest'
import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import {
  actionCardState,
  actionErrorOutcome,
  actionSummaryView,
  responseStatus,
  withActionStatus,
} from '@/lib/ai/pending-actions'
import type { AiPendingAction, Message } from '@/lib/api/types'

const NOW = Date.parse('2026-10-05T10:00:00Z')
const pending = (over: Partial<AiPendingAction> = {}): AiPendingAction => ({
  id: 'a1',
  status: 'pending',
  requesterId: 'me',
  expiresAt: '2026-10-05T10:10:00Z',
  ...over,
})

function httpErr(status: number, data: unknown) {
  const config = { headers: new axios.AxiosHeaders() } as InternalAxiosRequestConfig
  return new axios.AxiosError('x', 'ERR_BAD_REQUEST', config, null, {
    status, statusText: '', headers: {}, config, data,
  } as AxiosResponse)
}

describe('confirmation card state', () => {
  it('requester + pending + not expired ⇒ buttons', () => {
    expect(actionCardState(pending(), 'me', NOW)).toEqual({ kind: 'actionable' })
  })

  it('someone else sees who has to decide', () => {
    expect(actionCardState(pending(), 'bob', NOW)).toEqual({ kind: 'waiting', requesterId: 'me' })
  })

  it('past expiresAt ⇒ expired, for everyone', () => {
    const late = Date.parse('2026-10-05T10:10:00Z')
    expect(actionCardState(pending(), 'me', late)).toEqual({ kind: 'expired' })
    expect(actionCardState(pending(), 'bob', late)).toEqual({ kind: 'expired' })
  })

  it('a resolved server status always wins over the local outcome', () => {
    expect(actionCardState(pending({ status: 'failed' }), 'me', NOW, 'confirmed')).toEqual({ kind: 'failed' })
    expect(actionCardState(pending({ status: 'cancelled' }), 'bob', NOW)).toEqual({ kind: 'cancelled' })
  })

  it('my optimistic outcome shows until MESSAGE_UPDATED arrives', () => {
    expect(actionCardState(pending(), 'me', NOW, 'confirmed')).toEqual({ kind: 'confirmed' })
    expect(actionCardState(pending(), 'me', NOW, 'handled')).toEqual({ kind: 'handled' })
  })

  it('unknown server statuses never show buttons', () => {
    expect(actionCardState(pending({ status: 'weird' }), 'me', NOW)).toEqual({ kind: 'expired' })
  })
})

describe('confirm / cancel errors', () => {
  it('maps every documented code', () => {
    expect(actionErrorOutcome(httpErr(404, { code: 'ACTION_NOT_FOUND' }))).toEqual({ key: 'aiActionErrNotFound', outcome: 'expired' })
    expect(actionErrorOutcome(httpErr(403, { code: 'ACTION_NOT_OWNER' }))).toEqual({ key: 'aiActionErrNotOwner', outcome: null })
    expect(actionErrorOutcome(httpErr(409, { code: 'ACTION_ALREADY_RESOLVED' }))).toEqual({ key: 'aiActionErrAlreadyResolved', outcome: 'handled' })
    expect(actionErrorOutcome(httpErr(410, { code: 'ACTION_EXPIRED' }))).toEqual({ key: 'aiActionErrExpired', outcome: 'expired' })
  })

  it('network / unknown errors keep the buttons with a generic message', () => {
    const config = { headers: new axios.AxiosHeaders() } as InternalAxiosRequestConfig
    expect(actionErrorOutcome(new axios.AxiosError('n', 'ERR_NETWORK', config))).toEqual({ key: 'errNetwork', outcome: null })
    expect(actionErrorOutcome(httpErr(500, { message: 'boom' }))).toEqual({ key: 'aiActionErrGeneric', outcome: null })
    expect(actionErrorOutcome(new Error('x'))).toEqual({ key: 'aiActionErrGeneric', outcome: null })
  })

  it('reads the response status', () => {
    expect(responseStatus({ status: 'confirmed' })).toBe('confirmed')
    expect(responseStatus({ status: 'failed' })).toBe('failed')
    expect(responseStatus({ status: 'x' })).toBeNull()
    expect(responseStatus(null)).toBeNull()
  })
})

describe('action summary', () => {
  it('email: headline + recipients + subject, never the tool name', () => {
    const v = actionSummaryView({ kind: 'send_email', to: 'a@x.io', subject: 'Q3' }, 'en')
    expect(v.titleKey).toBe('aiActionSendEmail')
    expect(v.lines).toEqual([
      { labelKey: 'aiActionFieldTo', value: 'a@x.io' },
      { labelKey: 'aiActionFieldSubject', value: 'Q3' },
    ])
  })

  it('event: a localized time range', () => {
    const v = actionSummaryView(
      { kind: 'create_event', title: 'Sync', start: '2026-10-06', end: '2026-10-07' },
      'en',
    )
    expect(v.titleKey).toBe('aiActionCreateEvent')
    expect(v.lines[0]).toEqual({ labelKey: 'aiActionFieldTitle', value: 'Sync' })
    expect(v.lines[1]).toMatchObject({ labelKey: 'aiActionFieldWhen' })
    expect(v.lines[1]!.value).toContain('2026')
  })

  it('generic: the humanized display name, or a plain headline', () => {
    expect(actionSummaryView({ kind: 'generic', tool: 'Create issue' }, 'en')).toEqual({
      titleKey: 'aiActionGenericNamed',
      titleValues: { tool: 'Create issue' },
      lines: [],
    })
    expect(actionSummaryView(undefined, 'en').titleKey).toBe('aiActionGeneric')
  })

  it('email: Cc, Bcc and a preview of the message when the server sends them', () => {
    const v = actionSummaryView(
      {
        kind: 'draft_email', to: 'a@x.io', cc: 'b@x.io, c@x.io', bcc: 'd@x.io', subject: 'Q3',
        bodyPreview: 'Hi team,\n\nthe numbers   are in.',
      },
      'en',
    )
    expect(v.lines).toEqual([
      { labelKey: 'aiActionFieldTo', value: 'a@x.io' },
      { labelKey: 'aiActionFieldCc', value: 'b@x.io, c@x.io' },
      { labelKey: 'aiActionFieldBcc', value: 'd@x.io' },
      { labelKey: 'aiActionFieldSubject', value: 'Q3' },
      { labelKey: 'aiActionFieldBody', value: 'Hi team, the numbers are in.' },
    ])
  })

  it('event: the attendees after the time', () => {
    const v = actionSummaryView(
      { kind: 'update_event', title: 'Sync', start: '2026-10-06', attendees: 'Ann, Bob' },
      'en',
    )
    expect(v.lines.map((l) => ('labelKey' in l ? l.labelKey : l.label))).toEqual([
      'aiActionFieldTitle',
      'aiActionFieldWhen',
      'aiActionFieldAttendees',
    ])
    expect(v.lines[2]!.value).toBe('Ann, Bob')
  })

  it('older servers (no new fields) show exactly what they did before', () => {
    expect(actionSummaryView({ kind: 'send_email', to: 'a@x.io' }, 'en').lines).toEqual([
      { labelKey: 'aiActionFieldTo', value: 'a@x.io' },
    ])
  })

  it('generic: "label: value" rows from the server-humanized fields', () => {
    const v = actionSummaryView(
      {
        kind: 'generic',
        tool: 'Create issue',
        fields: [
          { label: 'Title', value: 'Fix login' },
          { label: '  Priority ', value: 'High' },
        ],
      },
      'en',
    )
    expect(v.lines).toEqual([
      { label: 'Title', value: 'Fix login' },
      { label: 'Priority', value: 'High' },
    ])
  })

  it('generic: never shows raw ids or malformed rows', () => {
    const v = actionSummaryView(
      {
        kind: 'generic',
        fields: [
          { label: 'Owner', value: '64b7f0c2a1b2c3d4e5f60718' },
          { label: 'Page', value: '3f2504e0-4f89-11d3-9a0c-0305e82c3301' },
          { label: 'Database', value: '3f2504e04f8911d39a0c0305e82c3301' },
          { label: '', value: 'no label' },
          { label: 'Empty', value: '   ' },
          { label: 'Count', value: 3 },
          'not a row',
          { label: 'Status', value: 'Open' },
        ],
      },
      'en',
    )
    expect(v.lines).toEqual([{ label: 'Status', value: 'Open' }])
  })

  it('generic: a fields value that is not a list is ignored', () => {
    expect(actionSummaryView({ kind: 'generic', fields: 'Title: x' }, 'en').lines).toEqual([])
  })
})

describe('withActionStatus', () => {
  it('patches only the matching action', () => {
    const msg = {
      id: 'm', pendingActions: [pending(), pending({ id: 'a2' })],
    } as unknown as Message
    const next = withActionStatus(msg, 'a2', 'cancelled')
    expect(next.pendingActions!.map((a) => a.status)).toEqual(['pending', 'cancelled'])
    expect(withActionStatus(msg, 'zz', 'cancelled')).toBe(msg)
  })
})
