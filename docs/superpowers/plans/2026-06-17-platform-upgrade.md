# Platform Upgrade Plan — "Đỉnh, không thừa"

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development hoặc superpowers:executing-plans để thực thi từng task. Step dùng checkbox (`- [ ]`).

**Goal:** Nâng codebase từ "portfolio cao cấp" lên "public project xứng tầm AI, sẵn sàng một phần thương mại" — bằng các thay đổi đòn bẩy cao, chi phí vận hành thấp.

**Architecture:** Giữ nguyên kiến trúc hiện tại (NestJS auth + Spring Boot chat + NestJS ai + Flutter + Next.js + RabbitMQ/Redis/Qdrant). KHÔNG thêm tầng hạ tầng nặng. Chỉ siết 3 trục: **độ tin cậy (test+CI)**, **chi phí/chất lượng AI**, và **độ chỉn chu của một public repo**.

**Tech Stack:** giữ nguyên. Thêm: Vitest + React Testing Library (web), `flutter_test`/`mocktail` (mobile), OpenTelemetry SDK mỏng, gitleaks (CI secret scan).

## Global Constraints

- **Triết lý chủ đạo — "đỉnh, không thừa":** mỗi task phải qua test: *đòn bẩy cao cho 1 public + partly-commercial + AI-built project, chi phí/độ phức tạp vận hành thấp*. Nếu không qua → cắt.
- **Clean-code rule (CLAUDE.md):** Flutter ≤400 dòng/file, NestJS/Spring ≤500 dòng/file. Mọi file đụng tới phải tuân thủ.
- **i18n rule:** backend trả **error code**, client localize. Không hardcode string ngôn ngữ trong backend.
- **Sync rule:** thay đổi UI/feature 1 platform phải phản chiếu sang platform kia (web ↔ Flutter).
- **Public repo:** KHÔNG commit secret. `.env.example` phải đủ mọi biến. JWT_ACCESS_SECRET phải đồng nhất mọi service.
- **Package manager:** pnpm (JS/TS), Maven (Java), flutter pub (Flutter).

## Anti-Scope — KHÔNG làm (tránh "súng bắn muỗi")

Ghi rõ để chống over-engineering — các việc sau **cố ý loại khỏi plan** cho tới khi có nhu cầu thực:

- ❌ Kubernetes / service mesh / Istio — docker-compose là đủ cho quy mô này.
- ❌ Datadog / New Relic trả phí — dùng OTel + Sentry (đã có) + log có cấu trúc.
- ❌ Multi-region / autoscaling phức tạp.
- ❌ Full multi-tenancy (org/workspace/RBAC nhiều tầng) + billing engine — chỉ chuẩn bị "đường ray" (tenant id) nếu rẻ, không build engine.
- ❌ Tách thêm microservice — 3 backend service là vừa.
- ❌ Viết lại RAG/memory — phần này đã tốt, chỉ thêm đo lường (eval) và routing chi phí.

---

## Phase 0 — Foundation Gate (đòn bẩy cao nhất, ~2–3 ngày)

Mục tiêu: biến CI thành **cổng gác thật** và đóng 3 lỗ hổng đã verify hôm nay. Không có phase này, mọi phase sau không được bảo vệ.

### Task 1: CI thành cổng gác thật (bỏ `--passWithNoTests`)

**Files:**
- Modify: `.github/workflows/ci.yml:28,67`
- Modify: `.github/workflows/deploy.yml:36,42`

**Vấn đề:** 4 chỗ chạy `pnpm exec jest --passWithNoTests` → CI luôn xanh kể cả khi 0 test. Không gác gì.

**Cách làm (right-sized):** KHÔNG đặt coverage threshold cao ngay (sẽ fail vì client chưa có test). Làm 2 bước:
- Phase 0: bỏ `--passWithNoTests` cho **service đã có test** (ai-service, chat-service, auth-service) → các service này nếu mất test sẽ đỏ. Giữ tạm cho client cho tới khi Phase 1 thêm test.
- Thêm secret scan (Task 4) vào CI.

