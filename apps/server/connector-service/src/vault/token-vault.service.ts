import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EncBlob {
  iv: string;
  tag: string;
  data: string;
}

const IV_BYTES = 12;
/**
 * GCM tag length is pinned: without `authTagLength` Node accepts tags as short
 * as 4 bytes on decrypt, which turns a 128-bit integrity check into a 32-bit
 * one an attacker who can write a blob could brute-force.
 */
const TAG_BYTES = 16;

/**
 * AES-256-GCM token vault. Encrypts/decrypts third-party credentials before
 * they touch MongoDB. The key comes from CONNECTOR_VAULT_KEY (base64, 32 bytes,
 * validated at boot in config/configuration.ts).
 */
@Injectable()
export class TokenVaultService {
  private readonly key: Buffer;

  constructor(cfg: ConfigService) {
    const raw =
      cfg.get<string>('CONNECTOR_VAULT_KEY') ?? cfg.get<string>('vaultKey');
    this.key = Buffer.from(raw!, 'base64');
  }

  encrypt(plain: string): EncBlob {
    const iv = randomBytes(IV_BYTES);
    const c = createCipheriv('aes-256-gcm', this.key, iv, { authTagLength: TAG_BYTES });
    const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
    return {
      iv: iv.toString('base64'),
      tag: c.getAuthTag().toString('base64'),
      data: data.toString('base64'),
    };
  }

  decrypt(b: EncBlob): string {
    const iv = Buffer.from(b?.iv ?? '', 'base64');
    const tag = Buffer.from(b?.tag ?? '', 'base64');
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
      throw new Error('Invalid encrypted blob');
    }
    const d = createDecipheriv('aes-256-gcm', this.key, iv, { authTagLength: TAG_BYTES });
    d.setAuthTag(tag);
    return Buffer.concat([
      d.update(Buffer.from(b.data, 'base64')),
      d.final(),
    ]).toString('utf8');
  }
}
