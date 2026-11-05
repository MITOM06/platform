# Đóng gap audit ATTT cấp độ 3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đóng 5 gap còn mở từ audit ATTT cấp độ 3 (TCVN 11930, audit 2026-10-22, kiểm lại 2026-11-01 và 2026-11-05): Remote Mouse mở cổng, FileVault/auto-login, repo + `main` không bảo vệ, chưa backup/log tập trung, `/api/uploads/**` public.

**Architecture:** Phần code: uploads cần xác thực bằng *media token* HMAC riêng (không phải JWT) **và** qua kiểm tra quyền theo file (`metadata.refs` trên GridFS + fallback ảnh hồ sơ), có migration backfill cho file cũ; ai-service gọi nội bộ bằng `X-Internal-Key`; web + Flutter gắn token qua helper `absoluteMediaUrl` sẵn có), 2 task script trên Mini (backup Mongo hằng đêm, log tập trung), 3 task vận hành (gỡ Remote Mouse, branch protection, FileVault theo quyết định D2). Uploads rollout sau cờ `UPLOADS_REQUIRE_AUTH` (mặc định `false`) để app mobile cũ không vỡ.

**Tech Stack:** Spring Boot 3 (chat-service) · NestJS (ai-service) · Next.js (web) · Flutter · bash + launchd (Mini) · `gh api` · Docker (`mongo:7` cho `mongodump`).

**Spec:** Không có spec riêng — nguồn là kết quả audit trong `~/DigitalBrain/99_Meta/brain/01-knowledge.md` (dòng PON) + trạng thái thật đo ngày 2026-11-05 (mục "Hiện trạng" dưới).

---

## Hiện trạng đo ngày 2026-11-05

| Gap | Thực tế |
|---|---|
| Remote Mouse | `Remote Mouse.app` PID 1527 nghe TCP 1978/1979 + UDP 1978 trên **mọi interface** (`*:1978`) — điều khiển chuột/phím server, không xác thực mạnh |
| FileVault / auto-login | `FileVault is Off`, `autoLoginUser = khang`. Firewall macOS đang bật. **Runbook `runbooks/mac-mini-cloudflare.md:53-63` cố ý khuyên tắt FileVault** để tự lên lại sau mất điện. Nhưng `.env.mini` trên đĩa chứa Atlas URI, `CLAUDE_CODE_OAUTH_TOKEN`, `INTERNAL_API_KEY`, `JWT_ACCESS_SECRET` → mất máy = lộ hết |
| Repo / `main` | Repo **PUBLIC**, `main` **không có branch protection**, không ruleset |
| Backup / log | Mongo trên Atlas (tier chưa xác minh — M0 free **không có backup**). Không script backup nào trong repo. Log = `docker logs` mặc định, không tập trung, không giữ lịch sử |
| `/api/uploads/**` | `SecurityConfig.java:69` `permitAll` cho GET. Bảo vệ duy nhất = id UUIDv4 khó đoán (capability URL). Ai có link (Referer, log, forward) đều tải được, không hết hạn |

---

## ✅ Quyết định đã chốt (2026-11-05, Khang)

| # | Quyết định | Chọn | Hệ quả phải chịu |
|---|---|---|---|
| D1 | Uploads | **B — token + quyền theo file** | Mỗi lần tải file thêm 1–2 query; phải backfill quyền cho file cũ (Task 3); app mobile cũ mất ảnh khi bật cờ → cài lại app trước |
| D2 | FileVault | **B — giữ tắt, ghi rủi ro** | Mất máy = lộ secret trong `.env.mini` → runbook phải có danh sách secret cần xoay; audit vẫn ghi gap một phần |
| D3 | Repo | **A — giữ public + khoá `main`** | Code tiếp tục công khai; bù bằng secret scanning + push protection |
| D4 | Log | **A — Loki + Grafana trên Mini** | Tốn khoảng 300–500 MB RAM; Grafana chỉ mở qua Tailscale |
| D5 | Remote Mouse | **Gỡ hẳn** (mặc định, Khang không phản đối) | Mất điều khiển chuột từ xa — dùng Screen Sharing qua Tailscale nếu cần |
| D6 | Khoá `main` áp cho admin | **Có** (mặc định) | Khang và Claude cũng phải đi PR + CI xanh, không push thẳng |

