import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { getConnectionToken } from '@nestjs/mongoose';
import { REDIS_CLIENT } from '@platform/database';

describe('AppController', () => {
  let appController: AppController;

  const mockMongoConnection = {
    readyState: 1,
  };

  const mockRedis = {
    ping: jest.fn().mockResolvedValue('PONG'),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: getConnectionToken(),
          useValue: mockMongoConnection,
        },
        {
          provide: REDIS_CLIENT,
          useValue: mockRedis,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return health status', async () => {
      const status = await appController.checkHealth();
      expect(status.status).toBe('up');
      expect(status.service).toBe('auth-service');
      expect(status.database.mongodb).toBe('OK');
      expect(status.database.redis).toBe('OK');
    });
  });
});
