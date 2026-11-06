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

describe('InvitationMailerService.send (invite email)', () => {
  let roleModel: { findById: jest.Mock };
  let workspaceModel: { findOne: jest.Mock };
  let usersService: { findById: jest.Mock };
  let mail: { sendInviteEmail: jest.Mock };
  let service: InvitationMailerService;
  let logError: jest.SpyInstance;

  const TOKEN = 'tok_abcdefghijklmnopqrstuvwxyz';
  const inv = {
    email: 'jane@acme.com',
    roleId: 'role-1',
    invitedBy: 'u-admin',
    locale: 'en',
  } as any;

  beforeEach(() => {
    roleModel = { findById: jest.fn().mockReturnValue(ex({ name: 'Admin' })) };
    workspaceModel = { findOne: jest.fn().mockReturnValue(ex({ name: 'Acme' })) };
    usersService = { findById: jest.fn().mockResolvedValue({ displayName: 'Alice' }) };
    mail = { sendInviteEmail: jest.fn().mockResolvedValue(undefined) };
    const config = {
      get: (k: string) =>
        k === 'WEB_REDIRECT_URL' ? 'https://pon.acme.com/oauth-callback' : undefined,
    };
    service = new InvitationMailerService(
      roleModel as any,
      workspaceModel as any,
      usersService as any,
      mail as any,
      config as any,
    );
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => logError.mockRestore());

  it('sends the web-origin /invite/<token> link with workspace, inviter and role → true', async () => {
    await expect(service.send(inv, TOKEN)).resolves.toBe(true);
    expect(roleModel.findById).toHaveBeenCalledWith('role-1');
    expect(usersService.findById).toHaveBeenCalledWith('u-admin');
    expect(mail.sendInviteEmail).toHaveBeenCalledWith(
      'jane@acme.com',
      {
        inviteUrl: `https://pon.acme.com/invite/${TOKEN}`,
        workspaceName: 'Acme',
        inviterName: 'Alice',
        roleName: 'Admin',
      },
      'en',
    );
  });

  it('system inviter → workspace name, without a user lookup', async () => {
    await service.send({ ...inv, invitedBy: 'system' }, TOKEN);
    expect(usersService.findById).not.toHaveBeenCalled();
    expect(mail.sendInviteEmail.mock.calls[0][1].inviterName).toBe('Acme');
  });

  it('deleted inviter / no workspace / deleted role → fallbacks "PON" + "Member"', async () => {
    usersService.findById.mockResolvedValue(null);
    workspaceModel.findOne.mockReturnValue(ex(null));
    roleModel.findById.mockReturnValue(ex(null));
    await service.send(inv, TOKEN);
    expect(mail.sendInviteEmail.mock.calls[0][1]).toMatchObject({
      workspaceName: 'PON',
      inviterName: 'PON',
      roleName: 'Member',
    });
  });

  it('no WEB_REDIRECT_URL → falls back to the local web origin', async () => {
    service = new InvitationMailerService(
      roleModel as any,
      workspaceModel as any,
      usersService as any,
      mail as any,
      { get: () => undefined } as any,
    );
    await service.send(inv, TOKEN);
    expect(mail.sendInviteEmail.mock.calls[0][1].inviteUrl).toBe(
      `http://localhost:3000/invite/${TOKEN}`,
    );
  });

  it('SMTP failure → false, logged with masked recipient + provider code, never the token or address', async () => {
    mail.sendInviteEmail.mockRejectedValue(
      Object.assign(new Error('535 bad creds for jane@acme.com'), { code: 'EAUTH' }),
    );
    await expect(service.send(inv, TOKEN)).resolves.toBe(false);
    expect(logError).toHaveBeenCalledWith('INVITE_SEND_FAILED recipient=***@acme.com symptom=EAUTH');
    const logged = logError.mock.calls.flat().join(' ');
    expect(logged).not.toContain('jane@');
    expect(logged).not.toContain(TOKEN);
  });

  it('non-Error rejection without code → symptom is its typeof; Error without code → its name', async () => {
    mail.sendInviteEmail.mockRejectedValueOnce('boom');
    await expect(service.send(inv, TOKEN)).resolves.toBe(false);
    expect(logError).toHaveBeenLastCalledWith('INVITE_SEND_FAILED recipient=***@acme.com symptom=string');

    roleModel.findById.mockReturnValue({ exec: jest.fn().mockRejectedValue(new TypeError('x')) });
    await expect(service.send(inv, TOKEN)).resolves.toBe(false);
    expect(logError).toHaveBeenLastCalledWith('INVITE_SEND_FAILED recipient=***@acme.com symptom=TypeError');
  });
});
