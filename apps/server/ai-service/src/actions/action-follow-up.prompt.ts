import { wrapUntrusted } from '../ai/injection-guard';
import {
  ACTION_CONFIRMED_NOTICE,
  ACTION_FAILED_NOTICE,
  ACTION_OUTCOME_UNKNOWN_NOTICE,
} from '../ai/system-notices';
import { OUTCOME_UNKNOWN } from './action-outcome';
import { describeSummary } from './pending-action-summary';
import { ActionOutcome, PendingActionRecord } from './pending-action.types';

const MAX_RESULT_CHARS = 1500;

function outcomeLine(outcome: ActionOutcome): string {
  if (outcome.status === 'confirmed') return 'Result: it was executed successfully.';
  if (outcome.code === OUTCOME_UNKNOWN) {
    return (
      'Result: the connector did not confirm in time — it MAY have been completed. ' +
      'Tell the user to check before trying again.'
    );
  }
  const code = outcome.code ?? 'TOOL_FAILED';
  return `Result: it FAILED (reason code ${code}). Do not offer to retry it automatically.`;
}

/**
 * The single user turn of the follow-up model call: what was confirmed, how it
 * went, and the connector's raw output fenced as UNTRUSTED data (it can carry
 * third-party text such as an email subject).
 */
export function buildFollowUpPrompt(record: PendingActionRecord, outcome: ActionOutcome): string {
  const parts = [
    'The user reviewed an action you prepared earlier and CONFIRMED it in the app.',
    `Action: ${describeSummary(record.summary)}.`,
    outcomeLine(outcome),
  ];
  if (record.requestText.trim()) {
    parts.push(`The user's original request (reply in its language):\n"""${record.requestText}"""`);
  }
  const output = wrapUntrusted('Connector response', outcome.result.slice(0, MAX_RESULT_CHARS));
  if (output) parts.push(output);
  parts.push(
    'Write a short reply (1-2 sentences) telling the user the outcome. Do not show ids, links ' +
      'or technical error text, do not call tools and do not ask for another confirmation.',
  );
  return parts.join('\n\n');
}

/** Deterministic follow-up when no model text is available. */
export function followUpNotice(outcome: ActionOutcome): string {
  if (outcome.status === 'confirmed') return ACTION_CONFIRMED_NOTICE;
  return outcome.code === OUTCOME_UNKNOWN ? ACTION_OUTCOME_UNKNOWN_NOTICE : ACTION_FAILED_NOTICE;
}
