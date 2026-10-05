import { WRITE_TIMEOUT_RESULT } from '../tools/mcp-connector.client';
import { ActionOutcome } from './pending-action.types';

/** The connector may have completed a write it did not confirm in time. */
export const OUTCOME_UNKNOWN = 'OUTCOME_UNKNOWN';

/**
 * Classify a connector result string. connector-service reports failures as
 * `Tool error: [CODE] message`; ai-service's own client uses
 * `Tool error: connector unavailable` and {@link WRITE_TIMEOUT_RESULT}.
 * Only a machine code leaves this function — never the error text.
 */
export function classifyToolResult(result: string): ActionOutcome {
  const text = typeof result === 'string' ? result : '';
  if (text === WRITE_TIMEOUT_RESULT) return { status: 'failed', code: OUTCOME_UNKNOWN, result: text };
  if (/^Tool (error|not found)/i.test(text)) {
    const code = /\[([A-Z][A-Z0-9_]{1,40})\]/.exec(text)?.[1];
    return {
      status: 'failed',
      code: code ?? (/connector unavailable/i.test(text) ? 'CONNECTOR_UNAVAILABLE' : 'TOOL_FAILED'),
      result: text,
    };
  }
  return { status: 'confirmed', result: text };
}
