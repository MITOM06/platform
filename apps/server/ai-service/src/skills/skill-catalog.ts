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
      'and confirm timezone and duration before acting.' +
      ' If no calendar tool is available, tell the user to connect Google Calendar in Integrations first — never fabricate a booking.',
  },
  {
    id: 'mailWriter',
    instruction:
      'Email writing: help draft clear, professional emails. Match the requested tone, keep them ' +
      'concise, propose a subject line, and end with a clear call to action. Never send without ' +
      'showing the draft and getting explicit confirmation.' +
      ' If no email tool is available, tell the user to connect Gmail in Integrations first — never claim an email was sent.',
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
      'surface action items with owners.' +
      ' If no Notion tool is available, tell the user to connect Notion in Integrations first — never claim something was saved.',
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
      'summarize each in one line, and suggest a short reply or next action for the important ones.' +
      ' If no email tool is available, tell the user to connect Gmail in Integrations first.',
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
  {
    id: 'webSearch',
    instruction:
      'Web search assistant: when the user asks about current events, recent data, prices, ' +
      'technical documentation, or any time-sensitive information, proactively search for ' +
      'answers and cite your sources. Always mention the date your information is from and ' +
      'flag when data may be outdated. Structure answers as: answer → sources → caveats.',
  },
  {
    id: 'weatherForecast',
    instruction:
      'Weather assistant: when the user asks about weather, temperature, rain, humidity, wind, ' +
      'forecast, or climate for any location, provide useful weather context. If no location ' +
      'is specified, ask for it first. Provide current conditions (from knowledge), typical ' +
      'seasonal patterns, and always recommend checking a real-time weather service for ' +
      'live forecasts (e.g. weather.com, accuweather, windy.com).',
  },
];

/**
 * Skill ids that gate real tool access: an "action skill" must be ENABLED for
 * its provider's MCP tools to be exposed to the assistant (Approach A — skill is
 * a mandatory consent layer on top of the connector OAuth + RBAC allow-list).
 * `provider` must match the connector-service CATALOG id (the `<provider>`
 * segment of `mcp__<provider>__<tool>`). Providers NOT listed here are never
 * gated by a skill.
 */
export const SKILL_TOOL_REQUIREMENTS: Readonly<Record<string, { provider: string }>> = {
  scheduler: { provider: 'calendar' },
  mailWriter: { provider: 'gmail' },
  inboxTriage: { provider: 'gmail' },
  projectKeeper: { provider: 'notion' },
};

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
