import { model } from 'mongoose';
import { UserSchema } from '@platform/database';
import { BackupCodesCountService } from './backup-codes-count.service';

describe('BackupCodesCountService (/me count)', () => {
  /** findById(...).select(...).lean().exec() chain that records the select. */
  function serviceReturning(result: unknown) {
    const select = jest.fn();
    const query = {
      select: (sel: string) => {
        select(sel);
        return query;
      },
      lean: () => query,
      exec: () =>
        result instanceof Error
          ? Promise.reject(result)
          : Promise.resolve(result),
    };
    const findById = jest.fn(() => query);
    return {
      service: new BackupCodesCountService({ findById } as any),
      findById,
      select,
    };
  }

  it('counts the hashes and returns only a number', async () => {
    const { service, findById, select } = serviceReturning({
      _id: 'u1',
      mfa: { backupCodeHashes: ['h1', 'h2', 'h3'] },
    });

    await expect(service.remaining('u1')).resolves.toBe(3);
    expect(findById).toHaveBeenCalledWith('u1');
    // Nothing but the hashes (and _id) is loaded, and never the TOTP secret.
    expect(select).toHaveBeenCalledWith('mfa.backupCodeHashes');
  });

  it.each([
    ['all codes used', { mfa: { backupCodeHashes: [] } }],
    ['an enrollment with no list', { mfa: {} }],
  ])('%s → a real 0', async (_name, doc) => {
    const { service } = serviceReturning(doc);
    await expect(service.remaining('u1')).resolves.toBe(0);
  });

  it.each([
    ['the account is gone', null],
    ['the read fails', new Error('mongo down')],
  ])('%s → unknown, not 0', async (_name, result) => {
    const { service } = serviceReturning(result);
    await expect(service.remaining('u1')).resolves.toBeUndefined();
  });
});

describe('User schema: the 2FA secrets stay out of ordinary reads', () => {
  // A real Mongoose model, no database: `_applyPaths()` resolves the projection
  // that would be sent to Mongo, including the schema's select:false paths.
  const User = model('BackupCodesCountSpecUser', UserSchema);
  const fieldsOf = (query: any) => {
    query._applyPaths();
    return query._fields;
  };

  it('the read behind /me and profiles hides the hashes and the secret', () => {
    expect(fieldsOf(User.findById('u1').select('-password'))).toMatchObject({
      'mfa.backupCodeHashes': 0,
      'mfa.secretEnc': 0,
    });
  });

  it('the count reads only the hashes, never the secret', () => {
    expect(
      fieldsOf(User.findById('u1').select('mfa.backupCodeHashes')),
    ).toEqual({ 'mfa.backupCodeHashes': 1 });
  });
});
