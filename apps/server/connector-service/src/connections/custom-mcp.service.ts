import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { redactUrl } from '../common/redact';
import { httpStatusOf, McpAuth, McpClientService } from '../mcp/mcp-client.service';
import { assertSafeUrl, UnsafeUrlError } from '../security/url-guard';
import { TokenVaultService } from '../vault/token-vault.service';
import { CreateCustomMcpDto, CustomMcpView, DiscoverCustomMcpDto } from './dto/custom-mcp.dto';
import { DiscoverResult } from './dto/connection-view.dto';
import {
  CustomMcpAuthType,
  CustomMcpServer,
  CustomMcpServerDocument,
} from './schemas/custom-mcp-server.schema';

function toAuth(authType: CustomMcpAuthType, credential?: string): McpAuth {
  if (authType === 'oauth2') return { type: 'bearer', token: credential };
  if (authType === 'apikey') return { type: 'apikey', token: credential };
  return { type: 'none' };
}

/**
 * Custom MCP servers (admin-only to add — ADD_CUSTOM_MCP; listing and deleting
 * one's own servers needs no capability so a demoted member can still clean
 * up). URLs pass the SSRF guard; credentials are vault-encrypted and never
 * returned; URLs are redacted in logs, audit entries and API responses.
 */
@Injectable()
export class CustomMcpService {
  private readonly logger = new Logger(CustomMcpService.name);

  constructor(
    @InjectModel(CustomMcpServer.name)
    private readonly customModel: Model<CustomMcpServerDocument>,
    private readonly vault: TokenVaultService,
    private readonly mcp: McpClientService,
    private readonly audit: AuditService,
  ) {}

  async discover(dto: DiscoverCustomMcpDto): Promise<DiscoverResult> {
    await assertSafeUrl(dto.url);
    try {
      const tools = await this.mcp.discoverTools(dto.url, toAuth(dto.authType, dto.credential));
      return { tools: tools.map((t) => ({ name: t.name, description: t.description })) };
    } catch (err) {
      if (err instanceof UnsafeUrlError) throw err;
      this.logger.warn(`Discovery failed for custom MCP ${redactUrl(dto.url)}: ${(err as Error).message}`);
      const status = httpStatusOf(err);
      throw new BadRequestException({ code: 'MCP_DISCOVERY_FAILED', ...(status ? { status } : {}) });
    }
  }

  async save(userId: string, dto: CreateCustomMcpDto): Promise<CustomMcpView> {
    await assertSafeUrl(dto.url);
    const encryptedCredential =
      dto.authType !== 'none' && dto.credential ? this.vault.encrypt(dto.credential) : undefined;

    // Best-effort tool preview; failure here must not block saving the server.
    let toolsPreview: { name: string; description: string }[] = [];
    try {
      const tools = await this.mcp.discoverTools(dto.url, toAuth(dto.authType, dto.credential));
      toolsPreview = tools.map((t) => ({ name: t.name, description: t.description }));
    } catch (err) {
      this.logger.warn(`Tool preview failed for custom MCP ${redactUrl(dto.url)}: ${(err as Error).message}`);
    }

    const created = await this.customModel.create({
      userId,
      name: dto.name,
      url: dto.url,
      authType: dto.authType,
      encryptedCredential,
      toolsPreview,
    });
    const doc = typeof (created as any).toObject === 'function' ? (created as any).toObject() : created;
    await this.audit.record({
      actorId: userId,
      action: 'custom_mcp.add',
      targetType: 'connector',
      targetId: String(doc._id),
      meta: { name: dto.name, url: redactUrl(dto.url) },
    });
    return this.toView(doc);
  }

  /** The caller's own custom servers (no secrets). */
  async list(userId: string): Promise<CustomMcpView[]> {
    const docs = await this.customModel.find({ userId }).sort({ createdAt: -1 }).lean();
    return docs.map((d) => this.toView(d));
  }

  /** Owner-only, idempotent: `{ deleted: false }` when there is nothing (of the caller's) to delete. */
  async remove(userId: string, id: string): Promise<{ deleted: boolean }> {
    if (!isValidObjectId(id)) return { deleted: false };
    const doc = await this.customModel.findOneAndDelete({ _id: id, userId }).lean();
    if (!doc) return { deleted: false };
    await this.mcp.evictConnection(String(doc._id));
    await this.audit.record({
      actorId: userId,
      action: 'custom_mcp.delete',
      targetType: 'connector',
      targetId: String(doc._id),
      meta: { name: doc.name, url: redactUrl(doc.url) },
    });
    return { deleted: true };
  }

  private toView(d: any): CustomMcpView {
    return {
      id: String(d._id),
      name: d.name,
      url: redactUrl(d.url),
      authType: d.authType,
      hasCredential: !!d.encryptedCredential,
      toolsPreview: (d.toolsPreview ?? []).map((t: { name: string; description?: string }) => ({
        name: t.name,
        description: t.description ?? '',
      })),
      ...(d.createdAt ? { createdAt: d.createdAt } : {}),
    };
  }
}
