import { SKILL_TOOL_REQUIREMENTS } from '../skills/skill-catalog';
import { providerOf, toolOf } from './tool-names';

/** Catalog providers by the name users know them by; other providers keep their id. */
const PROVIDER_NAMES: Readonly<Record<string, string>> = {
  gmail: 'Gmail',
  calendar: 'Google Calendar',
  drive: 'Google Drive',
  notion: 'Notion',
};

const MAX_LISTED = 20;

function providerName(provider: string): string {
  if (PROVIDER_NAMES[provider]) return PROVIDER_NAMES[provider];
  return provider.startsWith('custom') ? 'a custom connector' : provider;
}

/**
 * System-prompt note for the connector tools the member's ROLE may not run
 * (connector-service `withheld`, reason `role`; e.g. a Member without
 * RUN_SENSITIVE_SKILL). Without it the model only sees that a send/create tool
 * is missing, and the skill instructions then tell it to ask for a reconnect —
 * wrong when the app IS connected and the role is the reason. '' when none.
 */
export function buildWithheldNote(names: readonly string[]): string {
  const byProvider = new Map<string, string[]>();
  for (const name of names.slice(0, MAX_LISTED)) {
    const provider = providerOf(name);
    const tool = toolOf(name);
    if (!provider || !tool) continue;
    const label = providerName(provider);
    const list = byProvider.get(label) ?? [];
    if (!list.includes(tool)) list.push(tool);
    byProvider.set(label, list);
  }
  if (byProvider.size === 0) return '';
  const listed = [...byProvider].map(([label, tools]) => `${label} (${tools.join(', ')})`).join('; ');
  return (
    `Connector actions this user's role may not run: ${listed}. ` +
    "These apps ARE connected, but the user's role in this workspace is not permitted to run actions " +
    'that send, create, change or delete data there. If the user asks for one, say plainly that their role ' +
    'does not allow it and that a workspace administrator can grant the permission; this overrides any ' +
    'instruction to tell them to connect or reconnect the app. Never claim such an action was done.'
  );
}

/** English names of the action skills as the Skills page shows them (client i18n catalogs). */
const SKILL_NAMES: Readonly<Record<string, string>> = {
  scheduler: 'Scheduler',
  mailWriter: 'Mail writer',
  inboxTriage: 'Inbox triage',
  projectKeeper: 'Project keeper',
};

/** The skills whose `SKILL_TOOL_REQUIREMENTS` entry would unlock this connector tool. */
function unlockingSkills(provider: string, tool: string): string[] {
  return Object.entries(SKILL_TOOL_REQUIREMENTS)
    .filter(
      ([, req]) =>
        req.provider === provider &&
        (!req.tools || req.tools.some((name) => name.toLowerCase() === tool.toLowerCase())),
    )
    .map(([id]) => SKILL_NAMES[id] ?? id);
}

/**
 * System-prompt note for the tools of CONNECTED apps that the skill gate dropped
 * because the user turned the unlocking skill off (XC-1). Without it the model only
 * sees the tools vanish, while the history still holds earlier calendar results and
 * pending cards — so it may "check" the calendar from memory. '' when none.
 */
export function buildSkillOffNote(names: readonly string[]): string {
  const byProvider = new Map<string, { tools: string[]; skills: Set<string> }>();
  for (const name of names.slice(0, MAX_LISTED)) {
    const provider = providerOf(name);
    const tool = toolOf(name);
    if (!provider || !tool) continue;
    const label = providerName(provider);
    const entry = byProvider.get(label) ?? { tools: [], skills: new Set<string>() };
    if (!entry.tools.includes(tool)) entry.tools.push(tool);
    unlockingSkills(provider, tool).forEach((s) => entry.skills.add(s));
    byProvider.set(label, entry);
  }
  if (byProvider.size === 0) return '';
  const listed = [...byProvider]
    .map(([label, e]) => `${label} (${e.tools.join(', ')}; turned on by the ${[...e.skills].join(' or ')} skill)`)
    .join('; ');
  return (
    `Connected apps you cannot use this turn because their skill is turned off: ${listed}. ` +
    'These apps ARE connected, but the user switched off the skill that lets you use them, so you have ' +
    'no tool for them now. If the user asks for something there, say plainly that the skill is off and ' +
    'that they can turn it on in Skills. Never claim you checked, read or changed anything in these apps, ' +
    'and do not present results or pending actions from earlier in this conversation as their current state.'
  );
}

/** Every per-member tool note for the volatile system block, joined; '' when none applies. */
export function buildToolNotes(withheld: readonly string[], skillOff: readonly string[]): string {
  return [buildWithheldNote(withheld), buildSkillOffNote(skillOff)].filter(Boolean).join('\n\n');
}
