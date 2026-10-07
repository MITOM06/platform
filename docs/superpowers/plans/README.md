# Implementation Plans — Status Index

> **Read this before opening any plan below.** Most are already implemented; only open a plan
> if you are actively building/extending that feature. Authoritative build state + remaining work:
> [`../PON-ENTERPRISE-HANDOFF.md`](../PON-ENTERPRISE-HANDOFF.md).
>
> Last regenerated: 2026-09-30 (added the AI Context plans and UI-redesign batches 7–8, which had
> shipped but were never indexed). Updated 2026-10-05: Cuộc gọi & Phòng họp tách thành 4 plan PENDING (xem bảng dưới); plan LiveKit 2026-08-22 bị thay thế.
>
> **Unticked `- [ ]` boxes inside a plan do not mean the work is open** — most plans were executed
> without ticking their steps. This index is the status of record.

## ⏳ PENDING — chưa bắt đầu

| Plan | Scope | Trạng thái |
|------|-------|------------|
| `2026-10-05-rtc-foundation-livekit.md` | Nền media dùng chung: lớp `rtc` trong chat-service (token LiveKit, webhook có xác thực, room API), LiveKit trong self-host stack + máy media riêng cho triển khai Mac mini, runbook | **DONE trên nhánh `feat/rtc-foundation` (2026-10-05), chưa lên `main`** — Task 1–8 + 10 xong, chat-service 241/241 test + spotless (sau final review); Task 9 (LiveKit cho dev local) nằm ở commit riêng chờ đẩy lên `dev`. Spec: [`../specs/2026-10-05-calls-and-meetings-design.md`](../specs/2026-10-05-calls-and-meetings-design.md). Không đổi hành vi người dùng (`CALL_TRANSPORT=mesh` mặc định). Deploy prod cần owner chọn máy media (spec §8) — **không chặn việc code** |
| `2026-10-05-calls-on-livekit.md` | **Cuộc gọi** 1-1 + nhóm kiểu Messenger/Zalo qua LiveKit sau cờ `CALL_TRANSPORT`: fix P1 NAT (chỉ có STUN), `answered_elsewhere`, busy phía server, roster từ webhook | **C1–C3 DONE, đã ship trong v1.1.0** (step plan: `2026-10-05-calls-c1-server.md`, `2026-10-05-calls-c2-web.md`, `2026-10-05-calls-c3-flutter.md`). **Còn C4 — QC trên thiết bị thật (pending).** Module B (Trí) |
| `2026-10-05-meetings-p1-core.md` | **Phòng họp** (tính năng mới, kiểu Meet/Teams): họp ngay/lên lịch, link `/meet/{code}`, màn chờ + phòng chờ, host/co-host, giơ tay, reaction, chat, ghi chú chung/riêng, share màn hình, layout, capability `HOST_MEETING` | **MT1 + MT2 xong trên `feat/meetings-p1`** (step plan `2026-10-07-meetings-mt1-mt2.md`) — capability `HOST_MEETING` + domain Phòng họp trong chat-service (REST `/api/meetings`, phòng chờ, webhook điểm danh, nhắc lịch, STOMP); chưa lên `dev`/`main`. **Còn MT3–MT8** (lệnh host/chat/ghi chú, web, Flutter, QC). Phụ thuộc Foundation |
| `2026-10-07-meetings-mt1-mt2.md` | Step plan MT1 (`HOST_MEETING`: catalog, preset, nhãn ma trận quyền web + Flutter 7 locale) + MT2 (chat-service: `Meeting`, `MeetingStore` nguyên tử, `MeetingService`/`MeetingJoinService`/`MeetingController`, `MeetingRtcHandler`, `MeetingReminderSweep`, STOMP `/topic/meeting/{id}` + `/user/queue/meeting`) | **DONE trên `feat/meetings-p1` (2026-10-07)** — Task 1–16; chat-service full suite xanh + spotless. Contract: `docs/api-spec.md` § Meetings |
| `2026-10-05-meetings-p2-ai.md` | AI trong họp: phụ đề có tên người nói, biên bản (transcript + ghi chú + chat), action items → nhắc việc, `@AI` trong chat họp | **PENDING — milestone plan (AI1–AI5).** Phụ thuộc Meetings P1. Module A |
| ~~`2026-08-22-meeting-room-livekit-phase1-plan.md`~~ | Meeting Room Phase 1 (LiveKit) | **SUPERSEDED 2026-10-05** bởi 4 plan trên — không thực thi |
| `2026-10-04-call-1on1-reliability.md` | Cuộc gọi 1-1 (web + Flutter): giữ ICE candidate tới sớm (đang bị bỏ, nên khác mạng thì mất tiếng), chuông + rung + tút chờ (file WAV tự tổng hợp), `reason` khi kết thúc (từ chối / bận / không trả lời / lỗi thiết bị / mất kết nối) kèm thông báo cho A, xử lý lỗi quyền phía B, tên người gọi trên web, nút mic/loa/camera trên mobile | **Code xong Task 0–8 (nhánh `fix/call-1on1-reliability`), CHỜ Task 9 — test trên thiết bị thật** (13 kịch bản trong plan, gồm 2 máy khác mạng). Verify 2026-10-04 (sau review toàn nhánh + 1 lượt sửa 7 lỗi Important): chat-service 199/199 + spotless, web tsc/lint/197 test/build PASS, Flutter analyze 0 issue + 184 test PASS. Còn mở (ruling): máy thứ 2 của B vẫn đổ chuông khi B đã nghe trên máy khác. Xây trên PR #163 (`fix/call-stuck-ringing`). Cuộc gọi thuộc Module B. Ngoài phạm vi: đổ chuông khi app ở nền (FCM + CallKit) và TURN (thuộc plan LiveKit) |

