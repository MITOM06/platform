# @platform/database

Shared NestJS infrastructure module for MongoDB (Mongoose) + Redis (ioredis),
plus the shared Mongo schemas used across the **NestJS** services.

## Scope — NestJS services only

This package is consumed by the TypeScript/NestJS services:

- `apps/server/auth-service`
- `apps/server/ai-service`

It is **not** used by `apps/server/chat-service` (Spring Boot / Java), which has
its own Spring Data MongoDB + Redis configuration and its own entity classes.
A document written by chat-service and one written via this package's schemas
target the **same MongoDB database** (`platform`) — keep field names in sync
manually when a collection is shared across the Java and Node services.

## Exports

- `DatabaseMongoModule` / `mongo.module` — `MongooseModule` configuration
- `DatabaseRedisModule` + `REDIS_CLIENT` token — Redis provider (ioredis)
- `Redis` — re-export of the `ioredis` client type
- `user.schema`, `friendship.schema` — shared Mongo schemas

## Usage

```ts
import { REDIS_CLIENT, Redis } from '@platform/database';

@Injectable()
export class MyService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}
}
```

> Note: `@platform/types` was removed (2026-06) — it held a single unused
> `WsEvent` type that neither client imported. STOMP event shapes are defined
> per-platform (web: `apps/web/lib/api/types.ts`; mobile: Dart models).
