# Task 7 Report — Testcontainers MongoDB Integration Test for Cursor Pagination

## Summary

Added the first real integration test for the chat-service using Testcontainers + MongoDB 7.
Previously all tests mocked `MessageRepository` — a broken query derivation or missing index
would never be caught. The new test exercises the actual Spring Data queries against a live
MongoDB instance.

---

## pom.xml Changes

**Added to `<properties>`:**
```xml
<testcontainers.version>1.20.4</testcontainers.version>
```
Spring Boot 3.3.5 manages Testcontainers at 1.19.8 (docker-java 3.3.6). That version sends
API version 1.32 in every request, which Docker Desktop 29.x rejects (`min API 1.40`).
Overriding to 1.20.4 (docker-java 3.4.0) was not sufficient on its own — the fix required
also configuring Maven Surefire to pass `-Dapi.version=1.47` to the forked JVM.

**Added three test-scope dependencies:**
```xml
org.testcontainers:testcontainers   (version managed)
org.testcontainers:junit-jupiter    (version managed)
org.testcontainers:mongodb          (version managed)
```

**Added maven-surefire-plugin configuration (default — runs on CI):**
```xml
<environmentVariables>
  <TESTCONTAINERS_RYUK_DISABLED>true</TESTCONTAINERS_RYUK_DISABLED>
</environmentVariables>
```
- `TESTCONTAINERS_RYUK_DISABLED=true` — disables the Ryuk resource reaper. CI runners are
  ephemeral (VM discarded after the job) so no containers leak; standard safe CI pattern.
- **No `api.version` override in the default build.** CI (`ubuntu-latest`, standard
  `/var/run/docker.sock`) negotiates the Docker API version correctly with Testcontainers
  1.20.4 / docker-java 3.4.

**Added a local-only Maven profile (`local-docker-desktop`) — addresses code-review feedback:**
```xml
<profile>
  <id>local-docker-desktop</id>
  <activation>
    <file><exists>${user.home}/Library/Containers/com.docker.docker/Data/docker.raw.sock</exists></file>
  </activation>
  <build><plugins><plugin>
    <artifactId>maven-surefire-plugin</artifactId>
    <configuration><argLine>-Dapi.version=1.47</argLine></configuration>
  </plugin></plugins></build>
</profile>
```
- `-Dapi.version=1.47` is the only mechanism that reaches the Surefire-FORKED test JVM and
  overrides docker-java's default API v1.32 (rejected by Docker Desktop 29.x).
  `~/.testcontainers.properties` does NOT propagate `api.version` to docker-java's forked
  client — verified empirically.
- The profile auto-activates ONLY when the Docker Desktop raw socket exists, so it never
  affects CI. This keeps the machine-specific workaround out of the shared default build,
  per the review's "Important" finding.
- Removed the duplicate `TESTCONTAINERS_RYUK_DISABLED` (previously in both `argLine` and
  `environmentVariables`). Added a JaCoCo-safety note (`${argLine}` expansion) in the pom.

---

## Test File

`apps/server/chat-service/src/test/java/com/platform/chatservice/service/MessageServicePaginationTest.java`

**Approach:**
- `@DataMongoTest` (MongoDB slice only) — no Redis / RabbitMQ / JWT secret needed.
- `@Testcontainers` + `static MongoDBContainer mongo = new MongoDBContainer("mongo:7")`
- `@DynamicPropertySource` sets `spring.data.mongodb.uri` to
  `mongodb://<host>:<mapped-port>/platform_test` (uses `getHost()` + `getMappedPort(27017)`
  instead of `getReplicaSetUrl()` which returns the container-internal hostname that is not
  routable from the host JVM).
- `MessageService` is constructed manually with real repositories + mocked non-MongoDB
  collaborators (`SimpMessagingTemplate`, `MessageServiceHelper`).
- `@BeforeEach` clears collections and inserts 5 messages with explicit `createdAt`
  timestamps set via `message.setCreatedAt(base.plusSeconds(i))` before saving.

**4 Test Cases:**

| # | Test | What it catches |
|---|------|----------------|
| 1 | `firstPage_returnsNewestTwoMessages_andHasMore` | DESC ordering of `findByConversationIdOrderByCreatedAtDesc`, correct `pageSize+1` over-fetch, `hasNext=true` logic |
| 2 | `cursorPage_returnsNextTwoOlderMessages_noOverlapWithFirstPage` | `findByConversationIdAndCreatedAtLessThanOrderByCreatedAtDesc` query derivation, strict `<` cursor semantics, no duplicates between pages |
| 3 | `lastPage_hasMoreIsFalse_andRemainingCountIsCorrect` | Terminal page detection (`hasNext=false` when fewer results than `pageSize`) |
| 4 | `conversationIsolation_differentConvMessages_notReturned` | `conversationId` filter in compound index — cross-contamination between conversations |

---

## Docker Environment Notes

Local Docker Desktop 29.5.3 on macOS uses non-standard socket paths:
- `/Users/phong/.docker/run/docker.sock` — CLI proxy socket (returns empty info for API <1.40)
- `/Users/phong/Library/Containers/com.docker.docker/Data/docker.raw.sock` — raw daemon socket

`~/.testcontainers.properties` must contain:
```
docker.host=unix:///Users/phong/Library/Containers/com.docker.docker/Data/docker.raw.sock
```

**On GitHub Actions (CI):** Docker is pre-installed on `ubuntu-latest` runners, the standard
`/var/run/docker.sock` works, and the minimum API requirement is met. The existing
`mvn test` command in `.github/workflows/ci.yml` will pick up `MessageServicePaginationTest`
automatically (Surefire default glob includes `**/*Test.java`). **No CI changes are needed.**

---

## Verify Output

### Compilation
```
cd apps/server/chat-service && mvn -q compile test-compile
# (no output = success)
```

### Test Run
```
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.158 s
       -- in com.platform.chatservice.service.MessageServicePaginationTest
[INFO] Tests run: 91, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```
All 4 new integration tests pass. All 87 existing mock tests continue to pass.

---

## Commit Hash

`4e4d2107`