## 🎨 UI Redesign (Warm Grey & Burgundy) — code complete, awaiting visual QA

> Direction/handoff: [`../UI-REDESIGN-DIRECTION.md`](../UI-REDESIGN-DIRECTION.md). Multi-layer
> program (tokens → shared components → per-screen batches) — read the direction doc before
> opening any plan below or writing the next one.

| Plan | Scope | Trạng thái |
|------|-------|------------|
| `2026-07-30-ui-redesign-p1-design-tokens.md` | Layer 1 — design tokens (`globals.css` + `app_theme.dart`) | **Done** — commit `86ca2212`. Web `pnpm build` PASS, `flutter analyze` clean, contrast WCAG AA verified (no value adjustment needed) |
| `2026-07-30-ui-redesign-p2-component-language.md` | Layer 2 — retire the neon brand: symbol rename, gradient/glow/aura removal, shared widgets (`pon_widgets.dart`), logo marks, chat-bubble radius | **Done** — commit `a26f492c` (210 files). Web build PASS, `flutter analyze` clean, `flutter test` 60/60. Neither layer visually verified on a real screen yet |
| `2026-07-30-ui-redesign-l3-pre-chrome-sweep.md` | L3-pre — cross-cutting chrome pass: drop elevation shadows, remove all glass blur (+ de-alpha the surfaces that only existed to be blurred), normalise candy radii, OTP box 10px parity fix | **Done** — commit `11d641aa` (57 files). Web build PASS (exit 0), `flutter analyze` clean. Written *during* execution as the decision record; recovers an interrupted session and fixes 2 bugs it left (mangled class `md:-none`, failing `flutter analyze`) |
| `2026-07-30-ui-redesign-l3-batch1-auth.md` | Layer 3 batch 1 — **Auth**: Flutter auth catches up to web (accent aura orbs removed, hardcoded `Colors.white` → theme tokens, amber second accent dropped, no-op compat params removed at auth call sites) + web control radii/SSO button parity | **Done** — 12 files. `flutter analyze` clean, `flutter test` 60/60, web build PASS. **Fixed a real bug: Flutter auth was illegible in light mode** (white text on the `#F5F2ED` page) |
| `2026-07-30-ui-redesign-l3-batch2a-chat-structural.md` | Layer 3 batch 2a — **Chat core, structural**: added the missing `bottomSheetTheme`/`dialogTheme` (root cause of ~25 hardcoded dark sheets), 31 duplicated accent hexes → token, teal second accent killed on both platforms, all chrome gradients flattened, `MessageBubble` AI-state tints themed | **Done** — 26 files. `flutter analyze` clean, `flutter test` 60/60, web build PASS. ⚠️ **Do not run `dart format` on `lib/features/chat`** — it is not format-clean, so it floods the diff (see plan's "Ghi chú kỹ thuật") |
| `2026-07-30-ui-redesign-l3-batch2b-chat-longtail.md` | Layer 3 batch 2b — **Chat core, long tail**: ~270 hardcoded colour literals → tokens across 53 chrome widgets, 26 radii normalised, leftover **neon cyan** + purple/teal hexes retired, 2 real black-on-burgundy contrast bugs fixed, and the light-mode dialog regression 2a introduced | **Done** — 59 files. `flutter analyze` clean, `flutter test` 60/60, web build PASS. Residual 32 literals are all deliberately-white (on accent / media / scrim) |
| `2026-07-30-ui-redesign-l3-batch3-settings-profile.md` | Layer 3 batch 3 — **Settings & Profile** (+ token-usage, whose Flutter mirror lives in settings): 35 ternaries → tokens, `SettingsCard`'s free-form `glowColor`/`iconBg` API replaced by a `destructive` flag on **both** platforms, 4 more aura orbs, leftover **neon cyan** in the usage chart + rejected **dark-indigo** `#1A1A2E`, and 5 black-on-burgundy contrast bugs | **Done** — 24 files, +136/−324. `flutter analyze` clean, `flutter test` 60/60, web build PASS |
| `2026-07-30-ui-redesign-l3-batch4-ai-features.md` | Layer 3 batch 4 — **AI features**: `AiHubTile.accent` / `AiHubCard.iconBg` per-item colour props removed on both platforms, assistant avatar's violet→teal gradient flattened (sheen motion kept), and **a grep gap closed** — batches 1–3 only searched `Colors.white\|black`, missing the rest of the Material palette | **Done** — 15 files, +58/−69. `flutter analyze` clean, `flutter test` 60/60, web build PASS. Off-palette decorative Material colours are now **0 app-wide** |
| `2026-07-30-ui-redesign-l3-batch5-admin.md` | Layer 3 batch 5 — **Admin console**: was hardcoded dark end-to-end (121 literals, 18 unconditional `darkSurface`, zero `isDark`). `UsageStatCard.color` → `alert` flag, 3 more rejected dark-indigo `#1A1A2E`, and **a real canvas bug** — `ctx.fillStyle = 'var(--primary)'` never worked, so the output bars painted black. Also caught a batch-3 miss (web token-usage SVG chart still on neon cyan) | **Done** — 17 files, +204/−213. `flutter analyze` clean, `flutter test` 60/60, web build PASS. **Neon cyan is now 0 app-wide on both platforms** |
| `2026-07-30-ui-redesign-l3-batch6-remainder.md` | Layer 3 batch 6 — **Remainder** (friends, reminders, help, integrations, skills, notifications, home): the 7 priority greps came back clean, so this was mechanical — 74 literals → tokens, 18 no-op params dropped, `FaqItemTile.glowColor` + its dead 3×-same-accent palette array retired, 2 more aura orbs. **Last batch of Layer 3** | **Done** — 15 files, +106/−189. `flutter analyze` clean, `flutter test` 60/60, web build PASS |
| `2026-07-30-ui-redesign-l3-batch7-hairline-regression.md` | Layer 3 batch 7 — 16 hardcoded dark hairlines removed, structural borders softened | **Done** — commit `119aab3` |
| `2026-07-30-ui-redesign-l3-batch8-media-corners-and-icons.md` | Layer 3 batch 8 — media clipped to bubble corners, 318 icons swept to `_rounded` | **Done** — commit `fbf8269` |
| `2026-07-30-ui-redesign-final-pass.md` | **Final pass (app-wide)** — (a) last 17 no-op call sites cleaned and all 12 param *declarations* deleted from `pon_widgets.dart`, paying off Layer 2's debt in full; (b) `Colors.redAccent` → `colorScheme.error` across 45 files (light-mode destructive was `#FF5252` instead of the palette's `#B3261E`); (c) backend checked — and found the **OAuth deeplink redirect page in `auth-service` still fully on the neon brand**, outside both apps' theming | **Done** — 50 files, +107/−174. `flutter analyze` clean, `flutter test` 60/60, web build PASS, auth-service build PASS. **UI redesign programme complete** |

