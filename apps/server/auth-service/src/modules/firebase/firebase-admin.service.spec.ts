const apps: unknown[] = [];
const initializeApp = jest.fn(() => apps.push({}));
const cert = jest.fn((sa) => ({ cert: sa }));
const verifyIdToken = jest.fn();
jest.mock('firebase-admin', () => ({
  apps,
  initializeApp: (...a: unknown[]) => initializeApp(...(a as [])),
  credential: { cert: (sa: unknown) => cert(sa) },
  auth: () => ({ verifyIdToken }),
}));

import { Logger } from '@nestjs/common';
import { FirebaseAdminService } from './firebase-admin.service';

describe('FirebaseAdminService', () => {
  let logError: jest.SpyInstance;
  const make = (b64?: string) =>
    new FirebaseAdminService({ get: (k: string) => (k === 'FIREBASE_SERVICE_ACCOUNT_BASE64' ? b64 : undefined) } as never);

  beforeEach(() => {
    apps.length = 0;
    jest.clearAllMocks();
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('missing FIREBASE_SERVICE_ACCOUNT_BASE64 → logs, does not initialize (phone auth disabled, boot continues)', () => {
    expect(() => make(undefined).onModuleInit()).not.toThrow();
    expect(initializeApp).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith(expect.stringContaining('FIREBASE_SERVICE_ACCOUNT_BASE64 is not set'));
  });

  it('decodes the base64 service account and initializes once', () => {
    const sa = { project_id: 'p', client_email: 'e', private_key: 'k' };
    const b64 = Buffer.from(JSON.stringify(sa)).toString('base64');
    make(b64).onModuleInit();
    expect(cert).toHaveBeenCalledWith(sa);
    expect(initializeApp).toHaveBeenCalledWith({ credential: { cert: sa } });

    make(b64).onModuleInit(); // hot-reload: app already exists
    expect(initializeApp).toHaveBeenCalledTimes(1);
  });

  it('malformed base64 JSON throws at boot (fail loud, not a silent half-config)', () => {
    expect(() => make(Buffer.from('not json').toString('base64')).onModuleInit()).toThrow(SyntaxError);
    expect(initializeApp).not.toHaveBeenCalled();
  });

  it('verifyIdToken delegates and propagates rejection (invalid / expired token)', async () => {
    verifyIdToken.mockResolvedValueOnce({ uid: 'u', phone_number: '+84' });
    await expect(make('x').verifyIdToken('t')).resolves.toEqual({ uid: 'u', phone_number: '+84' });
    expect(verifyIdToken).toHaveBeenCalledWith('t');
    verifyIdToken.mockRejectedValueOnce(new Error('auth/id-token-expired'));
    await expect(make('x').verifyIdToken('t')).rejects.toThrow('auth/id-token-expired');
  });
});
