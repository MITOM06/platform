import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import {
  ConnectionScope,
  UserConnection,
  UserConnectionDocument,
} from './schemas/user-connection.schema';

/** Fields only one connect flow writes; the other flow must clear them. */
export const DIRECTORY_ONLY_FIELDS = ['tokenEndpoint', 'encryptedClientCreds', 'directorySlug'] as const;
export const CATALOG_ONLY_FIELDS = ['accountLabel'] as const;

export interface ConnectionWrite {
  userId: string;
  provider: string;
  scope: ConnectionScope;
  /** Fields to set (status is forced to 'active'). */
  set: Partial<Record<keyof UserConnection, unknown>>;
  /** Fields to remove so a record written by the other flow stays coherent. */
  unset?: readonly string[];
}

/**
 * The single write path for user connections, shared by the static catalog
 * OAuth flow and the dynamic directory flow.
 *
 *  - One WORKSPACE connection per provider: connecting a second one replaces
 *    the first (audited `connector.replace`). The (userId, provider) unique
 *    index allowed one per admin, so two admins each holding a workspace
 *    `stripe` exposed `mcp__stripe__*` twice to every member and the
 *    Anthropic API rejected every request.
 *  - Catalog and directory flows share provider keys (`notion`): each write
 *    unsets the other flow's fields so the stored record is always coherent
 *    with the flow that wrote it last (no REST token paired with a stale
 *    directory token endpoint).
 */
@Injectable()
export class ConnectionStoreService {
  private readonly logger = new Logger(ConnectionStoreService.name);

  constructor(
    @InjectModel(UserConnection.name)
    private readonly connModel: Model<UserConnectionDocument>,
    private readonly audit: AuditService,
  ) {}

  async upsert(write: ConnectionWrite): Promise<void> {
    const { userId, provider, scope } = write;
    if (scope === 'workspace') await this.supersedeWorkspace(provider, userId);
    const unset = (write.unset ?? []).filter((f) => !(f in write.set));
    await this.connModel.updateOne(
      { userId, provider },
      {
        $set: { ...write.set, status: 'active', scope },
        ...(unset.length ? { $unset: Object.fromEntries(unset.map((f) => [f, ''])) } : {}),
      },
      { upsert: true },
    );
  }

  /** Remove every OTHER member's workspace connection for `provider`. */
  private async supersedeWorkspace(provider: string, keepUserId: string): Promise<void> {
    const others = await this.connModel
      .find({ provider, scope: 'workspace', userId: { $ne: keepUserId } }, { _id: 1, userId: 1 })
      .lean<Array<{ _id: unknown; userId: string }>>();
    if (!others.length) return;
    await this.connModel.deleteMany({ _id: { $in: others.map((o) => o._id) } });
    this.logger.log(`Replaced ${others.length} workspace ${provider} connection(s)`);
    await this.audit.record({
      actorId: keepUserId,
      action: 'connector.replace',
      targetType: 'connector',
      targetId: provider,
      meta: {
        scope: 'workspace',
        replacedConnectionIds: others.map((o) => String(o._id)),
        replacedOwnerIds: others.map((o) => o.userId),
      },
    });
  }
}
