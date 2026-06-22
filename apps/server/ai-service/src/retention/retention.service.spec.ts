import { ConfigService } from '@nestjs/config';
import { MemoryService } from '../memory/memory.service';
import { KbProcessorService } from '../kb/kb-processor.service';
import { RetentionService } from './retention.service';

function makeConfig(over: Record<string, unknown> = {}): ConfigService {
  const map: Record<string, unknown> = {
    'config.retention.enabled': true,
    'config.retention.memoryTtlDays': 180,
    'config.retention.intervalHours': 24,
    ...over,
  };
  return { get: jest.fn((k: string) => map[k]) } as unknown as ConfigService;
}

describe('RetentionService.runSweep', () => {
  let purgeFactsOlderThan: jest.Mock;
  let purgeOrphanedChunks: jest.Mock;
  let memory: MemoryService;
  let kb: KbProcessorService;

  beforeEach(() => {
    purgeFactsOlderThan = jest.fn().mockResolvedValue(undefined);
    purgeOrphanedChunks = jest.fn().mockResolvedValue(0);
    memory = { purgeFactsOlderThan } as unknown as MemoryService;
    kb = { purgeOrphanedChunks } as unknown as KbProcessorService;
  });

  it('purges memory with a cutoff in the past and purges orphan chunks', async () => {
    const svc = new RetentionService(makeConfig(), memory, kb);
    const before = Date.now();

    await svc.runSweep();

    expect(purgeFactsOlderThan).toHaveBeenCalledTimes(1);
    const cutoff = purgeFactsOlderThan.mock.calls[0][0] as number;
    // 180 days ago is well before "now".
    expect(cutoff).toBeLessThan(before);
    expect(purgeOrphanedChunks).toHaveBeenCalledTimes(1);
  });

  it('skips memory purge when TTL is 0 (keep forever) but still purges orphans', async () => {
    const svc = new RetentionService(makeConfig({ 'config.retention.memoryTtlDays': 0 }), memory, kb);

    await svc.runSweep();

    expect(purgeFactsOlderThan).not.toHaveBeenCalled();
    expect(purgeOrphanedChunks).toHaveBeenCalledTimes(1);
  });

  it('never throws when a purge step fails', async () => {
    purgeOrphanedChunks.mockRejectedValue(new Error('qdrant down'));
    const svc = new RetentionService(makeConfig(), memory, kb);

    await expect(svc.runSweep()).resolves.toBeUndefined();
  });
});
