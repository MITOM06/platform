import { ForbiddenException, Logger } from '@nestjs/common';
import { ConnectorPolicyService } from './connector-policy.service';
import { ConnectorPolicy, isAvailableCatalogId, skillGateAllows } from './connector-policy';

/** `model.<method>(...).lean()` chain resolving to `result` (or rejecting with it). */
function leanChain(result: unknown, reject = false) {
  const lean = jest.fn(() => (reject ? Promise.reject(result) : Promise.resolve(result)));
  return { lean };
}

describe('ConnectorPolicyService', () => {
  let workspaceModel: { findOne: jest.Mock };
  let directoryModel: { find: jest.Mock };
  let skillModel: { find: jest.Mock };
  let svc: ConnectorPolicyService;

  beforeEach(() => {
    workspaceModel = { findOne: jest.fn() };
    directoryModel = { find: jest.fn() };
    skillModel = { find: jest.fn() };
    svc = new ConnectorPolicyService(workspaceModel as any, directoryModel as any, skillModel as any);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  const workspace = (doc: unknown) => workspaceModel.findOne.mockReturnValue(leanChain(doc));

  describe('loadPolicy', () => {
    it('reads only the policy fields of the workspace singleton', async () => {
      workspace({ connectorAllowList: ['gmail'], aiSettings: { allowedConnectors: ['notion'] } });
      const policy = await svc.loadPolicy();
      expect(workspaceModel.findOne).toHaveBeenCalledWith({}, { connectorAllowList: 1, aiSettings: 1 });
      expect(policy.allowList).toEqual(['gmail']);
      expect(policy.aiAllowed).toEqual(['notion']);
    });

    it('no workspace doc → allow-all list and AI inherits (null)', async () => {
      workspace(null);
      const policy = await svc.loadPolicy();
      expect(policy.allowList).toEqual([]);
      expect(policy.aiAllowed).toBeNull();
    });

    it('malformed fields (non-array) fall back to allow-all / inherit', async () => {
      workspace({ connectorAllowList: 'gmail', aiSettings: { allowedConnectors: 'gmail' } });
      const policy = await svc.loadPolicy();
      expect(policy.allowList).toEqual([]);
      expect(policy.aiAllowed).toBeNull();
    });

    it('AI allowedConnectors = [] is kept as "AI may use NO connector" (not inherit)', async () => {
      workspace({ connectorAllowList: [], aiSettings: { allowedConnectors: [] } });
      const policy = await svc.loadPolicy();
      expect(policy.aiAllowed).toEqual([]);
      expect(policy.aiAllows('gmail')).toBe(false);
      expect(policy.aiAllows('notion')).toBe(false);
    });

    it('propagates a db error so callers can fail closed', async () => {
      workspaceModel.findOne.mockReturnValue(leanChain(new Error('mongo down'), true));
      await expect(svc.loadPolicy()).rejects.toThrow('mongo down');
    });
  });

  describe('assertConnectAllowed', () => {
    it('BLOCKS a catalog connector missing from a non-empty allow-list with 403 CONNECTOR_NOT_ALLOWED', async () => {
      workspace({ connectorAllowList: ['notion'] });
      const err = await svc.assertConnectAllowed('gmail').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).getStatus()).toBe(403);
      expect((err as ForbiddenException).getResponse()).toEqual({
        code: 'CONNECTOR_NOT_ALLOWED',
        provider: 'gmail',
      });
    });

    it('allows a catalog connector that is on the allow-list', async () => {
      workspace({ connectorAllowList: ['notion', 'gmail'] });
      await expect(svc.assertConnectAllowed('gmail')).resolves.toBeUndefined();
    });

    it('empty allow-list allows every catalog connector', async () => {
      workspace({ connectorAllowList: [] });
      await expect(svc.assertConnectAllowed('calendar')).resolves.toBeUndefined();
    });

    it('directory-only and custom providers are not governed by the catalog allow-list', async () => {
      workspace({ connectorAllowList: ['notion'] });
      await expect(svc.assertConnectAllowed('stripe')).resolves.toBeUndefined();
      await expect(svc.assertConnectAllowed('custom:abc')).resolves.toBeUndefined();
    });

    it('a db error rejects (never silently allows)', async () => {
      workspaceModel.findOne.mockReturnValue(leanChain(new Error('timeout'), true));
      await expect(svc.assertConnectAllowed('gmail')).rejects.toThrow('timeout');
    });
  });

  describe('usableProviders', () => {
    it('live catalog ids are usable without a db lookup; custom providers never are', async () => {
      const usable = await svc.usableProviders(['notion', 'gmail', 'custom:x', 'custom_y']);
      expect([...usable].sort()).toEqual(['gmail', 'notion']);
      expect(directoryModel.find).not.toHaveBeenCalled();
    });

    it('directory providers are usable only when an available entry exists (deduped lookup)', async () => {
      directoryModel.find.mockReturnValue(leanChain([{ slug: 'stripe' }]));
      const usable = await svc.usableProviders(['stripe', 'linear', 'stripe', 'notion']);
      expect(directoryModel.find).toHaveBeenCalledWith(
        { slug: { $in: ['stripe', 'linear'] }, available: true },
        { slug: 1 },
      );
      expect([...usable].sort()).toEqual(['notion', 'stripe']);
    });

    it('an unavailable catalog id (drive) is NOT usable unless the directory has it available', async () => {
      directoryModel.find.mockReturnValue(leanChain([]));
      const usable = await svc.usableProviders(['drive']);
      expect(directoryModel.find).toHaveBeenCalledWith(
        { slug: { $in: ['drive'] }, available: true },
        { slug: 1 },
      );
      expect(usable.has('drive')).toBe(false);
    });

    it('FAILS CLOSED for directory providers when the lookup throws, keeping catalog ones', async () => {
      directoryModel.find.mockReturnValue(leanChain(new Error('db down'), true));
      const usable = await svc.usableProviders(['stripe', 'gmail']);
      expect([...usable]).toEqual(['gmail']);
      expect(Logger.prototype.warn).toHaveBeenCalledWith('Directory availability lookup failed: db down');
    });

    it('empty input → empty set, no lookup', async () => {
      expect((await svc.usableProviders([])).size).toBe(0);
      expect(directoryModel.find).not.toHaveBeenCalled();
    });
  });

  describe('enabledSkillIds', () => {
    it('returns the enabled skill ids of that user only', async () => {
      skillModel.find.mockReturnValue(leanChain([{ skillId: 'scheduler' }, { skillId: 'mailWriter' }]));
      await expect(svc.enabledSkillIds('u1')).resolves.toEqual(['scheduler', 'mailWriter']);
      expect(skillModel.find).toHaveBeenCalledWith({ userId: 'u1', enabled: true }, { skillId: 1 });
    });

    it('FAILS CLOSED to [] on a db error', async () => {
      skillModel.find.mockReturnValue(leanChain(new Error('boom'), true));
      await expect(svc.enabledSkillIds('u1')).resolves.toEqual([]);
      expect(Logger.prototype.warn).toHaveBeenCalledWith('Skill lookup failed for u1: boom');
    });
  });

  describe('isDirectoryOnly', () => {
    it.each([
      ['stripe', true],
      ['notion', false],
      ['drive', false],
      ['custom:abc', false],
    ])('%s → %s', (provider, expected) => {
      expect(ConnectorPolicyService.isDirectoryOnly(provider)).toBe(expected);
    });
  });
});