## ✅ Done — role-aware AI Context (P1–P4)

Merged together via PR #125 (2026-07-13).

| Plan | Scope |
|------|-------|
| `2026-07-13-ai-context-p1-rbac-and-data.md` | RBAC capability + auth-service CRUD for company / department / member AI context |
| `2026-07-13-ai-context-p2a-payload-and-prompt.md` | Context carried in the AI request payload and rendered into the system prompt |
| `2026-07-13-ai-context-p2b-memory-global-rescope.md` | Long-term memory re-scoped from per-conversation to per-user |
| `2026-07-13-ai-context-p3-web-ui.md` | Web `/ai-memory` → `/ai-context` screen + admin editors |
| `2026-07-13-ai-context-p4-flutter-ui.md` | Flutter AI Context screen + admin editors |

## ✅ Done — 2026-07-10 batch (all executed & verified)

| Plan | Scope | Verified in |
|------|-------|-------------|
| `2026-07-10-sidebar-profile-dot-video-hd-recheck.md` | Xoá hardcoded green dot own-avatar (`SidebarProfileBar.tsx`) | commit `c22356b9` |
| `2026-07-10-directory-logo-csp-fix.md` | Domain favicon connector vào CSP `img-src` (`next.config.ts`) | commit `c22356b9` |
| `2026-07-10-skills-copy-honesty-fix.md` | Sửa copy skill sai + fix `requires` id mismatch (web+Flutter) | commit `c22356b9` |
| `2026-07-10-skills-real-tool-wiring.md` | Gate MCP tool (calendar/gmail/notion) theo skill enable | commit `c22356b9` — **1 phần vẫn chặn bởi secret**: `webSearch` cần `WEB_SEARCH_API_URL`/`WEB_SEARCH_API_KEY` (rỗng trong `.env`); `weatherForecast` không có tool — ngoài scope |
| `2026-07-10-edit-profile-cover-role-privacy.md` | Cover 16:6 nhất quán (web+Flutter), field Role read-only, dời Privacy xuống cuối form | 2026-07-11: web `pnpm build` PASS, Flutter `flutter analyze` clean (chưa commit) |
| `2026-07-10-media-message-actions-and-viewer-frame.md` | Video thumbnail hiện frame đầu + bỏ nút download rời, Copy ảnh thật + Download vào menu 3 chấm, khung viewer web ôm sát media | 2026-07-11: web `pnpm build` PASS, Flutter `flutter analyze` clean (chưa commit). **Flutter thêm package `super_clipboard` — build đầu tiên cần Rust toolchain (cargokit)** |

