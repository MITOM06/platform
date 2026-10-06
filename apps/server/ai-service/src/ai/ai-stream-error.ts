/**
 * `code` values of `AI_STREAM_ERROR` events. Clients map them to localized text
 * (never show the `error` string). Every failure path of a request publishes
 * exactly one of these — a request never ends silently.
 */
export const AiStreamErrorCode = {
  QUOTA_EXCEEDED: 'AI_QUOTA_EXCEEDED',
  RATE_LIMITED: 'AI_RATE_LIMITED',
  FORBIDDEN: 'AI_FORBIDDEN',
  STREAM_INTERRUPTED: 'AI_STREAM_INTERRUPTED',
  UNAVAILABLE: 'AI_UNAVAILABLE',
  /** The model finished without any text (refusal, all tokens spent thinking, …). */
  EMPTY_RESPONSE: 'AI_EMPTY_RESPONSE',
} as const;

export type AiStreamErrorCodeValue = (typeof AiStreamErrorCode)[keyof typeof AiStreamErrorCode];
