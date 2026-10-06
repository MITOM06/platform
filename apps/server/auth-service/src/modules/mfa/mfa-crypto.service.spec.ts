import { ConfigService } from '@nestjs/config';
import { MfaCryptoService } from './mfa-crypto.service';

const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const make = (sessionSecret?: string) =>
  new MfaCryptoService({
    get: (k: string) => (k === 'SESSION_SECRET' ? sessionSecret : undefined),
  } as unknown as ConfigService);

describe('MfaCryptoService (AES-256-GCM, HKDF from SESSION_SECRET)', () => {
  const crypto = make('a'.repeat(64));

  it('round-trips a TOTP secret', () => {
    const enc = crypto.encrypt(SECRET, 'u1');
    expect(crypto.decrypt(enc, 'u1')).toBe(SECRET);
  });

  it('stores ciphertext, never the plaintext, with a fresh IV each time', () => {
    const a = crypto.encrypt(SECRET, 'u1');
    const b = crypto.encrypt(SECRET, 'u1');
    expect(a).toMatch(/^v1\.[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(a).not.toContain(SECRET);
    expect(a).not.toBe(b);
  });

  it('is bound to the user: another user id cannot decrypt it', () => {
    const enc = crypto.encrypt(SECRET, 'u1');
    expect(() => crypto.decrypt(enc, 'u2')).toThrow();
  });

  it('rejects a tampered ciphertext', () => {
    const [v, iv, tag, ct] = crypto.encrypt(SECRET, 'u1').split('.');
    const flipped = (ct[0] === 'A' ? 'B' : 'A') + ct.slice(1);
    expect(() =>
      crypto.decrypt([v, iv, tag, flipped].join('.'), 'u1'),
    ).toThrow();
    expect(() => crypto.decrypt('garbage', 'u1')).toThrow(
      'Unsupported 2FA secret format',
    );
  });

  it('a rotated SESSION_SECRET cannot decrypt old secrets', () => {
    const enc = crypto.encrypt(SECRET, 'u1');
    expect(() => make('b'.repeat(64)).decrypt(enc, 'u1')).toThrow();
  });

  it('without SESSION_SECRET it fails loudly instead of using a weak key', () => {
    expect(() => make(undefined).encrypt(SECRET, 'u1')).toThrow(
      'SESSION_SECRET is required',
    );
  });
});