## ✅ Done — 2026-07-11 batch (executed & verified 2026-07-17)

| Plan | Scope | Ghi chú |
|------|-------|---------|
| `2026-07-10-direct-ai-chat-and-message-width.md` | Chat 1-1 với @AI không cần gõ mention (`ChatController.java` + `MessageController.java`, cả 2 platform tự hưởng vì chung backend) + giới hạn bề rộng bubble AI trên web màn hình rộng (`MessageBubble.tsx`) | 2026-07-17: `mvn test` controller suites PASS (Testcontainers pagination test cần Docker), web `pnpm build` PASS |
| `2026-07-11-auth-split-screen-redesign.md` | Redesign `/login`, `/register` (web) — layout 2 cột, cột trái animation hội thoại lặp lại + tagline riêng của PON (không copy ảnh tham khảo) | Web only, Flutter có auth UI riêng không đụng tới. 2026-07-17: web `pnpm build` PASS |

## ✅ Done — 2026-07-08 / 2026-07-09 batch (verified via code inspection, not yet build-deployed)

| Plan | Scope | Verified in commit(s) |
|------|-------|------------------------|
| `2026-07-08-connector-logos-and-new-skills.md` | Real connector logos (web `ConnectorCard`+ Flutter) + webSearch/weatherForecast skills | `b0d8b852` |
| `2026-07-08-ui-polish-5-issues.md` | Directory logos (`DirectoryCard`), last-seen text, own-avatar green dot (web), token-usage chart, mobile app icon | `228eb28f` |
| `2026-07-08-memory-extraction-fix.md` | Extraction threshold 20→10 + first-extract at turn 3 + `/memory` `/ai-memory` slash command (no more hallucination) | present in `ai.service.ts` / `configuration.ts` (commit not individually tagged — bundled in an ai-service batch) |
| `2026-07-09-upload-preview-and-multiselect.md` | Upload preview strip + multi-select messages | web `d9fb9f67`, Flutter `698cc0bd` |
| `2026-07-09-video-hd-greendhot-fixes.md` | Inline video player, global HD/SD toggle, own-avatar green dot (Flutter) | `a6655116` |
| `2026-07-09-settings-mobile-fixes.md` | `/legal` redirect crash, profile view→edit flow + cover-photo preview + AppBar save button, token-usage date range picker (Flutter + chat-service) | `a6655116` |

