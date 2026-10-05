import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const FORMAT_VERSION = 'v1';
const HKDF_INFO = 'pon-mfa-totp';
const IV_BYTES = 12;

/**
 * Encrypts TOTP secrets at rest with AES-256-GCM. The key is derived with
 * HKDF-SHA256 from SESSION_SECRET (info "pon-mfa-totp"), so no extra deployment
 * secret is needed. Rotating SESSION_SECRET makes every stored secret
 * undecryptable: affected users must be reset by an Owner and re-enroll.
 *
 * The userId is bound as additional authenticated data, so a ciphertext copied
 * onto another user's document does not decrypt.
 *
 * Payload format: `v1.<iv>.<tag>.<ciphertext>` (base64url parts).
 */
@Injectable()
export class MfaCryptoService {
  private readonly logger = new Logger(MfaCryptoService.name);
  private key: Buffer | null = null;

  constructor(private readonly config: ConfigService) {
    if (!this.config.get<string>('SESSION_SECRET')) {
      // Production refuses to boot without it (main.ts); elsewhere 2FA fails loudly.
      this.logger.error(
        'SESSION_SECRET is not set: 2FA enrollment and verification are unavailable',
      );
    }
  }

  encrypt(plaintext: string, userId: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.getKey(), iv);
    cipher.setAAD(Buffer.from(userId, 'utf8'));
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    return [
      FORMAT_VERSION,
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.');
  }

  /** Throws when the payload was tampered with, belongs to another user or the key changed. */
  decrypt(payload: string, userId: string): string {
    const [version, iv, tag, ciphertext] = payload.split('.');
    if (version !== FORMAT_VERSION || !iv || !tag || ciphertext === undefined) {
      throw new Error('Unsupported 2FA secret format');
    }
    const decipher = createDecipheriv(
      ALGORITHM,
      this.getKey(),
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAAD(Buffer.from(userId, 'utf8'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  private getKey(): Buffer {
    if (this.key) return this.key;
    const secret = this.config.get<string>('SESSION_SECRET');
    if (!secret) {
      throw new Error('SESSION_SECRET is required to encrypt 2FA secrets');
    }
    this.key = Buffer.from(
      hkdfSync('sha256', secret, Buffer.alloc(0), HKDF_INFO, 32),
    );
    return this.key;
  }
}
