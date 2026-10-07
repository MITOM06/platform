/** Errors of LiveKitSession — typed so the UI maps them to localized text, never browser/SDK text. */

/** The user cancelled the browser's share picker, or the source is not allowed. */
export class ScreenShareError extends Error {
  constructor() {
    super('screen share refused')
  }
}

/** The browser refused (or has no) microphone/camera. Maps to `media_error`. */
export class MediaAccessError extends Error {
  constructor() {
    super('media access refused')
  }
}

/** Could not reach or join the room. Maps to `failed`. */
export class RoomConnectError extends Error {
  constructor() {
    super('room connection failed')
  }
}

export const MEDIA_ERRORS = new Set([
  'NotAllowedError',
  'NotFoundError',
  'NotReadableError',
  'OverconstrainedError',
  'SecurityError',
])

/** Errors from the share picker that mean "the user said no", not "it broke". */
export const SHARE_REFUSED = new Set(['NotAllowedError', 'AbortError', 'SecurityError'])

export function errorName(err: unknown): string | undefined {
  const name = (err as { name?: unknown } | null)?.name
  return typeof name === 'string' ? name : undefined
}