### Quy tắc phân quyền file (D1 = B)

Người dùng `u` được tải file `f` khi đã xác thực (media token / JWT) **và** một trong các điều kiện:
1. `u` là người upload (`metadata.uploadedBy`).
2. `f` được gắn vào hội thoại `c` (`metadata.refs` có `{t:"c", id:c}`) và `u` hiện là participant của `c` (rời nhóm → mất quyền ngay).
3. `f` được gắn vào KB phòng ban `d` (`{t:"d", id:d}`) và `u` thuộc `d` (`users.departmentIds`).
4. `f` là ảnh hồ sơ công khai trong workspace: URL của nó nằm ở `users.avatarUrl`, `users.coverPhoto`, `workspace.logoUrl`, `external_bots.avatarUrl` hoặc `ai_personas.avatarUrl` → mọi người đã đăng nhập đều xem được. Kiểm tra bằng query trực tiếp vào DB dùng chung `platform` **chỉ khi** 1–3 không khớp → không phải sửa auth-service.
5. Gọi nội bộ có `X-Internal-Key` đúng → luôn được tải (ai-service vision/KB).

`refs` được ghi lúc **lưu**: tin nhắn (gửi, chuyển tiếp, sửa, tin AI), avatar/wallpaper hội thoại, tài liệu KB. Chấp nhận: tin nhắn bị thu hồi vẫn giữ ref (người trong hội thoại vẫn tải được nếu đã có link).

## Global Constraints

- Nhánh `feat/security-audit-l3` cắt từ `origin/main`; PR → `main`. **Không** merge `dev → main`.
- Merge vào `main` = Mini tự deploy prod trong khoảng 15 phút → mỗi PR phải review trước.
- Không secret mới: media token ký bằng khoá dẫn xuất `HMAC-SHA256(JWT_ACCESS_SECRET, "pon-media-v1")`; internal call dùng `INTERNAL_API_KEY` sẵn có (chat-service đọc qua `app.connector.internal-key`, `application.yml:111`).
- Cờ `UPLOADS_REQUIRE_AUTH` mặc định `false`; chỉ bật trên prod sau khi app mobile mới đã cài lên mọi máy demo.
- macOS = BSD: không `pkill -f`/`killall`, chỉ kill theo PID; `sed -i ''`.
- Compose trên Mini luôn `-p pon-mini`; trong SSH non-TTY dùng `/usr/local/bin/docker`.
- Script vận hành Mini nằm ở `scripts/mini/`, mỗi script có `*.test.sh` cùng tên (theo mẫu `redeploy.test.sh`).
- Không đưa backup vào `~/DigitalBrain` (vault không chứa file nặng).

## Review Focus

1. **Media token bị dùng làm bearer cho API** — token trong URL lọt qua Referer/log. Phải chắc `JwtAuthenticationFilter` không chấp nhận nó (định dạng khác JWT, khoá khác) → test ở Task 1.
2. **Token hết hạn khi tab mở lâu** — ảnh đang hiển thị không được vỡ hàng loạt; client làm mới token trước khi hết hạn 1h, và URL ổn định trong cả chu kỳ để cache ảnh vẫn trúng → test ở Task 3/4.
3. **ai-service vision/KB tải file khi cờ bật** — quên `X-Internal-Key` thì AI mất khả năng đọc ảnh, lỗi im lặng → test ở Task 2.
4. **Backup chạy nhưng không restore được** — dump rỗng/hỏng mà script vẫn báo OK → Task 5 có bước restore thử vào DB tạm và đếm document.
5. **Prune/backup làm đầy đĩa Mini** — giữ có giới hạn (14 bản), kiểm tra dung lượng trống trước khi dump → test ở Task 5.
6. **Một đường lưu tin quên ghi ref** (chuyển tiếp, sửa tin, tin AI, đặt avatar nhóm) → người nhận thấy ảnh vỡ dù có quyền. Mỗi đường có assertion riêng ở Task 1b Step 5; migration Task 1c báo số file không có ref để soi.
7. **Ảnh hồ sơ đổi URL** (user đổi avatar) → ảnh cũ không còn trong `users.avatarUrl` → chỉ người upload xem được. Chấp nhận, vì không ai còn hiển thị ảnh cũ.

