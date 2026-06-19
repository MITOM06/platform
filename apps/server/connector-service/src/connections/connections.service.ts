import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { McpAuth, McpClientService } from '../mcp/mcp-client.service';
import { TokenVaultService } from '../vault/token-vault.service';
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
import { SkillView } from './dto/skill.dto';

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
  ) {}

  // ── Connections ───────────────────────────────────────────────────────────

  async listConnections(userId: string): Promise<ConnectionView[]> {
    const docs = await this.connModel.find({ userId }).lean();
    // Map to a secret-free view — encryptedTokens is deliberately dropped.
    return docs.map((d) => ({
      id: String(d._id),
      provider: d.provider,
      status: d.status,
      scopes: d.scopes ?? [],
      accountLabel: d.accountLabel,
      lastUsedAt: d.lastUsedAt,
    }));
  }

  async deleteConnection(id: string): Promise<{ deleted: boolean }> {
    const res = await this.connModel.deleteOne({ _id: id });
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

    return this.customModel.create({
      userId,
      name: dto.name,
      url: dto.url,
      authType: dto.authType,
      encryptedCredential,
      toolsPreview,
    });
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
