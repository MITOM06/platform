import { Test } from '@nestjs/testing';
import { CatalogController } from './catalog.controller';
import { ConnectorPolicy } from '../governance/connector-policy';
import { ConnectorPolicyService } from '../governance/connector-policy.service';

describe('CatalogController', () => {
  let controller: CatalogController;
  let loadPolicy: jest.Mock;

  beforeEach(async () => {
    loadPolicy = jest.fn().mockResolvedValue(ConnectorPolicy.allowAll());
    const moduleRef = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [{ provide: ConnectorPolicyService, useValue: { loadPolicy } }],
    }).compile();
    controller = moduleRef.get(CatalogController);
  });

  it('returns a notion oauth2 entry', async () => {
    const list = await controller.list();
    expect(Array.isArray(list)).toBe(true);
    const notion = list.find((e) => e.id === 'notion');
    expect(notion).toBeDefined();
    expect(notion!.authType).toBe('oauth2');
  });

  it('never leaks oauth secret env names in the public payload', async () => {
    const json = JSON.stringify(await controller.list());
    expect(json).not.toContain('clientSecretEnv');
    expect(json).not.toContain('clientIdEnv');
  });

  it('flags connectors the workspace allow-list leaves out', async () => {
    loadPolicy.mockResolvedValue(new ConnectorPolicy(['notion', 'calendar'], null));
    const list = await controller.list();
    expect(list.find((e) => e.id === 'gmail')!.allowedByWorkspace).toBe(false);
    expect(list.find((e) => e.id === 'notion')!.allowedByWorkspace).toBe(true);
  });

  it('an empty allow-list (or an unreadable policy) allows everything', async () => {
    expect((await controller.list()).every((e) => e.allowedByWorkspace)).toBe(true);
    loadPolicy.mockRejectedValue(new Error('mongo down'));
    expect((await controller.list()).every((e) => e.allowedByWorkspace)).toBe(true);
  });
});
