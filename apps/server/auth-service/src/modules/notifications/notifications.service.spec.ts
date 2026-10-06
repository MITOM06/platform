import { NotificationsService } from './notifications.service';

describe('NotificationsService.markRead', () => {
  const exec = jest.fn().mockResolvedValue(null);
  const model = { findOneAndUpdate: jest.fn().mockReturnValue({ exec }) };
  const service = new NotificationsService(model as any);

  beforeEach(() => jest.clearAllMocks());

  it('404 NOTIFICATION_NOT_FOUND for a malformed id, without querying (no CastError 500)', async () => {
    await expect(service.markRead('not-an-id', 'u1')).rejects.toMatchObject({
      status: 404,
      response: { code: 'NOTIFICATION_NOT_FOUND' },
    });
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("marks only the caller's notification; unknown ids stay a silent no-op", async () => {
    const id = '64b0000000000000000000aa';
    await expect(service.markRead(id, 'u1')).resolves.toBeUndefined();
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: id, recipientId: 'u1' },
      { $set: { readAt: expect.any(Date) } },
    );
  });
});
