import { FriendsController } from './friends.controller';

/** Every route acts as the token subject — never an id from the body/params owner. */
describe('FriendsController', () => {
  const req = { user: { sub: 'me' } };
  function make() {
    const svc = {
      sendRequest: jest.fn().mockResolvedValue({ _id: 'f1' }),
      acceptRequest: jest.fn().mockResolvedValue({ _id: 'f1', status: 'accepted' }),
      listFriends: jest.fn().mockResolvedValue([{ _id: 'x' }]),
      listIncomingRequests: jest.fn().mockResolvedValue([]),
      getStatus: jest.fn().mockResolvedValue('incoming'),
      removeFriend: jest.fn().mockResolvedValue(undefined),
    };
    return { ctrl: new FriendsController(svc as never), svc };
  }

  it('POST request → sendRequest(caller, recipientId)', async () => {
    const { ctrl, svc } = make();
    await expect(ctrl.request(req, { recipientId: 'u2' } as never)).resolves.toEqual({ _id: 'f1' });
    expect(svc.sendRequest).toHaveBeenCalledWith('me', 'u2');
  });

  it('PUT accept → acceptRequest(caller, requesterId)', async () => {
    const { ctrl, svc } = make();
    await ctrl.accept(req, { requesterId: 'u2' } as never);
    expect(svc.acceptRequest).toHaveBeenCalledWith('me', 'u2');
  });

  it('GET / and GET requests list for the caller', async () => {
    const { ctrl, svc } = make();
    await expect(ctrl.list(req)).resolves.toEqual([{ _id: 'x' }]);
    await expect(ctrl.requests(req)).resolves.toEqual([]);
    expect(svc.listFriends).toHaveBeenCalledWith('me');
    expect(svc.listIncomingRequests).toHaveBeenCalledWith('me');
  });

  it('GET status/:userId wraps the status', async () => {
    const { ctrl, svc } = make();
    await expect(ctrl.status(req, 'u2')).resolves.toEqual({ status: 'incoming' });
    expect(svc.getStatus).toHaveBeenCalledWith('me', 'u2');
  });

  it('DELETE :userId → removeFriend(caller, userId) + {success:true}', async () => {
    const { ctrl, svc } = make();
    await expect(ctrl.remove(req, 'u2')).resolves.toEqual({ success: true });
    expect(svc.removeFriend).toHaveBeenCalledWith('me', 'u2');
  });

  it('a service error propagates (DELETE does not report success)', async () => {
    const { ctrl, svc } = make();
    svc.removeFriend.mockRejectedValue(new Error('db down'));
    await expect(ctrl.remove(req, 'u2')).rejects.toThrow('db down');
  });
});
