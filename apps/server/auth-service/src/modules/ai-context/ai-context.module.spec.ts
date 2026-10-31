import { Global, Module } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { AiContextModule } from './ai-context.module';
import { AiContextService } from './ai-context.service';

const connection = { models: {}, model: () => ({}) };

@Global()
@Module({
  providers: [{ provide: getConnectionToken(), useValue: connection }],
  exports: [getConnectionToken()],
})
class FakeDatabaseModule {}

describe('AiContextModule', () => {
  it('resolves every dependency of AiContextService (a gap would stop the boot)', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakeDatabaseModule, AiContextModule],
    }).compile();
    expect(moduleRef.get(AiContextService)).toBeInstanceOf(AiContextService);
  });
});
