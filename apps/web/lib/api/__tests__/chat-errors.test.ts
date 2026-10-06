/**
 * chat-service / friends error codes → specific localized messages. The server's
 * `message` text is English diagnostics and must never reach the UI.
 */

import { describe, it, expect } from 'vitest'
import axios from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import {
  chatErrorMessage,
  existingConversationId,
  parseChatError,
} from '@/lib/api/chat-errors'
import { friendErrorKey } from '@/lib/hooks/use-friends'

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}(${Object.values(values).join(',')})` : key

function httpError(status: number, data: unknown) {
  const config = { url: '/x', headers: new axios.AxiosHeaders() } as InternalAxiosRequestConfig
  return new axios.AxiosError('failed', 'ERR_BAD_REQUEST', config, null, {
    status, statusText: '', headers: {}, config, data,
  } as AxiosResponse)
}

describe('chat error mapping', () => {
  it.each([
    ['GROUP_ADMIN_REQUIRED', 403, 'errGroupAdminRequired'],
    ['USER_BLOCKED', 403, 'errUserBlocked'],
    ['REPLY_TARGET_INVALID', 400, 'errReplyTargetInvalid'],
    ['MESSAGE_TYPE_NOT_ALLOWED', 400, 'errMessageTypeNotAllowed'],
    ['INVALID_URL', 400, 'errInvalidUrl'],
    ['INVALID_PARAMETER', 400, 'errInvalidParameter'],
    ['NOT_A_GROUP', 400, 'errNotAGroup'],
    ['NOT_A_MEMBER', 404, 'errNotAMember'],
    ['LAST_ADMIN_CANNOT_BE_REMOVED', 409, 'errLastAdminCannotBeRemoved'],
    ['PUBLIC_DEPARTMENT_CHANNEL_NOT_ALLOWED', 400, 'errPublicDepartmentChannel'],
  ])('%s → %s', (code, status, key) => {
    expect(chatErrorMessage(httpError(status, { code, message: 'internal text' }), t, 'fallback')).toBe(key)
  })

  it('PIN_LIMIT_REACHED carries the server max (default 5)', () => {
    expect(
      chatErrorMessage(httpError(409, { code: 'PIN_LIMIT_REACHED', params: { max: 5 } }), t, 'pinError'),
    ).toBe('pinLimitReached(5)')
    expect(chatErrorMessage(httpError(409, { code: 'PIN_LIMIT_REACHED' }), t, 'pinError')).toBe(
      'pinLimitReached(5)',
    )
  })

  it('code-less 429 is a rate-limit message; no response is a network message', () => {
    expect(chatErrorMessage(httpError(429, { error: 'Too Many Requests' }), t, 'fallback')).toBe('errRateLimited')
    const offline = new axios.AxiosError('Network Error', 'ERR_NETWORK')
    expect(chatErrorMessage(offline, t, 'fallback')).toBe('errNetwork')
  })

  it('unknown errors fall back to the caller key, never the raw message', () => {
    expect(chatErrorMessage(httpError(500, { error: 'Internal server error' }), t, 'sendMessageError')).toBe(
      'sendMessageError',
    )
    expect(chatErrorMessage(new Error('boom'), t, 'sendMessageError')).toBe('sendMessageError')
    expect(parseChatError('nope')).toEqual({})
  })

  it('reads the existing conversation id from a 409', () => {
    expect(existingConversationId(httpError(409, { conversationId: 'c9' }))).toBe('c9')
    expect(existingConversationId(httpError(400, { conversationId: 'c9' }))).toBeUndefined()
    expect(existingConversationId(httpError(409, {}))).toBeUndefined()
  })

  it('friend actions map USER_BLOCKED (auth-service top-level code)', () => {
    expect(friendErrorKey(httpError(403, { code: 'USER_BLOCKED' }), 'sendRequestError')).toBe('errUserBlocked')
    expect(friendErrorKey(httpError(500, {}), 'sendRequestError')).toBe('sendRequestError')
  })
})
