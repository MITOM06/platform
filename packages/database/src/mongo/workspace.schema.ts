import { Prop, Schema as NestSchema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema } from 'mongoose';

export type WorkspaceDocument = Workspace & Document;

/** Admin-editable SSO mapping config. Provider creds live in .env, NOT here. */
@NestSchema({ _id: false })
export class WorkspaceSso {
  @Prop({ default: false })
  enabled: boolean;

  /** Allowed email domains (empty = any verified email). */
  @Prop({ type: [String], default: [] })
  allowedDomains: string[];

  /** IdP group name → PON role NAME (e.g. { "pon-admins": "Admin" }). */
  @Prop({ type: Schema.Types.Mixed, default: {} })
  groupRoleMap: Record<string, string>;

  /** IdP group name → department id. */
  @Prop({ type: Schema.Types.Mixed, default: {} })
  groupDeptMap: Record<string, string>;

  /** Role NAME applied when no group matches. */
  @Prop()
  defaultRole?: string;
}
export const WorkspaceSsoSchema = SchemaFactory.createForClass(WorkspaceSso);

/**
 * Admin-editable AI assistant defaults (TASK-12). Owned by auth-service via the
 * `/admin/workspace` admin API; read (cached) by ai-service from the shared
 * `platform` DB. EVERY field is nullable and defaults to `null`, where
 * `null` = "no override — inherit the ai-service env var / hardcoded default".
 * An unset field NEVER overrides the env behavior (fully backward compatible).
 */
@NestSchema({ _id: false })
export class WorkspaceAiSettings {
  /** Default assistant name. `null` ⇒ env AI_BOT_DISPLAY_NAME / "PON AI". */
  @Prop({ type: String, default: null })
  personaName: string | null;

  /** 'friendly'|'professional'|'concise'|'creative'. `null` ⇒ 'friendly'. */
  @Prop({ type: String, default: null })
  defaultTone: string | null;

  /** 'auto'|'simple'|'mid'|'complex'. `null`/'auto' ⇒ env model router. */
  @Prop({ type: String, default: null })
  modelTier: string | null;

  /** Web-search tool toggle. `null` ⇒ env WEB_SEARCH_ENABLED. */
  @Prop({ type: Boolean, default: null })
  webSearchEnabled: boolean | null;

  /** Extended-thinking toggle. `null` ⇒ env AI_ENABLE_THINKING. */
  @Prop({ type: Boolean, default: null })
  thinkingEnabled: boolean | null;

  /** Monthly token quota. `null` ⇒ env AI_MONTHLY_TOKEN_LIMIT; `0` = block all. */
  @Prop({ type: Number, default: null })
  monthlyTokenLimit: number | null;

  /**
   * AI-specific MCP connector allow-list (catalog connector ids).
   * `null` = no AI-specific restriction (inherit `Workspace.connectorAllowList`);
   * `[]` = AI may use NO connectors; `[...]` = explicit list (must be a subset of
   * `connectorAllowList`).
   */
  // Function default `() => null` — a bare `default: null` on an array prop is
  // coerced to `[]` by Mongoose, which would erase the critical null-vs-[]
  // distinction (inherit vs allow-none).
  @Prop({ type: [String], default: () => null })
  allowedConnectors: string[] | null;

  /**
   * Daily-digest opt-in (TASK-11). `null` ⇒ inherit ai-service env
   * AI_DIGEST_ENABLED (default false). `true` = post a daily summary of the
   * prior day's activity into each active AI conversation.
   */
  @Prop({ type: Boolean, default: null })
  dailyDigestEnabled: boolean | null;

  /**
   * Local hour (0–23) at which the daily digest is delivered (TASK-11).
   * `null` ⇒ inherit ai-service env AI_DIGEST_HOUR (default 8). Single-tenant
   * deployment ⇒ server/workspace local hour (per-user timezone is a follow-up).
   */
  @Prop({ type: Number, default: null })
  dailyDigestHour: number | null;
}
export const WorkspaceAiSettingsSchema = SchemaFactory.createForClass(WorkspaceAiSettings);

/**
 * Singleton workspace config. PON is self-hosted, single-company-per-deployment,
 * so there is exactly ONE Workspace document per instance — it represents the
 * company. There is NO cross-company `orgId`: tenancy is the deployment
 * boundary. Bootstrapped on first deploy and editable via the admin API.
 */
@NestSchema({ timestamps: true })
export class Workspace {
  @Prop({ required: true })
  name: string;

  @Prop()
  logoUrl?: string;

  @Prop()
  primaryColor?: string;

  /** Feature flags toggled per deployment (config-driven, not code forks). */
  @Prop({ type: Schema.Types.Mixed, default: {} })
  features: Record<string, boolean>;

  /**
   * Catalog connector ids that members may personally connect (admin-curated
   * allow-list). Personal connectors outside this list are rejected.
   */
  @Prop({ type: [String], default: [] })
  connectorAllowList: string[];

  /** SSO (OIDC) mapping config. Provider secrets are in .env, not here. */
  @Prop({ type: WorkspaceSsoSchema, default: () => ({}) })
  sso: WorkspaceSso;

  /**
   * Admin-editable AI assistant defaults (TASK-12). Defaults to an all-null
   * sub-doc ⇒ pure env behavior. No data migration needed.
   */
  @Prop({ type: WorkspaceAiSettingsSchema, default: () => ({}) })
  aiSettings: WorkspaceAiSettings;
}

export const WorkspaceSchema = SchemaFactory.createForClass(Workspace);
