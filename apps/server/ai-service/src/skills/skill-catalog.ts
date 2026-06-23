/**
 * Behavioural source of truth for assistant skills. When a user enables a skill
 * (persisted in `user_skills`), its `instruction` is injected into the system
 * prompt so the assistant actually changes how it works — not just a toggle.
 *
 * `id` must stay in sync with the client display catalogs
 * (web `lib/skills.ts`, Flutter `skill_defs.dart`) where names/descriptions/icons
 * live as i18n. Keep instructions focused and composable: several can be active
 * at once, so each should read as one self-contained directive.
 */
export interface SkillSpec {
  id: string;
  /** Focused directive appended to the system prompt when enabled. */
  instruction: string;
}

export const SKILL_CATALOG: readonly SkillSpec[] = [
  {
    id: 'scheduler',
    instruction:
      'Scheduling assistant: when the user mentions times, deadlines, meetings or reminders, ' +
      'proactively offer to create calendar events or reminders, propose concrete time slots, ' +
      'and confirm timezone and duration before acting.',
  },
  {
    id: 'mailWriter',
    instruction:
      'Email writing: help draft clear, professional emails. Match the requested tone, keep them ' +
      'concise, propose a subject line, and end with a clear call to action. Never send without ' +
      'showing the draft and getting explicit confirmation.',
  },
  {
    id: 'researcher',
    instruction:
      'Research mode: answer from the uploaded knowledge base and provided sources first, cite as ' +
      '[Source N], synthesize across documents, and clearly separate what the sources support from ' +
      'your own inference. If the sources do not cover it, say so.',
  },
  {
    id: 'projectKeeper',
    instruction:
      'Project keeping: track tasks, owners, deadlines and decisions across the conversation. When ' +
      'asked for status, produce a structured summary (Done / In progress / Blocked / Next) and ' +
      'surface action items with owners.',
  },
  // ── Expanded professional skills ──
  {
    id: 'meetingNotes',
    instruction:
      'Meeting notes: from transcripts or notes, produce a tight summary, a decisions list, and ' +
      'action items as "owner — task — due". Flag anything ambiguous or unassigned.',
  },
  {
    id: 'inboxTriage',
    instruction:
      'Inbox triage: when reviewing messages/emails, prioritize them (urgent / today / later / FYI), ' +
      'summarize each in one line, and suggest a short reply or next action for the important ones.',
  },
  {
    id: 'dataAnalyst',
    instruction:
      'Data analysis: when given tables, numbers or metrics, compute the key figures, describe trends ' +
      'and outliers plainly, state assumptions, and never invent numbers that are not in the data.',
  },
  {
    id: 'docDrafter',
    instruction:
      'Document drafting: produce well-structured long-form documents (proposals, specs, reports) ' +
      'with clear headings, an executive summary first, and concise sections. Ask for the target ' +
      'audience and length when unclear.',
  },
  {
    id: 'translator',
    instruction:
      'Translation & localization: translate accurately and naturally, preserve meaning and tone, ' +
      'keep names/numbers/formatting intact, and note any phrase that does not translate cleanly.',
  },
];

const INSTRUCTION_BY_ID = new Map(SKILL_CATALOG.map((s) => [s.id, s.instruction]));

/** All known skill ids (for validation / client sync checks). */
export const SKILL_IDS: readonly string[] = SKILL_CATALOG.map((s) => s.id);

/**
 * Build the combined skill instruction block for a set of enabled skill ids.
 * Unknown ids are ignored. Returns '' when nothing applies.
 */
export function buildSkillInstructions(enabledIds: string[]): string {
  const blocks = enabledIds
    .map((id) => INSTRUCTION_BY_ID.get(id))
    .filter((x): x is string => !!x);
  if (blocks.length === 0) return '';
  return (
    '## Active skills (the user has enabled these assistant modes):\n' +
    blocks.map((b) => `- ${b}`).join('\n')
  );
}
