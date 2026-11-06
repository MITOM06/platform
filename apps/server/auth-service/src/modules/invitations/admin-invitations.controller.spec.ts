import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { GUARDS_METADATA, HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Capability, JwtUser } from '@platform/database';
import {
  PERMISSION_KEY,
  RequirePermissionGuard,
} from '../auth/guards/require-permission.guard';
import { AdminInvitationsController } from './admin-invitations.controller';

const ACTOR: JwtUser = {
  sub: 'admin1',
  sid: 's1',
  role: 'Admin',
  perms: [Capability.MANAGE_MEMBERS],
};

function make() {
  const invitations = {
    create: jest.fn().mockResolvedValue({ id: 'inv1' }),
    list: jest.fn().mockResolvedValue([{ id: 'inv1' }]),
    resend: jest.fn().mockResolvedValue({ id: 'inv1' }),
    revoke: jest.fn().mockResolvedValue({ success: true }),
  };
  const ctrl = new AdminInvitationsController(invitations as never);
  return { ctrl, invitations };
}

const ROUTES = ['create', 'list', 'resend', 'revoke'] as const;
const handlerOf = (name: (typeof ROUTES)[number]) =>
  AdminInvitationsController.prototype[name] as (...args: unknown[]) => unknown;

describe('AdminInvitationsController — delegation', () => {
  it.each([
    ['vi-VN,vi;q=0.9,en;q=0.8', 'vi'],
    ['EN-us', 'en'],
    ['xx-YY', 'en'],
    [undefined, 'en'],
  ])(
    'POST /admin/invitations with Accept-Language %p sends the email in %p',
    async (header, locale) => {
      const { ctrl, invitations } = make();
      const dto = { email: 'new@acme.com' } as never;
      await expect(ctrl.create(ACTOR, dto, header)).resolves.toEqual({
        id: 'inv1',
      });
      expect(invitations.create).toHaveBeenCalledWith(ACTOR, dto, locale);
    },
  );

  it('GET lists by the status filter (undefined → service default)', async () => {
    const { ctrl, invitations } = make();
    await expect(ctrl.list({ status: 'accepted' } as never)).resolves.toEqual([
      { id: 'inv1' },
    ]);
    await ctrl.list({} as never);
    expect(invitations.list).toHaveBeenNthCalledWith(1, 'accepted');
    expect(invitations.list).toHaveBeenNthCalledWith(2, undefined);
  });

  it('resend / revoke pass the actor and the route id', async () => {
    const { ctrl, invitations } = make();
    await expect(ctrl.resend(ACTOR, 'inv1')).resolves.toEqual({ id: 'inv1' });
    await expect(ctrl.revoke(ACTOR, 'inv1')).resolves.toEqual({
      success: true,
    });
    expect(invitations.resend).toHaveBeenCalledWith(ACTOR, 'inv1');
    expect(invitations.revoke).toHaveBeenCalledWith(ACTOR, 'inv1');
  });

  it('a NotFoundException from revoke reaches the caller unchanged', async () => {
    const { ctrl, invitations } = make();
    invitations.revoke.mockRejectedValue(
      new NotFoundException({ code: 'INVITATION_NOT_FOUND' }),
    );
    await expect(ctrl.revoke(ACTOR, 'nope')).rejects.toThrow(NotFoundException);
  });
});

describe('AdminInvitationsController — authorization', () => {
  const guard = new RequirePermissionGuard(new Reflector());
  const ctx = (name: (typeof ROUTES)[number], perms?: string[]) =>
    ({
      getHandler: () => AdminInvitationsController.prototype[name],
      getClass: () => AdminInvitationsController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { sub: 'u', perms } }),
      }),
    }) as unknown as ExecutionContext;

  it('JWT auth then capability guard on the whole controller', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AdminInvitationsController),
    ).toEqual([AuthGuard('jwt'), RequirePermissionGuard]);
  });

  it.each(ROUTES)('%s requires MANAGE_MEMBERS', (name) => {
    expect(
      Reflect.getMetadata(
        PERMISSION_KEY,
        AdminInvitationsController.prototype[name],
      ),
    ).toBe(Capability.MANAGE_MEMBERS);
  });

  it.each(ROUTES)(
    '%s: caller with other admin caps but not MANAGE_MEMBERS → 403',
    (name) => {
      expect(() =>
        guard.canActivate(
          ctx(name, [Capability.MANAGE_ROLES, Capability.MANAGE_WORKSPACE]),
        ),
      ).toThrow(ForbiddenException);
    },
  );

  it.each(ROUTES)('%s: caller with MANAGE_MEMBERS passes', (name) => {
    expect(guard.canActivate(ctx(name, [Capability.MANAGE_MEMBERS]))).toBe(
      true,
    );
  });

  it('resend answers 200 (not the POST default 201)', () => {
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handlerOf('resend'))).toBe(
      200,
    );
  });
});
