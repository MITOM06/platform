## Backend Implementation Report

> Scope: Issue 6 (shared per-conversation wallpaper) — the only issue requiring backend changes.
> Issue 1 (avatar sync) and Issue 5 (group avatar) were verified to need NO backend change (see Notes).
> auth-service was NOT modified.

### 변경된 파일

| 파일 | 변경 | 설명 |
|------|------|------|
| `apps/server/chat-service/src/main/java/com/platform/chatservice/model/Conversation.java` | 수정 | `private String wallpaper;` 필드 추가 (nullable, direct + group 공용). null/blank = default. |
| `apps/server/chat-service/src/main/java/com/platform/chatservice/dto/ConversationResponse.java` | 수정 | record에 `String wallpaper` 추가 + `toResponse` 호출부 호환을 위해 기존 두 생성자 모두 유지 (wallpaper=null 채움). |
| `apps/server/chat-service/src/main/java/com/platform/chatservice/dto/WallpaperRequest.java` | 신규 | `record WallpaperRequest(String wallpaper) {}` — PUT 바디. |
| `apps/server/chat-service/src/main/java/com/platform/chatservice/service/ConversationService.java` | 신규 메서드 + 수정 | `setWallpaper(userId, convId, wallpaper)` 추가 (참가자면 누구나, admin 아님 — `getRawConversation`으로 멤버십 체크). `toResponse`가 `c.getWallpaper()` 채우도록 수정. |
| `apps/server/chat-service/src/main/java/com/platform/chatservice/controller/ConversationController.java` | 신규 엔드포인트 | `PUT /api/conversations/{id}/wallpaper` 추가 → `setWallpaper` → 기존 `broadcastConversationUpdated` 재사용. |

### 빌드 결과
- chat-service `mvn compile`: ✓ 성공
- chat-service `mvn test`: ✓ 95/95 단위 테스트 통과. 단, `MessageServicePaginationTest`는 Testcontainers(Docker 데몬 필요) 기반 통합 테스트로, 이 환경에 Docker가 없어 1건 ERROR. **wallpaper 변경과 무관** (인프라 의존). spotless `mvn spotless:apply` 적용 완료.
- auth-service: 변경 없음 (✗ 해당 없음)

### API 엔드포인트 구현 확인 (web/mobile가 의존하는 최종 contract)

**`PUT /api/conversations/{id}/wallpaper`** — ✓ 구현됨
- 인증: JWT 필수 (`JwtAuthenticationFilter`), userId는 SecurityContext에서 추출
- 권한: **참가자면 누구나** (direct + group 모두; admin 아님). 비참가자는 `ConversationNotFoundException` (404).
- Request body:
  ```json
  { "wallpaper": "preset:midnight_glow" }
  ```
  - `wallpaper`: string. preset 토큰(예: `"preset:midnight_glow"`), 업로드 이미지 상대경로(예: `"/api/uploads/<id>#fit=cover&scale=120"`), 또는 `""`/null(전체 멤버 default로 리셋).
- Response: `200 OK` + `ConversationResponse` (아래 wallpaper 포함된 전체 shape)
- Broadcast: STOMP `/topic/conversation/{id}` → `{ "type": "CONVERSATION_UPDATED", "conversation": ConversationResponse }` (기존 경로 재사용 → 모든 멤버가 실시간 재해석)

**`ConversationResponse` 최종 shape (wallpaper 필드 추가됨)** — 모든 conversation 응답에 포함:
```json
{
  "id": "...",
  "type": "direct|group",
  "name": "...",
  "avatarUrl": "/api/uploads/<id> 또는 null (상대경로 — 클라가 absoluteMediaUrl/_absoluteUrl로 해석)",
  "participants": ["..."],
  "admins": ["..."],
  "createdBy": "...",
  "autoDeleteSeconds": null,
  "lastMessage": { "content": "...", "senderId": "...", "createdAt": "..." },
  "lastMessageAt": "...",
  "unreadCount": 0,
  "createdAt": "...",
  "status": "accepted|pending",
  "isPublic": false,
  "pinnedMessages": [ { "id":"", "senderId":"", "content":"", "createdAt":"" } ],
  "isMuted": false,
  "isArchived": false,
  "wallpaper": "preset:midnight_glow | /api/uploads/<id>#... | null"   // ← NEW
}
```
- `wallpaper`가 새 마지막 필드. 기존 클라이언트는 무시 가능(추가 필드). 신규 web/mobile은 `Conversation.wallpaper`로 읽어 default fallback 처리.

### Issue 1 / Issue 5 백엔드 검증 결과 (변경 없음)

- **Issue 5 (그룹 아바타)**: `UploadController.java:63`이 상대경로 `/api/uploads/<objectId>` 반환 — 계획서 권고대로 **상대경로 유지가 정답**. 업로드마다 새 ObjectId라 경로 자체가 매번 달라짐(자연 cache-busting). `ConversationCacheService.save()`는 `@CachePut`이라 저장 시 캐시가 즉시 갱신됨 → `getConversation`이 새 avatar 반환. 백엔드 정상. 실제 버그는 web 렌더(raw src) — 클라 스코프.
- **Issue 1 (아바타 동기화)**: 계획서가 `USER_UPDATED` 푸시를 "선택/생략 가능"으로 명시하고 "URL versioning + 클라 캐시 무효화에 의존" 권고. auth-service 아바타 업로드는 업로드마다 새 URL을 만드는 구조라 소스 레벨 버전 스탬프가 이미 충족됨 → 백엔드 변경 불필요, 침습적 cross-service 훅 생략. (Web/Mobile에서 `absoluteMediaUrl`/`_absoluteUrl` 적용 + 캐시 무효화로 해결)

### 주의사항
- `ConversationResponse`에 wallpaper를 **마지막 필드**로 추가하고 기존 16-arg 생성자와 13-arg 생성자를 모두 보존했으므로 다른 호출부/테스트는 영향 없음. `toResponse`(유일한 17-arg 호출부)만 wallpaper를 채움.
- wallpaper 권한은 **참가자 누구나** (계획서 권장안). admin-only가 필요해지면 `setWallpaper`에서 group일 때만 `requireGroupAdmin`로 게이팅하면 됨.
- 마이그레이션 불필요: 기존 conversation 문서는 `wallpaper` 없음 → null → 클라가 default로 처리.
- `MessageServicePaginationTest`(Testcontainers) 1건은 Docker 미가동으로 ERROR이며 본 변경과 무관. Docker 가동 환경에서 재실행 시 통과 예상.
