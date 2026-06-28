import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio, { Twilio } from 'twilio';

/**
 * Thin wrapper around the Twilio REST client used to send transactional SMS
 * (currently only phone-verification OTP codes).
 *
 * Credentials are read from flat env vars (TWILIO_ACCOUNT_SID /
 * TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER) via ConfigService — matching the
 * service's existing config convention (see mail.module.ts), since the
 * `registerAs` namespaced config files in src/config are not loaded.
 */
@Injectable()
export class SmsService {
  private readonly client: Twilio;
  private readonly from: string;
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly config: ConfigService) {
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID') ?? '';
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN') ?? '';
    this.from = this.config.get<string>('TWILIO_PHONE_NUMBER') ?? '';
    this.client = twilio(sid, token);
  }

  async sendSms(to: string, body: string): Promise<void> {
    try {
      await this.client.messages.create({ from: this.from, to, body });
    } catch (err) {
      this.logger.error(`Failed to send SMS to ${to}: ${String(err)}`);
      throw err;
    }
  }
}
