import { Prop, Schema as NestSchema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema } from 'mongoose';

export type WorkspaceDocument = Workspace & Document;

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
}

export const WorkspaceSchema = SchemaFactory.createForClass(Workspace);
