import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createHash } from 'crypto';
import { BotSessionService } from './bot-session.service';
import { BotSession } from './bot-session.schema';

const mockModel = () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
});
const DAY = 24 * 60 * 60 * 1000;

describe('BotSessionService', () => {
  let service: BotSessionService;
  let model: ReturnType<typeof mockModel>;

  beforeEach(async () => {
    model = mockModel();
    const module = await Test.createTestingModule({
      providers: [
        BotSessionService,
        { provide: getModelToken(BotSession.name), useValue: model },
        { provide: ConfigService, useValue: { get: (k: string) => (k === 'botSessionTtlDays' ? 30 : undefined) } },
      ],
    }).compile();
    service = module.get(BotSessionService);
    model.updateOne.mockReturnValue({ catch: jest.fn().mockResolvedValue(undefined) });
  });

  const sessionFor = (token: string, extra: Record<string, unknown>) => {
    const hash = createHash('sha256').update(token).digest('hex');
    model.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: 'id1', userId: 'u1', botUserId: 'extbot:b1', tokenHash: hash, ...extra }),
    });
  };

  it('issue() returns a 32-byte hex token, stores its SHA-256 hash and an expiry (TTL)', async () => {
    model.findOneAndUpdate.mockResolvedValue({});
    const before = Date.now();
    const { token, expiresAt } = await service.issue('u1', 'extbot:b1');
    expect(token).toHaveLength(64);
    const [, update] = model.findOneAndUpdate.mock.calls[0];
    expect(update.$set.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 30 * DAY);
    expect(update.$set.expiresAt).toEqual(expiresAt);
  });

  it('validate() returns userId+botUserId for a valid, unexpired token', async () => {
    const token = 'a'.repeat(64);
    sessionFor(token, { expiresAt: new Date(Date.now() + DAY) });
    expect(await service.validate(token)).toEqual({ userId: 'u1', botUserId: 'extbot:b1' });
  });

  it('validate() rejects an expired token', async () => {
    const token = 'b'.repeat(64);
    sessionFor(token, { expiresAt: new Date(Date.now() - 1000) });
    expect(await service.validate(token)).toBeNull();
  });

  it('validate() expires legacy sessions (no expiresAt) at createdAt + TTL', async () => {
    const token = 'c'.repeat(64);
    sessionFor(token, { createdAt: new Date(Date.now() - 31 * DAY) });
    expect(await service.validate(token)).toBeNull();
    sessionFor(token, { createdAt: new Date(Date.now() - 2 * DAY) });
    expect(await service.validate(token)).toEqual({ userId: 'u1', botUserId: 'extbot:b1' });
  });

  it('validate() returns null for unknown token', async () => {
    model.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    expect(await service.validate('bad')).toBeNull();
  });

  it('revoke() sets revokedAt', async () => {
    model.updateOne.mockResolvedValue({});
    await service.revoke('u1', 'extbot:b1');
    expect(model.updateOne).toHaveBeenCalledWith(
      { userId: 'u1', botUserId: 'extbot:b1', revokedAt: null },
      expect.objectContaining({ $set: expect.objectContaining({ revokedAt: expect.any(Date) }) }),
    );
  });
});