---

### Task 1: chat-service — media token + xác thực `GET /api/uploads/{id}` sau cờ

**Files:**
- Create: `apps/server/chat-service/src/main/java/com/platform/chatservice/security/MediaTokenService.java`
- Modify: `apps/server/chat-service/src/main/java/com/platform/chatservice/controller/UploadController.java` (thêm `GET /token`, chặn trong `getFile`)
- Modify: `apps/server/chat-service/src/main/resources/application.yml` (`app.uploads.require-auth: ${UPLOADS_REQUIRE_AUTH:false}`, `app.uploads.token-ttl: ${UPLOADS_TOKEN_TTL:PT24H}`)
- Modify: `infra/docker-compose/compose.mini.yml`, `compose.prod.yml` (truyền `UPLOADS_REQUIRE_AUTH: ${UPLOADS_REQUIRE_AUTH:-false}` cho chat-service)
- Test: `apps/server/chat-service/src/test/java/com/platform/chatservice/security/MediaTokenServiceTest.java`, `.../controller/UploadControllerAuthTest.java`
- Docs: `docs/api-spec.md` mục Uploads

**Interfaces:**
- Produces:
  - `MediaTokenService.issue(String userId) -> MediaToken(String token, Instant expiresAt)`
  - `MediaTokenService.verify(String token) -> Optional<String>` (userId nếu hợp lệ và chưa hết hạn)
  - Định dạng token: `base64url(userId + "." + expEpochSeconds) + "." + base64url(HMAC-SHA256(key, payload))`; `expEpochSeconds` làm tròn **lên** mốc 6h kế tiếp sau `now + ttl` để mọi lần issue trong cùng cửa sổ 6h ra cùng token (URL ổn định, cache ảnh trúng).
  - REST `GET /api/uploads/token` (cần JWT) → `200 {"token": "...", "expiresAt": "2026-11-06T12:00:00Z"}`
  - `GET /api/uploads/{id}` khi `require-auth=true`: cho qua nếu một trong ba: query `t` hợp lệ · header `Authorization: Bearer <JWT>` hợp lệ · header `X-Internal-Key` bằng `app.connector.internal-key` (so sánh constant-time, key rỗng = không bao giờ khớp). Ngược lại `401` body rỗng. Khi `false`: hành vi giữ nguyên như hiện nay. (Task 1 chỉ kiểm tra *đã xác thực*; Task 1b thêm kiểm tra quyền, trả `403` cho người đã xác thực nhưng không có quyền với file đó.)
  - `UploadReaderResolver.resolve(HttpServletRequest req) -> Optional<String>` (file mới `security/UploadReaderResolver.java`, controller chỉ gọi — luật clean-code: không logic trong controller): trả `"__internal__"` cho internal key, userId cho token/JWT, empty nếu không có gì — Task 1b dùng kết quả này.

- [ ] **Step 1: Viết test fail cho `MediaTokenService`**
  - `issue_then_verify_returns_userId`
  - `verify_rejects_tampered_signature` (đổi 1 ký tự chữ ký → `Optional.empty()`)
  - `verify_rejects_expired` (Clock cố định, vượt `expiresAt` 1s → empty)
  - `same_window_issues_identical_token` (2 lần issue cách 1 phút trong cùng cửa sổ 6h → `token` bằng nhau)
  - `media_token_is_not_accepted_as_jwt`: `JwtUtil` validate token media → false/throw
- [ ] **Step 2: Chạy, xác nhận fail** — `cd apps/server/chat-service && ./mvnw -q test -Dtest=MediaTokenServiceTest` → FAIL (class chưa có)
- [ ] **Step 3: Implement `MediaTokenService`** — `@Service`, inject `Clock` (thêm bean `Clock.systemUTC()` nếu chưa có), khoá dẫn xuất 1 lần ở constructor; verify dùng `MessageDigest.isEqual`.
- [ ] **Step 4: Chạy lại** → PASS
- [ ] **Step 5: Viết test fail `UploadControllerAuthTest`** (`@WebMvcTest` hoặc MockMvc theo mẫu test controller sẵn có):
  - `flag_off_serves_without_auth` → 200
  - `flag_on_no_credentials_401`
  - `flag_on_valid_t_200`, `flag_on_expired_t_401`
  - `flag_on_bearer_jwt_200`
  - `flag_on_internal_key_200`, `flag_on_wrong_internal_key_401`, `flag_on_blank_configured_key_never_matches_401`
  - `token_endpoint_requires_jwt_401` và `token_endpoint_returns_token_and_expiresAt`
