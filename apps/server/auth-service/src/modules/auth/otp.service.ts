import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomInt, createHash } from 'node:crypto';
import { UsersService } from '../users/users.service';
import { MailService } from '../Email/mail.service';
import { AuthCode } from '../../common/auth-code.enum';

/** How long an emailed OTP stays valid. */
const OTP_TTL_MS = 5 * 60 * 1000;

/**
 * Issues and checks the 6-digit email OTPs used by registration, unverified login, password
 * reset and resend. Extracted from {@link AuthService}, where the generate → hash → store → email
 * sequence was repeated at five call sites.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
  ) {}

  /** Generate a fresh OTP, store its hash on the user, and email the code. */
  async issue(userId: unknown, email: string, locale: string): Promise<void> {
    const otp = randomInt(100000, 1000000).toString();
    const expires = new Date(Date.now() + OTP_TTL_MS);
    await this.usersService.updateOtp(userId, this.hash(otp), expires);
    await this.deliver(email, otp, locale);
  }

  /** Whether {@code otp} is the code whose hash is stored on the user. */
  matches(storedHash: string, otp: string): boolean {
    return storedHash === this.hash(otp);
  }

  /**
   * One-way hash of an OTP before it is persisted. SHA-256 (not bcrypt) is the
   * right tool here: OTPs are short-lived (5 min) and brute-force is already
   * rate-limited at the verify layer, so we only need to ensure a DB dump can't
   * reveal live OTPs. Compare hash-to-hash; never store or match the raw code.
   */
  private hash(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
  }

  /**
   * Send an OTP email, converting a mail-provider failure into a typed 503 instead of letting it
   * escape as an untyped 500.
   *
   * The account row is already written by the time we get here, so a raw throw left the caller
   * with "Internal server error", an account they could not verify, and a retry that took the
   * "unverified → resend" branch and failed identically — a permanent signup deadlock from one
   * SMTP hiccup. With a typed code the client can say "we couldn't send the code" and offer
   * resend, which succeeds as soon as the provider recovers.
   */
  private async deliver(
    email: string,
    otp: string,
    locale: string,
  ): Promise<void> {
    try {
      await this.mailService.sendOtpEmail(email, otp, locale);
    } catch (e) {
      // Log enough to diagnose an outage, and nothing more. The full address is user PII, and a
      // mail-provider error message carries connection/credential detail (nodemailer's is
      // literally "Invalid login: 535-5.7.8 Username and Password not accepted"). Keep the
      // recipient's DOMAIN — "every @acme.com send is failing" is the diagnosis, the local part
      // never is — plus the provider's own error code, which is a stable non-sensitive symbol
      // (EAUTH / ECONNECTION / EENVELOPE) and more actionable than the prose anyway.
      const domain = email.slice(email.lastIndexOf('@'));
      const err = e as { code?: string; responseCode?: number } | undefined;
      const symptom = err?.code ?? (e instanceof Error ? e.name : typeof e);
      this.logger.error(
        `${AuthCode.OTP_SEND_FAILED}: recipient=***${domain} symptom=${symptom}` +
          (err?.responseCode ? ` smtpStatus=${err.responseCode}` : ''),
      );
      throw new ServiceUnavailableException({ code: AuthCode.OTP_SEND_FAILED });
    }
  }
}
