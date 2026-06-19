import { Test } from '@nestjs/testing';
import { CatalogController } from './catalog.controller';

describe('CatalogController', () => {
  let controller: CatalogController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CatalogController],
    }).compile();
    controller = moduleRef.get(CatalogController);
  });

  it('returns a notion oauth2 entry', () => {
    const list = controller.list();
    expect(Array.isArray(list)).toBe(true);
    const notion = list.find((e) => e.id === 'notion');
    expect(notion).toBeDefined();
    expect(notion!.authType).toBe('oauth2');
  });

  it('never leaks oauth secret env names in the public payload', () => {
    const json = JSON.stringify(controller.list());
    expect(json).not.toContain('clientSecretEnv');
    expect(json).not.toContain('clientIdEnv');
  });
});
