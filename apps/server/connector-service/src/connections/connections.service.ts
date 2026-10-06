import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { Capability, JwtUser } from '@platform/database';
import { AuditService } from '../audit/audit.service';
import { AdapterRegistryService } from '../adapters/adapter-registry.service';
import { RevokeOutcome } from '../adapters/provider-adapter.interface';
import { withTimeout } from '../common/with-timeout';
import { ALL_ACTION_GROUPS } from '../catalog/catalog';
import { UserConnection, UserConnectionDocument } from './schemas/user-connection.schema';
import { UserSkill, UserSkillDocument } from './schemas/user-skill.schema';
import { ConnectionView } from './dto/connection-view.dto';
import { ConnectionPermissionsView } from './dto/connection-permissions.dto';
import { SkillView } from './dto/skill.dto';

const REVOKE_TIMEOUT_MS = 6_000;

@Injectable()
export class ConnectionsService {
  private readonly logger = new Logger(ConnectionsService.name);

  constructor(
    @InjectModel(UserConnection.name)
    private readonly connModel: Model<UserConnectionDocument>,
    @InjectModel(UserSkill.name)
    private readonly skillModel: Model<UserSkillDocument>,
    private readonly adapters: AdapterRegistryService,
    private readonly audit: AuditService,
  ) {}

  // ── Connections ───────────────────────────────────────────────────────────

  async listConnections(userId: string): Promise<ConnectionView[]> {
    // The caller's own (personal) connections PLUS every workspace-scoped
    // connection (shared across all members).
    const docs = await this.connModel.find({ $or: [{ userId }, { scope: 'workspace' }] }).lean();
    // Map to a secret-free view — encryptedTokens is deliberately dropped.
    // `status` is 'active' | 'expired' (refresh token dead — reconnect) | 'revoked'.
    return docs.map((d) => ({
      id: String(d._id),
      provider: d.provider,
      status: d.status,
      scope: d.scope ?? 'personal',
      scopes: d.scopes ?? [],
      actionGroups: d.actionGroups ?? [...ALL_ACTION_GROUPS],
      accountLabel: d.accountLabel,
      lastUsedAt: d.lastUsedAt,
    }));
  }

  /**
   * Read the action groups granted on one of the caller's connections (or any
   * workspace connection). Used to render the permission toggles.
   */
  async getConnectionPermissions(userId: string, id: string): Promise<ConnectionPermissionsView> {
    if (!isValidObjectId(id)) throw new NotFoundException('Connection not found');
    const conn = await this.connModel.findOne({ _id: id, $or: [{ userId }, { scope: 'workspace' }] }).lean();
    if (!conn) throw new NotFoundException('Connection not found');
    return { actionGroups: conn.actionGroups ?? [...ALL_ACTION_GROUPS] };
  }

  /**
   * Narrow/restore the action groups the AI may use on the caller's own
   * connection. Only the owner can change a connection's permissions.
   */
  async updateConnectionPermissions(
    userId: string,
    id: string,
    actionGroups: string[],
  ): Promise<ConnectionPermissionsView> {
    if (!isValidObjectId(id)) throw new NotFoundException('Connection not found');
    const res = await this.connModel.updateOne({ _id: id, userId }, { $set: { actionGroups } });
    if (!res.matchedCount) throw new NotFoundException('Connection not found');
    await this.audit.record({
      actorId: userId,
      action: 'connection.permissions.update',
      targetType: 'connector',
      targetId: id,
      meta: { actionGroups },
    });
    return { actionGroups };
  }

  /**
   * Disconnect.
   *  - Personal connection: only its owner (others get 404).
   *  - Workspace connection: any holder of CONNECT_WORKSPACE_CONNECTOR (403
   *    otherwise); audited as `connector.disconnect`.
   * The grant is revoked at the provider first, best-effort (Google today;
   * providers without a known revocation endpoint are skipped).
   */
  async deleteConnection(user: JwtUser, id: string): Promise<{ deleted: boolean }> {
    if (!isValidObjectId(id)) throw new NotFoundException('Connection not found');
    const conn = await this.connModel
      .findOne({ _id: id, $or: [{ userId: user.sub }, { scope: 'workspace' }] })
      .lean();
    if (!conn) throw new NotFoundException('Connection not found');

    const workspace = conn.scope === 'workspace';
    if (workspace && !(user.perms ?? []).includes(Capability.CONNECT_WORKSPACE_CONNECTOR)) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_PERMISSION',
        required: Capability.CONNECT_WORKSPACE_CONNECTOR,
      });
    }

    const revoke = await this.revokeAtProvider(conn);
    await this.connModel.deleteOne({ _id: conn._id });
    if (workspace) {
      await this.audit.record({
        actorId: user.sub,
        action: 'connector.disconnect',
        targetType: 'connector',
        targetId: conn.provider,
        meta: { scope: 'workspace', connectionId: String(conn._id), ownerId: conn.userId, revoke },
      });
    }
    return { deleted: true };
  }

  private async revokeAtProvider(conn: any): Promise<RevokeOutcome> {
    const adapter = this.adapters.forProvider(conn.provider);
    if (!adapter.revoke) return 'unsupported';
    try {
      return await withTimeout(
        adapter.revoke({
          provider: conn.provider,
          userId: conn.userId,
          mcpUrl: conn.mcpUrl,
          encryptedTokens: conn.encryptedTokens,
          encryptedClientCreds: conn.encryptedClientCreds,
          tokenEndpoint: conn.tokenEndpoint,
          _id: conn._id,
        }),
        REVOKE_TIMEOUT_MS,
        'revoke',
      );
    } catch (err) {
      this.logger.warn(`Revocation for ${conn.provider} failed: ${(err as Error).message}`);
      return 'failed';
    }
  }

  // ── Skills (thin upsert; wired by web C3 / Flutter D3) ───────────────────

  async listSkills(userId: string): Promise<SkillView[]> {
    const docs = await this.skillModel.find({ userId }).lean();
    return docs.map((d) => ({ skillId: d.skillId, enabled: d.enabled }));
  }

  async setSkill(userId: string, skillId: string, enabled: boolean): Promise<SkillView> {
    await this.skillModel.updateOne({ userId, skillId }, { $set: { enabled } }, { upsert: true });
    return { skillId, enabled };
  }
}
