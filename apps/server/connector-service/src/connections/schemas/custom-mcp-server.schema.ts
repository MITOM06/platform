import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { EncryptedTokens } from './user-connection.schema';

export type CustomMcpServerDocument = HydratedDocument<CustomMcpServer>;

export type CustomMcpAuthType = 'oauth2' | 'apikey' | 'none';

@Schema({ _id: false })
export class ToolPreview {
  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;
}

const ToolPreviewSchema = SchemaFactory.createForClass(ToolPreview);

@Schema({ collection: 'custom_mcp_servers', timestamps: true })
export class CustomMcpServer {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  url: string;

  @Prop({ required: true, default: 'none' })
  authType: CustomMcpAuthType;

  // Nullable — only present for oauth2/apikey servers. AES-256-GCM blob.
  @Prop({ type: Object, required: false })
  encryptedCredential?: EncryptedTokens;

  @Prop({ type: [ToolPreviewSchema], default: [] })
  toolsPreview: ToolPreview[];
}

export const CustomMcpServerSchema =
  SchemaFactory.createForClass(CustomMcpServer);
