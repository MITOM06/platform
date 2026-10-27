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
