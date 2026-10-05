import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { getOtpEmailStrings, SupportedLocale } from './otp-i18n';
import { getInviteEmailStrings } from './invite-i18n';
import { getWelcomeEmailStrings, WelcomeVariant } from './welcome-i18n';

export interface InviteEmailContext {
  inviteUrl: string;
  workspaceName: string;
  inviterName: string;
  roleName: string;
}

export interface WelcomeEmailContext {
  loginUrl: string;
  displayName: string;
  workspaceName: string;
  roleName: string;
  variant: WelcomeVariant;
}

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

  /** Invitation email with the one-time accept link (invite-only onboarding). */
  async sendInviteEmail(
    email: string,
    ctx: InviteEmailContext,
    locale: string = 'en',
  ) {
    const t = getInviteEmailStrings(locale, {
      inviter: ctx.inviterName,
      workspace: ctx.workspaceName,
      role: ctx.roleName,
    });

    await this.mailerService.sendMail({
      to: email,
      subject: t.subject,
      template: './invite',
      context: { inviteUrl: ctx.inviteUrl, email, t },
    });
  }

  /** "Your PON account is active" after an invitation is accepted. */
  async sendWelcomeEmail(
    email: string,
    ctx: WelcomeEmailContext,
    locale: string = 'en',
  ) {
    const t = getWelcomeEmailStrings(
      locale,
      {
        name: ctx.displayName,
        workspace: ctx.workspaceName,
        role: ctx.roleName,
      },
      ctx.variant,
    );

    await this.mailerService.sendMail({
      to: email,
      subject: t.subject,
      template: './welcome',
      context: { loginUrl: ctx.loginUrl, email, t },
    });
  }
}
