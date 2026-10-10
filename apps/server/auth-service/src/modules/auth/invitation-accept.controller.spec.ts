jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }));

import { InvitationAcceptController } from './invitation-accept.controller';
import { ssoRequired } from '../sso/sso-policy.service';

describe('InvitationAcceptController — accept-password', () => {
  const user = { _id: 'u1', email: 'jane@acme.com', displayName: 'Jane' };
  const mfaRequired = {
    code: 'MFA_REQUIRED',
    mfaToken: 'tok',
    enrollmentRequired: true,
    user: { id: 'u1', email: 'jane@acme.com', displayName: 'Jane' },
  };
  let invitations: { acceptWithPassword: jest.Mock };
  let auth: { startSignIn: jest.Mock; issueTokensForUser: jest.Mock };
  let controller: InvitationAcceptController;

  beforeEach(() => {
    invitations = { acceptWithPassword: jest.fn().mockResolvedValue(user) };
    auth = {
      startSignIn: jest.fn().mockResolvedValue(mfaRequired),
      issueTokensForUser: jest.fn(),
    };
    controller = new InvitationAcceptController(
      invitations as never,
      auth as never,
    );
  });

  it('Owner / Admin-like invite role: MFA_REQUIRED (enrollment) like a password login — no tokens', async () => {
    const dto = {
      displayName: 'Jane',
      password: 'Str0ngPassw0rd',
      deviceId: 'd',
      platform: 'mobile',
    };
    await expect(controller.acceptPassword('tok', dto as any)).resolves.toEqual(
      mfaRequired,
    );
    expect(auth.startSignIn).toHaveBeenCalledWith(user, {
      deviceId: 'd',
      platform: 'mobile',
      method: 'invite',
    });
    expect(auth.issueTokensForUser).not.toHaveBeenCalled();
  });

  it('Member invite role: LOGIN_SUCCESS + tokens from the sign-in, passed through', async () => {
    const signedIn = {
      code: 'LOGIN_SUCCESS',
      accessToken: 'a',
      refreshToken: 'r',
      sid: 's',
      user: {
        id: 'u1',
        email: 'jane@acme.com',
        displayName: 'Jane',
        mustSetPassword: false,
      },
    };
    auth.startSignIn.mockResolvedValue(signedIn);
    await expect(
      controller.acceptPassword('tok', {
        displayName: 'Jane',
        password: 'Str0ngPassw0rd',
      } as any),
    ).resolves.toEqual(signedIn);
    expect(auth.startSignIn).toHaveBeenCalledWith(
      user,
      expect.objectContaining({ method: 'invite' }),
    );
  });

  it('web defaults for device / platform', async () => {
    await controller.acceptPassword('tok', {
      displayName: 'J',
      password: 'p',
    } as any);
    expect(auth.startSignIn).toHaveBeenCalledWith(user, {
      deviceId: 'web-login',
      platform: 'web',
      method: 'invite',
    });
  });

  it('SSO_REQUIRED from the accept is passed through, nothing signed in', async () => {
    invitations.acceptWithPassword.mockRejectedValue(ssoRequired());
    await expect(
      controller.acceptPassword('tok', {
        displayName: 'J',
        password: 'p',
      } as any),
    ).rejects.toMatchObject({
      status: 403,
      response: { code: 'SSO_REQUIRED' },
    });
    expect(auth.startSignIn).not.toHaveBeenCalled();
  });
});
