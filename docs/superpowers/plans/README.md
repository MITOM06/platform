# Implementation Plans — Status Index

> **Read this before opening any plan below.** Most are already implemented; only open a plan
> if you are actively building/extending that feature. Authoritative build state + remaining work:
> [`../PON-ENTERPRISE-HANDOFF.md`](../PON-ENTERPRISE-HANDOFF.md).
>
> Last regenerated: 2026-07-09 (full status sweep — all 2026-07-07/08/09 plans verified complete).

## 🟡 NEW — 2026-07-10 batch (written, not yet executed by Claude Code)

| Plan | Nội dung | Ghi chú |
|------|----------|---------|
| `2026-07-10-sidebar-profile-dot-video-hd-recheck.md` | Xoá hardcoded green dot ở `SidebarProfileBar.tsx` (own avatar) | Bug thật mới, 1 file, low risk |
| `2026-07-10-directory-logo-csp-fix.md` | Thêm domain favicon connector vào CSP `img-src` (`next.config.ts`) | Bug thật (không phải build cũ) — logo bị CSP chặn |
| `2026-07-10-skills-copy-honesty-fix.md` | Sửa copy skill sai sự thật + fix `requires` id mismatch (web+Flutter) | Content-only, làm trước plan lớn bên dưới |
| `2026-07-10-skills-real-tool-wiring.md` | Gate MCP tool (calendar/gmail/notion) theo skill enable — 4/11 skill wire được vào tool thật | **Chặn 1 phần bởi thiếu secret**: `webSearch` cần `WEB_SEARCH_API_URL`/`WEB_SEARCH_API_KEY` (đang rỗng trong `.env`) từ user, không code được; `weatherForecast` không có tool nào — ngoài scope |

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
