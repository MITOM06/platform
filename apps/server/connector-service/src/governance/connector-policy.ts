import { findCatalogEntry, isCatalogId } from '../catalog/catalog';
import { isCustomProvider } from '../internal/tool-naming';

/**
 * Action skills that gate a provider's tools (Approach A — a skill is a consent
 * layer on top of OAuth + RBAC). MUST stay in sync with ai-service
 * `src/skills/skill-catalog.ts` SKILL_TOOL_REQUIREMENTS; mirrored here because
 * the Bot Factory MCP endpoint serves tools without going through ai-service.
 * A provider not listed is never skill-gated.
 */
export const SKILL_TOOL_REQUIREMENTS: Readonly<Record<string, { provider: string }>> = {
  scheduler: { provider: 'calendar' },
  mailWriter: { provider: 'gmail' },
  inboxTriage: { provider: 'gmail' },
  projectKeeper: { provider: 'notion' },
};

const SKILL_GATED_PROVIDERS = new Set(Object.values(SKILL_TOOL_REQUIREMENTS).map((r) => r.provider));

/** True when the provider's tools are unlocked by the member's enabled skills. */
export function skillGateAllows(provider: string, enabledSkillIds: readonly string[]): boolean {
  if (!SKILL_GATED_PROVIDERS.has(provider)) return true;
  return enabledSkillIds.some((id) => SKILL_TOOL_REQUIREMENTS[id]?.provider === provider);
}

/**
 * Snapshot of the workspace-level connector policy (`workspaces` singleton).
 *
 * Semantics:
 *  - `connectorAllowList` governs CATALOG connector ids (gmail, calendar,
 *    notion, drive) — whichever flow (catalog or directory) created the
 *    connection and whatever its scope. `[]` (or no workspace doc) = allow all.
 *    Directory-only connectors are governed by their directory entry
 *    (`available`), custom MCP servers by ADD_CUSTOM_MCP.
 *  - `aiSettings.allowedConnectors` is the AI-specific narrowing: `null` =
 *    inherit (no extra filter), `[]` = the AI may use NO connector, `[...]` =
 *    only those provider ids (custom servers are never listed, so they are
 *    dropped whenever it is non-null — same as ai-service).
 */
export class ConnectorPolicy {
  constructor(
    readonly allowList: readonly string[],
    readonly aiAllowed: readonly string[] | null,
  ) {}

  static allowAll(): ConnectorPolicy {
    return new ConnectorPolicy([], null);
  }

  /** Workspace allow-list gate (connect time and use time). */
  workspaceAllows(provider: string): boolean {
    if (isCustomProvider(provider) || !isCatalogId(provider)) return true;
    return this.allowList.length === 0 || this.allowList.includes(provider);
  }

  /** AI `allowedConnectors` gate (use time, every AI channel). */
  aiAllows(provider: string): boolean {
    return this.aiAllowed === null || this.aiAllowed.includes(provider);
  }
}

/** A catalog id whose catalog entry is live (built-in flow still usable). */
export function isAvailableCatalogId(provider: string): boolean {
  return !!findCatalogEntry(provider)?.available;
}
