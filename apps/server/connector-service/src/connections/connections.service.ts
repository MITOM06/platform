import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { McpAuth, McpClientService } from '../mcp/mcp-client.service';
import { TokenVaultService } from '../vault/token-vault.service';
import { AuditService } from '../audit/audit.service';
import {
  UserConnection,
  UserConnectionDocument,
} from './schemas/user-connection.schema';
import {
  CustomMcpServer,
  CustomMcpServerDocument,
} from './schemas/custom-mcp-server.schema';
import { UserSkill, UserSkillDocument } from './schemas/user-skill.schema';
import { CreateCustomMcpDto, DiscoverCustomMcpDto } from './dto/custom-mcp.dto';
import { ConnectionView, DiscoverResult } from './dto/connection-view.dto';
import { ConnectionPermissionsView } from './dto/connection-permissions.dto';
import { SkillView } from './dto/skill.dto';
import { ALL_ACTION_GROUPS } from '../catalog/catalog';

@Injectable()
export class ConnectionsService {
  private readonly logger = new Logger(ConnectionsService.name);

  constructor(
    @InjectModel(UserConnection.name)
    private readonly connModel: Model<UserConnectionDocument>,
    @InjectModel(CustomMcpServer.name)
    private readonly customModel: Model<CustomMcpServerDocument>,
    @InjectModel(UserSkill.name)
    private readonly skillModel: Model<UserSkillDocument>,
    private readonly vault: TokenVaultService,
    private readonly mcp: McpClientService,
    private readonly audit: AuditService,
  ) {}

  // ── Connections ───────────────────────────────────────────────────────────

  async listConnections(userId: string): Promise<ConnectionView[]> {
    // The caller's own (personal) connections PLUS every workspace-scoped
    // connection (shared across all members).
    const docs = await this.connModel
      .find({ $or: [{ userId }, { scope: 'workspace' }] })
      .lean();
    // Map to a secret-free view — encryptedTokens is deliberately dropped.
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
  async getConnectionPermissions(
    userId: string,
    id: string,
  ): Promise<ConnectionPermissionsView> {
    const conn = await this.connModel
      .findOne({ _id: id, $or: [{ userId }, { scope: 'workspace' }] })
      .lean();
    if (!conn) throw new NotFoundException('Connection not found');
    return { actionGroups: conn.actionGroups ?? [...ALL_ACTION_GROUPS] };
  }

  /**
   * Narrow/restore the action groups the AI may use on the caller's own
   * connection. Only the owner can change a personal connection's permissions.
   */
  async updateConnectionPermissions(
    userId: string,
    id: string,
    actionGroups: string[],
  ): Promise<ConnectionPermissionsView> {
    const res = await this.connModel.updateOne(
      { _id: id, userId },
      { $set: { actionGroups } },
    );
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

  async deleteConnection(
    userId: string,
    id: string,
  ): Promise<{ deleted: boolean }> {
    // Scope the delete to the caller so a user can only remove their OWN
    // (personal) connection — never another member's. Workspace-scoped
    // connections are not deletable via this personal endpoint.
    const res = await this.connModel.deleteOne({
      _id: id,
      userId,
      scope: { $ne: 'workspace' },
    });
    if (!res.deletedCount) {
      throw new NotFoundException('Connection not found');
    }
    return { deleted: true };
  }

  // ── Custom MCP servers ──────────────────────────────────────────────────

  private toAuth(authType: string, credential?: string): McpAuth {
    if (authType === 'oauth2') return { type: 'bearer', token: credential };
    if (authType === 'apikey') return { type: 'apikey', token: credential };
    return { type: 'none' };
  }

  async discoverCustom(dto: DiscoverCustomMcpDto): Promise<DiscoverResult> {
    const auth = this.toAuth(dto.authType, dto.credential);
    const tools = await this.mcp.listTools(dto.url, auth);
    return {
      tools: tools.map((t) => ({ name: t.name, description: t.description })),
    };
  }

  async saveCustom(userId: string, dto: CreateCustomMcpDto) {
    const encryptedCredential =
      dto.authType !== 'none' && dto.credential
        ? this.vault.encrypt(dto.credential)
        : undefined;

    // Best-effort tool preview; failure here must not block saving the server.
    let toolsPreview: { name: string; description: string }[] = [];
    try {
      const tools = await this.mcp.listTools(
        dto.url,
        this.toAuth(dto.authType, dto.credential),
      );
      toolsPreview = tools.map((t) => ({
        name: t.name,
        description: t.description,
      }));
    } catch (err) {
      this.logger.warn(
        `Tool preview failed for custom MCP ${dto.url}: ${(err as Error).message}`,
      );
    }

    const created = await this.customModel.create({
      userId,
      name: dto.name,
      url: dto.url,
      authType: dto.authType,
      encryptedCredential,
      toolsPreview,
    });
    await this.audit.record({
      actorId: userId,
      action: 'custom_mcp.add',
      targetType: 'connector',
      targetId: String(created._id),
      meta: { name: dto.name, url: dto.url },
    });
    return created;
  }

  // ── Skills (thin upsert; wired by web C3 / Flutter D3) ───────────────────

  async listSkills(userId: string): Promise<SkillView[]> {
    const docs = await this.skillModel.find({ userId }).lean();
    return docs.map((d) => ({ skillId: d.skillId, enabled: d.enabled }));
  }

  async setSkill(userId: string, skillId: string, enabled: boolean): Promise<SkillView> {
    await this.skillModel.updateOne(
      { userId, skillId },
      { $set: { enabled } },
      { upsert: true },
    );
    return { skillId, enabled };
  }
}
