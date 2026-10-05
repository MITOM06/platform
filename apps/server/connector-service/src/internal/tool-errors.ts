/**
 * Tool results are plain strings consumed by the model (ai-service tool loop,
 * Bot Factory). Failures start with `Tool error:` — ai-service relies on that
 * prefix to skip its result cache — followed by a machine code and a short,
 * clean sentence. Raw upstream bodies (Google/MCP HTTP error JSON, internal
 * service responses) are logged server-side and never forwarded.
 */
export type ToolErrorCode =
  | 'INVALID_TOOL'
  | 'UNKNOWN_TOOL'
  | 'INVALID_INPUT'
  | 'NOT_PERMITTED'
  | 'NO_CONNECTION'
  | 'CONNECTION_EXPIRED'
  | 'AUTH_FAILED'
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_UNAVAILABLE'
  | 'UPSTREAM_BLOCKED'
  | 'UPSTREAM_ERROR'
  | 'TOOL_FAILED';

export function toolError(code: ToolErrorCode, message: string): string {
  return `Tool error: [${code}] ${message}`;
}

/** Typed failure an adapter can throw; InternalService renders it with {@link toolError}. */
export class ToolExecutionError extends Error {
  constructor(
    readonly code: ToolErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ToolExecutionError';
  }
}

/** Trim free text (remote tool output, MCP protocol messages) to a bounded size. */
export function clip(text: string, max = 300): string {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Map an upstream HTTP status to the code + sentence handed to the model. */
export function httpFailure(service: string, status: number, reason?: string): ToolExecutionError {
  const why = reason ? ` (${reason})` : '';
  if (status === 401) {
    return new ToolExecutionError(
      'AUTH_FAILED',
      `${service} rejected the stored credentials. Ask the user to reconnect ${service} in Integrations.`,
    );
  }
  if (status === 403) {
    return new ToolExecutionError('PERMISSION_DENIED', `${service} denied access to this action${why}.`);
  }
  if (status === 404) return new ToolExecutionError('NOT_FOUND', `${service} could not find that item${why}.`);
  if (status === 429) {
    return new ToolExecutionError('RATE_LIMITED', `${service} is rate limiting requests; try again shortly.`);
  }
  if (status >= 500) {
    return new ToolExecutionError('UPSTREAM_UNAVAILABLE', `${service} is temporarily unavailable (HTTP ${status}).`);
  }
  return new ToolExecutionError('UPSTREAM_ERROR', `${service} rejected the request (HTTP ${status})${why}.`);
}

/** Error raised when a stored grant is dead (refresh returned `invalid_grant`). */
export function connectionExpired(provider: string): ToolExecutionError {
  return new ToolExecutionError(
    'CONNECTION_EXPIRED',
    `The ${provider} connection has expired. Ask the user to reconnect ${provider} in Integrations.`,
  );
}
