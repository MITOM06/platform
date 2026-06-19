import { TokenVaultService } from './token-vault.service';

describe('TokenVaultService', () => {
  const key = Buffer.alloc(32, 7).toString('base64');
  const svc = new TokenVaultService({ get: () => key } as any);

  it('round-trips a secret', () => {
    const blob = svc.encrypt('refresh-token-xyz');
    expect(blob.data).not.toContain('refresh-token-xyz');
    expect(svc.decrypt(blob)).toBe('refresh-token-xyz');
  });

  it('rejects tampered ciphertext', () => {
    const blob = svc.encrypt('secret');
    expect(() =>
      svc.decrypt({ ...blob, tag: Buffer.alloc(16).toString('base64') }),
    ).toThrow();
  });
});
