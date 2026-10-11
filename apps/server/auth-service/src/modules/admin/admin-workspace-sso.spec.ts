jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }));

import { BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service';

/** PATCH /admin/workspace with an `sso` object ("Require SSO" switch). */
// An Owner may change any SSO setting (assertSsoMappingAllowed lets it through).
const OWNER = { sub: 'actor1', role: 'Owner', perms: [] };

describe('AdminService.updateWorkspace — sso', () => {
  let workspaceModel: { findOneAndUpdate: jest.Mock };
  let audit: { record: jest.Mock };
  let sso: { plan: jest.Mock; apply: jest.Mock };
  let service: AdminService;
  const order: string[] = [];

  beforeEach(() => {
    order.length = 0;
    workspaceModel = {
      findOneAndUpdate: jest.fn(() => ({
        exec: async () => {
          order.push('save');
          return { _id: 'ws', name: 'Acme' };
        },
      })),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    sso = {
      plan: jest.fn(async (patch: Record<string, unknown>) => {
        order.push('plan');
        return { sso: { ...patch, enforced: true }, before: {}, after: {} };
      }),
      apply: jest.fn(async () => {
        order.push('apply');
      }),
    };
    service = new AdminService(
      workspaceModel as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      audit as never,
      { publish: jest.fn() } as never,
      sso as never,
    );
  });

  it('validates, stores the planned sso object, then applies (sign-outs) after the save', async () => {
    const patch = { enabled: true, allowedDomains: ['acme.com'] };
    await service.updateWorkspace(OWNER, { sso: patch });
    expect(sso.plan).toHaveBeenCalledWith(patch);
    expect(workspaceModel.findOneAndUpdate).toHaveBeenCalledWith(
      {},
      { $set: { sso: { ...patch, enforced: true } } },
      { new: true, upsert: true },
    );
    expect(sso.apply).toHaveBeenCalledWith(
      expect.objectContaining({ sso: { ...patch, enforced: true } }),
      'actor1',
    );
    expect(order).toEqual(['plan', 'save', 'apply']);
  });

  it('SSO_ENFORCE_NOT_READY → nothing is saved', async () => {
    sso.plan.mockRejectedValue(
      new BadRequestException({ code: 'SSO_ENFORCE_NOT_READY' }),
    );
    await expect(
      service.updateWorkspace(OWNER, { sso: { enforced: true } }),
    ).rejects.toMatchObject({ response: { code: 'SSO_ENFORCE_NOT_READY' } });
    expect(workspaceModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(sso.apply).not.toHaveBeenCalled();
  });

  it('a patch without sso never touches the SSO switch', async () => {
    await service.updateWorkspace(OWNER, { name: 'Acme' });
    expect(sso.plan).not.toHaveBeenCalled();
    expect(sso.apply).not.toHaveBeenCalled();
  });
});
