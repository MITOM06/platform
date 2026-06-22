export const AiStreamErrorCode = {
  QUOTA_EXCEEDED: 'AI_QUOTA_EXCEEDED',
  RATE_LIMITED: 'AI_RATE_LIMITED',
  STREAM_INTERRUPTED: 'AI_STREAM_INTERRUPTED',
  UNAVAILABLE: 'AI_UNAVAILABLE',
} as const;

export type AiStreamErrorCodeValue = (typeof AiStreamErrorCode)[keyof typeof AiStreamErrorCode];
