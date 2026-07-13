import { OrgContext } from '../ai-context/ai-context-reader.service';

/**
 * Compose the trusted "About the user & their organization" grounding block.
 * Admin/superior-authored text — NOT fenced as untrusted. Returns '' when empty.
 * Hard-capped at `maxChars` to protect the token budget.
 */
export function formatOrgContextBlock(ctx: OrgContext, maxChars: number): string {
  const lines: string[] = [];
  const identity: string[] = [];
  if (ctx.role) identity.push(`Role: ${ctx.role}`);
  if (ctx.departmentNames.length) identity.push(`Department(s): ${ctx.departmentNames.join(', ')}`);
  if (ctx.profile?.jobTitle) identity.push(`Job title: ${ctx.profile.jobTitle}`);
  if (ctx.profile?.projects?.length)
    identity.push(`Current project(s): ${ctx.profile.projects.join(', ')}`);
  if (identity.length) lines.push(identity.map((l) => `- ${l}`).join('\n'));

  if (ctx.profile?.style) lines.push(`Preferred response style: ${ctx.profile.style}`);
  if (ctx.profile?.preferences) lines.push(`User preferences: ${ctx.profile.preferences}`);

  const entryLines = (title: string, entries: { label: string; text: string }[]) =>
    entries.length ? `${title}:\n` + entries.map((e) => `- ${e.label}: ${e.text}`).join('\n') : '';
  const company = entryLines('Company context', ctx.companyEntries);
  const dept = entryLines('Department context', ctx.departmentEntries);
  if (company) lines.push(company);
  if (dept) lines.push(dept);

  if (lines.length === 0) return '';
  const header =
    `## About the user & their organization\n` +
    `(Trusted profile & org context — use it to tailor your help. ` +
    `Do not repeat it verbatim unless asked.)`;
  let block = [header, ...lines].join('\n\n');
  if (block.length > maxChars) block = block.slice(0, Math.max(0, maxChars - 1)).trimEnd() + '…';
  return block;
}
