import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { getOtpEmailStrings, SupportedLocale } from './otp-i18n';

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) {}

  async sendOtpEmail(
    email: string,
    otp: string,
    locale: SupportedLocale | string = 'en',
  ) {
    const t = getOtpEmailStrings(locale);

    await this.mailerService.sendMail({
      to: email,
      subject: t.subject,
      template: './otp', // single template, localized via context (see otp-i18n.ts)
      context: {
        otp,
        email,
        t,
      },
    });
  }
}