- [ ] **Step 1:** Đọc `.github/workflows/ci.yml` và `deploy.yml` đầy đủ, xác định job nào chạy cho service nào.
- [ ] **Step 2:** Với job test của 3 backend service đã có test, đổi `jest --passWithNoTests` → `jest --ci` (NestJS) / giữ `mvn test` (Spring). Thêm comment `# client tests gated in Phase 1`.
- [ ] **Step 3:** Thêm bước `flutter test` (mobile) và `pnpm --filter web test` (web) ở chế độ **non-blocking** tạm thời (`continue-on-error: true`) — để CI bắt đầu chạy chúng mà chưa fail build.
- [ ] **Step 4:** Verify: `act -j test` hoặc push nhánh → xem CI chạy đúng job, không còn `passWithNoTests` cho backend.
- [ ] **Step 5:** Commit: `ci: make backend test jobs a real gate, run client tests non-blocking`

### Task 2: Xóa `any` trong path xác thực JWT

**Files:**
- Modify: `apps/server/auth-service/src/modules/auth/strategies/jwt.strategy.ts:11,25`

**Vấn đề:** `redis: any` và `validate(req: any, payload: any)` — type erasure ngay trên đường xác thực token. `Redis` type đã import được (dùng ở service khác).

**Interfaces — Produces:** `interface JwtPayload { sub: string; email?: string; sessionId?: string; iat?: number; exp?: number; }` (điều chỉnh field theo payload thật khi đọc code).

- [ ] **Step 1:** Đọc `jwt.strategy.ts` đầy đủ + tìm nơi token được ký (`auth.service.ts` / `session.service.ts`) để biết shape payload thật.
- [ ] **Step 2:** Định nghĩa `JwtPayload` interface (file `auth/interfaces/jwt-payload.interface.ts` hoặc inline) khớp đúng field đang ký.
- [ ] **Step 3:** Đổi `redis: any` → `redis: Redis` (import `ioredis`/`Redis` đúng như service khác đang dùng). Đổi `validate(req: Request, payload: JwtPayload)`.
- [ ] **Step 4:** Verify: `pnpm --filter auth-service build` (tsc) PASS, `pnpm --filter auth-service test` PASS.
- [ ] **Step 5:** Commit: `fix(auth): replace any with typed Redis + JwtPayload in JWT strategy`

### Task 3: Backend trả error code thay vì string tiếng Việt

**Files:**
- Modify: `apps/server/auth-service/src/modules/auth/auth.service.ts:152,309,403`
- Modify (client mapping): `apps/client/lib/l10n/app_*.arb` (7 file) + `apps/web/messages/*.json`

**Vấn đề:** `"Tài khoản bị tạm khóa ${minutes} phút..."` v.v. hardcode tiếng Việt trong backend — vi phạm chính rule i18n của dự án.

**Cách làm:** backend trả `{ code: 'ACCOUNT_LOCKED', params: { minutes } }`; client map code → string đã localize.

**Interfaces — Produces:** error codes: `ACCOUNT_LOCKED` (param `minutes`), `PASSWORD_UPDATED`, `ACCOUNT_UNVERIFIED_OTP_SENT`.

- [ ] **Step 1:** Tìm tất cả string ngôn ngữ trong `auth-service/src` (`grep -rn "Tài khoản\|Mật khẩu\|đã"`), liệt kê đầy đủ (có thể >3 chỗ).
- [ ] **Step 2:** Định nghĩa enum/const `AuthErrorCode` + chuẩn response `{ code, params? }`. Đổi 3+ chỗ sang trả code.
- [ ] **Step 3:** Thêm key l10n tương ứng vào `app_en.arb` (template) + 6 file còn lại + `web/messages/*.json`. Map code→key ở client.
- [ ] **Step 4:** Verify backend: `pnpm --filter auth-service test`. Verify client: `flutter gen-l10n` + `flutter analyze` sạch.
- [ ] **Step 5:** Commit: `refactor(auth): return error codes instead of hardcoded VI strings (i18n rule)`

