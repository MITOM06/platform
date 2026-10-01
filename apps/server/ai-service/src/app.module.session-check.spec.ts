import { DatabaseRedisModule, SharedJwtStrategy } from '@platform/database';
import { AppModule } from './app.module';

/**
 * Clients call this service directly with their access token, so the shared JWT
 * strategy must run the sess:{sid} revocation check — which needs REDIS_CLIENT
 * from DatabaseRedisModule. Guards against the wiring silently regressing.
 */
describe('AppModule — access-token session check wiring', () => {
  it('registers SharedJwtStrategy and imports DatabaseRedisModule (REDIS_CLIENT)', () => {
    const imports: unknown[] = Reflect.getMetadata('imports', AppModule) ?? [];
    const providers: unknown[] = Reflect.getMetadata('providers', AppModule) ?? [];
    expect(providers).toContain(SharedJwtStrategy);
    expect(imports).toContain(DatabaseRedisModule);
  });
});
