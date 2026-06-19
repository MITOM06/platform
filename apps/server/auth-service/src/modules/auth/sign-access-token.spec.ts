jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }));

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { REDIS_CLIENT } from '@platform/database';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { ClaimsService } from './claims.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../Email/mail.service';

describe('AuthService.signAccessToken — RBAC claims', () => {
  let service: AuthService;
  let jwt: { sign: jest.Mock };

  beforeEach(async () => {
    jwt = { sign: jest.fn().mockReturnValue('signed.jwt.token') };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: jwt },
        { provide: SessionService, useValue: {} },
        { provide: ClaimsService, useValue: {} },
        { provide: UsersService, useValue: {} },
        { provide: MailService, useValue: {} },
        {
          provide: ConfigService,
          useValue: { get: (k: string) => (k === 'JWT_ACCESS_SECRET' ? 'secret' : undefined) },
        },
        { provide: REDIS_CLIENT, useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('includes role/perms/depts in the signed payload', () => {
    service.signAccessToken({
      sub: 'u1',
      sid: 's1',
      role: 'Admin',
      perms: ['MANAGE_MEMBERS', 'MANAGE_ROLES'],
      depts: ['d1'],
    });

    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'u1',
        sid: 's1',
        role: 'Admin',
        perms: ['MANAGE_MEMBERS', 'MANAGE_ROLES'],
        depts: ['d1'],
      }),
      expect.any(Object),
    );
  });

  it('still signs a minimal payload when claims are omitted (back-compat)', () => {
    service.signAccessToken({ sub: 'u1', sid: 's1' });
    const [payload] = jwt.sign.mock.calls[0];
    expect(payload).toEqual({ sub: 'u1', sid: 's1' });
  });
});