- [ ] **Step 6: Chạy, xác nhận fail**
- [ ] **Step 7: Implement** `UploadReaderResolver`; trong `UploadController` thêm `@GetMapping("/token")` và đầu `getFile` gọi resolver khi cờ bật (empty → 401). Giữ `permitAll` ở `SecurityConfig` cho `GET /api/uploads/*` (vì `<img>` không gửi header) **nhưng** `/api/uploads/token` phải nằm ngoài matcher permitAll → đổi matcher thành regex chỉ khớp id (`/api/uploads/{id:[0-9a-fA-F-]{24,36}}`).
- [ ] **Step 8: Chạy full suite + spotless** — `./mvnw -q spotless:apply test` → xanh
- [ ] **Step 9: Cập nhật `docs/api-spec.md` + compose, commit**
```bash
git add apps/server/chat-service/src docs/api-spec.md infra/docker-compose/compose.mini.yml infra/docker-compose/compose.prod.yml
git commit -m "feat(chat): media token for uploads, auth behind UPLOADS_REQUIRE_AUTH"
```

### Task 1b: chat-service — phân quyền theo file (`refs` + `UploadAccessPolicy`)

**Files:**
- Create: `apps/server/chat-service/src/main/java/com/platform/chatservice/service/upload/UploadRefs.java` (trích id + ghi ref)
- Create: `.../service/upload/UploadAccessPolicy.java`
- Modify: `.../service/MessageService.java` (gửi :54/:75, chuyển tiếp/các `save` khác :151, sửa nội dung :263), `.../service/AiMessageService.java:124`, `.../service/ConversationService.java:163-181` (avatar, wallpaper), nơi tạo `KbDocument` (grep `KbDocument.builder`)
- Modify: `.../controller/UploadController.java` — `getFile` gọi policy thay cho kiểm tra "đã đăng nhập" của Task 1; thêm `Cache-Control: private, max-age=86400` khi cờ bật
- Test: `.../service/upload/UploadRefsTest.java`, `.../service/upload/UploadAccessPolicyTest.java`, bổ sung `UploadControllerAuthTest`

**Interfaces:**
- Consumes: Task 1 — `MediaTokenService.verify`, cờ `app.uploads.require-auth`.
- Produces:
  - `UploadRefs.extractIds(String text) -> Set<String>` — mọi id khớp `/api/uploads/([0-9a-f]{24}|uuid)` trong chuỗi (kể cả JSON mảng ảnh, JSON file card, URL tuyệt đối, có `#fragment`/`?query`), lowercase.
  - `UploadRefs.attachToConversation(String text, String conversationId)` / `attachToDepartment(String text, String departmentId)` — `$addToSet` vào `metadata.refs` của `fs.files` (`{t:"c"|"d", id}`), khớp theo `filename` = id; id không tồn tại → bỏ qua, không lỗi.
  - `UploadAccessPolicy.canRead(GridFSFile file, String userId) -> boolean` — đúng thứ tự quy tắc 1→4 ở mục "Quy tắc phân quyền file"; quy tắc 5 (internal key) xử lý ở controller trước khi gọi policy.

- [ ] **Step 1: Test fail `UploadRefsTest`:** `extracts_relative_absolute_json_array_file_card_and_fragment`, `ignores_external_urls_and_bad_ids`, `attach_is_idempotent` (gọi 2 lần → 1 ref), `attach_unknown_id_is_noop`.
- [ ] **Step 2: Test fail `UploadAccessPolicyTest`** (Mongo test sẵn có theo mẫu suite — Testcontainers hoặc mock `MongoTemplate`, theo cách các service test hiện dùng):
  - `uploader_can_read`
  - `participant_of_referenced_conversation_can_read`, `non_participant_cannot_read`, `user_who_left_conversation_cannot_read`
  - `department_member_can_read_department_kb_file`, `other_department_cannot`
  - `user_avatar_readable_by_any_authenticated_user`, `workspace_logo_readable`, `bot_and_persona_avatar_readable`
  - `file_without_refs_only_uploader`
  - `profile_fallback_not_queried_when_conversation_rule_matches` (verify không có query `users`)
