import { LoginAttemptsService } from './login-attempts.service';

describe('LoginAttemptsService — keys use the normalized email', () => {
  function make() {
    const redis = {
      get: jest.fn().mockResolvedValue(null),
      ttl: jest.fn().mockResolvedValue(120),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };
    const config = { get: (_k: string, d?: unknown) => d };
    return {
      svc: new LoginAttemptsService(config as any, redis as any),
      redis,
    };
  }

  it('case variants share one lockout / failed-attempt counter', async () => {
    const { svc, redis } = make();
    await svc.checkBruteForce(' Bob@QC.test ');
    expect(redis.get).toHaveBeenCalledWith('lockout:bob@qc.test');

    await expect(svc.handleFailedLogin('BOB@qc.test')).rejects.toMatchObject({
      response: { code: 'LOGIN_FAILED_WITH_REMAINING' },
    });
    expect(redis.incr).toHaveBeenCalledWith('failed_attempts:bob@qc.test');

    await svc.reset('bob@QC.TEST');
    expect(redis.del).toHaveBeenCalledWith('failed_attempts:bob@qc.test');
  });

  it('locks the normalized key once the limit is reached', async () => {
    const { svc, redis } = make();
    redis.incr.mockResolvedValue(5);
    await expect(svc.handleFailedLogin('Bob@QC.test')).rejects.toMatchObject({
      response: { code: 'LOGIN_FAILED_LOCKED' },
    });
    expect(redis.set).toHaveBeenCalledWith(
      'lockout:bob@qc.test',
      '1',
      'EX',
      300,
    );
  });
});