**Note:** these six plans were still listed as "pending" in `SESSION-HANDOFF-2026-07-09.md` — that doc was stale relative to the commits above. Code-level verification (grep + git show) confirms all changes are present on the current branch. What's NOT verified: an actual `pnpm build` / `flutter analyze` / `mvn compile` run in this session, and whether the running dev/prod instances have picked up these commits (restart/rebuild may be needed — see Action Items below).

## ✅ Done — Bot Factory complete integration (Phase 1–3)

| Plan | Scope |
|------|-------|
| `2026-06-25-personal-assistant-client-ui.md` | Bot Factory assistant UI (web + Flutter) — Task 1–4 complete, both platforms verified |
| `2026-06-25-botfather-zone.md` | BotFather zone UX (self-service setup wizard) — Tasks 1–6 complete, all backends + frontends verified |
| `2026-06-25-identity-bridge-bot-connector.md` | Identity bridge for bot connector (MCP token + connector tools) — Tasks 1–4 complete, all services verified |

## ✅ Done — enterprise foundation (P0–P8)

| Plan | Scope |
|------|-------|
| `2026-06-24-botfactory-personal-assistant-bridge.md` | Phase 1 server-side bridge (chat-service) — merged via PR #81 |
| `2026-06-22-p8-sso-oidc.md` | Enterprise SSO (OIDC) — framework done; live E2E needs an owner IdP |
| `2026-06-21-p7-self-host-deployment-kit.md` | One-command self-host (Caddy + compose.prod + bootstrap) |
| `2026-06-20-p6-department-group-bot.md` | Department-scoped group bot + chat-service RBAC |
| `2026-06-19-p5-google-connectors.md` | Gmail + Google Calendar connectors |
| `2026-06-19-p0-part2-enforcement.md` | Cross-service RBAC enforcement + connector governance |
| `2026-06-19-p0-enterprise-foundation.md` | Workspace / Departments / Members / hybrid RBAC |
| `2026-06-19-mcp-connector-core.md` | P1 MCP connector core (connector-service) |
| `2026-06-17-web-mobile-responsive.md` | Web/mobile responsive + bottom tab bar |
| `2026-06-17-platform-upgrade.md` | Public-repo hardening (CI, secret scan, `.env.example`) |
| `2026-06-17-performance-overhaul.md` | N+1 fixes, virtual scroll, RabbitMQ AI queue |

