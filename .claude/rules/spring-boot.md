---
paths:
  - "apps/server/chat-service/**"
---

# Spring Boot Chat Service Rules

You are working on the Spring Boot 3 chat service. Follow these rules:

**Jakarta EE**: Use `jakarta.*` imports ONLY. Never `javax.*`.

**Injection**: Constructor injection only. Use `@RequiredArgsConstructor` (Lombok). Never `@Autowired` on fields.

**Entities**: `@Document(collection="...")` for MongoDB. Always use Lombok (`@Data @Builder @NoArgsConstructor @AllArgsConstructor`). Add `@CreatedDate`/`@LastModifiedDate` for timestamps.

**DTOs**: Never expose `@Document` entities in API responses. Always create separate Request/Response record or class.

**Security**: Every protected endpoint must go through `JwtAuthenticationFilter`. Extract `userId` from `SecurityContextHolder`, never trust request params for identity.

**Pagination**: All list endpoints MUST use `Pageable` + return `Page<T>`. Never return unbounded lists.

**MongoDB URI**: `mongodb://localhost:27018/platform` (port 27018, not 27017).

**JWT Secret**: Env var name is `JWT_ACCESS_SECRET`. Must match `apps/server/auth-service/.env` exactly.
