import { getModelToken } from '@nestjs/mongoose';
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

describe('BotSessionService', () => {
  let service: BotSessionService;
  let model: ReturnType<typeof mockModel>;

  beforeEach(async () => {
    model = mockModel();
    const module = await Test.createTestingModule({
      providers: [
        BotSessionService,
        { provide: getModelToken(BotSession.name), useValue: model },
      ],
    }).compile();
    service = module.get(BotSessionService);
  });

  it('issue() returns a 32-byte hex token and stores its SHA-256 hash', async () => {
    model.findOneAndUpdate.mockResolvedValue({ userId: 'u1', botUserId: 'extbot:b1' });
    const token = await service.issue('u1', 'extbot:b1');
    expect(token).toHaveLength(64); // 32 bytes = 64 hex chars
    const [call] = model.findOneAndUpdate.mock.calls;
    const hash = createHash('sha256').update(token).digest('hex');
    expect(call[1].$set.tokenHash).toBe(hash);
  });

  it('validate() returns userId+botUserId for a valid token', async () => {
    const token = 'a'.repeat(64);
    const hash = createHash('sha256').update(token).digest('hex');
    model.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: 'id1',
        userId: 'u1',
        botUserId: 'extbot:b1',
        tokenHash: hash,
      }),
    });
    model.updateOne.mockReturnValue({
      catch: jest.fn().mockResolvedValue(undefined),
    });
    const result = await service.validate(token);
    expect(result).toEqual({ userId: 'u1', botUserId: 'extbot:b1' });
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
