import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserConnectionDocument = HydratedDocument<UserConnection>;

export type ConnectionStatus = 'active' | 'expired' | 'revoked';

/**
 * Encrypted token payload (AES-256-GCM). Stored as a subdocument; the
 * plaintext tokens never leave the vault. Always omitted from list/CRUD
 * responses — see ConnectionsService.toView().
 */
@Schema({ _id: false })
export class EncryptedTokens {
  @Prop({ required: true })
  iv: string;

  @Prop({ required: true })
  tag: string;

  @Prop({ required: true })
  data: string;
}

const EncryptedTokensSchema = SchemaFactory.createForClass(EncryptedTokens);

@Schema({ collection: 'user_connections', timestamps: true })
export class UserConnection {
  @Prop({ required: true, index: true })
  userId: string;

  // 'notion' | 'gmail' | ... | 'custom:<id>'
  @Prop({ required: true })
  provider: string;

  @Prop({ required: true, default: 'active' })
  status: ConnectionStatus;

  @Prop({ type: [String], default: [] })
  scopes: string[];

  @Prop()
  mcpUrl: string;

  @Prop({ type: EncryptedTokensSchema, required: true })
  encryptedTokens: EncryptedTokens;

  @Prop()
  accountLabel: string;

  @Prop()
  lastUsedAt: Date;
}

export const UserConnectionSchema = SchemaFactory.createForClass(UserConnection);

// One connection per (user, provider).
UserConnectionSchema.index({ userId: 1, provider: 1 }, { unique: true });