## ✅ Done — feature/fix plans (2026-06-26 → 2026-07-07)

| Plan | Scope |
|------|-------|
| `2026-07-07-bot-ux-and-input-fixes.md` | Bot conversation UX + mobile input fixes |
| `2026-07-07-block-ux-fixes.md` | Block-UX granularity fixes |
| `2026-07-07-auth-archived-mobile-fixes.md` | Auth screen, archived list & notification UX fixes |
| `2026-07-04-sidebar-ux-and-header-fixes.md` | Sidebar thresholds, header button order, wallpaper CSP (overrides plan below) |
| `2026-07-04-sidebar-min-width-and-offline-banner.md` | Sidebar min drag + compact offline banner (superseded by plan above) |
| `2026-07-03-security-hardening-2.md` | SSRF fix, message size limits, OTP hashing |
| `2026-07-03-security-hardening.md` | SVG/executable upload block, CORS fix, security headers |
| `2026-07-02-ux-polish.md` | Loading animation, unsaved-changes fix, media quality |
| `2026-07-02-fix-loading-and-sidebar.md` | Restore sidebar drag-resize + container queries + skeleton |
| `2026-07-02-auth-ui-and-bot-fixes.md` | Auth form layout, AI bot naming, extbot badge |
| `2026-07-02-ai-memory-sessions.md` | AI session management (/new, session list, auto-summarize) |
| `2026-07-01-role-display-in-profile.md` | Read-only workspace role in profile (web + mobile) |
| `2026-07-01-notification-and-auth-fixes.md` | Notification buttons, read/unread split, OAuth redirect |
| `2026-07-01-chat-ux-redesign.md` | Sidebar 2-state toggle, timestamp redesign, bare emoji |
| `2026-06-30-recaptcha-rerender-fix.md` | reCAPTCHA "already rendered" fix |
| `2026-06-30-phone-auth-production-ready.md` | Hide reCAPTCHA badge + disclosure text |
| `2026-06-29-web-mobile-responsive.md` | Responsive follow-up round |
| `2026-06-29-ux-improvements.md` | UX improvements batch |
| `2026-06-29-firebase-phone-auth.md` | Twilio → Firebase Phone Auth migration |
| `2026-06-29-brand-identity-and-cover-fix.md` | Brand identity + profile cover |
| `2026-06-28-wallpaper-opacity-and-forgot-password-fix.md` | Wallpaper opacity + forgot-password fix |
| `2026-06-28-security-notifications-and-phone-search.md` | Security notifications + phone search |
| `2026-06-28-security-and-ux-fixes.md` | Security & UX fixes batch |
| `2026-06-28-phone-number-with-sms-verification.md` | Phone number + SMS verification (Twilio era) |
| `2026-06-28-edit-profile-ui-and-wallpaper-fix.md` | Edit-profile UI + wallpaper fix |
| `2026-06-28-conversation-list-tabs.md` | 3-tab conversation list (Chats/Archived/Requests) |
| `2026-06-28-block-behavior-and-mute-duration.md` | Block behavior + mute durations |
| `2026-06-27-wallpaper-redesign.md` | Wallpaper redesign |
| `2026-06-27-notifications-and-security-page.md` | Notifications + security page |
| `2026-06-26-fix-message-disappear-on-rapid-switch.md` | Message-disappear-on-rapid-switch fix |

**Conventions:** plans are TDD, checkbox (`- [ ]`) steps, executed with `superpowers:subagent-driven-development`
or `superpowers:executing-plans`. Design specs live in `../specs/`. Done plans are kept (not deleted) as
the historical record of *why* things are built the way they are.
