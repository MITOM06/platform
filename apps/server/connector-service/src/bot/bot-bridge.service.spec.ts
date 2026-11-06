import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BotBridgeService } from './bot-bridge.service';

describe('BotBridgeService', () => {
  let config: { get: jest.Mock };
  let perms: { resolveMember: jest.Mock };
  let botModel: { findOne: jest.Mock };
  let svc: BotBridgeService;

  const bot = (v: unknown) => botModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(v) });

  beforeEach(() => {
    config = { get: jest.fn().mockReturnValue('https://pon.example/mcp') };
    perms = { resolveMember: jest.fn().mockResolvedValue({ exists: true, active: true, perms: new Set() }) };
    botModel = { findOne: jest.fn() };
    bot({ ownerUserId: 'u1' });
    svc = new BotBridgeService(config as any, perms as any, botModel as any);
  });

  describe('requireMcpServerUrl', () => {
    it('returns the configured public MCP URL', () => {
      expect(svc.requireMcpServerUrl()).toBe('https://pon.example/mcp');
      expect(config.get).toHaveBeenCalledWith('mcpServerUrl');
    });

    it.each([undefined, ''])('503 BOT_BRIDGE_DISABLED when unset (%p) — never a localhost fallback', (v) => {
      config.get.mockReturnValue(v);
      const err = (() => {
        try {
          svc.requireMcpServerUrl();
        } catch (e) {
          return e as ServiceUnavailableException;
        }
      })();
      expect(err).toBeInstanceOf(ServiceUnavailableException);
      expect(err!.getResponse()).toEqual({ code: 'BOT_BRIDGE_DISABLED' });
    });
  });

  describe('assertIssuable', () => {
    it('passes for an active member issuing for their own bot', async () => {
      await expect(svc.assertIssuable('u1', 'bot-1')).resolves.toBeUndefined();
      expect(botModel.findOne).toHaveBeenCalledWith({ botUserId: 'bot-1' }, { ownerUserId: 1 });
    });

    it('404 USER_NOT_FOUND for an unknown member (bot never looked up)', async () => {
      perms.resolveMember.mockResolvedValue({ exists: false, active: false, perms: new Set() });
      await expect(svc.assertIssuable('ghost', 'bot-1')).rejects.toMatchObject({
        constructor: NotFoundException,
        response: { code: 'USER_NOT_FOUND' },
      });
      expect(botModel.findOne).not.toHaveBeenCalled();
    });

    it('403 MEMBER_INACTIVE for a blocked member', async () => {
      perms.resolveMember.mockResolvedValue({ exists: true, active: false, perms: new Set() });
      await expect(svc.assertIssuable('u1', 'bot-1')).rejects.toMatchObject({
        constructor: ForbiddenException,
        response: { code: 'MEMBER_INACTIVE' },
      });
    });

    it('404 BOT_NOT_FOUND for an unknown bot', async () => {
      bot(null);
      await expect(svc.assertIssuable('u1', 'nope')).rejects.toMatchObject({
        constructor: NotFoundException,
        response: { code: 'BOT_NOT_FOUND' },
      });
    });

    it.each([{ ownerUserId: 'someone-else' }, {}])(
      '400 BOT_OWNER_MISMATCH when the bot is not the member\'s own (%p)',
      async (doc) => {
        bot(doc);
        await expect(svc.assertIssuable('u1', 'bot-1')).rejects.toMatchObject({
          constructor: BadRequestException,
          response: { code: 'BOT_OWNER_MISMATCH' },
        });
      },
    );
  });
});
