import { GUARDS_METADATA, HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { JwtAuthGuard } from '@platform/database';
import { ActionsController } from './actions.controller';
import { PendingActionService } from './pending-action.service';

describe('ActionsController — POST /ai/actions/:id/{confirm,cancel}', () => {
  it('is mounted at ai/actions behind the JWT guard', () => {
    expect(Reflect.getMetadata(PATH_METADATA, ActionsController)).toBe('ai/actions');
    expect(Reflect.getMetadata(GUARDS_METADATA, ActionsController)).toContain(JwtAuthGuard);
    for (const [handler, path] of [
      [ActionsController.prototype.confirm, ':id/confirm'],
      [ActionsController.prototype.cancel, ':id/cancel'],
    ] as const) {
      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.POST);
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(200);
    }
  });

  it('never binds a request body (confirm runs the stored input only)', () => {
    for (const name of ['confirm', 'cancel'] as const) {
      const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, ActionsController, name) ?? {};
      const types = Object.keys(args).map((k) => Number(k.split(':')[0]));
      expect(types).not.toContain(RouteParamtypes.BODY);
    }
  });

  it("resolves the action as the caller (req.user.sub)", async () => {
    const confirm = jest.fn().mockResolvedValue({ status: 'confirmed' });
    const cancel = jest.fn().mockResolvedValue({ status: 'cancelled' });
    const controller = new ActionsController({ confirm, cancel } as unknown as PendingActionService);
    const req = { user: { sub: 'user-7' } } as never;

    await expect(controller.confirm('id-1', req)).resolves.toEqual({ status: 'confirmed' });
    await expect(controller.cancel('id-2', req)).resolves.toEqual({ status: 'cancelled' });
    expect(confirm).toHaveBeenCalledWith('id-1', 'user-7');
    expect(cancel).toHaveBeenCalledWith('id-2', 'user-7');
  });
});
