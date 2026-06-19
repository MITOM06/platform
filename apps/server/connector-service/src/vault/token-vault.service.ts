import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EncBlob {
  iv: string;
  tag: string;
  data: string;
}

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
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
    return {
      iv: iv.toString('base64'),
      tag: c.getAuthTag().toString('base64'),
      data: data.toString('base64'),
    };
  }

  decrypt(b: EncBlob): string {
    const d = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(b.iv, 'base64'),
    );
    d.setAuthTag(Buffer.from(b.tag, 'base64'));
    return Buffer.concat([
      d.update(Buffer.from(b.data, 'base64')),
      d.final(),
    ]).toString('utf8');
  }
}
