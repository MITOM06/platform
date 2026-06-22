import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import {
  McpDirectoryEntry,
  McpDirectoryEntryDocument,
} from '../connections/schemas/mcp-directory-entry.schema';
import { DIRECTORY_SEED } from '../connections/directory.seed';
import {
  CreateDirectoryEntryDto,
  DirectoryEntryView,
  UpdateDirectoryEntryDto,
} from './dto/directory.dto';

/**
 * Owns the dynamic MCP connector directory (`mcp_directory` collection):
 * idempotent seeding of well-known servers on boot, the public list, and
 * admin CRUD. The OAuth layer resolves an entry by slug to start a connect
 * flow; the public view never exposes env secret names or token endpoints.
 */
@Injectable()
export class DirectoryService implements OnModuleInit {
  private readonly logger = new Logger(DirectoryService.name);

  constructor(
    @InjectModel(McpDirectoryEntry.name)
    private readonly model: Model<McpDirectoryEntryDocument>,
    private readonly audit: AuditService,
  ) {}

  /** Idempotently upsert the built-in seed entries on boot. */
  async onModuleInit(): Promise<void> {
    try {
      for (const seed of DIRECTORY_SEED) {
        await this.model.updateOne(
          { slug: seed.slug },
          {
            $set: {
              name: seed.name,
              icon: seed.icon,
              description: seed.description,
              mcpUrl: seed.mcpUrl,
              authMode: seed.authMode,
              tier: seed.tier,
              scopes: seed.scopes ?? [],
              available: seed.available ?? true,
              builtin: true,
            },
          },
          { upsert: true },
        );
      }
      this.logger.log(`Seeded ${DIRECTORY_SEED.length} built-in directory entries`);
    } catch (err) {
      this.logger.warn(`Directory seed failed: ${(err as Error).message}`);
    }
  }

  /** Public list — available entries only, secret-free view. */
  async list(): Promise<DirectoryEntryView[]> {
    const docs = await this.model.find({ available: true }).sort({ name: 1 }).lean();
    return docs.map((d) => this.toView(d));
  }

  /** Full entry by slug (internal use — includes env secret names). */
  async findBySlug(slug: string): Promise<McpDirectoryEntryDocument | null> {
    return this.model.findOne({ slug }).exec();
  }

  async create(
    actorId: string,
    dto: CreateDirectoryEntryDto,
  ): Promise<DirectoryEntryView> {
    const exists = await this.model.exists({ slug: dto.slug });
    if (exists) {
      throw new ConflictException(`Directory slug already exists: ${dto.slug}`);
    }
    const created = await this.model.create({
      slug: dto.slug,
      name: dto.name,
      icon: dto.icon ?? '',
      description: dto.description ?? '',
      mcpUrl: dto.mcpUrl,
      authMode: dto.authMode,
      tier: dto.tier ?? 'both',
      scopes: dto.scopes ?? [],
      envClientIdName: dto.envClientIdName,
      envClientSecretName: dto.envClientSecretName,
      authorizeUrl: dto.authorizeUrl,
      tokenUrl: dto.tokenUrl,
      available: dto.available ?? true,
      builtin: false,
      createdBy: actorId,
    });
    await this.audit.record({
      actorId,
      action: 'directory.create',
      targetType: 'directory_entry',
      targetId: dto.slug,
      meta: { name: dto.name, authMode: dto.authMode },
    });
    return this.toView(created.toObject());
  }

  async update(
    actorId: string,
    id: string,
    dto: UpdateDirectoryEntryDto,
  ): Promise<DirectoryEntryView> {
    const updated = await this.model
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .lean();
    if (!updated) {
      throw new NotFoundException('Directory entry not found');
    }
    await this.audit.record({
      actorId,
      action: 'directory.update',
      targetType: 'directory_entry',
      targetId: updated.slug,
      meta: { fields: Object.keys(dto) },
    });
    return this.toView(updated);
  }

  async remove(actorId: string, id: string): Promise<{ deleted: boolean }> {
    const entry = await this.model.findById(id).lean();
    if (!entry) {
      throw new NotFoundException('Directory entry not found');
    }
    if (entry.builtin) {
      throw new ConflictException('Cannot delete a built-in directory entry');
    }
    await this.model.deleteOne({ _id: id });
    await this.audit.record({
      actorId,
      action: 'directory.delete',
      targetType: 'directory_entry',
      targetId: entry.slug,
    });
    return { deleted: true };
  }

  /** Map a stored entry to the public, secret-free view. */
  private toView(d: McpDirectoryEntry & { _id?: unknown }): DirectoryEntryView {
    return {
      id: String(d._id),
      slug: d.slug,
      name: d.name,
      icon: d.icon ?? '',
      description: d.description ?? '',
      mcpUrl: d.mcpUrl,
      authMode: d.authMode,
      tier: d.tier,
      scopes: d.scopes ?? [],
      available: d.available ?? true,
      builtin: d.builtin ?? false,
    };
  }
}
