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
- `user.schema`, `friendship.schema`, `user-block.schema` — shared Mongo schemas

> **`user-block.schema`** (`user_blocks` collection): one row per blocker→blocked
> pair, replacing the former embedded `users.blockedUsers[]` array (see ADR-011).
> Written by auth-service (block/unblock); also read by chat-service to reject
> messages between blocked users. One-time data migration lives in
> `apps/server/auth-service/scripts/` (`pnpm migrate:blocks`).

> **Build gotcha:** this package commits compiled `.js`/`.d.ts` **inside `src/`**,
> and auth-service's Jest resolves `src/*.js` before `*.ts`. After editing a schema,
> refresh the in-src artifacts with `npx tsc -p . --outDir src` (this is separate
> from `pnpm build`, which emits to `dist/`) — otherwise tests load the stale `.js`.

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