### Task 4: Secret hygiene cho public repo (CRITICAL vì repo public)

**Files:**
- Create: `.github/workflows/` thêm bước gitleaks (vào `ci.yml`)
- Audit: tất cả `.env.example`, `apps/*/CLAUDE.md`, root
- Verify: `pon-c30fd-firebase-adminsdk-fbsvc-*.json` (đã gitignored + không trong history — confirm lại)

**Vấn đề:** repo public → bất kỳ ai đọc được. Phải chắc chắn 0 secret và onboarding rõ ràng.

- [ ] **Step 1:** Chạy `gitleaks detect --no-banner` local trên toàn history. Liệt kê mọi finding.
- [ ] **Step 2:** Confirm Firebase key không trong git history (`git log --all -- '<file>'` rỗng — đã verify hôm nay, re-confirm). Nếu có bất kỳ secret nào trong history → tài liệu hoá quy trình rotate + (tuỳ mức độ) `git filter-repo`.
- [ ] **Step 3:** Rà mọi `.env.example` đủ biến (so với `.env` thật, che giá trị). Đặc biệt: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `JWT_ACCESS_SECRET`, `QDRANT_URL`, RabbitMQ/Redis/Mongo URI.
- [ ] **Step 4:** Thêm job `gitleaks` vào `ci.yml` (block PR nếu phát hiện secret).
- [ ] **Step 5:** Commit: `ci: add gitleaks secret scanning + complete .env.example for public repo`

---

## Phase 1 — Test Foundation (~1–2 tuần)

Mục tiêu: đưa client từ 0 → có lưới an toàn happy-path. Không chạy theo % coverage — chạy theo **đường đi quan trọng nhất** (critical path).

### Task 5: Flutter test harness + provider/widget happy-path

**Files:**
- Create: `apps/client/test/features/chat/chat_provider_test.dart`
- Create: `apps/client/test/features/chat/conversations_notifier_test.dart`
- Create: `apps/client/test/features/chat/chat_screen_test.dart`
- Modify: `apps/client/pubspec.yaml` (thêm `mocktail` dev dependency)

**Interfaces — Consumes:** `ChatProvider`, `ConversationsNotifier`, `StompService` (mock).

- [ ] **Step 1:** Thêm `mocktail` vào `dev_dependencies`, `flutter pub get`.
- [ ] **Step 2:** Viết test FAIL trước: `chat_provider_test.dart` — gửi message → state chuyển sang sending → done khi STOMP ack (mock StompService). (code test cụ thể: mock `StompService.send`, `ProviderContainer`, `expect` state transitions).
- [ ] **Step 3:** Chạy `flutter test test/features/chat/chat_provider_test.dart` → FAIL (chưa wire mock).
- [ ] **Step 4:** Wire mock đúng, chạy lại → PASS.
- [ ] **Step 5:** Lặp cho `conversations_notifier` (load + cập nhật khi có STOMP event) và `chat_screen` (render list + input bar — widget test với `pumpWidget`).
- [ ] **Step 6:** Verify toàn bộ: `flutter test` PASS, `flutter analyze` sạch.
- [ ] **Step 7:** Commit: `test(mobile): add chat provider/notifier/screen happy-path tests`

### Task 6: Web test harness (Vitest + RTL) + critical-path

**Files:**
- Create: `apps/web/vitest.config.ts`, `apps/web/test/setup.ts`
- Create: `apps/web/components/chat/__tests__/MessageBubble.test.tsx`
- Create: `apps/web/lib/api/__tests__/axios-refresh.test.ts`
- Modify: `apps/web/package.json` (script `"test": "vitest run"`)

