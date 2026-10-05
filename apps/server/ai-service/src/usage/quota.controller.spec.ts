import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard, PERMISSION_KEY } from '@platform/database';
import { UsageController } from './usage.controller';
import { QuotaService } from './quota.service';
import { UsageService } from './usage.service';
import { SettingsService } from '../settings/settings.service';

describe('GET /usage/quota', () => {
  it('is mounted at usage/quota behind the JWT guard with no admin capability', () => {
    expect(Reflect.getMetadata(PATH_METADATA, UsageController)).toBe('usage');
    const handler = UsageController.prototype.getQuota;
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('quota');
    expect(Reflect.getMetadata(GUARDS_METADATA, UsageController)).toContain(JwtAuthGuard);
    // Any signed-in member may read their OWN quota — unlike /usage/dashboard.
    expect(Reflect.getMetadata(PERMISSION_KEY, handler)).toBeUndefined();
    expect(
      Reflect.getMetadata(PERMISSION_KEY, UsageController.prototype.getDashboard),
    ).toBeDefined();
  });

  it("returns the caller's quota (req.user.sub) computed with the workspace limit", async () => {
    const getQuotaStatus = jest.fn().mockResolvedValue({
      used: 1200,
      limit: 2000,
      periodStart: '2026-10-01T00:00:00.000Z',
      periodEnd: '2026-11-01T00:00:00.000Z',
    });
    const quota = new QuotaService(
      { getQuotaStatus } as unknown as UsageService,
      { getSettings: jest.fn().mockResolvedValue({ monthlyTokenLimit: 2000 }) } as unknown as SettingsService,
    );
    const controller = new UsageController({} as never, quota);

    const res = await controller.getQuota({ user: { sub: 'user-7' } } as never);

    // Same limit source as AiService's enforcement (resolved workspace setting).
    expect(getQuotaStatus).toHaveBeenCalledWith('user-7', 2000);
    expect(res).toEqual({
      used: 1200,
      limit: 2000,
      periodStart: '2026-10-01T00:00:00.000Z',
      periodEnd: '2026-11-01T00:00:00.000Z',
    });
  });
});
