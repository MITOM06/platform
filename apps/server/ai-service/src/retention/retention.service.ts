import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MemoryService } from '../memory/memory.service';
import { KbProcessorService } from '../kb/kb-processor.service';

/**
 * Periodic data-retention job (no external scheduler dependency — a self-managed
 * interval). On each tick it:
 *   - purges memory facts older than `AI_MEMORY_TTL_DAYS` (0 = keep forever)
 *   - purges KB vector chunks whose owning document record no longer exists
 *
 * Right-sized for a small team: a single in-process timer, fail-soft, and fully
 * disableable via `AI_RETENTION_ENABLED=false`.
 */
@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionService.name);
  private readonly enabled: boolean;
  private readonly memoryTtlDays: number;
  private readonly intervalMs: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly memoryService: MemoryService,
    private readonly kbProcessor: KbProcessorService,
  ) {
    this.enabled = this.configService.get<boolean>('config.retention.enabled') ?? true;
    this.memoryTtlDays = this.configService.get<number>('config.retention.memoryTtlDays') ?? 180;
    const hours = this.configService.get<number>('config.retention.intervalHours') ?? 24;
    this.intervalMs = Math.max(1, hours) * 60 * 60 * 1000;
  }

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.log('Retention disabled (AI_RETENTION_ENABLED=false)');
      return;
    }
    // First sweep shortly after boot, then on the configured cadence.
    this.timer = setInterval(() => void this.runSweep(), this.intervalMs);
    // Don't keep the event loop alive solely for the timer.
    this.timer.unref?.();
    setTimeout(() => void this.runSweep(), 60_000).unref?.();
    this.logger.log(
      `Retention enabled: memoryTtlDays=${this.memoryTtlDays}, every ${this.intervalMs / 3_600_000}h`,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Run one retention sweep. Public so it can be triggered/tested directly. */
  async runSweep(): Promise<void> {
    try {
      if (this.memoryTtlDays > 0) {
        const cutoff = Date.now() - this.memoryTtlDays * 24 * 60 * 60 * 1000;
        await this.memoryService.purgeFactsOlderThan(cutoff);
        this.logger.log(`Memory TTL purge complete (cutoff ${new Date(cutoff).toISOString()})`);
      }
      const purged = await this.kbProcessor.purgeOrphanedChunks();
      this.logger.log(`Retention sweep done (orphan KB docs purged: ${purged})`);
    } catch (err) {
      this.logger.error(`Retention sweep failed: ${(err as Error).message}`);
    }
  }
}
