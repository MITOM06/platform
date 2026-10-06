import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ExternalBotRefDocument = HydratedDocument<ExternalBotRef>;

/**
 * Read-only view of chat-service's `external_bots` registry (Spring
 * `@Document("external_bots")`), used to verify that a bot belongs to the
 * member a session is issued for. The collection name is pinned — Mongoose's
 * implicit pluralisation would otherwise read a different collection.
 */
@Schema({ collection: 'external_bots', strict: false })
export class ExternalBotRef {
  @Prop()
  botUserId: string;

  @Prop()
  ownerUserId: string;

  @Prop()
  enabled?: boolean;
}

export const ExternalBotRefSchema = SchemaFactory.createForClass(ExternalBotRef);
