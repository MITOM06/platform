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

  it('only cancelled / refused Google sign-ins are retried from the invitation', () => {
    expect(isInviteRetryNotice('SOCIAL_LOGIN_CANCELLED')).toBe(true)
    expect(isInviteRetryNotice('SOCIAL_LOGIN_FAILED')).toBe(true)
    expect(isInviteRetryNotice('INVITATION_EMAIL_MISMATCH')).toBe(false)
    expect(isInviteRetryNotice(null)).toBe(false)
  })

  it('a cancelled attempt returns to the remembered invitation, once', () => {
    rememberInviteReturn('tok/1')
    expect(inviteReturnPath('SOCIAL_LOGIN_CANCELLED')).toBe('/invite/tok%2F1?reason=SOCIAL_LOGIN_CANCELLED')
    expect(inviteReturnPath('SOCIAL_LOGIN_CANCELLED')).toBeNull()
  })

  it('any other code goes to the login page and still clears the memory', () => {
    rememberInviteReturn('tok-1')
    expect(inviteReturnPath('INVITATION_EMAIL_MISMATCH')).toBeNull()
    expect(sessionStorage.getItem(KEY)).toBeNull()
  })

  it('nothing remembered, an expired memory or a malformed one → login page', () => {
    expect(inviteReturnPath('SOCIAL_LOGIN_FAILED')).toBeNull()

    rememberInviteReturn('tok-1')
    expect(inviteReturnPath('SOCIAL_LOGIN_FAILED', Date.now() + 11 * 60 * 1000)).toBeNull()

    sessionStorage.setItem(KEY, '{not json')
    expect(inviteReturnPath('SOCIAL_LOGIN_FAILED')).toBeNull()
  })

  it('a plain Google sign-in forgets an earlier invitation', () => {
    rememberInviteReturn('tok-1')
    forgetInviteReturn()
    expect(inviteReturnPath('SOCIAL_LOGIN_CANCELLED')).toBeNull()
  })
})