- [ ] **Step 1:** Cài `vitest @testing-library/react @testing-library/jest-dom jsdom` (devDeps), tạo config + setup.
- [ ] **Step 2:** Test FAIL trước: `MessageBubble.test.tsx` render đúng từng message type (text/image/file/AI) — đối chiếu với `message_bubble.dart` để đảm bảo sync.
- [ ] **Step 3:** `pnpm --filter web test` → FAIL.
- [ ] **Step 4:** Sửa cho PASS (test phản ánh đúng component hiện tại).
- [ ] **Step 5:** Test `axios-refresh`: 401 → refresh 1 lần → retry → fail thì clearAuth. Mock axios adapter.
- [ ] **Step 6:** Verify: `pnpm --filter web test` PASS, `pnpm --filter web lint` + `tsc --noEmit` sạch.
- [ ] **Step 7:** Bật gate cứng cho web/mobile trong CI (gỡ `continue-on-error` từ Task 1).
- [ ] **Step 8:** Commit: `test(web): add Vitest harness + MessageBubble + axios refresh tests; gate client tests in CI`

### Task 7: Một integration test THẬT (dùng replica set có sẵn)

**Files:**
- Create: `apps/server/chat-service/src/test/.../MessageServiceIT.java` (Testcontainers MongoDB) **hoặc** ai-service e2e với Qdrant.

**Vấn đề:** docker-compose có MongoDB replica set nhưng KHÔNG test nào dùng — 100% test là mock. Một broken query/missing index không bị bắt.

- [ ] **Step 1:** Thêm Testcontainers (Mongo) vào `chat-service` test scope (Maven).
- [ ] **Step 2:** Viết IT: lưu message thật → cursor pagination thật → assert thứ tự + giới hạn + cursor đúng (đây là thứ mock không catch được).
- [ ] **Step 3:** Chạy `mvn -Dtest=MessageServiceIT test` → PASS với container thật.
- [ ] **Step 4:** Thêm vào CI (job riêng, có service container).
- [ ] **Step 5:** Commit: `test(chat): add Testcontainers integration test for message pagination`

---

## Phase 2 — AI Cost & Quality (trọng tâm "AI xứng tầm, không tốn kém")

Đây là phần khác biệt nhất cho một dự án AI-built. AI layer đã tốt; việc cần làm là **cắt chi phí thừa** và **đo được chất lượng**.

### Task 8: Model routing theo độ phức tạp (cắt chi phí lớn nhất)

**Files:**
- Modify: `apps/server/ai-service/src/ai/ai.service.ts` (chọn model)
- Modify: `apps/server/ai-service/src/config/configuration.ts`

**Vấn đề:** `primaryModel = claude-opus-4-8` dùng cho **MỌI** tin nhắn. Opus đắt nhất — "súng bắn muỗi" cho câu chào/câu ngắn. `fallbackModel` (haiku) chỉ dùng khi lỗi, không dùng để tiết kiệm.

**Cách làm (right-sized, KHÔNG over-engineer):** một router heuristic rẻ, không thêm model phân loại:
- Tin ngắn/không tool/không KB-context → `claude-haiku-4-5` hoặc `claude-sonnet-4-6`.
- Có tool use, có KB grounding, hoặc hội thoại dài/độ khó cao → `claude-opus-4-8`.
- Cho phép override per-conversation (persona "pro" luôn Opus).

**Interfaces — Produces:** `selectModel(ctx: { hasTools, hasKbContext, historyLen, contentLen }): string`.

- [ ] **Step 1:** Đọc `ai.service.ts` đầy đủ để biết chỗ `model` được truyền vào `messages.stream`.
- [ ] **Step 2:** Thêm config `ANTHROPIC_ROUTER_ENABLED`, `ANTHROPIC_SIMPLE_MODEL` (default `claude-haiku-4-5`), ngưỡng độ dài.
- [ ] **Step 3:** Viết test FAIL: `selectModel` trả simple model cho turn ngắn không tool, trả Opus khi có tool/KB.
- [ ] **Step 4:** Implement `selectModel`, wire vào agentic loop. Verify test PASS.
- [ ] **Step 5:** Verify build + `pnpm --filter ai-service test`. Ghi rõ trong PR: kỳ vọng giảm token cost ~X% cho turn đơn giản (đo bằng metric ở Task 10).
- [ ] **Step 6:** Commit: `feat(ai): complexity-based model routing to cut cost on simple turns`