- [ ] **Step 3: Chạy** `./mvnw -q test -Dtest='UploadRefsTest,UploadAccessPolicyTest'` → FAIL
- [ ] **Step 4: Implement** `UploadRefs`, `UploadAccessPolicy` (participants qua `ConversationCacheService.findByIdOptional`, phòng ban qua `users.departmentIds`).
- [ ] **Step 5: Gắn ghi ref vào mọi đường lưu** — mỗi chỗ sau khi lưu thành công gọi `attachToConversation(content, conversationId)`: gửi tin, chuyển tiếp, sửa nội dung, tin AI, đặt avatar/wallpaper hội thoại; tạo `KbDocument` → hội thoại hoặc phòng ban tương ứng. Test cho từng đường: thêm 1 assertion "sau khi gửi/chuyển tiếp/sửa/đặt avatar, `fs.files.metadata.refs` có `{t:"c", id}`" vào test service sẵn có của đường đó.
- [ ] **Step 6: Nối vào controller** + test MockMvc: `flag_on_participant_200`, `flag_on_stranger_with_valid_token_403`, `flag_on_internal_key_bypasses_policy_200`, `flag_on_response_cache_control_private`.
- [ ] **Step 7: Full suite + spotless** → xanh; file nào vượt 500 dòng (luật clean-code) thì tách.
- [ ] **Step 8: Commit** `feat(chat): per-file access control for uploads`

### Task 1c: Backfill `refs` cho file cũ

**Files:**
- Create: `scripts/migrations/2026-11-05-upload-refs.js` (mongosh, cùng mẫu `2026-08-13-user-blocks-collection.js`; idempotent)
- Modify: `package.json` gốc — script `migrate:upload-refs`

**Interfaces:** Consumes: định dạng `metadata.refs` của Task 1b. Quét `messages` (theo từng conversationId, chỉ tin có `/api/uploads/` trong `content`), `conversations.avatarUrl|wallpaper`, `kb_documents.fileUrl` → `$addToSet` ref. Ảnh hồ sơ không cần backfill (quy tắc 4 kiểm tra trực tiếp). In báo cáo: số file được gắn ref, số file **không** có ref nào (từ nay chỉ người upload xem được).

- [ ] **Step 1:** chạy trên `dev` (DB local có seed) với `--dry-run` → in số liệu, không ghi.
- [ ] **Step 2:** chạy thật trên `dev` 2 lần → lần 2 báo 0 thay đổi (idempotent).
- [ ] **Step 3:** commit `chore(migration): backfill upload refs`.
- [ ] **Step 4 (vận hành, trước khi bật cờ trên prod):** **chạy Task 5 backup trước**, rồi chạy migration trên Atlas, lưu báo cáo vào PR.

### Task 2: ai-service — gửi `X-Internal-Key` khi tải upload

**Files:**
- Modify: `apps/server/ai-service/src/ai/chat-image.service.ts:97`, `apps/server/ai-service/src/kb/kb-processor.service.ts:71`
- Test: spec sẵn có cạnh 2 file trên (`*.spec.ts`)

**Interfaces:**
- Consumes: Task 1 — chat-service chấp nhận header `X-Internal-Key`.
- Produces: helper `internalUploadHeaders(config): Record<string,string>` trong `apps/server/ai-service/src/common/upload-ref.ts` → `{ 'X-Internal-Key': config.internalApiKey }` (rỗng `{}` nếu key không set).

- [ ] **Step 1: Test fail** — trong 2 spec, assert `fetch` được gọi với `headers` chứa `'X-Internal-Key': 'test-key'` khi `config.internalApiKey='test-key'`; và **không** gửi header khi URL không qua `resolveUploadUrl` (không bao giờ gửi key ra host lạ).
- [ ] **Step 2: Chạy** `pnpm --filter ai-service test -- chat-image kb-processor` → FAIL
- [ ] **Step 3: Implement** helper + truyền vào 2 chỗ `fetch`.
- [ ] **Step 4: Chạy lại + `pnpm --filter ai-service test`** → xanh
- [ ] **Step 5: Commit** `fix(ai): authenticate upload fetches to chat-service with the internal key`

