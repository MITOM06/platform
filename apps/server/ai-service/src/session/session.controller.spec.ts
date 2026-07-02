import { NotFoundException } from '@nestjs/common';
import { SessionController } from './session.controller';
import { AiSessionService } from './ai-session.service';

const req = { user: { sub: 'user-1' } } as never;

describe('SessionController', () => {
  let controller: SessionController;
  let resumeSession: jest.Mock;
  let renameSession: jest.Mock;

  beforeEach(() => {
    resumeSession = jest.fn();
    renameSession = jest.fn();
    const svc = { resumeSession, renameSession } as unknown as AiSessionService;
    controller = new SessionController(svc);
  });

  describe('resume', () => {
    it('returns the session when found', async () => {
      const session = { _id: 's1', isActive: true };
      resumeSession.mockResolvedValue(session);

      await expect(controller.resumeSession('conv-1', 's1', req)).resolves.toBe(session);
    });

    it('throws NotFoundException (404) instead of returning null (bug #5)', async () => {
      resumeSession.mockResolvedValue(null);

      await expect(controller.resumeSession('conv-1', 'missing', req)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('rename', () => {
    it('returns the renamed session when found', async () => {
      const session = { _id: 's1', name: 'New name' };
      renameSession.mockResolvedValue(session);

      await expect(controller.renameSession('s1', 'New name', req)).resolves.toBe(session);
    });

    it('throws NotFoundException (404) instead of returning null (bug #5)', async () => {
      renameSession.mockResolvedValue(null);

      await expect(controller.renameSession('missing', 'x', req)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
