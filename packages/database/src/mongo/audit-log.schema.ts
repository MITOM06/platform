import { Prop, Schema as NestSchema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

/**
 * Append-only audit trail for privileged actions across the deployment
 * (workspace/department/member/role changes, workspace connector connects,
 * custom-MCP adds, sensitive tool runs). Written by `AuditService.record(...)`
 * in auth-service and emitted by connector-service via the internal API.
 *
 * Single-tenant-per-deployment: there is no cross-company orgId — every row
 * belongs to the one workspace. Read by `GET /admin/audit` (VIEW_AUDIT_LOG).
 */
@NestSchema({ timestamps: { createdAt: true, updatedAt: false } })
export class AuditLog {
  /** User id of the actor who performed the action. */
  @Prop({ required: true, index: true })
  actorId: string;

  /** Display name of the actor captured at write time (avoids read-time joins). */
  @Prop()
  actorName?: string;

  /** Machine action key, e.g. `member.update`, `role.create`, `connector.connect`. */
  @Prop({ required: true, index: true })
  action: string;

  /** Domain of the target, e.g. `member`, `role`, `department`, `workspace`, `connector`. */
  @Prop({ required: true })
  targetType: string;

  /** Id (or label) of the affected entity, when applicable. */
  @Prop()
  targetId?: string;

  /** Free-form structured context (changed fields, provider id, tool name…). */
  @Prop({ type: Schema.Types.Mixed, default: {} })
  meta: Record<string, unknown>;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// Most queries are "latest first" — back the default sort with an index.
AuditLogSchema.index({ createdAt: -1 });