describe('ConnectorPolicy (pure gates)', () => {
  it('aiAllows: null inherits, a list narrows, custom servers are dropped when narrowed', () => {
    expect(new ConnectorPolicy([], null).aiAllows('custom:x')).toBe(true);
    const narrowed = new ConnectorPolicy([], ['gmail']);
    expect(narrowed.aiAllows('gmail')).toBe(true);
    expect(narrowed.aiAllows('notion')).toBe(false);
    expect(narrowed.aiAllows('custom:x')).toBe(false);
  });

  it('allowAll allows every catalog connector and AI inherits', () => {
    const p = ConnectorPolicy.allowAll();
    expect(p.workspaceAllows('gmail')).toBe(true);
    expect(p.aiAllows('gmail')).toBe(true);
  });

  it('skillGateAllows: gated providers need a matching enabled skill; others never gated', () => {
    expect(skillGateAllows('gmail', [])).toBe(false);
    expect(skillGateAllows('gmail', ['scheduler'])).toBe(false);
    expect(skillGateAllows('gmail', ['inboxTriage'])).toBe(true);
    expect(skillGateAllows('calendar', ['scheduler'])).toBe(true);
    expect(skillGateAllows('notion', ['unknownSkill'])).toBe(false);
    expect(skillGateAllows('stripe', [])).toBe(true);
  });

  it('isAvailableCatalogId: live catalog only', () => {
    expect(isAvailableCatalogId('notion')).toBe(true);
    expect(isAvailableCatalogId('drive')).toBe(false);
    expect(isAvailableCatalogId('stripe')).toBe(false);
  });
});
