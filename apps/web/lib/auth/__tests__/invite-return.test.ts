import { beforeEach, describe, expect, it } from 'vitest'
import {
  forgetInviteReturn,
  inviteReturnPath,
  isInviteRetryNotice,
  rememberInviteReturn,
} from '@/lib/auth/invite-return'

const KEY = 'pon:auth:invite-return'

describe('invite-return: a failed Google sign-in goes back to its invitation', () => {
  beforeEach(() => sessionStorage.clear())

  it('Google outcomes worth retrying go back to the invitation; a dead invitation does not', () => {
    expect(isInviteRetryNotice('SOCIAL_LOGIN_CANCELLED')).toBe(true)
    expect(isInviteRetryNotice('SOCIAL_LOGIN_FAILED')).toBe(true)
    expect(isInviteRetryNotice('INVITATION_EMAIL_MISMATCH')).toBe(true)
    expect(isInviteRetryNotice('INVITE_GOOGLE_FLOW_EXPIRED')).toBe(true)
    expect(isInviteRetryNotice('INVITATION_REVOKED')).toBe(false)
    expect(isInviteRetryNotice(null)).toBe(false)
  })

  it('a cancelled attempt returns to the remembered invitation', () => {
    rememberInviteReturn('tok/1')
    expect(inviteReturnPath('SOCIAL_LOGIN_CANCELLED')).toBe('/invite/tok%2F1?reason=SOCIAL_LOGIN_CANCELLED')
  })

  // QC 2026-10-27: wrong account → back on the invitation → Back to Google's
  // chooser → wrong account again landed on /login, the memory already spent.
  it('every failed attempt returns to the invitation, not just the first', () => {
    rememberInviteReturn('tok-1')
    expect(inviteReturnPath('INVITATION_EMAIL_MISMATCH')).toBe('/invite/tok-1?reason=INVITATION_EMAIL_MISMATCH')
    expect(inviteReturnPath('INVITATION_EMAIL_MISMATCH')).toBe('/invite/tok-1?reason=INVITATION_EMAIL_MISMATCH')
    expect(inviteReturnPath('SOCIAL_LOGIN_CANCELLED')).toBe('/invite/tok-1?reason=SOCIAL_LOGIN_CANCELLED')
  })

  it('a round trip past the 10-minute invite flow still finds its invitation', () => {
    rememberInviteReturn('tok-1')
    expect(inviteReturnPath('INVITE_GOOGLE_FLOW_EXPIRED', Date.now() + 11 * 60 * 1000)).toBe(
      '/invite/tok-1?reason=INVITE_GOOGLE_FLOW_EXPIRED',
    )
  })

  it('any other code goes to the login page and still clears the memory', () => {
    rememberInviteReturn('tok-1')
    expect(inviteReturnPath('INVITATION_REVOKED')).toBeNull()
    expect(sessionStorage.getItem(KEY)).toBeNull()
  })

  it('nothing remembered, an expired memory or a malformed one → login page', () => {
    expect(inviteReturnPath('SOCIAL_LOGIN_FAILED')).toBeNull()

    rememberInviteReturn('tok-1')
    expect(inviteReturnPath('SOCIAL_LOGIN_FAILED', Date.now() + 61 * 60 * 1000)).toBeNull()
    expect(sessionStorage.getItem(KEY)).toBeNull()

    sessionStorage.setItem(KEY, '{not json')
    expect(inviteReturnPath('SOCIAL_LOGIN_FAILED')).toBeNull()
    expect(sessionStorage.getItem(KEY)).toBeNull()
  })

  it('a plain Google sign-in forgets an earlier invitation', () => {
    rememberInviteReturn('tok-1')
    forgetInviteReturn()
    expect(inviteReturnPath('SOCIAL_LOGIN_CANCELLED')).toBeNull()
  })
})
