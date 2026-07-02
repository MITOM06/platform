import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Workspace, WorkspaceDocument } from '@platform/database';

export interface WorkspacePublicConfig {
  name: string;
  features: Record<string, boolean>;
  connectorAllowList: string[];
  /**
   * Configured AI assistant display name (`aiSettings.personaName`). `null` when
   * unset — clients fall back to their localized "AI Assistant" label. Exposed
   * here so non-admin members can label the AI bot without the admin-only
   * workspace endpoint.
   */
  assistantName: string | null;
}

/**
 * Read access to the singleton workspace config. Exposes only the public
 * surface clients need to gate their UI (name, feature flags, connector
 * allow-list) — never secrets.
 */
@Injectable()
export class WorkspaceService {
  constructor(
    @InjectModel(Workspace.name)
    private readonly workspaceModel: Model<WorkspaceDocument>,
  ) {}

  async getPublicConfig(): Promise<WorkspacePublicConfig> {
    const ws = await this.workspaceModel.findOne().lean().exec();
    return {
      name: ws?.name ?? 'PON Workspace',
      features: ws?.features ?? {},
      connectorAllowList: ws?.connectorAllowList ?? [],
      assistantName: ws?.aiSettings?.personaName ?? null,
    };
  }
}
