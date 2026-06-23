import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * Read-only, SLIM projection of the singleton `workspaces` document — ai-service
 * only needs `aiSettings` (TASK-12). The authoritative full schema lives in
 * `@platform/database` (owned/written by auth-service); ai-service NEVER writes
 * this collection, so a minimal local model mapped to the same collection name
 * is sufficient and avoids a cross-package dependency.
 *
 * `strict: false` lets the other workspace fields (name, sso, connectorAllowList,
 * …) pass through untouched on the rare write path — but ai-service never writes.
 */
@Schema({ collection: 'workspaces', strict: false })
export class Workspace {
  @Prop({ type: Object, default: null })
  aiSettings: {
    personaName?: string | null;
    defaultTone?: string | null;
    modelTier?: string | null;
    webSearchEnabled?: boolean | null;
    thinkingEnabled?: boolean | null;
    monthlyTokenLimit?: number | null;
    allowedConnectors?: string[] | null;
  } | null;
}

export const WorkspaceSchema = SchemaFactory.createForClass(Workspace);