### Task 3: web — gắn media token qua `absoluteMediaUrl`

**Files:**
- Create: `apps/web/lib/media-token.ts` (store Zustand: `token`, `expiresAt`, `ensureMediaToken(): Promise<void>`)
- Modify: `apps/web/lib/media.ts` (`absoluteMediaUrl`, `downloadMediaUrl`), `apps/web/lib/api/chat.ts` (thêm `getMediaToken()`), nơi khởi tạo phiên sau đăng nhập (gọi `ensureMediaToken()`), `apps/web/lib/auth/logout.ts` (xoá token)
- Test: `apps/web/lib/__tests__/media.test.ts`, `apps/web/lib/__tests__/media-token.test.ts`

**Interfaces:**
- Consumes: Task 1 — `GET /api/uploads/token`.
- Produces: `absoluteMediaUrl(url)` trả URL có `?t=<token>` (hoặc `&t=`) **chỉ** khi path khớp `/api/uploads/` và đã có token; URL `http(s)` ngoài, `blob:`, `data:` giữ nguyên.

- [ ] **Step 1: Test fail**: `appends_t_for_upload_path`, `inserts_t_before_fragment` (avatar/wallpaper dạng `/api/uploads/<id>#fit=cover&scale=120` → `?t=` nằm **trước** `#`, `Conversation.java:58`), `keeps_existing_query_and_appends_with_ampersand`, `does_not_touch_external_blob_data_urls`, `no_token_yet_returns_plain_url`, `download_url_keeps_both_t_and_download`, `refreshes_when_less_than_1h_left` (fake timers), `logout_clears_token`.
- [ ] **Step 2: Chạy** `pnpm --filter web vitest run lib/__tests__/media` → FAIL
- [ ] **Step 3: Implement**; `ensureMediaToken` gọi lại API khi còn < 1h, hẹn `setTimeout` làm mới. Component dùng `absoluteMediaUrl` phải re-render khi token đổi → selector Zustand trong hook `useMediaUrl(url)` nếu render trước khi có token (thêm hook vào `media-token.ts`, thay ở các chỗ ảnh avatar/tin nhắn đang gọi trực tiếp — chỉ những chỗ render trước khi đăng nhập xong).
- [ ] **Step 4: Chạy** `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint && pnpm --filter web vitest run` → xanh
- [ ] **Step 5: Commit** `feat(web): send the media token with upload URLs`

### Task 4: Flutter — gắn media token qua `absoluteMediaUrl`

**Files:**
- Create: `apps/client/lib/core/media/media_token_provider.dart` (Riverpod, cùng logic làm mới < 1h)
- Modify: `apps/client/lib/core/utils/media_url.dart`, repository chat (thêm `getMediaToken()`), luồng đăng nhập/đăng xuất trong `features/auth/domain/auth_provider.dart`
- Test: `apps/client/test/core/media_url_test.dart`, `apps/client/test/core/media_token_provider_test.dart`

**Interfaces:**
- Consumes: Task 1.
- Produces: `String absoluteMediaUrl(String url)` — hành vi giống web Task 3 (cùng quy tắc `?t=`/`&t=`, cùng ngoại lệ). Giữ chữ ký cũ để 22 chỗ gọi không phải sửa; token đọc từ holder đồng bộ do provider cập nhật.

- [ ] **Step 1: Test fail** — cùng 8 case như Task 3, kể cả `inserts_t_before_fragment` (đổi tên sang snake_case Dart).
- [ ] **Step 2: Chạy** `cd apps/client && flutter test test/core/` → FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Chạy** `flutter analyze && flutter test` → xanh
- [ ] **Step 5: Commit** `feat(mobile): send the media token with upload URLs`

**Sau Task 1–4 (vận hành, chỉ sau khi PR merge + deploy):** backup (Task 5) → chạy migration Task 1c trên Atlas → cài app mới lên mọi máy demo → đặt `UPLOADS_REQUIRE_AUTH=true` trong `.env.mini` → recreate chat-service → kiểm tra: mở `https://<api>/api/uploads/<id>` không token = 401; tài khoản không thuộc hội thoại (có token) = 403; web + app vẫn thấy ảnh; hỏi AI về 1 ảnh vẫn trả lời được. Rollback = đặt lại `false`.

