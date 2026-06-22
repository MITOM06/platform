import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type McpDirectoryEntryDocument = HydratedDocument<McpDirectoryEntry>;

/**
 * How a directory entry authenticates a user connection:
 *  - 'mcp-oauth': MCP-native OAuth — discover metadata, Dynamic Client
 *    Registration (RFC 7591) + Authorization Code + PKCE (RFC 7636). No
 *    per-provider operator credentials needed.
 *  - 'env-oauth': classic OAuth using operator-registered client id/secret
 *    held in env vars (envClientIdName / envClientSecretName) — the legacy
 *    Notion/Google path.
 *  - 'apikey':    user pastes an API key / bearer token (stored encrypted).
 *  - 'none':      open MCP server, no auth.
 */
export type DirectoryAuthMode = 'mcp-oauth' | 'env-oauth' | 'apikey' | 'none';

/** Governance tier — mirrors CatalogTier. */
export type DirectoryTier = 'workspace' | 'personal' | 'both';

/**
 * A discoverable MCP server in the dynamic connector directory. Seeded with
 * well-known public MCP servers (builtin:true) and extendable by workspace
 * admins (builtin:false, createdBy set). Stored in the `mcp_directory`
 * collection; the public view (DirectoryService.toView) drops env secret names.
 */
@Schema({ collection: 'mcp_directory', timestamps: true })
export class McpDirectoryEntry {
  /** Stable, URL-safe identifier used as the connection `provider`. */
  @Prop({ required: true, unique: true, index: true })
  slug: string;

  @Prop({ required: true })
  name: string;

  /** Icon hint (lucide/brand name or emoji); clients map to their own assets. */
  @Prop({ default: '' })
  icon: string;

  @Prop({ default: '' })
  description: string;

  /** Remote MCP endpoint (Streamable HTTP / SSE). */
  @Prop({ required: true })
  mcpUrl: string;

  @Prop({ required: true, default: 'mcp-oauth' })
  authMode: DirectoryAuthMode;

  @Prop({ required: true, default: 'both' })
  tier: DirectoryTier;

  @Prop({ type: [String], default: [] })
  scopes: string[];

  /** env-oauth only: name of the env var holding the OAuth client id. */
  @Prop()
  envClientIdName?: string;

  /** env-oauth only: name of the env var holding the OAuth client secret. */
  @Prop()
  envClientSecretName?: string;

  /** env-oauth only: provider authorize endpoint. */
  @Prop()
  authorizeUrl?: string;

  /** env-oauth only: provider token endpoint. */
  @Prop()
  tokenUrl?: string;

  /** Whether the entry is shown/connectable. */
  @Prop({ default: true })
  available: boolean;

  /** Seeded built-in entry (idempotently upserted) vs. admin-created. */
  @Prop({ default: false, index: true })
  builtin: boolean;

  /** userId of the admin who created a custom entry (unset for builtin). */
  @Prop()
  createdBy?: string;
}

export const McpDirectoryEntrySchema =
  SchemaFactory.createForClass(McpDirectoryEntry);