### Task 9: AI eval harness (đo regression chất lượng)

**Files:**
- Create: `apps/server/ai-service/eval/dataset.jsonl` (10–30 case: câu hỏi + grounding KB + kỳ vọng)
- Create: `apps/server/ai-service/eval/run-eval.ts` + script `pnpm --filter ai-service eval`

**Vấn đề:** không có cách đo "đổi prompt/model có làm AI tệ đi không". Với AI-built project, đây là lưới an toàn quan trọng nhất của AI layer.

**Cách làm (rẻ):** LLM-as-judge dùng chính Claude (Haiku để rẻ) chấm pass/fail theo rubric; chạy thủ công/khi đổi prompt, KHÔNG gate CI (tốn token).

- [ ] **Step 1:** Tạo dataset nhỏ: các case bao gồm RAG grounding, memory recall, tool use, refusal.
- [ ] **Step 2:** Viết runner: chạy ai-service trên từng case → thu câu trả lời → Haiku judge theo rubric → in bảng pass/fail + lý do.
- [ ] **Step 3:** Chạy baseline, lưu kết quả vào `eval/baseline.md`.
- [ ] **Step 4:** Document trong README ai-service: chạy eval trước khi đổi prompt/model.
- [ ] **Step 5:** Commit: `feat(ai): add LLM-as-judge eval harness + baseline dataset`

### Task 10: Observability mỏng (OTel xuyên pipeline + AI cost/latency)

**Files:**
- Modify: `apps/server/ai-service/src/main.ts`, `apps/server/auth-service/src/main.ts`
- Modify: `apps/server/chat-service/...` (Spring OTel starter)
- Create: cấu hình OTel exporter (console/OTLP → có thể trỏ Jaeger local trong compose)

**Vấn đề:** khi 1 message AI fail, không trace được fail ở hop nào (`chat → RabbitMQ → ai-service → Redis → STOMP`). Chỉ có Sentry rời rạc.

**Cách làm (right-sized):** OTel auto-instrumentation + 1 trace context truyền qua RabbitMQ header & Redis payload. Export ra Jaeger chạy trong docker-compose (miễn phí). Thêm metric: token in/out per request, model dùng, latency.

- [ ] **Step 1:** Thêm OTel SDK (NestJS) + Spring OTel starter. Console exporter trước.
- [ ] **Step 2:** Truyền `traceparent` qua RabbitMQ message header (chat→ai) và Redis response payload (ai→chat).
- [ ] **Step 3:** Thêm span/metric ở agentic loop: model, input/output tokens, số vòng tool, latency.
- [ ] **Step 4:** Thêm Jaeger vào `infra/docker-compose/compose.yml`, trỏ OTLP exporter vào đó.
- [ ] **Step 5:** Verify: gửi 1 tin AI → thấy 1 trace liền mạch qua 3 service trong Jaeger UI.
- [ ] **Step 6:** Commit: `feat(obs): end-to-end OTel tracing + AI token/latency metrics across pipeline`

---

## Phase 3 — Public-Project Polish (vì public + một phần thương mại)

### Task 11: Onboarding & docs cho người lạ clone repo

**Files:**
- Create/Update: `README.md` (root) — quickstart 5 phút, kiến trúc, "deploy your own"
- Create: `ONBOARDING.md` (cho dev mới + cho AI agent)
- Create: `docs/architecture.md` + sơ đồ (Mermaid)