### Task 5: Backup Mongo hằng đêm từ Mini

**Files:**
- Create: `scripts/mini/backup-mongo.sh`, `scripts/mini/backup-mongo.test.sh`, `scripts/mini/com.pon.mongo-backup.plist`
- Modify: `scripts/mini/install-autoupdate.sh` (cài thêm plist) hoặc tạo `install-backup.sh` theo cùng mẫu
- Docs: `docs/superpowers/runbooks/backup-restore.md`

**Interfaces:**
- `backup-mongo.sh [--restore-check]`: đọc `MONGODB_URI` từ `infra/docker-compose/.env.mini`; chạy `docker run --rm mongo:7 mongodump --uri=... --archive --gzip` → `~/PonBackups/platform-YYYYmmdd-HHMM.archive.gz` (chmod 600); giữ **14** bản mới nhất; dừng với exit 2 nếu ổ trống < **10 GB**; `--restore-check` restore bản mới nhất vào DB tạm `platform_restore_check` trên container `mongo:7` cục bộ dùng-xong-xoá, so số document `users`/`messages`/`conversations` > 0, ghi `~/PonBackups/last-status`.
- launchd: 03:30 hằng ngày; Chủ nhật chạy thêm `--restore-check`.

- [ ] **Step 0 (bạn làm):** xem tier Atlas trong Atlas UI. Nếu M10+ có Cloud Backup thì task này vẫn làm (bản sao ngoài Atlas), nhưng ghi cả hai vào runbook.
- [ ] **Step 1: Test fail** `backup-mongo.test.sh` (stub `docker` như `redeploy.test.sh`): `keeps_only_14_archives`, `refuses_when_disk_below_10g` (stub `df`), `archive_is_mode_600`, `failed_dump_exit_nonzero_and_no_partial_file`, `restore_check_fails_when_counts_zero`.
- [ ] **Step 2: Chạy** `bash scripts/mini/backup-mongo.test.sh` → FAIL
- [ ] **Step 3: Implement** (ghi ra file `.partial` rồi `mv` khi xong).
- [ ] **Step 4: Chạy lại** → all checks passed
- [ ] **Step 5: Runbook** — cách restore toàn bộ / 1 collection, vị trí file, ai giữ bản sao ngoài máy (đề xuất: `rsync` sang Air hằng tuần — **không** qua `~/DigitalBrain`).
- [ ] **Step 6: Commit** `feat(mini): nightly Mongo backup with weekly restore check`
- [ ] **Step 7 (vận hành trên Mini sau merge):** cài plist, chạy tay 1 lần + `--restore-check`, xác nhận `last-status` OK.

### Task 6: Log tập trung (theo D4 = A: Loki + Grafana local)

**Files:**
- Create: `infra/docker-compose/compose.logging.yml` (Loki 3.x, Grafana, Alloy đọc Docker socket), `infra/logging/loki.yml` (retention `336h`), `infra/logging/alloy.river`
- Modify: `scripts/mini/up.sh` (thêm `-f compose.logging.yml` khi `LOGGING=1` trong `.env.mini`), `compose.mini.yml` (mọi service: `logging: driver json-file, max-size 10m, max-file 5` — áp dụng cả khi không bật Loki)
- Docs: `docs/observability.md` mục "Log tập trung"

**Interfaces:** Grafana chỉ bind `127.0.0.1:3300` (vào qua Tailscale/SSH tunnel), **không** qua Caddy/Cloudflare. Mật khẩu admin Grafana từ `.env.mini` `GRAFANA_ADMIN_PASSWORD:?required`.

- [ ] **Step 1: Test fail** — thêm case vào `scripts/mini/smoke.test.sh` hoặc test mới: `docker compose -f compose.mini.yml -f compose.logging.yml config` hợp lệ; mọi service có `logging.options.max-size`; Grafana port chỉ `127.0.0.1`.
- [ ] **Step 2: Chạy** → FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Chạy** → xanh; `bash scripts/mini/redeploy.test.sh` vẫn xanh
- [ ] **Step 5: Commit** `feat(mini): central logs with Loki + Grafana (local, 14 days)`
- [ ] **Step 6 (vận hành):** bật `LOGGING=1`, kiểm `docker stats` RAM, truy vấn `{container="pon-mini-chat-service-1"}` ra log.

