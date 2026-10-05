import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Workspace, WorkspaceDocument } from '@platform/database';
import { isCatalogId } from '../catalog/catalog';
import {
  McpDirectoryEntry,
  McpDirectoryEntryDocument,
} from '../connections/schemas/mcp-directory-entry.schema';
import { UserSkill, UserSkillDocument } from '../connections/schemas/user-skill.schema';
import { isCustomProvider } from '../internal/tool-naming';
import { ConnectorPolicy, isAvailableCatalogId } from './connector-policy';

/**
 * Reads the live connector policy from the shared db so it is enforced at use
 * time (tool listing + execution, Bot Factory MCP) and not only when a
 * connection is first made.
 */
@Injectable()
export class ConnectorPolicyService {
  private readonly logger = new Logger(ConnectorPolicyService.name);

  constructor(
    @InjectModel(Workspace.name)
    private readonly workspaceModel: Model<WorkspaceDocument>,
    @InjectModel(McpDirectoryEntry.name)
    private readonly directoryModel: Model<McpDirectoryEntryDocument>,
    @InjectModel(UserSkill.name)
    private readonly skillModel: Model<UserSkillDocument>,
  ) {}

  /** Current policy. Throws on a db error — callers decide how to fail closed. */
  async loadPolicy(): Promise<ConnectorPolicy> {
    const ws = await this.workspaceModel
      .findOne({}, { connectorAllowList: 1, aiSettings: 1 })
      .lean<{ connectorAllowList?: string[]; aiSettings?: { allowedConnectors?: string[] | null } }>();
    const allowList = Array.isArray(ws?.connectorAllowList) ? ws!.connectorAllowList : [];
    const ai = ws?.aiSettings?.allowedConnectors;
    return new ConnectorPolicy(allowList, Array.isArray(ai) ? ai : null);
  }

  /** Throws 403 `CONNECTOR_NOT_ALLOWED` when the workspace allow-list blocks `provider`. */
  async assertConnectAllowed(provider: string): Promise<void> {
    const policy = await this.loadPolicy();
    if (!policy.workspaceAllows(provider)) {
      throw new ForbiddenException({ code: 'CONNECTOR_NOT_ALLOWED', provider });
    }
  }

  /**
   * Providers (non-custom) whose connector still exists: a live catalog entry,
   * or an `available` directory entry with that slug. Unknown or disabled
   * directory connectors stop serving tools immediately.
   */
  async usableProviders(providers: readonly string[]): Promise<Set<string>> {
    const usable = new Set<string>();
    const lookup: string[] = [];
    for (const p of new Set(providers)) {
      if (isCustomProvider(p)) continue;
      if (isAvailableCatalogId(p)) usable.add(p);
      else lookup.push(p);
    }
    if (!lookup.length) return usable;
    try {
      const entries = await this.directoryModel
        .find({ slug: { $in: lookup }, available: true }, { slug: 1 })
        .lean<Array<{ slug: string }>>();
      for (const e of entries) usable.add(e.slug);
    } catch (err) {
      // Fail closed for directory-only providers.
      this.logger.warn(`Directory availability lookup failed: ${(err as Error).message}`);
    }
    return usable;
  }

  /** Enabled skill ids for the Bot Factory skill gate. Fails closed to []. */
  async enabledSkillIds(userId: string): Promise<string[]> {
    try {
      const docs = await this.skillModel
        .find({ userId, enabled: true }, { skillId: 1 })
        .lean<Array<{ skillId: string }>>();
      return docs.map((d) => d.skillId);
    } catch (err) {
      this.logger.warn(`Skill lookup failed for ${userId}: ${(err as Error).message}`);
      return [];
    }
  }

  /** Directory-only (non-catalog, non-custom) provider? */
  static isDirectoryOnly(provider: string): boolean {
    return !isCustomProvider(provider) && !isCatalogId(provider);
  }
}
