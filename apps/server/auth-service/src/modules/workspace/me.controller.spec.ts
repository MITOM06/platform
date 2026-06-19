import { Test } from '@nestjs/testing';
import { Capability } from '@platform/database';
import { MeController } from './me.controller';
import { ClaimsService } from '../auth/claims.service';
import { WorkspaceService } from './workspace.service';

describe('MeController', () => {
  let controller: MeController;
  let claims: { resolve: jest.Mock };
  let workspace: { getPublicConfig: jest.Mock };

  beforeEach(async () => {
    claims = {
      resolve: jest.fn().mockResolvedValue({
        role: 'Manager',
        perms: [Capability.USE_PERSONAL_ASSISTANT],
        depts: ['d1'],
      }),
    };
    workspace = {
      getPublicConfig: jest.fn().mockResolvedValue({
        name: 'Acme',
        features: { beta: true },
        connectorAllowList: ['gmail'],
      }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [MeController],
      providers: [
        { provide: ClaimsService, useValue: claims },
        { provide: WorkspaceService, useValue: workspace },
      ],
    }).compile();

    controller = moduleRef.get(MeController);
  });

  it('returns the caller resolved caps + workspace public config', async () => {
    const req = { user: { sub: 'u1' } };
    const res = await controller.capabilities(req as any);

    expect(claims.resolve).toHaveBeenCalledWith('u1');
    expect(res).toEqual({
      role: 'Manager',
      perms: [Capability.USE_PERSONAL_ASSISTANT],
      depts: ['d1'],
      workspace: {
        name: 'Acme',
        features: { beta: true },
        connectorAllowList: ['gmail'],
      },
    });
  });
});
