# Backend Implementation Report — chat-service external-bots list endpoint

## 변경된 파일
- `apps/server/chat-service/src/main/java/com/platform/chatservice/service/ExternalBotAdminService.java`
  — added `public List<ExternalBotResponse> listAll()` → `repo.findAll().stream().map(this::toResponse).toList()`; added `import java.util.List;`
- `apps/server/chat-service/src/main/java/com/platform/chatservice/controller/ExternalBotController.java`
  — added `GET /api/admin/external-bots` handler gated by `@PreAuthorize("hasAuthority('PERM_MANAGE_WORKSPACE')")`; added `import java.util.List;`
- `apps/server/chat-service/src/test/java/com/platform/chatservice/service/ExternalBotAdminServiceTest.java`
  — added `listAll_mapsAllRepoDocsToResponses()` and `listAll_returnsEmptyWhenNoBots()` (Mockito, no Mongo)

## 엔드포인트 시그니처
```java
@GetMapping("/admin/external-bots")          // full path: GET /api/admin/external-bots
@PreAuthorize("hasAuthority('PERM_MANAGE_WORKSPACE')")
public List<ExternalBotResponse> list()      // returns DTO list (entity never exposed)
```
Read-only, workspace-wide, admin-gated. No identity taken from request body.

## 빌드 결과
- chat-service compile: ✓ (`mvn -q -DskipTests compile` — no errors)
- auth-service: 변경 없음 (off-limits, not touched)

## API 엔드포인트 구현 확인
- `GET /api/admin/external-bots` — ✓ 구현됨, MANAGE_WORKSPACE 권한 필요

## 테스트 결과
```
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0 -- in com.platform.chatservice.service.ExternalBotAdminServiceTest
[INFO] BUILD SUCCESS
```
(2 pre-existing register/findAssistantFor tests + 2 new listAll tests = 4)

## 주의사항 / Deviations
- 계획 대비 추가: plan은 listAll 테스트 1개를 명시했으나, 매핑 검증과 빈 리스트 케이스를 분리해 2개로 작성함 (커버리지 강화, scope 내).
- `ExternalBotResponse` DTO와 `ExternalBotRepository.findAll()`(MongoRepository 상속)는 이미 존재하여 추가 신규 파일 불필요.
- DTO 분리 / 생성자 주입(`@RequiredArgsConstructor`) / Jakarta 컨벤션 모두 기존 패턴 그대로 준수.