### Task 7: Repo — branch protection + secret scanning (D3 = A, D6 = có)

Thao tác GitHub, không có code. Làm **sau** khi Task 1–6 đã merge (vì từ đây push thẳng `main` bị chặn).

- [ ] **Step 1:** bật protection:
```bash
gh api -X PUT repos/MITOM06/platform/branches/main/protection --input - <<'JSON'
{"required_status_checks":{"strict":true,"contexts":["Auth Service (NestJS)","Chat Service (Spring Boot)","AI Service (NestJS)","Connector Service (NestJS)","Web (Next.js)","Flutter Client","Secret Scan (gitleaks)","Environment Separation (no hardcoded prod hosts)"]},
 "enforce_admins":true,"required_pull_request_reviews":null,"restrictions":null,
 "allow_force_pushes":false,"allow_deletions":false,"required_linear_history":false}
JSON
```
  (`required_pull_request_reviews: null` vì repo 1 người — không tự approve được PR của mình; bắt buộc PR thì dùng ruleset "require pull request, 0 approvals" ở Step 2.)
- [ ] **Step 2:** ruleset bắt buộc PR (0 approval) cho `main` qua `gh api repos/MITOM06/platform/rulesets`.
- [ ] **Step 3:** bật secret scanning + push protection: `gh api -X PATCH repos/MITOM06/platform -f security_and_analysis[secret_scanning][status]=enabled -f security_and_analysis[secret_scanning_push_protection][status]=enabled`
- [ ] **Step 4: Verify:** `gh api repos/MITOM06/platform/branches/main/protection --jq '.enforce_admins.enabled'` → `true`; thử `git push origin HEAD:main` từ nhánh test → bị từ chối.
- [ ] **Step 5:** kiểm tra `scripts/mini/redeploy.sh` / CI không có bước nào push lên `main` (nếu có → sửa trước Step 1).

### Task 8: Mini — gỡ Remote Mouse + FileVault theo D2

Vận hành trên Mini, không có code.

- [ ] **Step 1 (D5 = gỡ):** thoát app qua `osascript -e 'quit app "Remote Mouse"'`; nếu còn, `kill <PID>` theo PID lấy từ `lsof -nP -iTCP:1978 -sTCP:LISTEN`; xoá `/Applications/Remote Mouse.app` và mục Login Items.
- [ ] **Step 2: Verify:** `lsof -nP -iTCP:1978 -iTCP:1979` rỗng; sau reboot vẫn rỗng.
- [ ] **Step 3 (D2 = B, đã chốt):** cập nhật `runbooks/mac-mini-cloudflare.md` mục FileVault: ghi rủi ro chấp nhận + danh sách secret phải xoay nếu mất máy (`JWT_ACCESS_SECRET`, `INTERNAL_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, Atlas user, Upstash token, LiveKit key, Cloudflare tunnel token, Firebase SA). Thêm cài đặt bù: khoá màn hình ngay khi rảnh (`sysadminctl -screenLock immediate`), giữ firewall macOS bật.
- [ ] **Step 4:** commit runbook `docs(mini): record the FileVault decision and the secrets to rotate on loss`

### Task 9: Hồ sơ audit

- [ ] Tạo `docs/security/audit-l3-status.md`: bảng 5 gap → trạng thái (đóng / rủi ro chấp nhận + lý do + ngày), link PR/commit. Đây là tài liệu dùng cho báo cáo đồ án.
- [ ] Đề xuất cập nhật dòng audit trong `01-knowledge.md` (hỏi bạn trước khi ghi).
- [ ] Commit `docs(security): audit L3 gap status`

---

## Thứ tự PR đề xuất

1. PR-1: Task 1 + 1b + 1c + 2 (server + migration, cờ tắt → không đổi hành vi prod)
2. PR-2: Task 3 + 4 (client)
3. PR-3: Task 5 + 6 (Mini scripts)
4. Vận hành: cài backup (Task 5) → chạy migration 1c trên Atlas → cài app mới → bật cờ uploads → log → Task 8
5. Task 7 (khoá `main`) — cuối cùng
6. Task 9
