import { Prop, Schema as NestSchema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema } from 'mongoose';
import { PermissionMatrix } from '../rbac/capabilities';

export type RoleDocument = Role & Document;

/**
 * A role template carrying a permission matrix as DATA (hybrid RBAC). Preset
 * roles (Owner/Admin/Manager/Member) are seeded idempotently on bootstrap;
 * admins may clone/edit non-preset roles. The Owner role is undeletable and
 * always holds every capability. Role names are unique.
 */
@NestSchema({ timestamps: true })
export class Role {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ default: false })
  isPreset: boolean;

  /** capability key -> enabled flag. See `Capability` in the rbac catalog. */
  @Prop({ type: Schema.Types.Mixed, default: {} })
  permissions: PermissionMatrix;
}

export const RoleSchema = SchemaFactory.createForClass(Role);
