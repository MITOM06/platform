import { Injectable } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { QuotaStatus, UsageService } from './usage.service';

/**
 * The caller-facing view of the monthly AI quota. Resolves the limit exactly
 * like `AiService` does before every request (workspace `monthlyTokenLimit`
 * override, already resolved against `AI_MONTHLY_TOKEN_LIMIT` by
 * SettingsService) so clients stop hard-coding a 500k limit.
 */
@Injectable()
export class QuotaService {
  constructor(
    private readonly usageService: UsageService,
    private readonly settingsService: SettingsService,
  ) {}

  async getQuota(userId: string): Promise<QuotaStatus> {
    const settings = await this.settingsService.getSettings();
    return this.usageService.getQuotaStatus(userId, settings.monthlyTokenLimit);
  }
}
