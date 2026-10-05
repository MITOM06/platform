import { Logger } from '@nestjs/common';
import { InvitationMailerService } from './invitation-mailer.service';

const ex = (v: unknown) => ({ exec: jest.fn().mockResolvedValue(v) });

describe('InvitationMailerService.sendWelcome', () => {
  let roleModel: { findById: jest.Mock };
  let workspaceModel: { findOne: jest.Mock };
  let mail: { sendWelcomeEmail: jest.Mock };
  let service: InvitationMailerService;
  let logError: jest.SpyInstance;

  const inv = {
    email: 'jane@acme.com',
    roleId: 'role-1',
    locale: 'vi',
  } as any;

  beforeEach(() => {
    roleModel = { findById: jest.fn().mockReturnValue(ex({ name: 'Admin' })) };
    workspaceModel = {
      findOne: jest.fn().mockReturnValue(ex({ name: 'Acme' })),
    };
    mail = { sendWelcomeEmail: jest.fn().mockResolvedValue(undefined) };
    const config = {
      get: (k: string) =>
        k === 'WEB_REDIRECT_URL'
          ? 'https://pon.acme.com/oauth-callback'
          : undefined,
    };
    service = new InvitationMailerService(
      roleModel as any,
      workspaceModel as any,
      {} as any,
      mail as any,
      config as any,
    );
    logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => logError.mockRestore());

  it.each(['google', 'password'] as const)(
    '%s variant: workspace + role + web-origin /login link, invitation locale',
    async (variant) => {
      await service.sendWelcome(inv, 'Jane', variant);
      expect(mail.sendWelcomeEmail).toHaveBeenCalledWith(
        'jane@acme.com',
        {
          loginUrl: 'https://pon.acme.com/login',
          displayName: 'Jane',
          workspaceName: 'Acme',
          roleName: 'Admin',
          variant,
        },
        'vi',
      );
    },
  );

  it('deleted role → "Member"', async () => {
    roleModel.findById.mockReturnValue(ex(null));
    await service.sendWelcome(inv, 'Jane', 'password');
    expect(mail.sendWelcomeEmail.mock.calls[0][1].roleName).toBe('Member');
  });

  it('a mail failure is swallowed and logged without the address', async () => {
    mail.sendWelcomeEmail.mockRejectedValue(
      Object.assign(new Error('Invalid login: 535 secret detail'), {
        code: 'EAUTH',
      }),
    );
    await expect(
      service.sendWelcome(inv, 'Jane', 'google'),
    ).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledWith(
      'WELCOME_SEND_FAILED recipient=***@acme.com symptom=EAUTH',
    );
  });

  it('a lookup failure is swallowed too', async () => {
    workspaceModel.findOne.mockReturnValue({
      exec: jest.fn().mockRejectedValue(new Error('mongo down')),
    });
    await expect(
      service.sendWelcome(inv, 'Jane', 'google'),
    ).resolves.toBeUndefined();
    expect(mail.sendWelcomeEmail).not.toHaveBeenCalled();
  });
});
