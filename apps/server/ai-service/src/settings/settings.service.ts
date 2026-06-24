import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Workspace } from './workspace.schema';
import {
  ResolvedAiSettings,
  normalizeModelTier,
} from './resolved-ai-settings';

/** In-memory cache TTL safety net (ms) — converges even if a publish is missed. */
const CACHE_TTL_MS = 60_000;

/** Shape of the persisted aiSettings sub-doc (all fields nullable). */
type StoredAiSettings = NonNullable<Workspace['aiSettings']>;

/**
 * Read-only resolver for workspace-level AI settings (TASK-12). Loads the
 * singleton `workspaces` doc from the shared `platform` DB, resolves each field
 * against the ai-service env defaults (null ⇒ env), and caches the result
 * in-memory. ai-service NEVER writes this collection.
 *
 * Cache invalidation: `invalidate()` (driven by Redis pub/sub on
 * `ai:settings:invalidate`) drops the cache so the next request reloads. A 60s
 * TTL is the safety net if an invalidation message is ever lost.
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  private cache: ResolvedAiSettings | null = null;
  private cacheAt = 0;
  private inflight: Promise<ResolvedAiSettings> | null = null;

  constructor(
    @InjectModel(Workspace.name) private readonly workspaceModel: Model<Workspace>,
    private readonly config: ConfigService,
  ) {}

  /** Resolved settings (cached). Falls back to pure-env defaults on any error. */
  async getSettings(): Promise<ResolvedAiSettings> {
    const fresh = this.cache && Date.now() - this.cacheAt < CACHE_TTL_MS;
    if (fresh) return this.cache as ResolvedAiSettings;

    // Collapse concurrent reloads into a single DB read.
    if (this.inflight) return this.inflight;

    this.inflight = this.load()
      .then((resolved) => {
        this.cache = resolved;
        this.cacheAt = Date.now();
        return resolved;
      })
      .catch((err) => {
        this.logger.warn(
          `Failed to load workspace AI settings — using env defaults: ${(err as Error).message}`,
        );
        // Serve env-only defaults; do NOT cache the failure so the next call retries.
        return this.resolve(null);
      })
      .finally(() => {
        this.inflight = null;
      });

    return this.inflight;
  }

  /** Drop the in-memory cache; the next getSettings() reloads from Mongo. */
  invalidate(): void {
    this.cache = null;
    this.cacheAt = 0;
    this.logger.log('AI settings cache invalidated');
  }

  private async load(): Promise<ResolvedAiSettings> {
    const ws = await this.workspaceModel
      .findOne({}, { aiSettings: 1 })
      .lean()
      .exec();
    return this.resolve((ws as { aiSettings?: StoredAiSettings } | null)?.aiSettings ?? null);
  }

  /** Resolve each stored field against env defaults. `null`/absent ⇒ env. */
  resolve(stored: StoredAiSettings | null): ResolvedAiSettings {
    const s = stored ?? {};
    return {
      personaName: s.personaName ?? null,
      defaultTone: s.defaultTone ?? null,
      modelTier: normalizeModelTier(s.modelTier ?? 'auto'),
      webSearchEnabled:
        s.webSearchEnabled ?? this.envBool('config.webSearch.enabled', true),
      thinkingEnabled:
        s.thinkingEnabled ?? this.envBool('config.ai.enableThinking', false),
      monthlyTokenLimit:
        s.monthlyTokenLimit ??
        this.config.get<number>('config.quota.monthlyTokenLimit') ??
        500000,
      // null = inherit (no AI filter); [] preserved as "allow none".
      allowedConnectors: s.allowedConnectors ?? null,
      dailyDigestEnabled:
        s.dailyDigestEnabled ?? this.envBool('config.digest.enabled', false),
      dailyDigestHour:
        s.dailyDigestHour ?? this.config.get<number>('config.digest.hour') ?? 8,
    };
  }

  private envBool(key: string, fallback: boolean): boolean {
    const v = this.config.get<boolean>(key);
    return typeof v === 'boolean' ? v : fallback;
  }
}