- [ ] **Step 1:** Viết README: stack, ports, `docker compose up`, chạy từng service, biến env tối thiểu.
- [ ] **Step 2:** Sơ đồ Mermaid: service topology + real-time pipeline + AI message bus.
- [ ] **Step 3:** Mục "Self-host / deploy" + giới hạn đã biết (single-tenant, quota token).
- [ ] **Step 4:** Verify: người chưa biết dự án làm theo README chạy được local (tự kiểm bằng cách làm sạch env và chạy theo từng bước).
- [ ] **Step 5:** Commit: `docs: add quickstart README, architecture diagrams, onboarding guide`

### Task 12: Rate limiting & abuse guard (public = ai cũng gọi được)

**Files:**
- Modify: ai-service request consumer (per-user token quota — đã có `monthlyTokenLimit`, cần enforce + per-conversation rate)
- Modify: chat-service REST (đã có rate limiter — mở rộng + đồng bộ)

**Vấn đề:** public + AI → bị spam/abuse tốn tiền API. Phải chặn ở mức rẻ (Redis counter), không cần API gateway riêng.

- [ ] **Step 1:** Xác minh `AI_MONTHLY_TOKEN_LIMIT` có thực sự enforce per-user chưa (đọc consumer). Nếu chưa → enforce + trả error code khi vượt.
- [ ] **Step 2:** Thêm per-user/per-IP rate limit (Redis sliding window) cho endpoint gửi message + trigger AI.
- [ ] **Step 3:** Test: vượt quota → bị chặn với error code rõ ràng; client hiển thị thông báo localized.
- [ ] **Step 4:** Commit: `feat(ai/chat): enforce per-user token quota + Redis rate limiting for public use`

### Task 13: Dọn shared packages cho đúng giá trị

**Files:**
- Modify/Delete: `packages/types` (hiện 1 dòng `WsEvent`, không ai dùng)
- Possibly: `packages/database` (chỉ NestJS dùng được — document rõ)

**Cách làm:** 2 lựa chọn, chọn 1 (right-sized):
- **(A) Bỏ `packages/types`** nếu STOMP event contract không thực sự share được giữa Dart/TS/Java.
- **(B) Biến thành contract thật**: định nghĩa đầy đủ event payload, sinh type cho TS + generate/đối chiếu cho Dart, dùng ở cả 2 client. Chỉ làm nếu giá trị > chi phí.

- [ ] **Step 1:** Kiểm `WsEvent` có import ở đâu không (`grep -rn "WsEvent"`). Nếu 0 → nghiêng về (A).
- [ ] **Step 2:** Quyết định + thực hiện. Nếu (A): xoá package, cập nhật `pnpm-workspace.yaml`/tsconfig refs.
- [ ] **Step 3:** Document `packages/database` chỉ dùng cho NestJS service (auth + ai), Spring có schema riêng.
- [ ] **Step 4:** Verify: `pnpm install` + build toàn bộ workspace PASS.
- [ ] **Step 5:** Commit: `chore: clean up shared packages to reflect real usage`

---

## Self-Review (đã chạy)

- **Spec coverage:** 7 vấn đề verified → đều có task (test client→T5/T6, CI gate→T1, any JWT→T2, i18n→T3, tracing→T10, ai.service size→gập vào T8 khi đụng file, packages/types→T13). Thêm: AI cost (T8), eval (T9), public-repo hygiene (T4), onboarding (T11), abuse (T12).
- **Placeholder scan:** không dùng "TBD/xử lý sau". Chỗ chưa chốt (T13 A/B) đã nêu tiêu chí quyết định cụ thể.
- **Type consistency:** `selectModel` (T8), `JwtPayload` (T2), `AuthErrorCode` (T3) đặt tên nhất quán.

## Thứ tự ưu tiên đề xuất

1. **Phase 0** (2–3 ngày) — bắt buộc trước, đòn bẩy cao nhất, rủi ro thấp.
2. **Task 8** (AI model routing) — có thể làm song song Phase 0, cắt chi phí ngay.
3. **Phase 1** (test) — nền tảng cho mọi thay đổi sau.
4. **Task 10** (tracing) + **Task 9** (eval) — đo lường.
5. **Phase 3** — polish public/thương mại.
