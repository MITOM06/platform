# Phòng họp P1 — MT4 + MT5 (Web: danh sách, tạo, chi tiết, trong phòng họp) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (MT4) Web có màn **Phòng họp**: danh sách Sắp tới / Đã qua (cursor), **Họp ngay** một chạm, **Lên lịch** / sửa / **Họp lại** (tiêu đề, mô tả, ngày giờ theo múi giờ trình duyệt → gửi UTC, người mời, phòng ban, 5 công tắc cài đặt), trang chi tiết `/meetings/[id]` (thông tin, hành động theo `viewerRole`, điểm danh, ghi chú chung + riêng, lịch sử chat), vào bằng mã/link, toast + thông báo OS cho `meet.invited` / `meet.starting` / `meet.cancelled`, mục điều hướng "Phòng họp". (MT5) Trang `/meet/[code]` toàn màn hình: **màn chờ** (chọn mic/cam/loa, preview, mức âm), **phòng chờ** (host duyệt), **phòng họp** trên LiveKit (lưới / người nói / ghim, share màn hình tôn trọng `allowAttendeeScreenShare`, viền người đang nói), panel **Mọi người** (giơ tay theo thứ tự, phòng chờ Cho vào/Từ chối, menu host đủ 13 lệnh), **chat trong họp** (lạc quan theo `clientId`, `meet.error`), **ghi chú** (tự lưu 2s, 409 không mất chữ), reaction, phím tắt, rời / kết thúc cho mọi người, xử lý `meet.removed` / `meet.muted` / `meet.ended` / `meet.settings` / `meet.roster`, nối lại.

**Architecture:** Tách 3 lớp, mỗi file ≤ 400 dòng:
1. **Logic thuần** trong `apps/web/lib/meetings/*.ts` (parse sự kiện, map lỗi → khoá i18n, cập nhật cache, lịch/UTC, form, quyền UI, máy trạng thái ghi chú, pha của trang phòng, bố cục sân khấu, reaction, phím tắt, thiết bị) — có vitest đầy đủ, viết test trước.
2. **Dữ liệu server** qua TanStack Query (`lib/hooks/use-meetings.ts`, khoá trong `meetingKeys`); STOMP chỉ **vá cache** bằng `setQueryData` (không refetch, trừ lúc nối lại STOMP — xem Task 16). **Trạng thái UI phòng họp** (pha, panel, layout, ghim, mic/cam/share, tin chat chờ, reaction) trong Zustand `lib/store/meeting.store.ts`.
3. **Điều phối** `lib/meetings/meeting-room-controller.ts` (lớp không-React như `SfuGroupCall`): giữ `LiveKitSession` (mở rộng, dùng chung với Cuộc gọi), gọi REST join/lobby/end, gửi `/app/meet.*`, nhận sự kiện cá nhân. Một subscription **bền** `/user/queue/meeting` trong `useRealtimeNotifications` (cùng chỗ với `/user/queue/notifications`) chuyển sự kiện cho `lib/realtime/meeting-queue.ts`; topic `/topic/meeting/{id}` subscribe trong effect của trang phòng (re-subscribe theo `useStompConnected`).

UI theo `docs/design-system.md` (Warm Grey & Burgundy, web là chuẩn gốc): token `globals.css`, primitive shadcn trong `components/ui/` (không sửa tay), Geist, `text-sm` mặc định, một nút `default` mỗi view, hairline thay shadow, `ResponsiveModal` (bottom sheet < 768px), lucide 16/20px.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · TanStack Query v5 · Zustand 5 · `@stomp/stompjs` (singleton `stompService`) · `livekit-client` 2.22 · next-intl 4 (7 locale) · shadcn/ui + Tailwind 4 · sonner · react-markdown + remark-gfm · vitest 4 + Testing Library + jsdom.

**Nguồn ràng buộc:** milestone `docs/superpowers/plans/2026-10-05-meetings-p1-core.md` (MT4, MT5, Global Constraints, Review Focus); spec `docs/superpowers/specs/2026-10-05-calls-and-meetings-design.md` §1 (bảng UX Phòng họp), §4.3; **contract đã ship** `docs/api-spec.md` § Meetings + code thật `MeetingController.java`, `MeetingWsController.java`, `dto/meeting/*`, `ErrorCodes`, `MeetingEvents` trên `feat/meetings-p1` @ `4997eb2` (MT1–MT3 + QA). **Contract đã build thắng plan cũ** — mọi chỗ lệch ghi ở "Sai khác so với milestone plan".

## Global Constraints

- Nhánh `feat/meetings-p1` (worktree hiện tại). Không commit seed / `.env*.local` / URL localhost / key LiveKit dev (`.claude/rules/dev-local-only.md`); test tay trên `dev` trước khi PR.
- Worktree **chưa có `node_modules`**: chạy `pnpm install --frozen-lockfile` ở root repo một lần trước Task 1. Không thêm dependency mới (mọi thứ cần đã có: `livekit-client`, `react-markdown`, `remark-gfm`, `react-day-picker`, `sonner`, `zustand`).
- **≤ 400 dòng mỗi file** (UI lẫn lib), JSX lồng ≤ 5 cấp — quá thì tách component con (`.claude/rules/web.md`, `clean-code.md`). Mỗi task có bước `wc -l`.
- **TypeScript strict, không `any`**; dữ liệu từ mạng/STOMP là `unknown` cho tới khi qua parser có type guard. Type API trong `lib/api/meeting-types.ts`, re-export từ `lib/api/types.ts` (như `usage-types.ts` — `types.ts` đã 435 dòng).
- **API chỉ qua `chatApi`** (`lib/api/axios.ts`) — không `fetch` thô. User search qua `authService.searchUsers`, phòng ban qua `useDepartments` sẵn có.
- **TanStack Query cho dữ liệu server**, Zustand cho UI. STOMP → `queryClient.setQueryData` (rule web). `useEffect` không dùng để fetch.
- **STOMP:** không tạo client mới; `stompService.subscribeDurable` cho hàng đợi cá nhân (đăng ký **một lần** trong `useRealtimeNotifications`), `stompService.subscribe` + `useStompConnected` cho topic phòng; luôn huỷ trong cleanup. Gửi lệnh bằng `stompService.publish` (no-op khi mất kết nối ⇒ UI phải tự báo, xem Task 20).
- **Không lộ dữ liệu thô** (`.claude/rules/no-raw-system-data-in-ui.md`): không hiện `userId`, `hostId`, `removedIds`, tên room `meet_*`, token, URL `wss://`, lỗi LiveKit/axios/`err.message`. `displayName` vắng hoặc trông như id (`safeDisplayName` trong `lib/chat/names.ts`) ⇒ nhãn chung đã dịch. Mã phòng `abc-defg-hjk` và link `/meet/{code}` **được** hiện. Nhãn thiết bị của trình duyệt (`MediaDeviceInfo.label`) được hiện; nhãn rỗng ⇒ "Micro 1"… đã dịch. Nội dung chat/ghi chú/reaction từ người khác là dữ liệu không tin cậy: chat render text thuần (`whitespace-pre-wrap`), ghi chú qua `MarkdownContent` (react-markdown, không bật HTML thô), reaction chỉ nhận đúng 6 emoji.
- **i18n:** namespace mới `meeting` trong `apps/web/messages/{en,vi,zh,ja,ko,es,fr}.json` + 2 key `layout.navMeetings`, `layout.tabMeetings`. `lib/__tests__/i18n-parity.test.ts` bắt **cả 7 file có đủ key, cùng placeholder, không rỗng, plural có `other`** ⇒ mọi task thêm chuỗi phải thêm vào cả 7 file trong cùng commit (bảng en + vi ở mục "i18n"; zh/ja/ko/es/fr dịch lúc thực thi). Ngày giờ qua `Intl.DateTimeFormat(locale, …)` / `useFormatter` của next-intl — không hardcode pattern.
- **Lint React Compiler** (`eslint-config-next` 16 bật `react-hooks` v7): không `setState` đồng bộ trong thân effect (dùng sự kiện / `useSyncExternalStore` / key reset), không đọc `ref.current` trong render, không gọi `Date.now()` / `Math.random()` trong render (dùng `useNow` của next-intl hoặc giá trị lấy trong handler).
- **Giới hạn (milestone + contract):** tiêu đề ≤ 120, mô tả ≤ 2000, người mời ≤ 100, chat ≤ 2000/tin, ghi chú ≤ 50 000, 25 người/phòng, lịch: bắt đầu ≥ now − 5 phút, kết thúc > bắt đầu và ≤ bắt đầu + 24h; reaction: đúng `👍 ❤️ 😂 😮 👏 🎉`, ≤ 1 lần/giây; chat dùng chung hạn mức chat thường (10 tin / 5s — server).
- **Thời gian gửi lên server luôn là ISO UTC có `Z`** (`Date.prototype.toISOString()`); server trả 400 `MEETING_INVALID {field:"scheduledStart"}` với datetime không offset.
- **LiveKitSession dùng chung với Cuộc gọi (Module B — Phạm Minh Trí):** mọi thay đổi ở `lib/rtc/livekit-session.ts` và `components/call/*` phải **giữ nguyên hành vi Cuộc gọi** (mặc định cũ, test cũ xanh không sửa) — báo Trí trước khi merge (spec §6).
- Mỗi task: test RED → code → GREEN → `npx tsc --noEmit -p tsconfig.json` → commit. Lệnh chạy **từ `apps/web`**.

## Review Focus

1. **Hai người cùng sửa ghi chú chung** — người lưu sau nhận 409 `MEETING_NOTE_CONFLICT` + `latest`; UI báo "Đã có bản mới hơn", chữ đang gõ **còn nguyên**, cho so sánh và chọn Giữ bản của tôi / Dùng bản mới hơn / Lưu bản đã gộp. Gõ tiếp trong lúc đang lưu không mất chữ. Test Task 11 (`note-sync`) + Task 11 (`NotesEditor` RTL).
2. **Người không được mời mở link khi host chưa vào** — màn chờ ghi "Yêu cầu tham gia" → `join` ⇒ `waiting` ⇒ màn "Đang xin vào…"; host vào thì thấy ngay số người chờ ở nút Mọi người + panel phòng chờ (từ `meet.lobby` server gửi lúc host `join`). Cho vào ⇒ người chờ tự `join` lại và vào phòng, không bấm gì thêm. Test Task 14 (`room-phase`), Task 15 (controller).
3. **Người bị mời ra** — đang trong phòng: rời LiveKit ngay, màn "Bạn đã bị mời ra", không có nút Vào lại; mở lại link ⇒ màn chờ ⇒ `join` 403 `MEETING_REMOVED` ⇒ cùng màn đó (không vào phòng chờ). Trang chi tiết: không lộ ghi chú/chat (403 ⇒ thông báo, không lỗi đỏ). Test Task 14, 15.
4. **Host rời không bấm Kết thúc** — nút Rời của host/co-host mở menu "Rời cuộc họp" / "Kết thúc cho mọi người" (xác nhận); rời thường không gọi `/end`. Co-host thấy và dùng được mọi lệnh host. Test Task 6 (`permissions`).
5. **Mở link cuộc họp đã kết thúc / đã huỷ** — `/meet/{code}` chuyển `router.replace('/meetings/{id}')`, trang chi tiết hiện trạng thái Đã kết thúc / Đã huỷ, điểm danh, ghi chú — không phải màn lỗi. Test Task 14 (`room-phase`) + checklist tay.
6. **Không lộ dữ liệu thô** — mọi `errorCode`/HTTP lỗi ⇒ khoá `meeting.err*` (test bảng mã ở Task 2); tên vắng ⇒ nhãn chung (test ở Task 3/4/6); `meet.invited.hostId` không bao giờ render.
7. **Nối lại** — STOMP rớt rồi về: topic được subscribe lại, tay/roster/cài đặt/chat được đồng bộ lại; LiveKit chập chờn: banner "Đang kết nối lại…"; LiveKit đứt hẳn: màn "Mất kết nối" + Vào lại (xin token mới). Đang ở phòng chờ mà STOMP rớt: tự `join` lại để không lỡ `meet.admitted`. Test Task 15, 16.

---

## Ruling khi viết plan

Như plan MT1–MT3: plan ghi **đầy đủ code test** (test là đặc tả) cho mọi module logic thuần và controller; code hiện thực mô tả bằng chữ ký + hành vi chính xác. Component UI mô tả bằng cây component, props, trạng thái, khoá i18n, class Tailwind chính và tiêu chí a11y; phần không unit-test được có checklist tay ở Task 23. Nếu giao cho người khác thực thi mà không có ngữ cảnh phiên này, viết bổ sung code hiện thực trước.

Đường dẫn viết tắt:
- `W/` = `apps/web/`
- `ML/` = `apps/web/lib/meetings/`
- `MC/` = `apps/web/components/meeting/`
- Lệnh `TSC` = `npx tsc --noEmit -p tsconfig.json`, `VT <path>` = `npx vitest run <path>` (đều chạy trong `apps/web`).

---

## Sai khác so với milestone plan (đối chiếu code thật @ `4997eb2`, 2026-10-07)

| # | Milestone plan / spec nói | Code thật / vấn đề | Plan này làm |
|---|---|---|---|
| 1 | Token host/co-host thêm `roomAdmin` | Server **không bao giờ** cấp `roomAdmin` (api-spec `MeetingJoinResponse`); mọi lệnh điều hành đi qua `/app/meet.host` | Client không gọi API quản trị LiveKit; mọi lệnh host = `stompService.publish('/app/meet.host', …)` |
| 2 | `join` → `{status, url, token, role}`; không nói `role` đổi giữa họp | MT3: `meet.roster[].role` = **vai trò hiện tại** (đổi sau `MAKE_COHOST`/`REVOKE_COHOST`) | Vai trò của mình = dòng của mình trong roster mới nhất, mặc định `join.role` (`myRoomRole`, Task 6). Bị thu hồi co-host ⇒ xoá danh sách phòng chờ đang hiện |
| 3 | `meet.lobby` tới host/co-host | Không có REST đọc phòng chờ; `meet.lobby` chỉ tới khi phòng chờ đổi, khi host/co-host `join`, khi được phong co-host ⇒ STOMP nối lại thì lỡ | Nối lại STOMP khi đang là host/co-host ⇒ controller gọi lại `POST /join` (idempotent cho người đang ở trong: không tính đầy phòng, server đẩy lại `meet.lobby`; token mới bỏ đi). Ghi là **gap B2** (đề xuất `GET /lobby`) |
| 4 | `meet.invited` (milestone: chỉ tên) | Payload thật `{code, title, hostId, hostName, scheduledStart}` — có `hostId` thô | Parser giữ `hostId` chỉ để làm `host.userId` của dòng tạm trong cache; **không bao giờ render** (test Task 3) |
| 5 | `meet.cancelled` | Payload thật chỉ `{event, meetingId}` — không có tiêu đề | Toast lấy tiêu đề từ cache nếu có, không thì câu chung "Một cuộc họp bạn được mời đã bị huỷ" (**gap B3**, không chặn) |
| 6 | Tạo cuộc họp cho phòng ban: người tạo thuộc phòng ban hoặc có `MANAGE_DEPARTMENTS` | Web chỉ đọc được tên phòng ban qua `GET /admin/departments` (cần `MANAGE_DEPARTMENTS`); `/me/capabilities` chỉ có `depts` là id. Thành viên thường không có cách lấy tên phòng ban của mình | Theo tiền lệ nhóm phòng ban P6 (`NewConversationModal`): ô Phòng ban chỉ hiện khi có `MANAGE_DEPARTMENTS`. Trang chi tiết: tên lấy từ cùng danh sách nếu có, không thì "Một phòng ban". **Gap B1** (đề xuất `GET /me/departments`) |
| 7 | MT4: "Toast/banner khi nhận `meet.invited` / `meet.starting` (bấm ⇒ `/meet/{code}`)" | — | Theo milestone. Thêm `meet.cancelled` (toast, cập nhật cache). Tab ẩn + đã cấp quyền + bật thông báo ⇒ `Notification` của OS như tin nhắn |
| 8 | MT4: `use-meetings.ts` "STOMP cập nhật cache bằng `setQueryData`, không refetch" | `meet.invited` không mang đủ object `Meeting`; `meet.ended` không cho biết vị trí trong "Đã qua" | `meet.invited` ⇒ chèn **dòng tạm** dựng từ payload vào "Sắp tới" (`invitedPlaceholder`), mở chi tiết sẽ GET bản thật. Kết thúc / huỷ ⇒ bỏ khỏi "Sắp tới", đánh dấu `['meetings','past']` stale bằng `invalidateQueries({refetchType:'none'})` (refetch khi người dùng mở tab — không refetch ngay) |
| 9 | Milestone không nói về đăng nhập lại khi mở link | `middleware.ts` đưa người chưa đăng nhập về `/login`, sau đăng nhập luôn về `/` ⇒ **mất link họp** | ➕ Task 8: middleware lưu đường dẫn `/meet/*` / `/meetings/*` vào cookie ngắn hạn `pon_return_to`; `establishSession` dùng nó sau mọi kiểu đăng nhập (mật khẩu, Google, 2FA) nếu qua được `isSafeReturnPath` (chỉ 2 dạng đường dẫn đó — không open redirect) |
| 10 | MT4: "Mục điều hướng … `MobileTabBar` nếu còn chỗ, nếu không thì trong menu Thêm" | `MobileTabBar` có 4 tab, không có menu "Thêm"; khu nhắn tin (sidebar) có hàng icon ở header | Thêm icon `Video` "Phòng họp" vào header sidebar (cạnh Danh bạ) **và** tab thứ 5 "Họp" ở `MobileTabBar` (5 tab vẫn ≥ 44px ở 320px). Ẩn `MobileTabBar` trên `/meet/*`. Vị trí Flutter quyết ở MT6 (xem "Quyết định cho owner") |
| 11 | MT4 chi tiết: "Ô Biên bản AI để trống chờ P2" | Hiện một ô rỗng "sắp có" là UI chết | Không render ô nào ở P1; để `{/* P2: AI summary slot */}` trong `page.tsx` — P2 thêm component |
| 12 | MT5: `LiveKitSession` dùng nguyên | Session hiện tại: luôn bật mic khi `connect`, không chọn thiết bị, không share màn hình, không data channel, gộp mọi track của một người vào **một** `MediaStream`, không báo khi server tắt mic mình | ➕ Task 13: mở rộng **tương thích ngược** — `connect(url, token, {video, audio?, audioDeviceId?, videoDeviceId?})` (mặc định `audio: true` như cũ), `peer.screen` (stream share tách riêng, không trộn vào `stream`), `peer.avatarUrl`, `setScreenShare`, `switchDevice`, `publishData`/`onData`, `onLocalMediaChanged` (server mute / người dùng bấm "Dừng chia sẻ" của trình duyệt), `setPeerVideoEnabled` (tắt nhận video của ô bị ẩn). Cuộc gọi không đổi hành vi |
| 13 | MT5 components: `PreJoinLobby, WaitingScreen, MeetingStage, ControlBar, ParticipantsPanel, MeetingChatPanel, NotesPanel, ReactionOverlay, HostMenu` | Giới hạn 400 dòng + JSX ≤ 5 cấp + màn trạng thái (bị mời ra / khoá / đầy / lỗi) + âm thanh khi ô bị ẩn | Giữ đủ tên milestone, thêm: `RoomStatusScreen`, `MeetingRoom`, `MeetingTile`, `RemoteAudio`, `DeviceSelects`, `MicLevel`, `ReactionPicker`, `LobbySection`, `ParticipantRow`, `RoomManageMenu`, `LeaveMenu`, `SidePanel`, `RoomDevicesDialog`; `NotesEditor` + `NoteConflictDialog` dùng chung trang chi tiết và panel |
| 14 | MT5: `VideoTile` trong `ParticipantTileGrid` (Cuộc gọi) là hàm private | Phòng họp cần cùng ô video + huy hiệu (mic tắt, giơ tay) + `object-contain` cho share | ➕ Tách `VideoTile` ra `components/call/VideoTile.tsx` (export, **thêm** prop tuỳ chọn `badges?`, `fit?`, `avatarUrl?` — mặc định giữ y hệt), `ParticipantTileGrid` import lại. Không đổi giao diện Cuộc gọi |
| 15 | Âm thanh | Cuộc gọi phát tiếng qua `<video>` của từng ô; ở bố cục người nói/ô bị ẩn sẽ **mất tiếng** người không có ô | Mọi `<video>` trong phòng họp `muted`; tiếng phát qua `RemoteAudio` (một `<audio>` mỗi người + một cho tiếng share), hỗ trợ `setSinkId` khi chọn loa |
| 16 | MT4 test: "hooks (cache update theo event)" | Hook React khó test cô lập; logic nằm ở hàm vá cache | Test hàm thuần `cache-updates.ts` + `meeting-queue.ts` với `QueryClient` thật (không render) |
| 17 | Giơ tay / roster lúc vào giữa chừng | `meet.hands` chỉ phát khi đổi; `meet.roster` chỉ khi có người vào/ra | Subscribe topic **trước**, rồi `GET /hands` + `GET /api/meetings/{id}` (roster mồi từ `attendance` mở + vai trò hiện tại từ `host`/`coHosts`) — như MT3 Sai khác #12 dặn |

## Backend gaps (phát hiện khi viết plan)

| # | Gap | Ảnh hưởng | Mức | Đề xuất (không làm trong plan này) |
|---|---|---|---|---|
| B1 | Không có endpoint cho **thành viên thường** đọc `{id, name}` phòng ban của mình (`GET /admin/departments` cần `MANAGE_DEPARTMENTS`; `/me/capabilities.depts` chỉ là id; `ai-context` chỉ trả tên) | Người có `HOST_MEETING` nhưng không có `MANAGE_DEPARTMENTS` không chọn được phòng ban khi tạo họp (dù server cho phép nếu họ thuộc phòng ban đó); trang chi tiết không hiện được tên phòng ban cho họ | **Blocker riêng cho trường "Phòng ban" của thành viên thường** — phần còn lại của MT4 không bị chặn (dùng fallback Sai khác #6) | auth-service `GET /me/departments` → `[{id, name}]` (tất cả nếu có `MANAGE_DEPARTMENTS`, không thì của mình). Thêm vào api-spec auth + Flutter dùng chung ở MT6. Khi có: đổi `useDepartmentOptions` (Task 10) sang endpoint mới |
| B2 | Không có `GET /api/meetings/{id}/lobby` | Host/co-host lỡ `meet.lobby` khi STOMP rớt ⇒ không thấy người đang chờ tới lần đổi kế tiếp | Không chặn — workaround `POST /join` lại (Sai khác #3) | `GET /api/meetings/{id}/lobby` (host/co-host) → `{waiting:[LobbyEntry]}` |
| B3 | `meet.cancelled` không có `title`/`code` | Toast huỷ không nêu được tên cuộc họp khi cache không có | Không chặn (câu chung) | Thêm `title`, `code`, `scheduledStart` vào `meet.cancelled` như `meet.starting` |
| B4 | `GET /api/meetings?scope=past` chỉ liệt kê cuộc họp mình host/co-host/được mời/thuộc phòng ban | Người vào bằng link (được cho vào từ phòng chờ) không thấy cuộc họp đó trong "Đã qua" dù vẫn đọc được ghi chú (records access) | Không chặn (mở lại link ⇒ trang chi tiết) | Thêm điều kiện `attendance.userId = me` vào truy vấn `past` |

Không có gap nào phá contract đã ship; không cần sửa chat-service để làm MT4–MT5.

---
## Contract phía web (dùng nguyên `docs/api-spec.md` § Meetings — không đổi gì ở server)

### REST web gọi (`meetingsApi` trong `W/lib/api/meetings.ts`, đều qua `chatApi`)

| Hàm | Request | Trả | Dùng ở |
|---|---|---|---|
| `list(scope, cursor?, size=20)` | `GET /api/meetings?scope=&cursor=&size=` | `MeetingPage` (`hasNext`; cursor = `id` dòng cuối) | `/meetings` (`useInfiniteQuery`) |
| `get(id)` | `GET /api/meetings/{id}` | `Meeting` | chi tiết, mồi roster/cài đặt trong phòng |
| `byCode(code)` | `GET /api/meetings/by-code/{code}` | `Meeting` (cả ENDED) | `/meet/[code]` |
| `create(input)` | `POST /api/meetings` (body `{}` = họp ngay) | 201 `Meeting` | Họp ngay, Lên lịch, Họp lại |
| `update(id, input)` | `PATCH /api/meetings/{id}` | `Meeting` | Sửa; công tắc "Người tham dự được sửa ghi chú chung" trong phòng |
| `cancel(id)` | `DELETE /api/meetings/{id}` | 204 | Huỷ (host, SCHEDULED, chưa ai vào) |
| `join(id)` | `POST /api/meetings/{id}/join` | `{status:'joined', url, token, role}` \| `{status:'waiting'}` | màn chờ, phòng chờ, vào lại, nối lại (host) |
| `leaveLobby(id)` | `DELETE /api/meetings/{id}/lobby` | 204 | rời phòng chờ |
| `admit(id, userId)` / `deny(id, userId)` | `POST …/lobby/{userId}/admit\|deny` | 204 | panel phòng chờ |
| `end(id)` | `POST /api/meetings/{id}/end` | 204 | Kết thúc cho mọi người |
| `messages(id, before?, size=50)` | `GET …/messages?before=&size=` | `MeetingMessagePage` **mới nhất trước** | chat panel, lịch sử ở chi tiết |
| `getNote(id, scope)` / `putNote(id, scope, {content, version})` | `GET\|PUT …/notes/shared\|private` | `MeetingNote`; 409 `{code:'MEETING_NOTE_CONFLICT', latest}` | `NotesEditor` |
| `hands(id)` | `GET …/hands` | `{hands: MeetingHand[]}` | mồi giơ tay khi vào/nối lại |

Mọi `{id}`/`{code}`/`{userId}` đi qua `encodeURIComponent`.

### STOMP

| Hướng | Destination | Payload | Ai/khi nào |
|---|---|---|---|
| sub (bền, cả phiên) | `/user/queue/meeting` | `meet.lobby · meet.admitted · meet.denied · meet.ended · meet.invited · meet.starting · meet.cancelled · meet.removed · meet.muted · meet.error` | `useRealtimeNotifications` → `handleMeetingQueueEvent` |
| sub (khi `phase ∈ connecting\|inRoom`) | `/topic/meeting/{id}` | `meet.roster · meet.settings · meet.ended · meet.hands · meet.chat · meet.notes.updated` | `useMeetingRoomStomp` |
| pub | `/app/meet.hand` | `{meetingId, raised}` | nút Giơ tay, `Ctrl/⌘+Alt+H` |
| pub | `/app/meet.chat` | `{meetingId, content, clientId}` (`clientId` = `c-` + 12 ký tự `[A-Za-z0-9]`) | chat panel |
| pub | `/app/meet.host` | `{meetingId, action, targetId?}` (`targetId` chỉ với `MUTE_MIC, REMOVE, LOWER_HAND, MAKE_COHOST, REVOKE_COHOST`) | menu host |

Không subscribe topic khi đang `waiting` (server trả STOMP ERROR `Unauthorized subscription` cho người đang chờ).

### Sự kiện → hành vi web

| Sự kiện | Cache (TanStack) | Store / controller | UI |
|---|---|---|---|
| `meet.roster` | `meetingKeys.roster(id)` ← `participants` | `myRole` ← dòng của mình (vai trò hiện tại); mất co-host ⇒ xoá `lobby` | panel Mọi người, nhãn vai trò trên ô; toast "Bạn đã được làm đồng tổ chức" / "…không còn là…" khi vai trò mình đổi |
| `meet.settings` | `detail(id)` + `byCode(code)`: `settings` | attendee đang share mà `allowAttendeeScreenShare=false` ⇒ `setScreenShare(false)` | toast "Người tổ chức đã tắt chia sẻ màn hình"; công tắc host hết "pending" |
| `meet.hands` | `hands(id)` ← `hands` | — | hàng giơ tay đầu panel, huy hiệu ✋ trên ô + số thứ tự |
| `meet.chat` | `messages(id)`: chèn đầu trang 1 (dedupe `id`) | xoá tin chờ có cùng `clientId`; panel đóng ⇒ `unreadChat++` (không đếm tin của mình) | chat panel, chấm đỏ nút Chat |
| `meet.notes.updated` | — | `sharedNoteSignal = {version, updatedBy}` | `NotesEditor` dispatch `remoteUpdated` (sạch ⇒ GET lại; đang sửa ⇒ banner) |
| `meet.ended` (topic hoặc cá nhân) | `detail`: `status:'ENDED'`, `endedAt`; bỏ khỏi upcoming; past stale | `phase='ended'`, ngắt LiveKit | toast "Cuộc họp đã kết thúc" + `router.replace('/meetings/{id}')` |
| `meet.lobby` | `lobby(id)` ← `waiting` | — | số trên nút Mọi người; toast "{n} người đang chờ" khi tăng và panel đóng |
| `meet.admitted` | — | đang `waiting` ⇒ `join` lại ⇒ vào phòng | — |
| `meet.denied` | — | `phase='denied'` | màn "Bạn không được cho vào" |
| `meet.removed` | `detail`: không đổi | `phase='removed'`, ngắt LiveKit, xoá tin chờ | màn "Bạn đã bị mời ra" (không có Vào lại) |
| `meet.muted` | — | `mic=false` (session cũng báo qua `onLocalMediaChanged`) | toast "{actor} đã tắt micro của bạn" |
| `meet.error` | — | có `clientId` ⇒ đánh dấu tin chờ lỗi; có `action` ⇒ hết pending của công tắc đó | toast khoá `meeting.err*` theo `errorCode`/`params` (Task 2) |
| `meet.invited` | `list('upcoming')`: chèn dòng tạm | — | toast/OS "{name} mời bạn tham gia “{title}”" → `/meet/{code}` |
| `meet.starting` | — | — | toast/OS "“{title}” bắt đầu lúc {time}" → `/meet/{code}` |
| `meet.cancelled` | upcoming: bỏ; `detail`: `ENDED` + `cancelledAt`; past stale | đang ở màn chờ của cuộc họp đó ⇒ `phase='ended'` | toast "“{title}” đã bị huỷ" |

### Mã lỗi → khoá i18n (`ML/meeting-errors.ts`, Task 2)

| `code` (REST) / `errorCode` (`meet.error`) | Khoá `meeting.*` | Ghi chú |
|---|---|---|
| `MEETING_NOT_FOUND` | `errNotFound` | |
| `MEETING_FORBIDDEN` | `errForbidden` | |
| `MEETING_CREATE_FORBIDDEN` | `errCreateForbidden` | thiếu `HOST_MEETING` (claim cũ) |
| `MEETING_DEPARTMENT_FORBIDDEN` | `errDepartmentForbidden` | |
| `MEETING_REMOVED` | `errRemoved` | join ⇒ màn removed |
| `MEETING_LOCKED` | `errLocked` | join ⇒ màn locked |
| `MEETING_ENDED` | `errEnded` | join ⇒ chuyển trang chi tiết |
| `MEETING_FULL` | `errFull {max:25}` | |
| `MEETING_NOT_CANCELLABLE` | `errNotCancellable` | |
| `MEETINGS_UNAVAILABLE` (hoặc HTTP 503 không code) | `errUnavailable` | |
| `MEETING_NOTES_READ_ONLY` | `errNotesReadOnly` | |
| `MEETING_NOTE_CONFLICT` | `errNoteConflict` | thường được xử lý trước bằng `noteConflictLatest` |
| `RATE_LIMITED` (hoặc HTTP 429) | `errRateLimited` | |
| `MEETING_INVALID {field:"title"}` | `valTitleTooLong {max}` | `max` từ `params`, mặc định 120 |
| `… {field:"description"}` | `valDescriptionTooLong {max}` | 2000 |
| `… {field:"inviteeIds", max}` / không `max` | `valTooManyInvitees {max}` / `errInviteeInvalid` | |
| `… {field:"departmentId"}` | `errDepartmentInvalid` | |
| `… {field:"scheduledStart"}` | `errStartInvalid` | |
| `… {field:"scheduledEnd"}` | `errEndInvalid` | |
| `… {field:"content"}` + ngữ cảnh `note` | `errNoteTooLong {max}` | 50 000 |
| `… {field:"content"}` khác | `errChatTooLong {max}` | 2000 |
| `… {field:"targetId"}` | `errTargetUnavailable` | |
| `MEETING_INVALID` khác / không `params` | `errInvalid` | |
| không có response (mạng) | `errNetwork` | |
| mọi thứ còn lại | `errGeneric` | **không bao giờ** `err.message` |

---

## Kiến trúc trạng thái

```
                       ┌────────── TanStack Query (dữ liệu server) ──────────┐
REST (meetingsApi) ──► │ ['meetings', 'upcoming'|'past']  (infinite, cursor)  │
                       │ ['meeting', id] · ['meeting-code', code]             │
                       │ ['meeting-roster', id] · ['meeting-hands', id]       │
                       │ ['meeting-lobby', id] · ['meeting-messages', id]     │
                       │ ['meeting-note', id, 'shared'|'private']             │
                       └───────────▲──────────────────────────▲──────────────┘
                                   │ setQueryData (cache-updates.ts)
/user/queue/meeting ─► meeting-queue.ts ──┤                    │
/topic/meeting/{id} ─► useMeetingRoomStomp → room-events.ts ───┘
                                   │
                                   ▼
               MeetingRoomController (lib, không React) ──► LiveKitSession (dùng chung Cuộc gọi)
                                   │                          ▲ peers/local/speakers/data
                                   ▼                          │
                     Zustand meeting.store.ts (UI: phase, panel, layout, pin, mic/cam/screen,
                       pendingChat, pendingHost, reactions, unread, sharedNoteSignal, audioOutputId)
```

- **Một controller đang hoạt động** tại một thời điểm (`getActiveMeetingController()` trong module controller); `meeting-queue.ts` chuyển sự kiện phòng (`lobby/admitted/denied/removed/muted/error/ended`) cho nó nếu `meetingId` khớp.
- `meeting.store.ts` **không** chứa dữ liệu server (roster/hands/chat/notes nằm trong Query); chỉ chứa cái server không lưu.
- Ghi chú: `useNoteEditor(meetingId, scope, canEdit)` = `useQuery(note)` + `useReducer(noteReducer)` + autosave 2s; `meet.notes.updated` đi qua `sharedNoteSignal` của store (trong phòng) — trang chi tiết không subscribe topic (cuộc họp có thể đã ENDED; sửa sau khi kết thúc không phát sự kiện).

## Cây component

```
app/(main)/meetings/page.tsx                    MeetingsPage
 ├─ MC/MeetingsHeader.tsx                       tiêu đề + [Họp ngay] [Lên lịch] (HOST_MEETING) + JoinByCodeForm
 ├─ Tabs (Sắp tới | Đã qua) → MC/MeetingList.tsx → MC/MeetingRow.tsx (MeetingStatusBadge, CopyLinkButton)
 └─ MC/MeetingFormDialog.tsx (create | edit | again)
      ├─ MC/MeetingScheduleFields.tsx
      ├─ MC/InviteePicker.tsx (+ ô Phòng ban khi MANAGE_DEPARTMENTS)
      └─ MC/MeetingSettingsFields.tsx

app/(main)/meetings/[id]/page.tsx               MeetingDetailPage
 ├─ MC/detail/MeetingInfoCard.tsx               tiêu đề, trạng thái, thời gian, host/co-host/được mời/phòng ban
 ├─ MC/detail/MeetingActions.tsx                Tham gia · Sao chép link · Sửa · Huỷ · Kết thúc · Họp lại
 ├─ MC/detail/AttendanceList.tsx
 ├─ MC/NotesEditor.tsx (tabs Chung | Của tôi) → MC/NoteConflictDialog.tsx
 └─ MC/detail/ChatHistory.tsx

app/(main)/meet/[code]/page.tsx                 MeetPage (toàn màn hình): tải theo mã → notFound | ended (→ chi tiết) | MeetingSession
 └─ MC/room/MeetingSession.tsx                  tạo controller, subscribe topic, switch theo phase
      ├─ MC/room/PreJoinLobby.tsx → DeviceSelects.tsx, MicLevel.tsx
      ├─ MC/room/WaitingScreen.tsx
      ├─ MC/room/RoomStatusScreen.tsx           denied · removed · locked · full · unavailable · notFound · left · connectionLost · error
      └─ MC/room/MeetingRoom.tsx
           ├─ MC/room/MeetingStage.tsx → MC/room/MeetingTile.tsx → components/call/VideoTile.tsx
           ├─ MC/room/RemoteAudio.tsx · MC/room/ReactionOverlay.tsx
           ├─ MC/room/SidePanel.tsx
           │    ├─ MC/room/ParticipantsPanel.tsx → LobbySection.tsx, ParticipantRow.tsx → HostMenu.tsx, RoomManageMenu.tsx
           │    ├─ MC/room/MeetingChatPanel.tsx
           │    └─ MC/room/NotesPanel.tsx → MC/NotesEditor.tsx
           └─ MC/room/ControlBar.tsx → ReactionPicker.tsx, LeaveMenu.tsx, RoomDevicesDialog.tsx
```

Bố cục phòng: desktop (`md+`) = sân khấu + panel phải 360px (`border-l border-border/60 bg-card`), thanh điều khiển dưới (64px, `bg-background border-t`); phone = sân khấu toàn màn, panel là bottom sheet (`Sheet` side=bottom, 85dvh), thanh điều khiển cuộn ngang với nút chính (mic, cam, giơ tay, rời) luôn thấy, phần còn lại trong menu "Thêm" (`MoreHorizontal`). Sân khấu dùng nền tối cố định của Cuộc gọi (`bg-neutral-950`, như `VideoTile`) để video nổi — đây là "nội dung", không phải chrome (giống ngoại lệ wallpaper ở design-system §1.4); chrome (thanh, panel, menu) dùng token.

## Bản đồ file

**Mới (lib)**

| File | Nội dung | ~dòng | Task |
|---|---|---|---|
| `W/lib/api/meeting-types.ts` | type + hằng số contract | 190 | 1 |
| `W/lib/api/meetings.ts` | `meetingsApi` | 90 | 1 |
| `ML/meeting-errors.ts` | parse lỗi, mã → khoá, `noteConflictLatest` | 120 | 2 |
| `ML/meeting-events.ts` | `parseMeetingEvent` | 170 | 3 |
| `ML/cache-updates.ts` | `meetingKeys` + hàm vá cache thuần | 200 | 4 |
| `ML/schedule.ts` | ngày giờ địa phương ⇄ UTC, thời lượng, nhãn múi giờ, khoảng thời gian | 130 | 5 |
| `ML/meeting-form.ts` | giá trị form, validate, → request, form từ cuộc họp | 150 | 5 |
| `ML/meeting-code.ts` | chuẩn hoá mã/link | 45 | 6 |
| `ML/attendance.ts` | gộp điểm danh theo người | 80 | 6 |
| `ML/permissions.ts` | quyền UI (chi tiết, màn chờ, menu host, share) | 150 | 6 |
| `ML/active-room.ts` | đăng ký phòng đang mở (nhận sự kiện cá nhân) | 25 | 7 |
| `ML/room-events.ts` | áp sự kiện topic vào cache + store | 110 | 7 |
| `W/lib/realtime/meeting-queue.ts` | xử lý `/user/queue/meeting` | 170 | 7 |
| `W/lib/hooks/use-meetings.ts` | query + mutation | 200 | 7 |
| `W/lib/auth/return-path.ts` | `isSafeReturnPath`, cookie `pon_return_to` | 60 | 8 |
| `ML/note-sync.ts` | reducer ghi chú | 150 | 11 |
| `W/lib/hooks/use-note-editor.ts` | reducer + query + autosave | 160 | 11 |
| `ML/room-phase.ts` | pha trang `/meet` | 110 | 14 |
| `ML/stage-layout.ts` | bố cục sân khấu | 140 | 14 |
| `ML/reactions.ts` | encode/decode + throttle | 60 | 14 |
| `ML/shortcuts.ts` | phím tắt | 40 | 14 |
| `ML/devices.ts` | nhớ thiết bị (localStorage try/catch), hỗ trợ trình duyệt | 80 | 14 |
| `W/lib/store/meeting.store.ts` | Zustand UI phòng | 200 | 15 |
| `ML/meeting-room-controller.ts` | điều phối phòng | 330 | 15 |
| `W/lib/hooks/use-meeting-room-stomp.ts` | subscribe topic + đồng bộ lại | 110 | 16 |
| `W/lib/hooks/use-media-preview.ts` | preview getUserMedia + mức âm + liệt kê thiết bị | 170 | 17 |
| `W/lib/hooks/use-meeting-shortcuts.ts` | keydown → controller | 50 | 18 |

**Mới (UI)** — mỗi file ≤ 400 dòng (mục tiêu ≤ 250)

| File | Task |
|---|---|
| `W/app/(main)/meetings/page.tsx`, `MC/MeetingsHeader.tsx`, `MC/JoinByCodeForm.tsx`, `MC/MeetingList.tsx`, `MC/MeetingRow.tsx`, `MC/MeetingStatusBadge.tsx`, `MC/CopyLinkButton.tsx` | 10 |
| `MC/MeetingFormDialog.tsx`, `MC/MeetingScheduleFields.tsx`, `MC/InviteePicker.tsx`, `MC/MeetingSettingsFields.tsx` | 10 |
| `W/app/(main)/meetings/[id]/page.tsx`, `MC/detail/MeetingInfoCard.tsx`, `MC/detail/MeetingActions.tsx`, `MC/detail/AttendanceList.tsx`, `MC/detail/ChatHistory.tsx` | 12 |
| `MC/NotesEditor.tsx`, `MC/NoteConflictDialog.tsx` | 11 |
| `W/app/(main)/meet/[code]/page.tsx`, `MC/room/MeetingSession.tsx`, `MC/room/PreJoinLobby.tsx`, `MC/room/DeviceSelects.tsx`, `MC/room/MicLevel.tsx`, `MC/room/WaitingScreen.tsx`, `MC/room/RoomStatusScreen.tsx` | 17 |
| `MC/room/MeetingRoom.tsx`, `MC/room/MeetingStage.tsx`, `MC/room/MeetingTile.tsx`, `MC/room/RemoteAudio.tsx`, `MC/room/ControlBar.tsx`, `MC/room/ReactionPicker.tsx`, `MC/room/ReactionOverlay.tsx`, `MC/room/LeaveMenu.tsx`, `MC/room/RoomDevicesDialog.tsx`, `MC/room/SidePanel.tsx` | 18 |
| `MC/room/ParticipantsPanel.tsx`, `MC/room/LobbySection.tsx`, `MC/room/ParticipantRow.tsx`, `MC/room/HostMenu.tsx`, `MC/room/RoomManageMenu.tsx` | 19 |
| `MC/room/MeetingChatPanel.tsx` | 20 |
| `MC/room/NotesPanel.tsx` | 21 |
| `W/components/call/VideoTile.tsx` (tách từ `ParticipantTileGrid.tsx`) | 18 |

**Sửa**

| File | Thay đổi | Task |
|---|---|---|
| `W/lib/api/types.ts` | `export * from './meeting-types'` | 1 |
| `W/lib/hooks/use-realtime-notifications.ts` | + subscription bền `/user/queue/meeting` → `handleMeetingQueueEvent` (ctx qua ref như hiện tại) | 7 |
| `W/middleware.ts` | lưu `pon_return_to` khi chuyển về `/login` từ `/meet/*`, `/meetings/*` | 8 |
| `W/lib/auth/sign-in.ts` | `establishSession` trả `consumeReturnPath()` khi tài khoản không bị `mustSetPassword` (mật khẩu, Google, 2FA đều đi qua đây) | 8 |
| `W/app/(main)/layout.tsx` | icon Phòng họp ở header sidebar; ẩn `MobileTabBar` trên `/meet/*` | 9 |
| `W/components/layout/MobileTabBar.tsx` | tab thứ 5 `/meetings` | 9 |
| `W/lib/rtc/livekit-session.ts` | mở rộng tương thích ngược (Sai khác #12) | 13 |
| `W/lib/rtc/__tests__/livekit-session.test.ts` | thêm test (test cũ giữ nguyên) | 13 |
| `W/components/call/ParticipantTileGrid.tsx` | import `VideoTile` từ file mới | 18 |
| `W/messages/{en,vi,zh,ja,ko,es,fr}.json` | namespace `meeting` + `layout.navMeetings`, `layout.tabMeetings` | 10, 12, 17–21 (theo nhóm) |
| `docs/api-spec.md`, `docs/superpowers/plans/README.md`, `apps/web/CLAUDE.md` | tài liệu | 23 |

**Test mới:** `ML/__tests__/{meeting-errors,meeting-events,cache-updates,schedule,meeting-form,meeting-code,attendance,permissions,room-events,note-sync,room-phase,stage-layout,reactions,shortcuts,devices,meeting-room-controller}.test.ts`, `W/lib/realtime/__tests__/meeting-queue.test.ts`, `W/lib/auth/__tests__/return-path.test.ts`, `W/components/meeting/__tests__/NotesEditor.test.tsx`, `W/components/layout/__tests__/MobileTabBar.test.tsx` (nếu chưa có — kiểm 5 tab). Mở rộng `W/lib/rtc/__tests__/livekit-session.test.ts`.

---
## i18n — khoá mới (en · vi; zh/ja/ko/es/fr dịch lúc thực thi, **phải có đủ 7 file** — `i18n-parity.test.ts`)

Namespace `layout` (Task 9): `navMeetings` Meetings · Phòng họp — `tabMeetings` Meet · Họp.

Namespace `meeting` (mới). Cột "Task" = task thêm khoá đó (thêm cả 7 locale trong commit của task).

| Khoá | en | vi | Task |
|---|---|---|---|
| `title` | Meetings | Phòng họp | 10 |
| `subtitle` | Start a meeting now or schedule one for later. | Họp ngay hoặc lên lịch cho cuộc họp sau. | 10 |
| `newInstant` | Start a meeting | Họp ngay | 10 |
| `newScheduled` | Schedule | Lên lịch | 10 |
| `joinByCodeLabel` | Meeting code or link | Mã hoặc link cuộc họp | 10 |
| `joinByCodePlaceholder` | abc-defg-hjk | abc-defg-hjk | 10 |
| `joinByCode` | Join | Tham gia | 10 |
| `codeInvalid` | That isn't a valid meeting code | Mã cuộc họp không hợp lệ | 10 |
| `tabUpcoming` / `tabPast` | Upcoming / Past | Sắp tới / Đã qua | 10 |
| `emptyUpcoming` | No upcoming meetings | Chưa có cuộc họp sắp tới | 10 |
| `emptyPast` | No past meetings | Chưa có cuộc họp nào đã qua | 10 |
| `loadMore` | Load more | Xem thêm | 10 |
| `listError` | Couldn't load meetings | Không tải được danh sách cuộc họp | 10 |
| `untitled` | Meeting | Cuộc họp | 10 |
| `instantMeeting` | Instant meeting | Họp ngay | 10 |
| `statusLive` / `statusScheduled` / `statusEnded` / `statusCancelled` | Live / Scheduled / Ended / Cancelled | Đang diễn ra / Đã lên lịch / Đã kết thúc / Đã huỷ | 10 |
| `roleHost` / `roleCohost` / `roleAttendee` | Host / Co-host / Participant | Người tổ chức / Đồng tổ chức / Người tham dự | 10 |
| `hostedBy` | Hosted by {name} | Tổ chức bởi {name} | 10 |
| `someone` | Someone | Ai đó | 10 |
| `participantFallback` | Participant | Người tham dự | 10 |
| `you` | You | Bạn | 10 |
| `nameWithYou` | {name} (you) | {name} (bạn) | 18 |
| `copyLink` / `linkCopied` / `copyFailed` | Copy link / Meeting link copied / Couldn't copy the link | Sao chép link / Đã sao chép link cuộc họp / Không sao chép được link | 10 |
| `join` / `joinNow` / `askToJoin` | Join / Join now / Ask to join | Tham gia / Tham gia ngay / Yêu cầu tham gia | 10, 17 |
| `starting` | Starting… | Đang tạo… | 10 |
| `formCreateTitle` / `formEditTitle` / `formAgainTitle` | Schedule a meeting / Edit meeting / Meet again | Lên lịch cuộc họp / Sửa cuộc họp / Họp lại | 10 |
| `fieldTitle` / `fieldTitlePlaceholder` | Title / Add a title | Tiêu đề / Thêm tiêu đề | 10 |
| `fieldDescription` / `fieldDescriptionPlaceholder` | Description / Agenda, links, anything people should know | Mô tả / Chương trình, link, điều mọi người cần biết | 10 |
| `fieldWhen` / `whenNow` / `whenLater` | When / Start now / Schedule for later | Thời gian / Bắt đầu ngay / Lên lịch | 10 |
| `fieldDate` / `fieldTime` / `fieldDuration` | Date / Start time / Duration | Ngày / Giờ bắt đầu / Thời lượng | 10 |
| `durationMinutes` | {count, plural, other {# min}} | {count, plural, other {# phút}} | 10 |
| `durationHours` | {count, plural, one {# hour} other {# hours}} | {count, plural, other {# giờ}} | 10 |
| `durationHoursMinutes` | {hours} h {minutes} min | {hours} giờ {minutes} phút | 10 |
| `timeZoneHint` | Times are in {zone} | Giờ theo múi {zone} | 10 |
| `fieldInvitees` / `inviteeSearchPlaceholder` | Invite people / Search by name or email | Mời người tham dự / Tìm theo tên hoặc email | 10 |
| `inviteeCount` | {count, plural, =0 {No one invited yet} one {# person invited} other {# people invited}} | {count, plural, =0 {Chưa mời ai} other {Đã mời # người}} | 10 |
| `removeInvitee` | Remove {name} | Bỏ {name} | 10 |
| `searchNoResults` | No one found | Không tìm thấy ai | 10 |
| `fieldDepartment` / `departmentNone` / `departmentHint` | Department / No department / Everyone in the department is invited | Phòng ban / Không chọn phòng ban / Mọi thành viên phòng ban đều được mời | 10 |
| `departmentGeneric` | A department | Một phòng ban | 12 |
| `settingsTitle` | Meeting options | Tuỳ chọn cuộc họp | 10 |
| `settingWaitingRoom` / `settingWaitingRoomDesc` | Waiting room / People who aren't invited wait until a host lets them in | Phòng chờ / Người không được mời phải chờ người tổ chức cho vào | 10 |
| `settingMuteOnEntry` / `settingMuteOnEntryDesc` | Mute people when they join / Participants start with their microphone off | Tắt micro khi vào / Người tham dự vào phòng với micro đã tắt | 10 |
| `settingScreenShare` | Participants can present their screen | Người tham dự được trình bày màn hình | 10 |
| `settingNotes` | Participants can edit shared notes | Người tham dự được sửa ghi chú chung | 10 |
| `settingLocked` / `settingLockedDesc` | Lock meeting / Only invited people can join | Khoá cuộc họp / Chỉ người được mời mới vào được | 10 |
| `submitCreate` / `submitSave` | Schedule / Save changes | Lên lịch / Lưu thay đổi | 10 |
| `toastCreated` / `toastUpdated` | Meeting scheduled / Changes saved | Đã lên lịch cuộc họp / Đã lưu thay đổi | 10 |
| `valTitleTooLong` | Title can be at most {max} characters | Tiêu đề tối đa {max} ký tự | 5 |
| `valDescriptionTooLong` | Description can be at most {max} characters | Mô tả tối đa {max} ký tự | 5 |
| `valTooManyInvitees` | You can invite at most {max} people | Chỉ mời được tối đa {max} người | 5 |
| `valStartPast` | Pick a time in the future | Hãy chọn thời điểm trong tương lai | 5 |
| `valScheduleInvalid` | Pick a valid date and time | Hãy chọn ngày giờ hợp lệ | 5 |
| `errNotFound` | This meeting doesn't exist | Cuộc họp không tồn tại | 2 |
| `errForbidden` | You can't do that in this meeting | Bạn không có quyền làm việc này trong cuộc họp | 2 |
| `errCreateForbidden` | Your role can't host meetings | Vai trò của bạn không được tổ chức cuộc họp | 2 |
| `errDepartmentForbidden` | You can't create a meeting for that department | Bạn không thể tạo cuộc họp cho phòng ban này | 2 |
| `errRemoved` | You were removed from this meeting | Bạn đã bị mời ra khỏi cuộc họp này | 2 |
| `errLocked` | This meeting is locked | Cuộc họp đã bị khoá | 2 |
| `errEnded` | This meeting has ended | Cuộc họp đã kết thúc | 2 |
| `errFull` | This meeting is full ({max} people) | Cuộc họp đã đủ {max} người | 2 |
| `errNotCancellable` | Someone has already joined, so it can't be cancelled | Đã có người vào họp nên không huỷ được | 2 |
| `errUnavailable` | Meetings are unavailable right now. Try again shortly. | Phòng họp tạm thời không dùng được. Hãy thử lại sau. | 2 |
| `errNotesReadOnly` | Only hosts can edit the shared notes | Chỉ người tổ chức được sửa ghi chú chung | 2 |
| `errNoteConflict` | Someone saved a newer version | Đã có người lưu bản mới hơn | 2 |
| `errRateLimited` | You're sending too fast. Wait a moment. | Bạn gửi quá nhanh. Hãy chờ một chút. | 2 |
| `errChatTooLong` | Messages can be at most {max} characters | Tin nhắn tối đa {max} ký tự | 2 |
| `errNoteTooLong` | Notes can be at most {max} characters | Ghi chú tối đa {max} ký tự | 2 |
| `errInviteeInvalid` | Someone on the list can't be invited | Có người trong danh sách không mời được | 2 |
| `errDepartmentInvalid` | That department isn't available | Phòng ban không hợp lệ | 2 |
| `errStartInvalid` | The start time isn't valid | Thời gian bắt đầu không hợp lệ | 2 |
| `errEndInvalid` | The meeting must end after it starts and within 24 hours | Cuộc họp phải kết thúc sau khi bắt đầu và trong vòng 24 giờ | 2 |
| `errTargetUnavailable` | That person isn't in the meeting any more | Người này không còn trong cuộc họp | 2 |
| `errInvalid` | Something in the request isn't valid | Yêu cầu không hợp lệ | 2 |
| `errNetwork` | Can't reach the server. Check your connection. | Không kết nối được máy chủ. Hãy kiểm tra mạng. | 2 |
| `errGeneric` | Something went wrong. Try again. | Đã có lỗi xảy ra. Hãy thử lại. | 2 |
| `notifInvitedTitle` | Meeting invitation | Lời mời họp | 7 |
| `notifInvitedBody` | {name} invited you to “{title}” | {name} mời bạn tham gia “{title}” | 7 |
| `notifInvitedBodyAt` | {name} invited you to “{title}” on {time} | {name} mời bạn tham gia “{title}” lúc {time} | 7 |
| `notifStartingTitle` / `notifStartingBody` | Meeting starting soon / “{title}” starts at {time} | Cuộc họp sắp bắt đầu / “{title}” bắt đầu lúc {time} | 7 |
| `notifCancelled` / `notifCancelledUnknown` | “{title}” was cancelled / A meeting you were invited to was cancelled | “{title}” đã bị huỷ / Một cuộc họp bạn được mời đã bị huỷ | 7 |
| `notifOpen` | Open | Mở | 7 |
| `edit` / `cancelMeeting` / `meetAgain` / `endMeeting` | Edit / Cancel meeting / Meet again / End meeting | Sửa / Huỷ cuộc họp / Họp lại / Kết thúc cuộc họp | 12 |
| `cancelConfirmTitle` / `cancelConfirmDesc` | Cancel this meeting? / Everyone invited will be told it's cancelled. | Huỷ cuộc họp này? / Mọi người được mời sẽ nhận thông báo huỷ. | 12 |
| `toastCancelled` / `toastEnded` | Meeting cancelled / Meeting ended | Đã huỷ cuộc họp / Đã kết thúc cuộc họp | 12 |
| `backToList` | All meetings | Tất cả cuộc họp | 12 |
| `detailError` | Couldn't load this meeting | Không tải được cuộc họp | 12 |
| `sectionPeople` / `coHosts` / `invitees` | People / Co-hosts / Invited | Thành phần / Đồng tổ chức / Được mời | 12 |
| `sectionAttendance` / `attendanceEmpty` / `attendanceInside` | Attendance / Nobody joined / In the meeting now | Điểm danh / Chưa có ai tham gia / Đang trong cuộc họp | 12 |
| `attendanceDuration` | {minutes, plural, other {# min}} | {minutes, plural, other {# phút}} | 12 |
| `attendanceSessions` | {count, plural, one {# session} other {# sessions}} | {count, plural, other {# lần vào}} | 12 |
| `sectionNotes` / `sectionChat` / `chatHistoryEmpty` | Notes / Meeting chat / No messages | Ghi chú / Chat trong cuộc họp / Không có tin nhắn | 12 |
| `removedNotice` | You were removed from this meeting, so its notes and chat aren't available. | Bạn đã bị mời ra khỏi cuộc họp nên không xem được ghi chú và chat. | 12 |
| `guestNotice` | Join the meeting to see its notes and chat. | Tham gia cuộc họp để xem ghi chú và chat. | 12 |
| `notesShared` / `notesPrivate` / `notesPrivateHint` | Shared / Mine / Only you can see these notes | Chung / Của tôi / Chỉ bạn xem được ghi chú này | 11 |
| `notesPlaceholder` | Write notes — Markdown works | Viết ghi chú — hỗ trợ Markdown | 11 |
| `notesWrite` / `notesPreview` | Write / Preview | Viết / Xem trước | 11 |
| `notesSaving` / `notesSaved` / `notesUnsaved` / `notesSaveFailed` / `notesRetry` | Saving… / Saved / Unsaved changes / Couldn't save / Try again | Đang lưu… / Đã lưu / Chưa lưu / Chưa lưu được / Thử lại | 11 |
| `notesReadOnly` | Only hosts can edit these notes | Chỉ người tổ chức được sửa ghi chú này | 11 |
| `notesRemoteNewer` / `notesRemoteNewerUnknown` | {name} saved a newer version / A newer version was saved | {name} vừa lưu bản mới hơn / Có bản mới hơn vừa được lưu | 11 |
| `notesCounter` | {count} / {max} | {count} / {max} | 11 |
| `notesConflictTitle` / `notesConflictDesc` | Someone saved a newer version / Your text is safe. Compare both versions and choose what to keep. | Đã có bản mới hơn / Chữ bạn đang gõ vẫn còn nguyên. So sánh hai bản rồi chọn bản giữ lại. | 11 |
| `notesConflictReview` / `notesConflictTheirs` / `notesConflictMine` | Compare / Newer version / Your version | So sánh / Bản mới hơn / Bản của bạn | 11 |
| `notesConflictKeepMine` / `notesConflictTakeTheirs` / `notesConflictSaveMerged` | Keep mine / Use newer version / Save merged text | Giữ bản của tôi / Dùng bản mới hơn / Lưu bản đã gộp | 11 |
| `notesConflictDiscardWarning` | Your unsaved text will be discarded | Chữ chưa lưu của bạn sẽ bị bỏ | 11 |
| `prejoinTitle` / `prejoinStartsAt` / `prejoinJoiningAs` | Ready to join? / Starts {time} / You'll join as {name} | Sẵn sàng tham gia? / Bắt đầu lúc {time} / Bạn sẽ tham gia với tên {name} | 17 |
| `prejoinCameraOff` / `prejoinMuteOnEntry` | Camera is off / The host asks people to join muted | Camera đang tắt / Người tổ chức đề nghị tắt micro khi vào | 17 |
| `prejoinLockedHint` / `prejoinInCall` | This meeting is locked. Only invited people can join. / You're in a call. Hang up to join this meeting. | Cuộc họp đã khoá. Chỉ người được mời mới vào được. / Bạn đang trong cuộc gọi. Hãy kết thúc cuộc gọi để vào họp. | 17 |
| `micOn` / `micOff` / `camOn` / `camOff` | Turn on microphone / Turn off microphone / Turn on camera / Turn off camera | Bật micro / Tắt micro / Bật camera / Tắt camera | 17 |
| `micLevel` | Microphone level | Mức âm micro | 17 |
| `deviceMic` / `deviceCamera` / `deviceSpeaker` / `deviceDefault` | Microphone / Camera / Speaker / System default | Micro / Camera / Loa / Mặc định của hệ thống | 17 |
| `deviceUnnamedMic` / `deviceUnnamedCamera` / `deviceUnnamedSpeaker` | Microphone {n} / Camera {n} / Speaker {n} | Micro {n} / Camera {n} / Loa {n} | 17 |
| `mediaBlocked` / `mediaUnavailable` | Your browser blocked the microphone or camera. You can still join and allow it later. / No microphone or camera found | Trình duyệt đang chặn micro hoặc camera. Bạn vẫn có thể tham gia và cho phép sau. / Không tìm thấy micro hoặc camera | 17 |
| `waitingTitle` / `waitingDesc` / `waitingCancel` | Asking to join… / Someone in the meeting will let you in soon / Cancel | Đang xin vào… / Người tổ chức sẽ cho bạn vào trong giây lát / Huỷ | 17 |
| `deniedTitle` / `deniedDesc` | You weren't let in / Someone in the meeting declined your request | Bạn không được cho vào / Người tổ chức đã từ chối yêu cầu của bạn | 17 |
| `removedTitle` / `removedDesc` | You were removed from the meeting / You can't rejoin this meeting | Bạn đã bị mời ra khỏi cuộc họp / Bạn không thể vào lại cuộc họp này | 17 |
| `lockedTitle` / `lockedDesc` | This meeting is locked / Only invited people can join right now | Cuộc họp đã khoá / Hiện chỉ người được mời mới vào được | 17 |
| `fullTitle` / `fullDesc` | This meeting is full / {max} people are already in. Try again later. | Cuộc họp đã đủ người / Đã có {max} người trong phòng. Hãy thử lại sau. | 17 |
| `unavailableTitle` / `unavailableDesc` | Meetings are unavailable / Try again in a moment | Phòng họp tạm thời không dùng được / Hãy thử lại sau giây lát | 17 |
| `notFoundTitle` / `notFoundDesc` | Meeting not found / Check the code or link and try again | Không tìm thấy cuộc họp / Kiểm tra lại mã hoặc link | 17 |
| `leftTitle` / `connectionLostTitle` / `connectionLostDesc` | You left the meeting / Connection lost / We couldn't reconnect you to the meeting | Bạn đã rời cuộc họp / Mất kết nối / Không thể kết nối lại vào cuộc họp | 17 |
| `rejoin` / `tryAgain` / `viewDetails` | Rejoin / Try again / Meeting details | Vào lại / Thử lại / Chi tiết cuộc họp | 17 |
| `reconnecting` / `poorConnection` / `realtimeOffline` | Reconnecting… / Your connection is unstable / Chat, hands and host controls are paused until you're back online | Đang kết nối lại… / Mạng của bạn không ổn định / Chat, giơ tay và quyền người tổ chức tạm dừng tới khi có mạng lại | 18 |
| `presenting` / `stopPresenting` / `presentingName` | You're presenting / Stop presenting / {name} is presenting | Bạn đang trình bày / Dừng trình bày / {name} đang trình bày | 18 |
| `participantCount` | {count, plural, one {# person} other {# people}} | {count, plural, other {# người}} | 18 |
| `overflowTiles` | +{count} | +{count} | 18 |
| `pin` / `unpin` / `micMutedLabel` / `handRaisedLabel` / `speakingLabel` | Pin / Unpin / Microphone off / Hand raised / Speaking | Ghim / Bỏ ghim / Micro đang tắt / Đang giơ tay / Đang nói | 18 |
| `shareStart` / `shareDisabled` / `shareFailed` / `shareRevoked` | Present screen / The host turned off screen sharing for participants / Couldn't start presenting / The host turned off screen sharing | Trình bày màn hình / Người tổ chức đã tắt trình bày màn hình của người tham dự / Không trình bày được màn hình / Người tổ chức đã tắt trình bày màn hình | 18 |
| `raiseHand` / `lowerHand` / `reactions` / `chat` / `notes` / `people` / `more` | Raise hand / Lower hand / Send a reaction / Chat / Notes / People / More options | Giơ tay / Hạ tay / Gửi biểu cảm / Chat / Ghi chú / Mọi người / Tuỳ chọn khác | 18 |
| `withShortcut` | {label} ({shortcut}) | {label} ({shortcut}) | 18 |
| `layout` / `layoutGrid` / `layoutSpotlight` | Layout / Grid / Speaker | Bố cục / Lưới / Người nói | 18 |
| `devicesTitle` | Audio & video | Âm thanh & hình ảnh | 18 |
| `leave` / `leaveMeeting` / `endForAll` | Leave / Leave meeting / End meeting for all | Rời / Rời cuộc họp / Kết thúc cho mọi người | 18 |
| `endConfirmTitle` / `endConfirmDesc` | End the meeting for everyone? / Everyone will leave and the meeting can't be restarted | Kết thúc cuộc họp cho mọi người? / Mọi người sẽ rời phòng và cuộc họp không mở lại được | 18 |
| `mutedBy` / `mutedByUnknown` | {name} muted your microphone / A host muted your microphone | {name} đã tắt micro của bạn / Người tổ chức đã tắt micro của bạn | 15 |
| `madeCohost` / `revokedCohost` | You're now a co-host / You're no longer a co-host | Bạn đã được làm đồng tổ chức / Bạn không còn là đồng tổ chức | 15 |
| `endedToast` | The meeting has ended | Cuộc họp đã kết thúc | 15 |
| `mediaFailed` | Couldn't turn on your microphone or camera | Không bật được micro hoặc camera | 15 |
| `reactionAria` | {name} reacted {emoji} | {name} đã thả {emoji} | 18 |
| `peopleTitle` | People | Mọi người | 19 |
| `sectionHands` / `sectionLobby` / `sectionInMeeting` | Raised hands ({count}) / Waiting to join ({count}) / In the meeting ({count}) | Đang giơ tay ({count}) / Đang chờ vào ({count}) / Trong cuộc họp ({count}) | 19 |
| `admit` / `deny` / `admitAll` | Admit / Deny / Admit all | Cho vào / Từ chối / Cho tất cả vào | 19 |
| `lobbyWaiting` | {count, plural, one {# person is waiting to join} other {# people are waiting to join}} | {count, plural, other {# người đang chờ vào}} | 19 |
| `personMenu` | Options for {name} | Tuỳ chọn cho {name} | 19 |
| `actionMuteMic` / `actionMuteAll` / `actionRemove` | Mute microphone / Mute everyone / Remove from meeting | Tắt micro / Tắt micro mọi người / Mời ra khỏi cuộc họp | 19 |
| `actionLowerHand` / `actionLowerAllHands` | Lower hand / Lower all hands | Hạ tay / Hạ tất cả tay | 19 |
| `actionMakeCohost` / `actionRevokeCohost` | Make co-host / Remove as co-host | Làm đồng tổ chức / Bỏ quyền đồng tổ chức | 19 |
| `manageTitle` | Host controls | Quyền người tổ chức | 19 |
| `removeConfirmTitle` / `removeConfirmDesc` | Remove {name}? / They won't be able to rejoin this meeting | Mời {name} ra khỏi cuộc họp? / Người này sẽ không vào lại được cuộc họp | 19 |
| `muteAllConfirmTitle` / `muteAllConfirmDesc` | Mute everyone? / People can unmute themselves | Tắt micro của mọi người? / Mọi người vẫn tự bật lại được | 19 |
| `chatTitle` / `chatPlaceholder` / `chatSend` / `chatEmpty` | Meeting chat / Send a message / Send / Messages are visible to everyone in the meeting | Chat trong cuộc họp / Gửi tin nhắn / Gửi / Mọi người trong cuộc họp đều thấy tin nhắn | 20 |
| `chatFailed` / `chatRetry` / `chatDiscard` / `chatSending` | Not sent / Retry / Discard / Sending… | Chưa gửi được / Gửi lại / Bỏ / Đang gửi… | 20 |
| `chatOffline` | Reconnecting — you can't send messages right now | Đang kết nối lại — tạm chưa gửi được tin | 20 |
| `chatCounter` / `chatLoadOlder` | {count}/{max} / Load earlier messages | {count}/{max} / Xem tin cũ hơn | 20 |
| `chatUnread` | {count, plural, one {# new message} other {# new messages}} | {count, plural, other {# tin mới}} | 20 |

Các nút Đóng / Huỷ / Thử lại chung dùng `common.close` / `common.cancel` / `common.retry` sẵn có.

---
# Tasks

Thứ tự theo phụ thuộc. **MT4:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12. **MT5:** 13 → 14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22 → 23. Task 8 (return path) và 9 (điều hướng) độc lập, làm lúc nào cũng được sau Task 1. Mọi task kết thúc bằng `TSC`, test của task, `wc -l` file mới, commit.

Quy ước test: `t` giả trả `key` hoặc `key(v1,v2)` để kiểm khoá + giá trị mà không cần catalogue:

```ts
const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}(${Object.values(values).join(',')})` : key
```

## MT4 — Danh sách, tạo, chi tiết

### Task 1: Type contract + `meetingsApi`

**Files:**
- Create: `W/lib/api/meeting-types.ts`, `W/lib/api/meetings.ts`
- Modify: `W/lib/api/types.ts` (cuối file: `export * from './meeting-types'`)
- Test: `W/lib/api/__tests__/meetings.test.ts`

**Interfaces — Produces** (`meeting-types.ts`, chỉ type + hằng):

```ts
export type MeetingStatus = 'SCHEDULED' | 'LIVE' | 'ENDED'
export type MeetingViewerRole = 'host' | 'cohost' | 'invited' | 'guest'
export type MeetingRoomRole = 'host' | 'cohost' | 'attendee'
export type MeetingListScope = 'upcoming' | 'past'
export type NoteScope = 'shared' | 'private'

/** A person next to a meeting. displayName/avatarUrl absent ⇒ generic label, never the id. */
export interface MeetingPerson { userId: string; displayName?: string; avatarUrl?: string }

export interface MeetingSettings {
  waitingRoom: boolean
  muteOnEntry: boolean
  allowAttendeeScreenShare: boolean
  attendeesCanEditNotes: boolean
  locked: boolean
}

export interface MeetingAttendance {
  userId: string; displayName?: string; role: MeetingRoomRole; joinedAt: string; leftAt?: string
}

export interface Meeting {
  id: string; code: string; title?: string; description?: string
  host: MeetingPerson; coHosts?: MeetingPerson[]; invitees?: MeetingPerson[]
  departmentId?: string
  scheduledStart?: string; scheduledEnd?: string
  status: MeetingStatus
  settings: MeetingSettings
  attendance?: MeetingAttendance[]
  /** host/co-host only — raw ids for matching, NEVER rendered. */
  removedIds?: string[]
  viewerRole: MeetingViewerRole
  createdAt: string; startedAt?: string; endedAt?: string; cancelledAt?: string
}

export interface MeetingPage { content: Meeting[]; page: number; size: number; totalElements: number; hasNext: boolean }

/** POST/PATCH body. PATCH: absent = unchanged, '' clears title/description/departmentId. */
export interface MeetingInput {
  title?: string; description?: string; inviteeIds?: string[]; departmentId?: string
  scheduledStart?: string; scheduledEnd?: string; settings?: Partial<MeetingSettings>
}

export type MeetingJoinResponse =
  | { status: 'joined'; url: string; token: string; role: MeetingRoomRole }
  | { status: 'waiting' }

export interface MeetingMessage { id: string; sender: MeetingPerson; content: string; createdAt: string }
export interface MeetingMessagePage { content: MeetingMessage[]; page: number; size: number; totalElements: number; hasNext: boolean }

export interface MeetingNote { scope: NoteScope; content: string; version: number; updatedBy?: MeetingPerson; updatedAt?: string }
export interface MeetingNoteInput { content: string; version: number }

export interface MeetingHand { userId: string; displayName?: string; raisedAt: string }
export interface LobbyEntry { userId: string; displayName?: string }
export interface RosterEntry { userId: string; displayName?: string; role: MeetingRoomRole; joinedAt: string }

export const HOST_ACTIONS = [
  'MUTE_MIC', 'MUTE_ALL', 'REMOVE', 'LOWER_HAND', 'LOWER_ALL_HANDS', 'LOCK', 'UNLOCK',
  'WAITING_ROOM_ON', 'WAITING_ROOM_OFF', 'ATTENDEE_SCREEN_SHARE_ON', 'ATTENDEE_SCREEN_SHARE_OFF',
  'MAKE_COHOST', 'REVOKE_COHOST',
] as const
export type HostAction = (typeof HOST_ACTIONS)[number]
/** Actions that need a `targetId` (server ignores it for the others). */
export const TARGETED_HOST_ACTIONS: ReadonlySet<HostAction> =
  new Set<HostAction>(['MUTE_MIC', 'REMOVE', 'LOWER_HAND', 'MAKE_COHOST', 'REVOKE_COHOST'])

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '👏', '🎉'] as const
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number]

export const MEETING_LIMITS = {
  title: 120, description: 2000, invitees: 100, chat: 2000, note: 50_000,
  participants: 25, maxDurationMinutes: 24 * 60, startGraceMinutes: 5,
} as const

/** Server defaults (api-spec CreateMeetingRequest). */
export const DEFAULT_MEETING_SETTINGS: MeetingSettings = {
  waitingRoom: true, muteOnEntry: false, allowAttendeeScreenShare: true,
  attendeesCanEditNotes: true, locked: false,
}

/** Every STOMP meeting payload, after parseMeetingEvent (Task 3). */
export type MeetingEvent =
  | { event: 'meet.roster'; meetingId: string; participants: RosterEntry[] }
  | { event: 'meet.settings'; meetingId: string; settings: MeetingSettings }
  | { event: 'meet.ended'; meetingId: string }
  | { event: 'meet.hands'; meetingId: string; hands: MeetingHand[] }
  | { event: 'meet.chat'; meetingId: string; clientId?: string; message: MeetingMessage }
  | { event: 'meet.notes.updated'; meetingId: string; version: number; updatedBy?: MeetingPerson }
  | { event: 'meet.lobby'; meetingId: string; waiting: LobbyEntry[] }
  | { event: 'meet.admitted' | 'meet.denied' | 'meet.removed' | 'meet.cancelled'; meetingId: string }
  | { event: 'meet.muted'; meetingId: string; actor?: MeetingPerson }
  | { event: 'meet.error'; meetingId?: string; action?: HostAction; clientId?: string;
      errorCode: string; params?: Record<string, string | number> }
  /** hostId: identity only (placeholder row) — never rendered. */
  | { event: 'meet.invited'; meetingId: string; code: string; title?: string; hostId?: string;
      hostName?: string; scheduledStart?: string }
  | { event: 'meet.starting'; meetingId: string; code: string; title?: string; scheduledStart?: string }

export type MeetingEventName = MeetingEvent['event']
```

**Interfaces — Produces** (`meetings.ts`):

```ts
export const meetingsApi = {
  list: (scope: MeetingListScope, cursor?: string, size = 20): Promise<MeetingPage>,
  get: (id: string): Promise<Meeting>,
  byCode: (code: string): Promise<Meeting>,
  create: (input: MeetingInput = {}): Promise<Meeting>,
  update: (id: string, input: MeetingInput): Promise<Meeting>,
  cancel: (id: string): Promise<void>,
  join: (id: string): Promise<MeetingJoinResponse>,
  leaveLobby: (id: string): Promise<void>,
  admit: (id: string, userId: string): Promise<void>,
  deny: (id: string, userId: string): Promise<void>,
  end: (id: string): Promise<void>,
  messages: (id: string, before?: string, size = 50): Promise<MeetingMessagePage>,
  getNote: (id: string, scope: NoteScope): Promise<MeetingNote>,
  putNote: (id: string, scope: NoteScope, input: MeetingNoteInput): Promise<MeetingNote>,
  hands: (id: string): Promise<MeetingHand[]>,   // unwraps { hands }
}
```

`cursor`/`before` vắng thì **không** gửi param (axios bỏ `undefined`). `hands` trả `[]` khi body thiếu mảng.

- [ ] **Step 1: Test** — `W/lib/api/__tests__/meetings.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const http = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn(),
}))
vi.mock('@/lib/api/axios', () => ({ chatApi: http }))

import { meetingsApi } from '@/lib/api/meetings'

beforeEach(() => {
  for (const fn of Object.values(http)) fn.mockReset().mockResolvedValue({ data: undefined })
})

describe('meetingsApi', () => {
  it('lists a scope with the cursor only when there is one', async () => {
    http.get.mockResolvedValue({ data: { content: [], page: 0, size: 20, totalElements: 0, hasNext: false } })
    await meetingsApi.list('upcoming')
    expect(http.get).toHaveBeenLastCalledWith('/api/meetings', {
      params: { scope: 'upcoming', cursor: undefined, size: 20 },
    })
    await meetingsApi.list('past', 'm9', 50)
    expect(http.get).toHaveBeenLastCalledWith('/api/meetings', {
      params: { scope: 'past', cursor: 'm9', size: 50 },
    })
  })

  it('encodes ids and codes in paths', async () => {
    await meetingsApi.byCode('abc-defg-hjk')
    expect(http.get).toHaveBeenLastCalledWith('/api/meetings/by-code/abc-defg-hjk')
    await meetingsApi.admit('m 1', 'u/2')
    expect(http.post).toHaveBeenLastCalledWith('/api/meetings/m%201/lobby/u%2F2/admit')
  })

  it('creates an instant meeting with an empty body', async () => {
    http.post.mockResolvedValue({ data: { id: 'm1' } })
    await expect(meetingsApi.create()).resolves.toEqual({ id: 'm1' })
    expect(http.post).toHaveBeenLastCalledWith('/api/meetings', {})
  })

  it('pages chat history newest-first with before + size', async () => {
    await meetingsApi.messages('m1', 'msg7')
    expect(http.get).toHaveBeenLastCalledWith('/api/meetings/m1/messages', {
      params: { before: 'msg7', size: 50 },
    })
  })

  it('reads and writes notes by scope', async () => {
    await meetingsApi.getNote('m1', 'private')
    expect(http.get).toHaveBeenLastCalledWith('/api/meetings/m1/notes/private')
    await meetingsApi.putNote('m1', 'shared', { content: '# hi', version: 3 })
    expect(http.put).toHaveBeenLastCalledWith('/api/meetings/m1/notes/shared', { content: '# hi', version: 3 })
  })

  it('unwraps the hands list and tolerates a missing array', async () => {
    http.get.mockResolvedValueOnce({ data: { hands: [{ userId: 'a', raisedAt: 't' }] } })
    await expect(meetingsApi.hands('m1')).resolves.toEqual([{ userId: 'a', raisedAt: 't' }])
    http.get.mockResolvedValueOnce({ data: {} })
    await expect(meetingsApi.hands('m1')).resolves.toEqual([])
  })

  it('maps lobby, end and cancel to their routes', async () => {
    await meetingsApi.leaveLobby('m1')
    expect(http.delete).toHaveBeenLastCalledWith('/api/meetings/m1/lobby')
    await meetingsApi.end('m1')
    expect(http.post).toHaveBeenLastCalledWith('/api/meetings/m1/end')
    await meetingsApi.cancel('m1')
    expect(http.delete).toHaveBeenLastCalledWith('/api/meetings/m1')
  })
})
```

- [ ] **Step 2: RED** — `VT lib/api/__tests__/meetings.test.ts` ⇒ không resolve module.
- [ ] **Step 3: Hiện thực** 2 file theo Interfaces; `const enc = encodeURIComponent`.
- [ ] **Step 4: GREEN** — `VT lib/api/__tests__/meetings.test.ts && TSC`
- [ ] **Step 5: Commit** `feat(web): meetings API client and contract types`

---

### Task 2: Lỗi họp → khoá i18n

**Files:**
- Create: `ML/meeting-errors.ts`
- Modify: `W/messages/*.json` — nhóm khoá `err*` (bảng i18n, Task 2) ở cả 7 locale
- Test: `ML/__tests__/meeting-errors.test.ts`

**Interfaces — Produces:**

```ts
import type { ChatErrorInfo } from '@/lib/api/chat-errors'
export type MeetingErrorInfo = ChatErrorInfo            // { status?, code?, params?, network? }
export type MeetingErrorContext = 'general' | 'chat' | 'note'
export interface MessageKey { key: string; values?: Record<string, string | number> }

/** Same parsing as chat-service errors (top-level {code, params}). */
export function parseMeetingError(err: unknown): MeetingErrorInfo           // = parseChatError
export function meetingErrorKey(info: MeetingErrorInfo, context?: MeetingErrorContext): MessageKey
export function meetingErrorMessage(err: unknown, t: Translate, context?: MeetingErrorContext): string
/** `meet.error` → same mapping (errorCode + params). */
export function meetingEventErrorKey(errorCode: string, params?: Record<string, string | number>,
  context?: MeetingErrorContext): MessageKey
/** The `latest` note of a 409 MEETING_NOTE_CONFLICT, else null (validated shape). */
export function noteConflictLatest(err: unknown): MeetingNote | null
```

Bảng ánh xạ = mục "Mã lỗi → khoá i18n" ở đầu plan. `max` lấy từ `params.max` nếu là số > 0, không thì `MEETING_LIMITS` tương ứng.

- [ ] **Step 1: Test** — `ML/__tests__/meeting-errors.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import {
  meetingErrorKey,
  meetingErrorMessage,
  meetingEventErrorKey,
  noteConflictLatest,
  parseMeetingError,
} from '@/lib/meetings/meeting-errors'

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}(${Object.values(values).join(',')})` : key

function httpError(status: number, data: unknown): AxiosError {
  const response = { status, data, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } }
  return new AxiosError('boom', 'ERR', undefined, undefined, response as AxiosResponse)
}

describe('meetingErrorKey', () => {
  it.each([
    ['MEETING_NOT_FOUND', 'errNotFound'],
    ['MEETING_FORBIDDEN', 'errForbidden'],
    ['MEETING_CREATE_FORBIDDEN', 'errCreateForbidden'],
    ['MEETING_DEPARTMENT_FORBIDDEN', 'errDepartmentForbidden'],
    ['MEETING_REMOVED', 'errRemoved'],
    ['MEETING_LOCKED', 'errLocked'],
    ['MEETING_ENDED', 'errEnded'],
    ['MEETING_NOT_CANCELLABLE', 'errNotCancellable'],
    ['MEETINGS_UNAVAILABLE', 'errUnavailable'],
    ['MEETING_NOTES_READ_ONLY', 'errNotesReadOnly'],
    ['MEETING_NOTE_CONFLICT', 'errNoteConflict'],
    ['RATE_LIMITED', 'errRateLimited'],
  ])('%s → %s', (code, key) => {
    expect(meetingErrorKey({ code }).key).toBe(key)
  })

  it('fills the room size into MEETING_FULL', () => {
    expect(meetingErrorKey({ code: 'MEETING_FULL' })).toEqual({ key: 'errFull', values: { max: 25 } })
  })

  it('maps MEETING_INVALID by field, using the server max when present', () => {
    expect(meetingErrorKey({ code: 'MEETING_INVALID', params: { field: 'title', max: 120 } }))
      .toEqual({ key: 'valTitleTooLong', values: { max: 120 } })
    expect(meetingErrorKey({ code: 'MEETING_INVALID', params: { field: 'description' } }))
      .toEqual({ key: 'valDescriptionTooLong', values: { max: 2000 } })
    expect(meetingErrorKey({ code: 'MEETING_INVALID', params: { field: 'inviteeIds', max: 100 } }))
      .toEqual({ key: 'valTooManyInvitees', values: { max: 100 } })
    expect(meetingErrorKey({ code: 'MEETING_INVALID', params: { field: 'inviteeIds' } }).key)
      .toBe('errInviteeInvalid')
    expect(meetingErrorKey({ code: 'MEETING_INVALID', params: { field: 'departmentId' } }).key)
      .toBe('errDepartmentInvalid')
    expect(meetingErrorKey({ code: 'MEETING_INVALID', params: { field: 'scheduledStart' } }).key)
      .toBe('errStartInvalid')
    expect(meetingErrorKey({ code: 'MEETING_INVALID', params: { field: 'scheduledEnd' } }).key)
      .toBe('errEndInvalid')
    expect(meetingErrorKey({ code: 'MEETING_INVALID', params: { field: 'targetId' } }).key)
      .toBe('errTargetUnavailable')
    expect(meetingErrorKey({ code: 'MEETING_INVALID', params: { field: 'size' } }).key).toBe('errInvalid')
    expect(meetingErrorKey({ code: 'MEETING_INVALID' }).key).toBe('errInvalid')
  })

  it('tells chat content from note content', () => {
    expect(meetingErrorKey({ code: 'MEETING_INVALID', params: { field: 'content', max: 2000 } }, 'chat'))
      .toEqual({ key: 'errChatTooLong', values: { max: 2000 } })
    expect(meetingErrorKey({ code: 'MEETING_INVALID', params: { field: 'content' } }, 'note'))
      .toEqual({ key: 'errNoteTooLong', values: { max: 50000 } })
  })

  it('falls back on status, network and the generic key — never raw text', () => {
    expect(meetingErrorKey({ status: 429 }).key).toBe('errRateLimited')
    expect(meetingErrorKey({ status: 503 }).key).toBe('errUnavailable')
    expect(meetingErrorKey({ network: true }).key).toBe('errNetwork')
    expect(meetingErrorKey({ status: 500, code: 'SOMETHING_NEW' }).key).toBe('errGeneric')
    expect(meetingErrorKey({}).key).toBe('errGeneric')
  })
})

describe('meetingErrorMessage / parseMeetingError', () => {
  it('reads the top-level code of an axios error', () => {
    const err = httpError(403, { error: 'Forbidden', code: 'MEETING_LOCKED', statusCode: 403 })
    expect(parseMeetingError(err)).toEqual({ status: 403, code: 'MEETING_LOCKED', params: undefined })
    expect(meetingErrorMessage(err, t)).toBe('errLocked')
  })

  it('never surfaces exception text', () => {
    expect(meetingErrorMessage(new Error('Cannot read properties of undefined'), t)).toBe('errGeneric')
  })
})

describe('meetingEventErrorKey', () => {
  it('maps meet.error codes with their params', () => {
    expect(meetingEventErrorKey('RATE_LIMITED').key).toBe('errRateLimited')
    expect(meetingEventErrorKey('MEETING_INVALID', { field: 'content', max: 2000 }, 'chat'))
      .toEqual({ key: 'errChatTooLong', values: { max: 2000 } })
    expect(meetingEventErrorKey('MEETINGS_UNAVAILABLE').key).toBe('errUnavailable')
  })
})

describe('noteConflictLatest', () => {
  const latest = { scope: 'shared', content: 'theirs', version: 8, updatedBy: { userId: 'u2', displayName: 'Minh' } }

  it('returns the latest note of a 409 conflict', () => {
    const err = httpError(409, { code: 'MEETING_NOTE_CONFLICT', statusCode: 409, latest })
    expect(noteConflictLatest(err)).toEqual(latest)
  })

  it('ignores other errors and malformed bodies', () => {
    expect(noteConflictLatest(httpError(409, { code: 'MEETING_ENDED' }))).toBeNull()
    expect(noteConflictLatest(httpError(409, { code: 'MEETING_NOTE_CONFLICT', latest: { content: 1 } }))).toBeNull()
    expect(noteConflictLatest(new Error('x'))).toBeNull()
  })
})
```

- [ ] **Step 2: RED** — `VT lib/meetings/__tests__/meeting-errors.test.ts`
- [ ] **Step 3: Hiện thực** — `parseMeetingError = parseChatError` (tái dùng `lib/api/chat-errors.ts`, không nhân bản), bảng `CODE_KEYS: Record<string, string>` + nhánh `MEETING_INVALID` theo `params.field`. `noteConflictLatest`: `axios.isAxiosError`, status 409, `data.code === 'MEETING_NOTE_CONFLICT'`, `latest.content` là string, `latest.version` là number, `scope ∈ {shared, private}`. Thêm khoá `err*` vào 7 locale.
- [ ] **Step 4: GREEN** — `VT lib/meetings/__tests__/meeting-errors.test.ts lib/__tests__/i18n-parity.test.ts && TSC`
- [ ] **Step 5: Commit** `feat(web): meeting error codes to localized messages`

---

### Task 3: `parseMeetingEvent` — sự kiện STOMP có type guard

**Files:**
- Create: `ML/meeting-events.ts`
- Test: `ML/__tests__/meeting-events.test.ts`

**Interfaces — Produces:** `export function parseMeetingEvent(body: string): MeetingEvent | null`

Quy tắc: JSON hỏng / không phải object / `event` lạ ⇒ `null`. `meetingId` (string) bắt buộc trừ `meet.error`. Mảng được **lọc** phần tử hỏng (không bỏ cả sự kiện): roster/lobby/hands cần `userId` string; roster `role ∉ {host,cohost,attendee}` ⇒ `'attendee'`; `displayName` chỉ giữ khi là string không rỗng. `meet.settings` cần đủ 5 boolean (thiếu ⇒ `null`). `meet.chat` cần `message.id/content/createdAt` string và `sender.userId`. `meet.notes.updated` cần `version` number. `meet.error`: `errorCode` string bắt buộc; `action` chỉ giữ khi thuộc `HOST_ACTIONS`; `params` chỉ giữ giá trị string/number. `meet.invited`/`meet.starting` cần `code` string.

- [ ] **Step 1: Test** — `ML/__tests__/meeting-events.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { parseMeetingEvent } from '@/lib/meetings/meeting-events'

const j = (v: unknown) => JSON.stringify(v)

describe('parseMeetingEvent', () => {
  it('rejects junk, unknown events and missing meeting ids', () => {
    expect(parseMeetingEvent('not json')).toBeNull()
    expect(parseMeetingEvent(j(['meet.ended']))).toBeNull()
    expect(parseMeetingEvent(j({ event: 'meet.unknown', meetingId: 'm1' }))).toBeNull()
    expect(parseMeetingEvent(j({ event: 'meet.ended' }))).toBeNull()
  })

  it('parses a roster with current roles and drops broken rows', () => {
    const e = parseMeetingEvent(j({
      event: 'meet.roster', meetingId: 'm1',
      participants: [
        { userId: 'a', displayName: 'An', role: 'cohost', joinedAt: '2026-10-08T02:00:00Z' },
        { userId: 'b', role: 'superuser', joinedAt: '2026-10-08T02:01:00Z' },
        { displayName: 'no id' },
      ],
    }))
    expect(e).toEqual({
      event: 'meet.roster', meetingId: 'm1',
      participants: [
        { userId: 'a', displayName: 'An', role: 'cohost', joinedAt: '2026-10-08T02:00:00Z' },
        { userId: 'b', role: 'attendee', joinedAt: '2026-10-08T02:01:00Z' },
      ],
    })
  })

  it('needs all five settings', () => {
    const settings = { waitingRoom: true, muteOnEntry: false, allowAttendeeScreenShare: false,
      attendeesCanEditNotes: true, locked: false }
    expect(parseMeetingEvent(j({ event: 'meet.settings', meetingId: 'm1', settings })))
      .toEqual({ event: 'meet.settings', meetingId: 'm1', settings })
    expect(parseMeetingEvent(j({ event: 'meet.settings', meetingId: 'm1', settings: { locked: true } })))
      .toBeNull()
  })

  it('keeps hands in server order', () => {
    const e = parseMeetingEvent(j({ event: 'meet.hands', meetingId: 'm1', hands: [
      { userId: 'c', displayName: 'Chi', raisedAt: '2026-10-08T02:06:00Z' },
      { userId: 'a', raisedAt: '2026-10-08T02:07:00Z' },
    ] }))
    expect(e?.event === 'meet.hands' && e.hands.map((h) => h.userId)).toEqual(['c', 'a'])
  })

  it('parses chat with an echoed client id', () => {
    const message = { id: 'x1', sender: { userId: 'a', displayName: 'An' }, content: 'hi', createdAt: '2026-10-08T02:05:11Z' }
    expect(parseMeetingEvent(j({ event: 'meet.chat', meetingId: 'm1', clientId: 'c-1', message })))
      .toEqual({ event: 'meet.chat', meetingId: 'm1', clientId: 'c-1', message })
    expect(parseMeetingEvent(j({ event: 'meet.chat', meetingId: 'm1', message: { id: 'x1' } }))).toBeNull()
  })

  it('parses note updates without content', () => {
    expect(parseMeetingEvent(j({ event: 'meet.notes.updated', meetingId: 'm1', version: 8,
      updatedBy: { userId: 'u2', displayName: 'Minh' } })))
      .toEqual({ event: 'meet.notes.updated', meetingId: 'm1', version: 8,
        updatedBy: { userId: 'u2', displayName: 'Minh' } })
    expect(parseMeetingEvent(j({ event: 'meet.notes.updated', meetingId: 'm1', version: '8' }))).toBeNull()
  })

  it('parses the personal queue events', () => {
    expect(parseMeetingEvent(j({ event: 'meet.lobby', meetingId: 'm1', waiting: [{ userId: 'g', displayName: 'Guest' }, {}] })))
      .toEqual({ event: 'meet.lobby', meetingId: 'm1', waiting: [{ userId: 'g', displayName: 'Guest' }] })
    for (const event of ['meet.admitted', 'meet.denied', 'meet.removed', 'meet.cancelled', 'meet.ended']) {
      expect(parseMeetingEvent(j({ event, meetingId: 'm1' }))).toEqual({ event, meetingId: 'm1' })
    }
    expect(parseMeetingEvent(j({ event: 'meet.muted', meetingId: 'm1', actor: { userId: 'h', displayName: 'Lan' } })))
      .toEqual({ event: 'meet.muted', meetingId: 'm1', actor: { userId: 'h', displayName: 'Lan' } })
  })

  it('parses meet.error and drops an unknown action and non-scalar params', () => {
    expect(parseMeetingEvent(j({ event: 'meet.error', meetingId: 'm1', action: 'NUKE', clientId: 'c-7',
      errorCode: 'MEETING_INVALID', params: { field: 'content', max: 2000, extra: { a: 1 } } })))
      .toEqual({ event: 'meet.error', meetingId: 'm1', clientId: 'c-7', errorCode: 'MEETING_INVALID',
        params: { field: 'content', max: 2000 } })
    expect(parseMeetingEvent(j({ event: 'meet.error', errorCode: 'RATE_LIMITED' })))
      .toEqual({ event: 'meet.error', errorCode: 'RATE_LIMITED' })
    expect(parseMeetingEvent(j({ event: 'meet.error', meetingId: 'm1', action: 'LOCK', errorCode: 'MEETINGS_UNAVAILABLE' })))
      .toEqual({ event: 'meet.error', meetingId: 'm1', action: 'LOCK', errorCode: 'MEETINGS_UNAVAILABLE' })
    expect(parseMeetingEvent(j({ event: 'meet.error', meetingId: 'm1' }))).toBeNull()
  })

  it('parses invitations and reminders (code required)', () => {
    expect(parseMeetingEvent(j({ event: 'meet.invited', meetingId: 'm1', code: 'abc-defg-hjk', title: 'Sync',
      hostId: '64b0aaaaaaaaaaaaaaaaaaaa', hostName: 'Lan', scheduledStart: '2026-10-08T02:00:00Z' })))
      .toEqual({ event: 'meet.invited', meetingId: 'm1', code: 'abc-defg-hjk', title: 'Sync',
        hostId: '64b0aaaaaaaaaaaaaaaaaaaa', hostName: 'Lan', scheduledStart: '2026-10-08T02:00:00Z' })
    expect(parseMeetingEvent(j({ event: 'meet.starting', meetingId: 'm1', code: 'abc-defg-hjk' })))
      .toEqual({ event: 'meet.starting', meetingId: 'm1', code: 'abc-defg-hjk' })
    expect(parseMeetingEvent(j({ event: 'meet.invited', meetingId: 'm1' }))).toBeNull()
  })
})
```

- [ ] **Step 2: RED** · **Step 3: Hiện thực** (helper `str(v)`, `person(v)`, `rows(v, fn)` — ≤ 170 dòng) · **Step 4: GREEN** `VT lib/meetings/__tests__/meeting-events.test.ts && TSC`
- [ ] **Step 5: Commit** `feat(web): typed parser for meeting STOMP events`

---

### Task 4: Khoá cache + hàm vá cache thuần

**Files:**
- Create: `ML/cache-updates.ts`
- Test: `ML/__tests__/cache-updates.test.ts`

**Interfaces — Produces:**

```ts
import type { InfiniteData } from '@tanstack/react-query'
export type MeetingListData = InfiniteData<MeetingPage, string | undefined>
export type MessageListData = InfiniteData<MeetingMessagePage, string | undefined>

export const meetingKeys = {
  all: ['meetings'] as const,
  list: (scope: MeetingListScope) => ['meetings', scope] as const,
  detail: (id: string) => ['meeting', id] as const,
  byCode: (code: string) => ['meeting-code', code] as const,
  roster: (id: string) => ['meeting-roster', id] as const,
  hands: (id: string) => ['meeting-hands', id] as const,
  lobby: (id: string) => ['meeting-lobby', id] as const,
  messages: (id: string) => ['meeting-messages', id] as const,
  note: (id: string, scope: NoteScope) => ['meeting-note', id, scope] as const,
}

/** Sort key the server uses: scheduledStart ?? createdAt. */
export function meetingSortAt(m: Pick<Meeting, 'scheduledStart' | 'createdAt'>): string
/** Replace the row with the same id, or insert it in ascending sortAt order (first page if empty). */
export function upsertUpcoming(data: MeetingListData | undefined, m: Meeting): MeetingListData | undefined
export function removeFromList(data: MeetingListData | undefined, id: string): MeetingListData | undefined
/** Replace a row in place only if present (past list / any list). */
export function replaceInList(data: MeetingListData | undefined, m: Meeting): MeetingListData | undefined
/** A list row built from meet.invited (status SCHEDULED, viewerRole invited, default settings). */
export function invitedPlaceholder(e: Extract<MeetingEvent, { event: 'meet.invited' }>, nowIso: string): Meeting
export function markEnded(m: Meeting | undefined, atIso: string, cancelled: boolean): Meeting | undefined
export function withSettings(m: Meeting | undefined, settings: MeetingSettings): Meeting | undefined
/** Open attendance rows → roster (current role from host/coHosts; one row per user, latest joinedAt). */
export function rosterFromMeeting(m: Meeting): RosterEntry[]
/** Prepend a live chat line to the newest page; no-op if the id is already cached anywhere. */
export function appendMessage(data: MessageListData | undefined, msg: MeetingMessage): MessageListData
/** All cached lines oldest → newest (pages are newest-first). */
export function flattenMessages(data: MessageListData | undefined): MeetingMessage[]
```

- [ ] **Step 1: Test** — `ML/__tests__/cache-updates.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import type { Meeting, MeetingMessage, MeetingPage, MeetingMessagePage } from '@/lib/api/meeting-types'
import {
  appendMessage, flattenMessages, invitedPlaceholder, markEnded, meetingSortAt, removeFromList,
  replaceInList, rosterFromMeeting, upsertUpcoming, withSettings,
  type MeetingListData, type MessageListData,
} from '@/lib/meetings/cache-updates'

const SETTINGS = { waitingRoom: true, muteOnEntry: false, allowAttendeeScreenShare: true,
  attendeesCanEditNotes: true, locked: false }

function meeting(id: string, over: Partial<Meeting> = {}): Meeting {
  return { id, code: `${id}-code`, host: { userId: 'h', displayName: 'Host' }, status: 'SCHEDULED',
    settings: SETTINGS, viewerRole: 'invited', createdAt: '2026-10-07T00:00:00Z', ...over }
}
function page(content: Meeting[], hasNext = false): MeetingPage {
  return { content, page: 0, size: 20, totalElements: content.length, hasNext }
}
function list(...pages: MeetingPage[]): MeetingListData {
  return { pages, pageParams: pages.map((_, i) => (i === 0 ? undefined : `c${i}`)) }
}
const ids = (d: MeetingListData | undefined) => d?.pages.map((p) => p.content.map((m) => m.id))

describe('upcoming list', () => {
  const a = meeting('a', { scheduledStart: '2026-10-08T01:00:00Z' })
  const c = meeting('c', { scheduledStart: '2026-10-08T03:00:00Z' })

  it('sorts by scheduledStart, instant meetings by creation', () => {
    expect(meetingSortAt(a)).toBe('2026-10-08T01:00:00Z')
    expect(meetingSortAt(meeting('i'))).toBe('2026-10-07T00:00:00Z')
  })

  it('inserts a new meeting in start order and replaces an existing one', () => {
    const b = meeting('b', { scheduledStart: '2026-10-08T02:00:00Z' })
    const data = upsertUpcoming(list(page([a, c])), b)
    expect(ids(data)).toEqual([['a', 'b', 'c']])
    const renamed = upsertUpcoming(data, { ...b, title: 'Renamed' })
    expect(renamed?.pages[0].content[1].title).toBe('Renamed')
    expect(ids(renamed)).toEqual([['a', 'b', 'c']])
  })

  it('appends past the last loaded row only when there is no next page', () => {
    const late = meeting('z', { scheduledStart: '2026-12-01T00:00:00Z' })
    expect(ids(upsertUpcoming(list(page([a, c], true)), late))).toEqual([['a', 'c']])
    expect(ids(upsertUpcoming(list(page([a, c], false)), late))).toEqual([['a', 'c', 'z']])
  })

  it('leaves an unloaded list alone and removes rows by id', () => {
    expect(upsertUpcoming(undefined, a)).toBeUndefined()
    expect(ids(removeFromList(list(page([a]), page([c])), 'c'))).toEqual([['a'], []])
    expect(ids(replaceInList(list(page([a])), meeting('nope')))).toEqual([['a']])
  })
})

describe('invitedPlaceholder', () => {
  it('builds a scheduled row the list can show — host name only, id kept for identity', () => {
    const m = invitedPlaceholder({ event: 'meet.invited', meetingId: 'm1', code: 'abc-defg-hjk', title: 'Sync',
      hostId: 'h1', hostName: 'Lan', scheduledStart: '2026-10-08T02:00:00Z' }, '2026-10-07T09:00:00Z')
    expect(m).toMatchObject({ id: 'm1', code: 'abc-defg-hjk', title: 'Sync', status: 'SCHEDULED',
      viewerRole: 'invited', host: { userId: 'h1', displayName: 'Lan' },
      scheduledStart: '2026-10-08T02:00:00Z', createdAt: '2026-10-07T09:00:00Z' })
    expect(m.settings).toEqual(SETTINGS)
  })
})

describe('detail patches', () => {
  it('marks a meeting ended or cancelled', () => {
    expect(markEnded(meeting('a', { status: 'LIVE' }), 'T', false)).toMatchObject({ status: 'ENDED', endedAt: 'T' })
    expect(markEnded(meeting('a'), 'T', true)).toMatchObject({ status: 'ENDED', cancelledAt: 'T' })
    expect(markEnded(undefined, 'T', false)).toBeUndefined()
  })

  it('swaps settings', () => {
    expect(withSettings(meeting('a'), { ...SETTINGS, locked: true })?.settings.locked).toBe(true)
  })

  it('builds the roster from open attendance rows with the current role', () => {
    const m = meeting('a', {
      host: { userId: 'h' }, coHosts: [{ userId: 'co' }],
      attendance: [
        { userId: 'h', displayName: 'Host', role: 'host', joinedAt: '2026-10-08T02:00:00Z' },
        { userId: 'co', displayName: 'Co', role: 'attendee', joinedAt: '2026-10-08T02:01:00Z' },
        { userId: 'x', role: 'attendee', joinedAt: '2026-10-08T02:02:00Z', leftAt: '2026-10-08T02:03:00Z' },
        { userId: 'y', role: 'attendee', joinedAt: '2026-10-08T02:02:00Z' },
        { userId: 'y', displayName: 'Yen', role: 'attendee', joinedAt: '2026-10-08T02:09:00Z' },
      ],
    })
    expect(rosterFromMeeting(m)).toEqual([
      { userId: 'h', displayName: 'Host', role: 'host', joinedAt: '2026-10-08T02:00:00Z' },
      { userId: 'co', displayName: 'Co', role: 'cohost', joinedAt: '2026-10-08T02:01:00Z' },
      { userId: 'y', displayName: 'Yen', role: 'attendee', joinedAt: '2026-10-08T02:09:00Z' },
    ])
    expect(rosterFromMeeting(meeting('b'))).toEqual([])
  })
})

describe('chat cache', () => {
  const msg = (id: string, at: string): MeetingMessage =>
    ({ id, sender: { userId: 'a' }, content: id, createdAt: at })
  const mpage = (content: MeetingMessage[]): MeetingMessagePage =>
    ({ content, page: 0, size: 50, totalElements: content.length, hasNext: false })

  it('prepends live lines to the newest page and dedupes by id', () => {
    const data: MessageListData = { pages: [mpage([msg('m2', 't2'), msg('m1', 't1')]), mpage([msg('m0', 't0')])],
      pageParams: [undefined, 'm1'] }
    const next = appendMessage(data, msg('m3', 't3'))
    expect(next.pages[0].content.map((m) => m.id)).toEqual(['m3', 'm2', 'm1'])
    expect(appendMessage(next, msg('m0', 't0'))).toBe(next)
    expect(flattenMessages(next).map((m) => m.id)).toEqual(['m0', 'm1', 'm2', 'm3'])
  })

  it('starts a cache when none is loaded', () => {
    const fresh = appendMessage(undefined, msg('m1', 't1'))
    expect(flattenMessages(fresh).map((m) => m.id)).toEqual(['m1'])
    expect(flattenMessages(undefined)).toEqual([])
  })
})
```

- [ ] **Step 2: RED** · **Step 3: Hiện thực** — mọi hàm trả object mới (không mutate); `upsertUpcoming` tìm trang/vị trí đầu tiên có `Date.parse(sortAt) > Date.parse(m.sortAt)`, không có ⇒ chèn cuối trang cuối **chỉ khi** `hasNext=false` (còn trang sau thì để trang sau tự mang về). `invitedPlaceholder` dùng `DEFAULT_MEETING_SETTINGS` (Task 1).
- [ ] **Step 4: GREEN** — `VT lib/meetings/__tests__/cache-updates.test.ts && TSC`
- [ ] **Step 5: Commit** `feat(web): meeting query keys and pure cache updates`

---
### Task 5: Lịch (giờ địa phương ⇄ UTC) + form tạo/sửa

**Files:**
- Create: `ML/schedule.ts`, `ML/meeting-form.ts`
- Modify: `W/messages/*.json` — khoá `val*` (7 locale)
- Test: `ML/__tests__/schedule.test.ts`, `ML/__tests__/meeting-form.test.ts`

**Interfaces — Produces** (`schedule.ts`):

```ts
/** What the form edits: a local wall-clock date + time in the browser's zone, and a length. */
export interface LocalSchedule { date: string /* YYYY-MM-DD */; time: string /* HH:mm */; durationMinutes: number }
export const DURATION_PRESETS: readonly number[]          // [15, 30, 45, 60, 90, 120, 180, 240]
/** Local wall-clock → UTC ISO with `Z`; null when malformed or not a real local time (Feb 30, DST gap). */
export function localToUtcIso(date: string, time: string): string | null
export function buildSchedule(s: LocalSchedule): { scheduledStart: string; scheduledEnd: string } | null
export function scheduleFromMeeting(m: Pick<Meeting, 'scheduledStart' | 'scheduledEnd'>): LocalSchedule | null
/** Next :00/:30 strictly after now, 30 minutes. */
export function defaultSchedule(now: Date): LocalSchedule
/** Presets plus `current` when it is not one of them, ascending. */
export function durationOptions(current?: number): number[]
export function splitDuration(minutes: number): { hours: number; minutes: number }
/** "GMT+7" style label of the browser zone at `at` (Intl `timeZoneName: 'shortOffset'`). */
export function timeZoneLabel(locale: string, at: Date): string
/** Locale-formatted "date, start – end" (Intl formatRange) or just the start. */
export function formatMeetingRange(locale: string, startIso: string, endIso?: string): string
```

**Interfaces — Produces** (`meeting-form.ts`):

```ts
export interface MeetingFormValues {
  title: string; description: string; invitees: MeetingPerson[]; departmentId: string /* '' = none */
  scheduled: boolean; schedule: LocalSchedule; settings: MeetingSettings
}
export type MeetingFormField = 'title' | 'description' | 'invitees' | 'schedule'
export type MeetingFormErrors = Partial<Record<MeetingFormField, MessageKey>>
export function emptyMeetingForm(now: Date): MeetingFormValues
/** 'edit' keeps the schedule; 'again' copies people/options but starts unscheduled. */
export function formFromMeeting(m: Meeting, mode: 'edit' | 'again', now: Date): MeetingFormValues
/** Client-side limits; schedule checked only when it is new/changed and the meeting is not LIVE. */
export function validateMeetingForm(v: MeetingFormValues, now: Date, original?: Meeting): MeetingFormErrors
/** Create (no original) or PATCH body (only what the contract needs; '' clears). */
export function toMeetingInput(v: MeetingFormValues, original?: Meeting): MeetingInput
```

- [ ] **Step 1: Test** — `ML/__tests__/schedule.test.ts` (đổi `TZ` để kiểm UTC thật; Node áp dụng ngay khi gán `process.env.TZ`)

```ts
import { afterAll, beforeAll, describe, it, expect } from 'vitest'
import {
  buildSchedule, defaultSchedule, durationOptions, formatMeetingRange, localToUtcIso,
  scheduleFromMeeting, splitDuration, timeZoneLabel,
} from '@/lib/meetings/schedule'

const previousTz = process.env.TZ
beforeAll(() => { process.env.TZ = 'Asia/Ho_Chi_Minh' })   // UTC+7, no DST
afterAll(() => { process.env.TZ = previousTz })

describe('local wall clock ⇄ UTC', () => {
  it('sends UTC with Z', () => {
    expect(localToUtcIso('2026-10-08', '09:00')).toBe('2026-10-08T02:00:00.000Z')
    expect(localToUtcIso('2026-10-08', '00:30')).toBe('2026-10-07T17:30:00.000Z')
  })

  it('rejects malformed and impossible dates', () => {
    expect(localToUtcIso('2026-02-30', '09:00')).toBeNull()
    expect(localToUtcIso('2026-10-08', '9:00')).toBeNull()
    expect(localToUtcIso('', '09:00')).toBeNull()
    expect(localToUtcIso('2026-10-08', '24:00')).toBeNull()
  })

  it('builds start and end from a duration', () => {
    expect(buildSchedule({ date: '2026-10-08', time: '09:00', durationMinutes: 90 })).toEqual({
      scheduledStart: '2026-10-08T02:00:00.000Z',
      scheduledEnd: '2026-10-08T03:30:00.000Z',
    })
    expect(buildSchedule({ date: 'x', time: '09:00', durationMinutes: 30 })).toBeNull()
  })

  it('reads a stored schedule back in local time', () => {
    expect(scheduleFromMeeting({ scheduledStart: '2026-10-08T02:00:00Z', scheduledEnd: '2026-10-08T02:45:00Z' }))
      .toEqual({ date: '2026-10-08', time: '09:00', durationMinutes: 45 })
    expect(scheduleFromMeeting({ scheduledStart: '2026-10-08T02:00:00Z' }))
      .toEqual({ date: '2026-10-08', time: '09:00', durationMinutes: 30 })
    expect(scheduleFromMeeting({})).toBeNull()
  })

  it('defaults to the next half hour', () => {
    expect(defaultSchedule(new Date('2026-10-08T02:10:00Z'))).toEqual({ date: '2026-10-08', time: '09:30', durationMinutes: 30 })
    expect(defaultSchedule(new Date('2026-10-08T02:30:00Z'))).toEqual({ date: '2026-10-08', time: '10:00', durationMinutes: 30 })
    expect(defaultSchedule(new Date('2026-10-08T16:50:00Z'))).toEqual({ date: '2026-10-09', time: '00:00', durationMinutes: 30 })
  })

  it('labels the zone with its offset', () => {
    expect(timeZoneLabel('en', new Date('2026-10-08T02:00:00Z'))).toBe('GMT+7')
  })
})

describe('durations', () => {
  it('keeps a custom stored duration selectable', () => {
    expect(durationOptions()).toEqual([15, 30, 45, 60, 90, 120, 180, 240])
    expect(durationOptions(50)).toEqual([15, 30, 45, 50, 60, 90, 120, 180, 240])
    expect(durationOptions(60)).toHaveLength(8)
  })

  it('splits minutes for display', () => {
    expect(splitDuration(90)).toEqual({ hours: 1, minutes: 30 })
    expect(splitDuration(45)).toEqual({ hours: 0, minutes: 45 })
  })
})

describe('formatMeetingRange', () => {
  it('uses the locale and never a hardcoded pattern', () => {
    const en = formatMeetingRange('en', '2026-10-08T02:00:00Z', '2026-10-08T03:00:00Z')
    expect(en).toContain('9:00')
    expect(en).toContain('10:00')
    expect(formatMeetingRange('vi', '2026-10-08T02:00:00Z')).toContain('09:00')
  })
})
```

- [ ] **Step 2: Test** — `ML/__tests__/meeting-form.test.ts`

```ts
import { afterAll, beforeAll, describe, it, expect } from 'vitest'
import type { Meeting } from '@/lib/api/meeting-types'
import { DEFAULT_MEETING_SETTINGS } from '@/lib/api/meeting-types'
import {
  emptyMeetingForm, formFromMeeting, toMeetingInput, validateMeetingForm, type MeetingFormValues,
} from '@/lib/meetings/meeting-form'

const previousTz = process.env.TZ
beforeAll(() => { process.env.TZ = 'Asia/Ho_Chi_Minh' })
afterAll(() => { process.env.TZ = previousTz })

const NOW = new Date('2026-10-08T02:10:00Z') // 09:10 local

function form(over: Partial<MeetingFormValues> = {}): MeetingFormValues {
  return { ...emptyMeetingForm(NOW), ...over }
}
function meeting(over: Partial<Meeting> = {}): Meeting {
  return { id: 'm1', code: 'abc-defg-hjk', title: 'Weekly', description: 'Agenda',
    host: { userId: 'h' }, invitees: [{ userId: 'a', displayName: 'An' }], departmentId: 'd1',
    scheduledStart: '2026-10-09T02:00:00Z', scheduledEnd: '2026-10-09T03:00:00Z', status: 'SCHEDULED',
    settings: { ...DEFAULT_MEETING_SETTINGS, waitingRoom: false }, viewerRole: 'host',
    createdAt: '2026-10-07T00:00:00Z', ...over }
}

describe('validateMeetingForm', () => {
  it('accepts an empty instant meeting', () => {
    expect(validateMeetingForm(form(), NOW)).toEqual({})
  })

  it('enforces the contract limits', () => {
    const errors = validateMeetingForm(form({
      title: 'x'.repeat(121), description: 'y'.repeat(2001),
      invitees: Array.from({ length: 101 }, (_, i) => ({ userId: `u${i}` })),
    }), NOW)
    expect(errors).toEqual({
      title: { key: 'valTitleTooLong', values: { max: 120 } },
      description: { key: 'valDescriptionTooLong', values: { max: 2000 } },
      invitees: { key: 'valTooManyInvitees', values: { max: 100 } },
    })
    expect(validateMeetingForm(form({ title: `  ${'x'.repeat(120)}  ` }), NOW)).toEqual({})
  })

  it('checks a new schedule but allows the 5-minute grace', () => {
    const at = (time: string) => form({ scheduled: true, schedule: { date: '2026-10-08', time, durationMinutes: 30 } })
    expect(validateMeetingForm(at('09:00'), NOW).schedule).toEqual({ key: 'valStartPast' })
    expect(validateMeetingForm(at('09:06'), NOW)).toEqual({})
    expect(validateMeetingForm(form({ scheduled: true, schedule: { date: '2026-02-30', time: '09:00', durationMinutes: 30 } }), NOW).schedule)
      .toEqual({ key: 'valScheduleInvalid' })
    expect(validateMeetingForm(form({ scheduled: true, schedule: { date: '2026-10-09', time: '09:00', durationMinutes: 1441 } }), NOW).schedule)
      .toEqual({ key: 'valScheduleInvalid' })
  })

  it('does not re-check an unchanged schedule that has already passed, nor a LIVE one', () => {
    const past = meeting({ scheduledStart: '2026-10-08T01:00:00Z', scheduledEnd: '2026-10-08T02:00:00Z' })
    expect(validateMeetingForm(formFromMeeting(past, 'edit', NOW), NOW, past)).toEqual({})
    const live = meeting({ status: 'LIVE' })
    const edited = { ...formFromMeeting(live, 'edit', NOW), schedule: { date: '2026-10-08', time: '08:00', durationMinutes: 30 } }
    expect(validateMeetingForm(edited, NOW, live)).toEqual({})
  })
})

describe('toMeetingInput — create', () => {
  it('sends only the settings for an untouched form', () => {
    expect(toMeetingInput(form())).toEqual({ settings: DEFAULT_MEETING_SETTINGS })
  })

  it('sends a trimmed title, unique invitees, the department and a UTC schedule', () => {
    expect(toMeetingInput(form({
      title: '  Sprint review ', description: 'Demo', departmentId: 'd1',
      invitees: [{ userId: 'a' }, { userId: 'b' }, { userId: 'a' }],
      scheduled: true, schedule: { date: '2026-10-09', time: '14:00', durationMinutes: 60 },
    }))).toEqual({
      title: 'Sprint review', description: 'Demo', inviteeIds: ['a', 'b'], departmentId: 'd1',
      scheduledStart: '2026-10-09T07:00:00.000Z', scheduledEnd: '2026-10-09T08:00:00.000Z',
      settings: DEFAULT_MEETING_SETTINGS,
    })
  })
})

describe('toMeetingInput — edit (PATCH)', () => {
  it('clears fields with empty strings and always replaces invitees', () => {
    const m = meeting()
    const v = { ...formFromMeeting(m, 'edit', NOW), title: '', description: '', departmentId: '', invitees: [] }
    expect(toMeetingInput(v, m)).toEqual({
      title: '', description: '', departmentId: '', inviteeIds: [],
      settings: { ...DEFAULT_MEETING_SETTINGS, waitingRoom: false },
    })
  })

  it('sends the schedule only when it changed and the meeting is not LIVE', () => {
    const m = meeting()
    const moved = { ...formFromMeeting(m, 'edit', NOW), schedule: { date: '2026-10-09', time: '10:00', durationMinutes: 60 } }
    expect(toMeetingInput(moved, m)).toMatchObject({
      scheduledStart: '2026-10-09T03:00:00.000Z', scheduledEnd: '2026-10-09T04:00:00.000Z',
    })
    expect(toMeetingInput(formFromMeeting(m, 'edit', NOW), m)).not.toHaveProperty('scheduledStart')
    expect(toMeetingInput(moved, meeting({ status: 'LIVE' }))).not.toHaveProperty('scheduledStart')
  })
})

describe('formFromMeeting', () => {
  it('"meet again" copies people and options but starts now', () => {
    const v = formFromMeeting(meeting({ status: 'ENDED' }), 'again', NOW)
    expect(v).toMatchObject({ title: 'Weekly', description: 'Agenda', departmentId: 'd1', scheduled: false,
      invitees: [{ userId: 'a', displayName: 'An' }] })
    expect(v.settings.waitingRoom).toBe(false)
  })

  it('"edit" loads the stored schedule in local time', () => {
    expect(formFromMeeting(meeting(), 'edit', NOW)).toMatchObject({
      scheduled: true, schedule: { date: '2026-10-09', time: '09:00', durationMinutes: 60 },
    })
  })
})
```

- [ ] **Step 3: RED** — `VT lib/meetings/__tests__/schedule.test.ts lib/meetings/__tests__/meeting-form.test.ts`
- [ ] **Step 4: Hiện thực**
  - `localToUtcIso`: regex `^\d{4}-\d{2}-\d{2}$` / `^([01]\d|2[0-3]):[0-5]\d$`; `new Date(y, m - 1, d, hh, mm)`; kiểm lại `getFullYear/getMonth/getDate/getHours/getMinutes` khớp (bắt ngày 30/2 và giờ rơi vào khoảng trống DST); `toISOString()`.
  - Định dạng ngày local `YYYY-MM-DD` bằng `getFullYear()`… + `padStart`, **không** `toISOString().slice` (sẽ ra ngày UTC).
  - `formatMeetingRange`: `new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })` + `.formatRange(start, end)` khi có end.
  - `toMeetingInput`: tạo mới — bỏ `title`/`description` rỗng sau trim (description giữ nguyên văn nếu không rỗng), `inviteeIds` bỏ trùng và chỉ gửi khi có, `departmentId` khi khác `''`, `settings` luôn gửi đủ 5. PATCH — `title`/`description`/`departmentId`: gửi giá trị mới khi khác bản gốc, gửi `''` khi xoá; `inviteeIds` luôn gửi; lịch chỉ khi `original.status !== 'LIVE'` và ISO mới khác ISO gốc (so sánh `Date.parse`).
- [ ] **Step 5: GREEN** — `VT lib/meetings/__tests__/schedule.test.ts lib/meetings/__tests__/meeting-form.test.ts lib/__tests__/i18n-parity.test.ts && TSC`
- [ ] **Step 6: Commit** `feat(web): meeting schedule (local ⇄ UTC) and form validation`

---

### Task 6: Mã cuộc họp, điểm danh, quyền UI

**Files:**
- Create: `ML/meeting-code.ts`, `ML/attendance.ts`, `ML/permissions.ts`
- Test: `ML/__tests__/meeting-code.test.ts`, `ML/__tests__/attendance.test.ts`, `ML/__tests__/permissions.test.ts`

**Interfaces — Produces:**

```ts
// meeting-code.ts
export const MEETING_CODE_RE: RegExp               // /^[a-hjkmnp-z]{3}-[a-hjkmnp-z]{4}-[a-hjkmnp-z]{3}$/
/** Code or pasted link → canonical "abc-defg-hjk", or null. Case/space/dash-insensitive like the server. */
export function parseMeetingCodeInput(raw: string): string | null
export function meetingPath(code: string): string    // `/meet/${code}`
export function meetingLink(code: string, origin: string): string

// attendance.ts
export interface AttendanceSummary {
  userId: string; displayName?: string; role: MeetingRoomRole
  firstJoinedAt: string; lastLeftAt?: string; totalSeconds: number; sessions: number; inside: boolean
}
/** One row per person: overlapping sessions (two devices) counted once; open rows run until endedAt ?? now. */
export function summarizeAttendance(rows: MeetingAttendance[] | undefined, now: Date, endedAt?: string): AttendanceSummary[]

// permissions.ts
export function isManager(role: MeetingRoomRole | MeetingViewerRole | undefined): boolean   // host | cohost
export interface DetailActions { join: boolean; copyLink: boolean; edit: boolean; cancel: boolean; end: boolean; meetAgain: boolean }
export function detailActions(m: Meeting, canHost: boolean): DetailActions
/** Records (notes, chat, attendance) are worth fetching: not a guest. Server still decides (403 handled). */
export function canSeeRecords(m: Meeting): boolean
export function canEditSharedNote(role: MeetingRoomRole | MeetingViewerRole, settings: MeetingSettings): boolean
export type PrejoinIntent = 'join' | 'ask' | 'locked'
export function prejoinIntent(m: Meeting): PrejoinIntent
export function myRoomRole(roster: RosterEntry[] | undefined, myId: string, fallback: MeetingRoomRole): MeetingRoomRole
export interface PersonTarget { userId: string; role: MeetingRoomRole; handRaised: boolean; micOn: boolean }
/** Per-person host menu, in display order. Empty ⇒ no menu. */
export function personActions(myRole: MeetingRoomRole, myId: string, target: PersonTarget): HostAction[]
export interface RoomControls { muteAll: true; lowerAllHands: boolean; lock: 'LOCK' | 'UNLOCK';
  waitingRoom: 'WAITING_ROOM_ON' | 'WAITING_ROOM_OFF'; screenShare: 'ATTENDEE_SCREEN_SHARE_ON' | 'ATTENDEE_SCREEN_SHARE_OFF' }
/** Room-wide host controls (the command each switch would send now), or null for attendees. */
export function roomControls(myRole: MeetingRoomRole, settings: MeetingSettings, anyHands: boolean): RoomControls | null
export function canShareScreen(myRole: MeetingRoomRole, settings: MeetingSettings): boolean
```

- [ ] **Step 1: Test** — `ML/__tests__/meeting-code.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { meetingLink, meetingPath, parseMeetingCodeInput } from '@/lib/meetings/meeting-code'

describe('parseMeetingCodeInput', () => {
  it.each([
    ['abc-defg-hjk', 'abc-defg-hjk'],
    ['ABC-DEFG-HJK', 'abc-defg-hjk'],
    ['abcdefghjk', 'abc-defg-hjk'],
    ['  abc defg hjk ', 'abc-defg-hjk'],
    ['https://pon.example.com/meet/abc-defg-hjk', 'abc-defg-hjk'],
    ['https://pon.example.com/meet/abc-defg-hjk?x=1#y', 'abc-defg-hjk'],
    ['/meet/ABCDEFGHJK', 'abc-defg-hjk'],
  ])('%s → %s', (raw, code) => {
    expect(parseMeetingCodeInput(raw)).toBe(code)
  })

  it.each(['', 'abc', 'abc-defg-hji', 'abc-defg-hjl', 'abc-defg-hjo', 'abc-defg-hj1', 'https://evil.com/x'])(
    'rejects %s', (raw) => {
      expect(parseMeetingCodeInput(raw)).toBeNull()
    })

  it('builds the path and the shareable link', () => {
    expect(meetingPath('abc-defg-hjk')).toBe('/meet/abc-defg-hjk')
    expect(meetingLink('abc-defg-hjk', 'https://pon.example.com')).toBe('https://pon.example.com/meet/abc-defg-hjk')
  })
})
```

- [ ] **Step 2: Test** — `ML/__tests__/attendance.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { summarizeAttendance } from '@/lib/meetings/attendance'

const NOW = new Date('2026-10-08T03:00:00Z')

describe('summarizeAttendance', () => {
  it('merges sessions per person and sums their time', () => {
    const out = summarizeAttendance([
      { userId: 'a', displayName: 'An', role: 'host', joinedAt: '2026-10-08T02:00:00Z', leftAt: '2026-10-08T02:10:00Z' },
      { userId: 'b', role: 'attendee', joinedAt: '2026-10-08T02:05:00Z', leftAt: '2026-10-08T02:06:00Z' },
      { userId: 'a', displayName: 'An', role: 'host', joinedAt: '2026-10-08T02:20:00Z', leftAt: '2026-10-08T02:30:00Z' },
    ], NOW)
    expect(out).toEqual([
      { userId: 'a', displayName: 'An', role: 'host', firstJoinedAt: '2026-10-08T02:00:00Z',
        lastLeftAt: '2026-10-08T02:30:00Z', totalSeconds: 1200, sessions: 2, inside: false },
      { userId: 'b', role: 'attendee', firstJoinedAt: '2026-10-08T02:05:00Z',
        lastLeftAt: '2026-10-08T02:06:00Z', totalSeconds: 60, sessions: 1, inside: false },
    ])
  })

  it('counts overlapping sessions from two devices once', () => {
    const [a] = summarizeAttendance([
      { userId: 'a', role: 'attendee', joinedAt: '2026-10-08T02:00:00Z', leftAt: '2026-10-08T02:30:00Z' },
      { userId: 'a', role: 'attendee', joinedAt: '2026-10-08T02:10:00Z', leftAt: '2026-10-08T02:20:00Z' },
    ], NOW)
    expect(a.totalSeconds).toBe(1800)
  })

  it('runs an open session until the end of the meeting, or now', () => {
    const rows = [{ userId: 'a', role: 'cohost' as const, joinedAt: '2026-10-08T02:50:00Z' }]
    expect(summarizeAttendance(rows, NOW)[0]).toMatchObject({ totalSeconds: 600, inside: true })
    expect(summarizeAttendance(rows, NOW, '2026-10-08T02:55:00Z')[0]).toMatchObject({ totalSeconds: 300, inside: false })
  })

  it('keeps the highest role and the latest name', () => {
    const [a] = summarizeAttendance([
      { userId: 'a', role: 'attendee', joinedAt: '2026-10-08T02:00:00Z', leftAt: '2026-10-08T02:01:00Z' },
      { userId: 'a', displayName: 'An', role: 'cohost', joinedAt: '2026-10-08T02:02:00Z', leftAt: '2026-10-08T02:03:00Z' },
    ], NOW)
    expect(a).toMatchObject({ role: 'cohost', displayName: 'An' })
    expect(summarizeAttendance(undefined, NOW)).toEqual([])
  })
})
```

- [ ] **Step 3: Test** — `ML/__tests__/permissions.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import type { Meeting, MeetingSettings } from '@/lib/api/meeting-types'
import { DEFAULT_MEETING_SETTINGS } from '@/lib/api/meeting-types'
import {
  canEditSharedNote, canSeeRecords, canShareScreen, detailActions, isManager, myRoomRole,
  personActions, prejoinIntent, roomControls,
} from '@/lib/meetings/permissions'

const S: MeetingSettings = DEFAULT_MEETING_SETTINGS
function meeting(over: Partial<Meeting> = {}): Meeting {
  return { id: 'm1', code: 'abc-defg-hjk', host: { userId: 'h' }, status: 'SCHEDULED', settings: S,
    viewerRole: 'host', createdAt: '2026-10-07T00:00:00Z', ...over }
}

describe('detailActions', () => {
  it('host of a scheduled meeting nobody joined: join, copy, edit, cancel', () => {
    expect(detailActions(meeting(), true)).toEqual({ join: true, copyLink: true, edit: true, cancel: true, end: false, meetAgain: false })
  })

  it('cannot cancel once someone joined or when LIVE; managers can end a LIVE meeting', () => {
    const joined = meeting({ attendance: [{ userId: 'a', role: 'attendee', joinedAt: 't' }] })
    expect(detailActions(joined, true).cancel).toBe(false)
    expect(detailActions(meeting({ status: 'LIVE', viewerRole: 'cohost' }), false))
      .toMatchObject({ join: true, edit: true, cancel: false, end: true })
  })

  it('invitees and guests only join and copy', () => {
    for (const viewerRole of ['invited', 'guest'] as const) {
      expect(detailActions(meeting({ status: 'LIVE', viewerRole }), true))
        .toEqual({ join: true, copyLink: true, edit: false, cancel: false, end: false, meetAgain: false })
    }
  })

  it('an ended meeting offers "meet again" to its hosts who can still host', () => {
    expect(detailActions(meeting({ status: 'ENDED' }), true))
      .toEqual({ join: false, copyLink: false, edit: false, cancel: false, end: false, meetAgain: true })
    expect(detailActions(meeting({ status: 'ENDED' }), false).meetAgain).toBe(false)
    expect(detailActions(meeting({ status: 'ENDED', viewerRole: 'invited' }), true).meetAgain).toBe(false)
  })
})

describe('notes and records', () => {
  it('guests see no records', () => {
    expect(canSeeRecords(meeting({ viewerRole: 'guest' }))).toBe(false)
    expect(canSeeRecords(meeting({ viewerRole: 'invited' }))).toBe(true)
  })

  it('managers always edit shared notes, others only when allowed', () => {
    const closed = { ...S, attendeesCanEditNotes: false }
    expect(canEditSharedNote('host', closed)).toBe(true)
    expect(canEditSharedNote('cohost', closed)).toBe(true)
    expect(canEditSharedNote('attendee', closed)).toBe(false)
    expect(canEditSharedNote('invited', S)).toBe(true)
    expect(canEditSharedNote('guest', closed)).toBe(false)
  })
})

describe('prejoinIntent', () => {
  it('invited people join, strangers ask or are locked out', () => {
    expect(prejoinIntent(meeting({ viewerRole: 'invited' }))).toBe('join')
    expect(prejoinIntent(meeting({ viewerRole: 'cohost', settings: { ...S, locked: true } }))).toBe('join')
    expect(prejoinIntent(meeting({ viewerRole: 'guest' }))).toBe('ask')
    expect(prejoinIntent(meeting({ viewerRole: 'guest', settings: { ...S, waitingRoom: false } }))).toBe('join')
    expect(prejoinIntent(meeting({ viewerRole: 'guest', settings: { ...S, locked: true } }))).toBe('locked')
  })
})

describe('room roles and host menus', () => {
  it('my role follows the roster, else the join role', () => {
    const roster = [{ userId: 'me', role: 'cohost' as const, joinedAt: 't' }]
    expect(myRoomRole(roster, 'me', 'attendee')).toBe('cohost')
    expect(myRoomRole([], 'me', 'attendee')).toBe('attendee')
    expect(myRoomRole(undefined, 'me', 'host')).toBe('host')
    expect(isManager('cohost')).toBe(true)
    expect(isManager('invited')).toBe(false)
  })

  const target = (over: Partial<{ userId: string; role: 'host' | 'cohost' | 'attendee'; handRaised: boolean; micOn: boolean }> = {}) =>
    ({ userId: 't', role: 'attendee' as const, handRaised: false, micOn: true, ...over })

  it('host can do everything to an attendee', () => {
    expect(personActions('host', 'me', target({ handRaised: true })))
      .toEqual(['MUTE_MIC', 'LOWER_HAND', 'MAKE_COHOST', 'REMOVE'])
  })

  it('host manages co-hosts; co-hosts only attendees; nobody targets the host or themselves', () => {
    expect(personActions('host', 'me', target({ role: 'cohost', micOn: false }))).toEqual(['REVOKE_COHOST', 'REMOVE'])
    expect(personActions('cohost', 'me', target())).toEqual(['MUTE_MIC', 'REMOVE'])
    expect(personActions('cohost', 'me', target({ role: 'cohost' }))).toEqual(['MUTE_MIC'])
    expect(personActions('cohost', 'me', target({ role: 'host', handRaised: true }))).toEqual(['MUTE_MIC', 'LOWER_HAND'])
    expect(personActions('host', 'me', target({ userId: 'me', role: 'host' }))).toEqual([])
    expect(personActions('attendee', 'me', target())).toEqual([])
  })

  it('room controls send the opposite of the current setting', () => {
    expect(roomControls('attendee', S, true)).toBeNull()
    expect(roomControls('cohost', S, false)).toEqual({ muteAll: true, lowerAllHands: false, lock: 'LOCK',
      waitingRoom: 'WAITING_ROOM_OFF', screenShare: 'ATTENDEE_SCREEN_SHARE_OFF' })
    expect(roomControls('host', { ...S, locked: true, waitingRoom: false, allowAttendeeScreenShare: false }, true))
      .toEqual({ muteAll: true, lowerAllHands: true, lock: 'UNLOCK', waitingRoom: 'WAITING_ROOM_ON',
        screenShare: 'ATTENDEE_SCREEN_SHARE_ON' })
  })

  it('attendees present only when allowed', () => {
    expect(canShareScreen('attendee', S)).toBe(true)
    expect(canShareScreen('attendee', { ...S, allowAttendeeScreenShare: false })).toBe(false)
    expect(canShareScreen('cohost', { ...S, allowAttendeeScreenShare: false })).toBe(true)
  })
})
```

Ghi chú hành vi `personActions` (khớp MT3): `MUTE_MIC` khi `micOn` và target ≠ mình (co-host được tắt mic cả host/co-host — server cho phép `MUTE_MIC` với host/co-host, chỉ `REMOVE`/`MAKE/REVOKE_COHOST` bị giới hạn); `LOWER_HAND` khi `handRaised` và target ≠ mình (tay mình hạ bằng nút Giơ tay); `MAKE_COHOST` chỉ host, target attendee; `REVOKE_COHOST` chỉ host, target co-host; `REMOVE` khi `outranks` (host ⇒ mọi người trừ host/mình; co-host ⇒ chỉ attendee).

- [ ] **Step 4: RED** · **Step 5: Hiện thực** — `parseMeetingCodeInput`: nếu chứa `/meet/` lấy đoạn sau tới `?`/`#`/`/`; chuỗi có `://` mà không chứa `/meet/` ⇒ null; lowercase, bỏ khoảng trắng và `-`; đúng 10 ký tự thuộc `[a-z]` trừ `i l o` ⇒ chèn gạch 3-4-3. `summarizeAttendance`: gom theo userId (giữ thứ tự `firstJoinedAt` tăng dần), gộp khoảng thời gian chồng nhau rồi cộng; `role` = cao nhất (host > cohost > attendee); `displayName` = của dòng muộn nhất có tên.
- [ ] **Step 6: GREEN** — `VT lib/meetings/__tests__/meeting-code.test.ts lib/meetings/__tests__/attendance.test.ts lib/meetings/__tests__/permissions.test.ts && TSC`
- [ ] **Step 7: Commit** `feat(web): meeting code parsing, attendance summary and UI permissions`

---
### Task 7: Query hooks + hàng đợi cá nhân `/user/queue/meeting` + áp sự kiện phòng vào cache

**Files:**
- Create: `ML/active-room.ts`, `ML/room-events.ts`, `W/lib/realtime/meeting-queue.ts`, `W/lib/hooks/use-meetings.ts`
- Modify: `W/lib/hooks/use-realtime-notifications.ts`, `W/messages/*.json` (khoá `notif*`, 7 locale)
- Test: `W/lib/realtime/__tests__/meeting-queue.test.ts`, `ML/__tests__/room-events.test.ts`

**Interfaces — Produces:**

```ts
// ML/active-room.ts — the one room page that is open (set by the controller in Task 15)
export interface ActiveMeetingRoom { meetingId: string; handle(e: MeetingEvent): void }
export function setActiveMeetingRoom(room: ActiveMeetingRoom | null): void
export function getActiveMeetingRoom(): ActiveMeetingRoom | null

// ML/room-events.ts — events of /topic/meeting/{id}
export interface RoomEventDeps {
  queryClient: QueryClient
  meetingId: string
  code?: string
  now: () => Date
  onRoster?(participants: RosterEntry[]): void
  onSettings?(settings: MeetingSettings): void
  onChat?(e: Extract<MeetingEvent, { event: 'meet.chat' }>): void
  onSharedNoteUpdated?(version: number, updatedBy?: MeetingPerson): void
  onEnded?(): void
}
export function applyRoomEvent(e: MeetingEvent, deps: RoomEventDeps): void
/** Shared by room-events and meeting-queue: ENDED in detail/byCode, out of upcoming, past marked stale. */
export function applyMeetingEnded(qc: QueryClient, meetingId: string, atIso: string, cancelled: boolean): void

// W/lib/realtime/meeting-queue.ts
export interface MeetingNotice { title: string; body: string; href: string }
export interface MeetingQueueContext {
  queryClient: QueryClient
  t: Translate            // `meeting` namespace
  locale: string
  now: () => Date
  notificationsEnabled: () => boolean
  notify(n: MeetingNotice): void          // OS notification when hidden, toast + action otherwise
  toastInfo(message: string): void
  activeRoom(): ActiveMeetingRoom | null
}
export function handleMeetingQueueEvent(e: MeetingEvent, ctx: MeetingQueueContext): void
```

Hành vi `handleMeetingQueueEvent`:
- `meet.invited` — chèn `invitedPlaceholder` vào `list('upcoming')` **chỉ khi chưa có** dòng cùng id (không đè bản thật); bật thông báo ⇒ `notify({title: notifInvitedTitle, body: notifInvitedBody(At), href: /meet/{code}})`. Tên host = `safeDisplayName(hostName, hostId) ?? t('someone')`, tiêu đề = `title?.trim() || t('untitled')`, giờ = `formatMeetingRange(locale, scheduledStart)`.
- `meet.starting` — `notify({notifStartingTitle, notifStartingBody{title,time}, /meet/{code}})`.
- `meet.cancelled` — đọc tiêu đề từ cache (`detail` → các trang list) **trước** khi vá; `applyMeetingEnded(…, cancelled=true)`; thông báo bật ⇒ `toastInfo(notifCancelled{title} | notifCancelledUnknown)`; chuyển cho phòng đang mở nếu khớp id.
- `meet.ended` (người đang chờ) — `applyMeetingEnded(…, false)`, chuyển cho phòng đang mở.
- `meet.lobby` — `setQueryData(lobby(id), waiting)` (luôn), chuyển cho phòng đang mở.
- `meet.admitted | meet.denied | meet.removed | meet.muted` — chỉ chuyển cho phòng đang mở khớp id.
- `meet.error` — chuyển cho phòng đang mở (khớp id, hoặc không có `meetingId`); không có phòng ⇒ bỏ qua.
- Sự kiện topic (`roster/settings/hands/chat/notes.updated`) tới nhầm hàng đợi ⇒ bỏ qua.

- [ ] **Step 1: Test** — `W/lib/realtime/__tests__/meeting-queue.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import type { Meeting, MeetingEvent, MeetingPage } from '@/lib/api/meeting-types'
import { DEFAULT_MEETING_SETTINGS } from '@/lib/api/meeting-types'
import { meetingKeys, type MeetingListData } from '@/lib/meetings/cache-updates'
import { handleMeetingQueueEvent, type MeetingQueueContext } from '@/lib/realtime/meeting-queue'

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}(${Object.values(values).join(',')})` : key

const NOW = new Date('2026-10-07T09:00:00Z')

function meeting(id: string, over: Partial<Meeting> = {}): Meeting {
  return { id, code: 'abc-defg-hjk', title: 'Weekly', host: { userId: 'h', displayName: 'Lan' },
    status: 'SCHEDULED', settings: DEFAULT_MEETING_SETTINGS, viewerRole: 'invited',
    createdAt: '2026-10-07T00:00:00Z', scheduledStart: '2026-10-08T02:00:00Z', ...over }
}
function seedUpcoming(qc: QueryClient, rows: Meeting[]) {
  const page: MeetingPage = { content: rows, page: 0, size: 20, totalElements: rows.length, hasNext: false }
  qc.setQueryData<MeetingListData>(meetingKeys.list('upcoming'), { pages: [page], pageParams: [undefined] })
}
const upcomingIds = (qc: QueryClient) =>
  qc.getQueryData<MeetingListData>(meetingKeys.list('upcoming'))?.pages.flatMap((p) => p.content.map((m) => m.id))

let qc: QueryClient
let ctx: MeetingQueueContext
let room: { meetingId: string; handle: ReturnType<typeof vi.fn> } | null

beforeEach(() => {
  qc = new QueryClient()
  room = null
  ctx = {
    queryClient: qc, t, locale: 'en', now: () => NOW,
    notificationsEnabled: () => true,
    notify: vi.fn(), toastInfo: vi.fn(),
    activeRoom: () => room,
  }
})

describe('invitations and reminders', () => {
  const invited: MeetingEvent = { event: 'meet.invited', meetingId: 'm2', code: 'xyz-wxyz-xyz',
    title: 'Planning', hostId: '64b0aaaaaaaaaaaaaaaaaaaa', hostName: 'Lan' }

  it('adds a placeholder row and notifies with the host name, linking to the room', () => {
    seedUpcoming(qc, [meeting('m1')])
    handleMeetingQueueEvent(invited, ctx)
    expect(upcomingIds(qc)).toEqual(['m1', 'm2'])
    expect(ctx.notify).toHaveBeenCalledWith({
      title: 'notifInvitedTitle', body: 'notifInvitedBody(Lan,Planning)', href: '/meet/xyz-wxyz-xyz',
    })
  })

  it('never shows the raw host id and falls back to generic labels', () => {
    handleMeetingQueueEvent({ ...invited, title: undefined, hostName: '64b0aaaaaaaaaaaaaaaaaaaa' }, ctx)
    const body = vi.mocked(ctx.notify).mock.calls[0][0].body
    expect(body).toBe('notifInvitedBody(someone,untitled)')
    expect(body).not.toContain('64b0')
  })

  it('does not overwrite a real row and stays silent when notifications are off', () => {
    const real = meeting('m2', { title: 'Real one' })
    seedUpcoming(qc, [real])
    ctx.notificationsEnabled = () => false
    handleMeetingQueueEvent(invited, ctx)
    expect(qc.getQueryData<MeetingListData>(meetingKeys.list('upcoming'))?.pages[0].content[0]).toBe(real)
    expect(ctx.notify).not.toHaveBeenCalled()
  })

  it('reminds with the start time', () => {
    handleMeetingQueueEvent({ event: 'meet.starting', meetingId: 'm1', code: 'abc-defg-hjk',
      title: 'Weekly', scheduledStart: '2026-10-08T02:00:00Z' }, ctx)
    const n = vi.mocked(ctx.notify).mock.calls[0][0]
    expect(n.title).toBe('notifStartingTitle')
    expect(n.body.startsWith('notifStartingBody(Weekly,')).toBe(true)
    expect(n.href).toBe('/meet/abc-defg-hjk')
  })
})

describe('cancellation and end', () => {
  it('drops a cancelled meeting from upcoming, marks the detail cancelled and names it', () => {
    seedUpcoming(qc, [meeting('m1'), meeting('m3')])
    qc.setQueryData(meetingKeys.detail('m1'), meeting('m1'))
    handleMeetingQueueEvent({ event: 'meet.cancelled', meetingId: 'm1' }, ctx)
    expect(upcomingIds(qc)).toEqual(['m3'])
    expect(qc.getQueryData<Meeting>(meetingKeys.detail('m1'))).toMatchObject({ status: 'ENDED', cancelledAt: NOW.toISOString() })
    expect(ctx.toastInfo).toHaveBeenCalledWith('notifCancelled(Weekly)')
  })

  it('uses a generic sentence when the meeting is not cached', () => {
    handleMeetingQueueEvent({ event: 'meet.cancelled', meetingId: 'zz' }, ctx)
    expect(ctx.toastInfo).toHaveBeenCalledWith('notifCancelledUnknown')
  })

  it('marks the past list stale without refetching it', () => {
    qc.setQueryData(meetingKeys.list('past'), { pages: [], pageParams: [] })
    handleMeetingQueueEvent({ event: 'meet.ended', meetingId: 'm1' }, ctx)
    expect(qc.getQueryState(meetingKeys.list('past'))?.isInvalidated).toBe(true)
  })
})

describe('room events', () => {
  it('stores the lobby and forwards room events to the open room only', () => {
    room = { meetingId: 'm1', handle: vi.fn() }
    const lobby: MeetingEvent = { event: 'meet.lobby', meetingId: 'm1', waiting: [{ userId: 'g', displayName: 'Guest' }] }
    handleMeetingQueueEvent(lobby, ctx)
    expect(qc.getQueryData(meetingKeys.lobby('m1'))).toEqual([{ userId: 'g', displayName: 'Guest' }])
    expect(room.handle).toHaveBeenCalledWith(lobby)

    handleMeetingQueueEvent({ event: 'meet.removed', meetingId: 'other' }, ctx)
    expect(room.handle).toHaveBeenCalledTimes(1)

    const err: MeetingEvent = { event: 'meet.error', errorCode: 'RATE_LIMITED' }
    handleMeetingQueueEvent(err, ctx)
    expect(room.handle).toHaveBeenLastCalledWith(err)
  })

  it('ignores room events when no room is open', () => {
    expect(() => handleMeetingQueueEvent({ event: 'meet.admitted', meetingId: 'm1' }, ctx)).not.toThrow()
    expect(ctx.notify).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Test** — `ML/__tests__/room-events.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import type { Meeting, MeetingMessagePage } from '@/lib/api/meeting-types'
import { DEFAULT_MEETING_SETTINGS } from '@/lib/api/meeting-types'
import { flattenMessages, meetingKeys, type MessageListData } from '@/lib/meetings/cache-updates'
import { applyRoomEvent, type RoomEventDeps } from '@/lib/meetings/room-events'

const NOW = new Date('2026-10-08T03:00:00Z')
const base: Meeting = { id: 'm1', code: 'abc-defg-hjk', host: { userId: 'h' }, status: 'LIVE',
  settings: DEFAULT_MEETING_SETTINGS, viewerRole: 'invited', createdAt: '2026-10-08T00:00:00Z' }

function deps(qc: QueryClient, over: Partial<RoomEventDeps> = {}): RoomEventDeps {
  return { queryClient: qc, meetingId: 'm1', code: 'abc-defg-hjk', now: () => NOW,
    onRoster: vi.fn(), onSettings: vi.fn(), onChat: vi.fn(), onSharedNoteUpdated: vi.fn(), onEnded: vi.fn(), ...over }
}

describe('applyRoomEvent', () => {
  it('ignores another meeting', () => {
    const qc = new QueryClient()
    const d = deps(qc)
    applyRoomEvent({ event: 'meet.hands', meetingId: 'other', hands: [] }, d)
    expect(qc.getQueryData(meetingKeys.hands('other'))).toBeUndefined()
  })

  it('replaces roster and hands', () => {
    const qc = new QueryClient()
    const d = deps(qc)
    const participants = [{ userId: 'a', role: 'cohost' as const, joinedAt: 't' }]
    applyRoomEvent({ event: 'meet.roster', meetingId: 'm1', participants }, d)
    expect(qc.getQueryData(meetingKeys.roster('m1'))).toEqual(participants)
    expect(d.onRoster).toHaveBeenCalledWith(participants)
    const hands = [{ userId: 'b', raisedAt: 't' }]
    applyRoomEvent({ event: 'meet.hands', meetingId: 'm1', hands }, d)
    expect(qc.getQueryData(meetingKeys.hands('m1'))).toEqual(hands)
  })

  it('patches settings into both detail caches', () => {
    const qc = new QueryClient()
    qc.setQueryData(meetingKeys.detail('m1'), base)
    qc.setQueryData(meetingKeys.byCode('abc-defg-hjk'), base)
    const settings = { ...DEFAULT_MEETING_SETTINGS, allowAttendeeScreenShare: false }
    applyRoomEvent({ event: 'meet.settings', meetingId: 'm1', settings }, deps(qc))
    expect(qc.getQueryData<Meeting>(meetingKeys.detail('m1'))?.settings).toEqual(settings)
    expect(qc.getQueryData<Meeting>(meetingKeys.byCode('abc-defg-hjk'))?.settings).toEqual(settings)
  })

  it('appends chat lines to the history cache and reports them', () => {
    const qc = new QueryClient()
    const page: MeetingMessagePage = { content: [], page: 0, size: 50, totalElements: 0, hasNext: false }
    qc.setQueryData<MessageListData>(meetingKeys.messages('m1'), { pages: [page], pageParams: [undefined] })
    const d = deps(qc)
    const e = { event: 'meet.chat' as const, meetingId: 'm1', clientId: 'c-1',
      message: { id: 'x', sender: { userId: 'a' }, content: 'hi', createdAt: 't' } }
    applyRoomEvent(e, d)
    expect(flattenMessages(qc.getQueryData(meetingKeys.messages('m1'))).map((m) => m.id)).toEqual(['x'])
    expect(d.onChat).toHaveBeenCalledWith(e)
  })

  it('signals shared-note updates and the end of the meeting', () => {
    const qc = new QueryClient()
    qc.setQueryData(meetingKeys.detail('m1'), base)
    const d = deps(qc)
    applyRoomEvent({ event: 'meet.notes.updated', meetingId: 'm1', version: 4, updatedBy: { userId: 'u', displayName: 'U' } }, d)
    expect(d.onSharedNoteUpdated).toHaveBeenCalledWith(4, { userId: 'u', displayName: 'U' })
    applyRoomEvent({ event: 'meet.ended', meetingId: 'm1' }, d)
    expect(qc.getQueryData<Meeting>(meetingKeys.detail('m1'))).toMatchObject({ status: 'ENDED', endedAt: NOW.toISOString() })
    expect(d.onEnded).toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: RED** — `VT lib/realtime/__tests__/meeting-queue.test.ts lib/meetings/__tests__/room-events.test.ts`
- [ ] **Step 4: Hiện thực** `active-room.ts`, `room-events.ts`, `meeting-queue.ts` theo hành vi trên (`applyMeetingEnded`: `setQueryData(detail)` + `setQueryData(byCode)` cho mọi query `['meeting-code', *]` có `id` khớp — dùng `qc.setQueriesData({ queryKey: ['meeting-code'] }, …)`; `removeFromList` upcoming; `invalidateQueries({ queryKey: meetingKeys.list('past'), refetchType: 'none' })`).
- [ ] **Step 5: Hiện thực** `W/lib/hooks/use-meetings.ts` (không unit test — `TSC` + checklist Task 23):

```ts
const noRetryOnClientError = (count: number, err: unknown) => {
  const s = parseMeetingError(err).status
  return !(s && s >= 400 && s < 500) && count < 2
}
export function useMeetingList(scope: MeetingListScope)       // useInfiniteQuery, initialPageParam undefined,
                                                              // getNextPageParam: last.hasNext ? last.content.at(-1)?.id : undefined
export function useMeeting(id: string | undefined)            // enabled: !!id, retry: noRetryOnClientError
export function useMeetingByCode(code: string | null)         // same, key byCode(code)
export function useMeetingRoster(id: string, enabled: boolean) // queryFn: GET meeting → setQueryData(detail) → rosterFromMeeting; staleTime: Infinity
export function useMeetingHands(id: string, enabled: boolean)  // queryFn meetingsApi.hands; staleTime: Infinity
export function useMeetingLobby(id: string)                   // useQuery({ queryKey: lobby(id), queryFn: () => [], enabled: false, initialData: [] })
export function useMeetingMessages(id: string, enabled: boolean) // infinite; before = oldest id of last page
export function useMeetingNote(id: string, scope: NoteScope, enabled: boolean)
export function useCreateMeeting()   // onSuccess(m): setQueryData(detail, byCode) + upsertUpcoming
export function useUpdateMeeting(id: string)  // onSuccess(m): same + replaceInList(past)
export function useCancelMeeting(meeting: Meeting) // onSuccess: applyMeetingEnded(cancelled=true)
export function useEndMeeting(meeting: Meeting)    // onSuccess: applyMeetingEnded(cancelled=false)
```

Không mutation nào gọi `invalidateQueries` có refetch (rule web); lỗi để component map qua `meetingErrorMessage`.

- [ ] **Step 6: Nối vào `useRealtimeNotifications`** — thêm `meetingCtxRef` (cập nhật mỗi render như `contextRef`, dùng `useTranslations('meeting')`, `useLocale()`), và trong effect subscription bền:

```ts
const offMeeting = stompService.subscribeDurable('/user/queue/meeting', (frame) => {
  const event = parseMeetingEvent(frame.body)
  const mctx = meetingCtxRef.current
  if (event && mctx) handleMeetingQueueEvent(event, mctx)
})
// cleanup: offMeeting()
```

`notify` dùng lại đúng logic `showNotification` hiện có (tab ẩn + `Notification.permission === 'granted'` ⇒ `new Notification(title, { body })`, click ⇒ `window.focus(); router.push(href)`; ngược lại `toast(title, { description: body, action: { label: t('notifOpen'), onClick } })`) — tách helper `presentNotice(title, body, open, actionLabel)` dùng chung cho cả tin nhắn và cuộc họp, không nhân bản. `activeRoom: getActiveMeetingRoom`. Thêm khoá `notif*` 7 locale.
- [ ] **Step 7: GREEN** — `VT lib/realtime lib/meetings lib/__tests__/i18n-parity.test.ts && TSC`; `wc -l lib/hooks/use-realtime-notifications.ts` ≤ 400 (hiện 167).
- [ ] **Step 8: Commit** `feat(web): meeting queries and realtime invitations, reminders, cancellations`

---

### Task 8: Quay lại link họp sau khi đăng nhập

**Files:**
- Create: `W/lib/auth/return-path.ts`
- Modify: `W/middleware.ts`, `W/lib/auth/sign-in.ts`
- Test: `W/lib/auth/__tests__/return-path.test.ts`

**Interfaces — Produces:**

```ts
export const RETURN_PATH_COOKIE = 'pon_return_to'
export const RETURN_PATH_MAX_AGE = 600 // seconds
/** Only the two meeting entry points, same origin, no traversal. */
export function isSafeReturnPath(path: string): boolean
/** Read + delete the cookie in the browser; null when absent/unsafe/SSR. */
export function consumeReturnPath(doc?: Pick<Document, 'cookie'>): string | null
```

`isSafeReturnPath`: khớp `^/meet/[a-z-]{10,14}$` hoặc `^/meetings(/[A-Za-z0-9]{1,64})?$` — không `//`, không `\`, không `..`, không scheme.

- [ ] **Step 1: Test**

```ts
import { describe, it, expect } from 'vitest'
import { consumeReturnPath, isSafeReturnPath, RETURN_PATH_COOKIE } from '@/lib/auth/return-path'

describe('isSafeReturnPath', () => {
  it.each(['/meet/abc-defg-hjk', '/meetings', '/meetings/670f1c2ab9e4d21f0c3a9e11'])('allows %s', (p) => {
    expect(isSafeReturnPath(p)).toBe(true)
  })
  it.each(['//evil.com', 'https://evil.com/meet/abc-defg-hjk', '/meet/../admin', '/admin', '/meet/abc-defg-hjk/x',
    '/\\evil.com', '/meetings/a/b', ''])('rejects %s', (p) => {
    expect(isSafeReturnPath(p)).toBe(false)
  })
})

describe('consumeReturnPath', () => {
  it('returns a safe path once and clears the cookie', () => {
    const writes: string[] = []
    let jar = `a=1; ${RETURN_PATH_COOKIE}=${encodeURIComponent('/meet/abc-defg-hjk')}`
    const doc = {
      get cookie() { return jar },
      set cookie(v: string) { writes.push(v); jar = 'a=1' },
    }
    expect(consumeReturnPath(doc)).toBe('/meet/abc-defg-hjk')
    expect(writes[0]).toContain(`${RETURN_PATH_COOKIE}=;`)
    expect(writes[0]).toContain('Max-Age=0')
    expect(consumeReturnPath(doc)).toBeNull()
  })

  it('drops an unsafe value', () => {
    const doc = { cookie: `${RETURN_PATH_COOKIE}=${encodeURIComponent('//evil.com')}` }
    expect(consumeReturnPath(doc)).toBeNull()
  })
})
```

- [ ] **Step 2: RED** · **Step 3: Hiện thực**
  - `middleware.ts`: ở nhánh `!hasSession && !isAuthOnly`, nếu `isSafeReturnPath(pathname)` thì `res.cookies.set(RETURN_PATH_COOKIE, pathname, { path: '/', maxAge: RETURN_PATH_MAX_AGE, sameSite: 'lax', secure: request.nextUrl.protocol === 'https:' })` trên response redirect. (Middleware chạy edge — `return-path.ts` không import gì của trình duyệt ở top-level.) Không httpOnly vì client đọc; giá trị đã giới hạn bởi regex.
  - `sign-in.ts` `establishSession`: `if (!mustSetPassword(user)) { const back = consumeReturnPath(); if (back) return back }` rồi `return postSignInPath(user)`. Tài khoản phải đặt mật khẩu vẫn đi `/set-password` (cookie còn hạn 10 phút — không xử lý tiếp, chấp nhận).
- [ ] **Step 4: GREEN** — `VT lib/auth && TSC`
- [ ] **Step 5: Commit** `feat(web): return to the meeting link after signing in`

---

### Task 9: Mục điều hướng "Phòng họp" + toàn màn hình cho `/meet/*`

**Files:**
- Modify: `W/app/(main)/layout.tsx`, `W/components/layout/MobileTabBar.tsx`, `W/messages/*.json` (`layout.navMeetings`, `layout.tabMeetings`)
- Test: `W/components/layout/__tests__/MobileTabBar.test.tsx`

- [ ] **Step 1: Test** — `W/components/layout/__tests__/MobileTabBar.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ usePathname: () => '/meetings/670f1c2ab9e4d21f0c3a9e11' }))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

import { MobileTabBar } from '@/components/layout/MobileTabBar'

describe('MobileTabBar', () => {
  it('has a Meetings tab that is active on meeting pages', () => {
    render(<MobileTabBar />)
    const link = screen.getByRole('link', { name: 'tabMeetings' })
    expect(link.getAttribute('href')).toBe('/meetings')
    expect(link.getAttribute('aria-current')).toBe('page')
    expect(screen.getAllByRole('link')).toHaveLength(5)
  })
})
```

- [ ] **Step 2: RED** · **Step 3: Hiện thực**
  - `MobileTabBar`: thêm `{ key: 'meetings', href: '/meetings', icon: Video, labelKey: 'tabMeetings' }` giữa `friends` và `explore`; thêm `aria-current={active ? 'page' : undefined}` cho mọi tab (a11y, không đổi giao diện). `isActive('/meetings')` dùng `startsWith` sẵn có (không khớp `/meet/`).
  - `layout.tsx`: `const isMeetingRoom = /^\/meet\//.test(pathname)`; `showTabBar = !isMessagingArea && !isMeetingRoom`. Header sidebar: thêm nút icon `Video` (`asChild` → `<Link href="/meetings">`, `title={t('navMeetings')}`, `aria-label` cùng giá trị, cùng class với nút Danh bạ) đặt **trước** nút Danh bạ. Hiện cho mọi người (vào họp không cần capability).
  - Khoá `layout.navMeetings`, `layout.tabMeetings` 7 locale.
- [ ] **Step 4: GREEN** — `VT components/layout lib/__tests__/i18n-parity.test.ts && TSC`
- [ ] **Step 5: Commit** `feat(web): meetings navigation entry`

---
### Task 10: Trang `/meetings` + dialog Lên lịch / Sửa / Họp lại

**Files:**
- Create: `W/app/(main)/meetings/page.tsx`, `MC/MeetingsHeader.tsx`, `MC/JoinByCodeForm.tsx`, `MC/MeetingList.tsx`, `MC/MeetingRow.tsx`, `MC/MeetingStatusBadge.tsx`, `MC/CopyLinkButton.tsx`, `MC/MeetingFormDialog.tsx`, `MC/MeetingScheduleFields.tsx`, `MC/InviteePicker.tsx`, `MC/MeetingSettingsFields.tsx`
- Modify: `W/messages/*.json` (khoá Task 10 ở bảng i18n, 7 locale)

**Hành vi:**

`page.tsx` (`'use client'`, ≤ 120 dòng): khung giống các trang full-width khác (`flex-1 overflow-y-auto`, nội dung `mx-auto w-full max-w-3xl px-4 py-6 md:px-6 pb-24 md:pb-6` — chừa `MobileTabBar`). Tiêu đề trang `text-2xl font-semibold tracking-tight` + `subtitle` `text-sm text-muted-foreground`. `Tabs` (shadcn) Sắp tới / Đã qua — tab nhớ trong `?tab=past` (`useSearchParams` + `router.replace`, không localStorage). Mỗi tab render `<MeetingList scope=…/>`. State dialog `{ mode: 'create' | 'edit' | 'again'; meeting?: Meeting } | null` giữ ở page.

`MeetingsHeader` (≤ 120 dòng): `const canHost = useHasCapability('HOST_MEETING')`.
- **Họp ngay** (`Button` default, icon `Video`) chỉ khi `canHost`: `useCreateMeeting().mutate({})` → thành công `router.push(meetingPath(m.code))`; đang tạo ⇒ disabled + `meeting.starting`; lỗi ⇒ `toast.error(meetingErrorMessage(err, t))` (403 `MEETING_CREATE_FORBIDDEN` khi claim cũ — đồng thời gọi `refreshClaims(queryClient)` để ẩn nút).
- **Lên lịch** (`Button` outline, icon `CalendarPlus`) chỉ khi `canHost` ⇒ mở dialog `create`.
- `JoinByCodeForm` luôn hiện: `Input` (`aria-label={t('joinByCodeLabel')}`, placeholder `abc-defg-hjk`, `inputMode="text"`, `autoCapitalize="none"`, `text-base md:text-sm`) + nút `joinByCode`; submit ⇒ `parseMeetingCodeInput` ⇒ null: lỗi inline `codeInvalid` (`aria-invalid`, `aria-describedby`), không null: `router.push(meetingPath(code))`.
- Phone: hai nút chính xếp hàng trên, ô nhập mã full-width bên dưới; `md+`: một hàng.

`MeetingList` (≤ 150 dòng): `useMeetingList(scope)`; trạng thái: loading = 3 `Skeleton` hàng 72px; lỗi = câu `listError` + `common.retry`; rỗng = icon `CalendarDays` 40px `text-muted-foreground` + `emptyUpcoming|emptyPast`; có dữ liệu = `<ul role="list">` các `MeetingRow` + nút `loadMore` (outline, full-width) khi `hasNextPage` (đang tải ⇒ spinner). Nhóm "Hôm nay / Ngày mai / …" **không làm** ở P1.

`MeetingRow` (≤ 130 dòng): `<li>` là list row (design-system §6: `rounded-lg p-3 hover:bg-muted transition-colors`), toàn hàng là `Link` tới `/meetings/{id}` (focus ring `focus-visible:ring-2 ring-ring`); trái: ô ngày 40×40 (`rounded-md bg-accent text-accent-foreground`, tháng `text-[10px] uppercase`, ngày `text-sm font-semibold`) hoặc icon `Video` cho họp ngay; giữa: tiêu đề (`title || t('untitled')`, `text-sm font-medium truncate`), dòng phụ `text-xs text-muted-foreground`: thời gian (`formatMeetingRange` hoặc `instantMeeting`) · `hostedBy {name}` (tên qua `safeDisplayName`, fallback `someone`; viewer là host ⇒ hiện `roleHost`); phải: `MeetingStatusBadge` (chỉ hiện khi LIVE / ENDED / huỷ — `LIVE` = `Badge` default có chấm tròn, ENDED = `secondary`, huỷ = `outline`) + nút **Tham gia** (`size="sm"`, chỉ khi `detailActions(m, canHost).join`, `stopPropagation` + `router.push(meetingPath(code))`) + `CopyLinkButton` icon (`aria-label={t('copyLink')}`).

`CopyLinkButton`: `navigator.clipboard.writeText(meetingLink(code, window.location.origin))` ⇒ `toast.success(t('linkCopied'))`; lỗi ⇒ `toast.error(t('copyFailed'))`. Có biến thể `variant="button"` (chữ) cho trang chi tiết.

`MeetingFormDialog` (≤ 230 dòng) — `ResponsiveModal` (`desktopClassName="sm:max-w-lg"`), tiêu đề `formCreateTitle|formEditTitle|formAgainTitle`. State: `useState<MeetingFormValues>` khởi tạo **một lần** từ `emptyMeetingForm(now)` / `formFromMeeting(m, mode, now)` (`now` lấy trong handler mở dialog, truyền qua prop — không `new Date()` trong render); dialog được `key` theo `mode + meeting.id` để reset. Lỗi = `validateMeetingForm(values, now, original)` tính khi submit (và khi field đã bị chạm). Submit:
- `create`/`again` ⇒ `useCreateMeeting` với `toMeetingInput(values)` ⇒ đóng dialog, `toast.success(t('toastCreated'))`; nếu **không** lên lịch ⇒ `router.push(meetingPath(m.code))` (họp ngay có tiêu đề/người mời).
- `edit` ⇒ `useUpdateMeeting(id)` với `toMeetingInput(values, original)` ⇒ `toastUpdated`.
- Lỗi server ⇒ map field: `MEETING_INVALID.params.field` ∈ `title|description` ⇒ lỗi inline của ô đó; `inviteeIds` ⇒ inline ở người mời; `scheduledStart|scheduledEnd` ⇒ inline ở lịch; còn lại ⇒ `toast.error(meetingErrorMessage(…))`.
- Footer: `common.cancel` (outline) + submit (default, spinner khi pending).

Thân dialog (mỗi phần là component riêng để JSX ≤ 5 cấp):
1. `Input` tiêu đề (`maxLength` không đặt cứng — để validate hiện thông báo; bộ đếm `{len}/120` hiện khi > 100) + `Textarea` mô tả (rows 3, bộ đếm khi > 1800).
2. `MeetingScheduleFields` — `RadioGroup`-like hai nút toggle (`role="radiogroup"`, `aria-checked`) **Bắt đầu ngay / Lên lịch** (ẩn "Bắt đầu ngay" khi `edit` một cuộc họp đã có lịch — contract không xoá được `scheduledStart`; `edit` cuộc họp LIVE ⇒ cả phần lịch `disabled`). Khi lên lịch: ngày = `Popover` + `Calendar` (react-day-picker, như `ProfileForm`), hiển thị bằng `Intl.DateTimeFormat(locale, { dateStyle: 'medium' })`, `disabled={{ before: today }}`; giờ = `Input type="time" step={300}`; thời lượng = `Select` từ `durationOptions(current)` với nhãn `durationMinutes|durationHours|durationHoursMinutes`; dòng gợi ý `timeZoneHint {zone: timeZoneLabel(locale, now)}`.
3. `InviteePicker` — ô tìm (debounce 400ms bằng `useDebounce` sẵn có, `authService.searchUsers`), kết quả là `listbox` (`role="option"`, `aria-selected`), chọn ⇒ chip (`Badge secondary` + nút X `aria-label={t('removeInvitee',{name})}`); bỏ chính mình khỏi kết quả (`useAuthStore` user id) và người đã chọn; hiện `inviteeCount`. Tên chip = `safeDisplayName` → fallback `participantFallback` (không bao giờ email/id thay tên — email chỉ ở dòng phụ của kết quả tìm như `NewConversationModal`). Ô **Phòng ban** chỉ khi `useHasCapability('MANAGE_DEPARTMENTS')` (gap B1): `Select` từ `useDepartments(true)` (`_id`, `name`) + mục `departmentNone`, kèm `departmentHint`. Khi edit mà `departmentId` không có trong danh sách (người sửa không có quyền) ⇒ không render ô (giá trị cũ giữ nguyên vì `toMeetingInput` chỉ gửi khi đổi).
4. `MeetingSettingsFields` — 5 `Switch` có `Label` + mô tả (`settingWaitingRoom(+Desc)`, `settingMuteOnEntry(+Desc)`, `settingScreenShare`, `settingNotes`, `settingLocked(+Desc)`), mỗi switch `id`/`htmlFor` đúng; nằm trong `<fieldset>` có `<legend>` = `settingsTitle`.

- [ ] **Step 1:** Viết các component theo mô tả. Không component nào gọi `chatApi` trực tiếp — chỉ qua hooks Task 7.
- [ ] **Step 2:** Thêm khoá Task 10 (7 locale).
- [ ] **Step 3: GREEN** — `TSC && VT lib/__tests__/i18n-parity.test.ts && pnpm lint`; `wc -l app/(main)/meetings/page.tsx components/meeting/*.tsx` mỗi file ≤ 400.
- [ ] **Step 4: Kiểm tay nhanh** (dev server trên `dev`, đăng nhập 2 tài khoản): Họp ngay ⇒ sang `/meet/{code}`; Lên lịch 10:00 ngày mai ⇒ hàng mới đúng chỗ trong Sắp tới, giờ hiển thị đúng múi; người được mời thấy toast mời + hàng mới không reload; tài khoản không có `HOST_MEETING` không thấy 2 nút.
- [ ] **Step 5: Commit** `feat(web): meetings list, instant meeting and schedule dialog`

---

### Task 11: Ghi chú — máy trạng thái, autosave 2s, 409 không mất chữ

**Files:**
- Create: `ML/note-sync.ts`, `W/lib/hooks/use-note-editor.ts`, `MC/NotesEditor.tsx`, `MC/NoteConflictDialog.tsx`
- Modify: `W/messages/*.json` (khoá `notes*`, 7 locale)
- Test: `ML/__tests__/note-sync.test.ts`, `W/components/meeting/__tests__/NotesEditor.test.tsx`

**Interfaces — Produces** (`note-sync.ts`):

```ts
export type NoteStatus = 'loading' | 'clean' | 'dirty' | 'saving' | 'saved' | 'conflict' | 'error'
export interface RemoteNewer { version: number; updatedBy?: MeetingPerson }
export interface NoteState {
  status: NoteStatus
  baseVersion: number          // version the draft is based on (sent as `version`)
  baseContent: string
  draft: string                // what the user sees — never overwritten while they have edits
  savingDraft: string | null
  latest: MeetingNote | null   // the other version during a conflict
  remoteNewer: RemoteNewer | null
  errorKey: MessageKey | null
}
export const initialNoteState: NoteState
export type NoteAction =
  | { type: 'loaded'; note: MeetingNote }
  | { type: 'edit'; draft: string }
  | { type: 'saveStarted' }
  | { type: 'saveSucceeded'; note: MeetingNote }
  | { type: 'saveConflicted'; latest: MeetingNote }
  | { type: 'saveFailed'; errorKey: MessageKey }
  | { type: 'retry' }
  | { type: 'remoteUpdated'; version: number; updatedBy?: MeetingPerson }
  | { type: 'keepMine' }
  | { type: 'takeTheirs' }
  | { type: 'saveMerged'; draft: string }
export function noteReducer(s: NoteState, a: NoteAction): NoteState
export function canAutosave(s: NoteState): boolean      // status === 'dirty'
export function savePayload(s: NoteState): MeetingNoteInput // { content: draft, version: baseVersion }
export function needsRefetch(s: NoteState): boolean     // remoteNewer && status ∈ clean|saved
export function hasUnsavedText(s: NoteState): boolean   // draft !== baseContent || status ∈ saving|conflict
```

- [ ] **Step 1: Test** — `ML/__tests__/note-sync.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import type { MeetingNote } from '@/lib/api/meeting-types'
import {
  canAutosave, hasUnsavedText, initialNoteState, needsRefetch, noteReducer, savePayload,
  type NoteAction, type NoteState,
} from '@/lib/meetings/note-sync'

const note = (content: string, version: number, by = 'Minh'): MeetingNote =>
  ({ scope: 'shared', content, version, updatedBy: { userId: 'u2', displayName: by }, updatedAt: 't' })
const run = (...actions: NoteAction[]): NoteState => actions.reduce(noteReducer, initialNoteState)

describe('noteReducer', () => {
  it('loads a note as clean', () => {
    const s = run({ type: 'loaded', note: note('base', 1) })
    expect(s).toMatchObject({ status: 'clean', baseVersion: 1, baseContent: 'base', draft: 'base' })
    expect(canAutosave(s)).toBe(false)
  })

  it('becomes dirty on edit and clean again when the edit is undone', () => {
    const dirty = run({ type: 'loaded', note: note('base', 1) }, { type: 'edit', draft: 'base!' })
    expect(dirty.status).toBe('dirty')
    expect(canAutosave(dirty)).toBe(true)
    expect(savePayload(dirty)).toEqual({ content: 'base!', version: 1 })
    expect(noteReducer(dirty, { type: 'edit', draft: 'base' }).status).toBe('clean')
  })

  it('keeps typing that happens while a save is in flight', () => {
    const s = run(
      { type: 'loaded', note: note('a', 1) },
      { type: 'edit', draft: 'ab' },
      { type: 'saveStarted' },
      { type: 'edit', draft: 'abc' },
      { type: 'saveSucceeded', note: note('ab', 2) },
    )
    expect(s).toMatchObject({ status: 'dirty', baseVersion: 2, baseContent: 'ab', draft: 'abc' })
    expect(savePayload(s)).toEqual({ content: 'abc', version: 2 })
  })

  it('marks a save as saved when nothing changed meanwhile', () => {
    const s = run({ type: 'loaded', note: note('a', 1) }, { type: 'edit', draft: 'ab' }, { type: 'saveStarted' },
      { type: 'saveSucceeded', note: note('ab', 2) })
    expect(s).toMatchObject({ status: 'saved', baseVersion: 2, draft: 'ab' })
    // the query cache echoes the saved note back — nothing changes (still "Saved")
    expect(noteReducer(s, { type: 'loaded', note: note('ab', 2) })).toBe(s)
  })

  describe('409 conflict', () => {
    const conflicted = run(
      { type: 'loaded', note: note('base', 1) },
      { type: 'edit', draft: 'base + mine' },
      { type: 'saveStarted' },
      { type: 'saveConflicted', latest: note('base + theirs', 2) },
    )

    it('never loses the text being typed', () => {
      expect(conflicted).toMatchObject({ status: 'conflict', draft: 'base + mine', baseVersion: 1 })
      expect(conflicted.latest?.content).toBe('base + theirs')
      expect(canAutosave(conflicted)).toBe(false)
      expect(hasUnsavedText(conflicted)).toBe(true)
      const typing = noteReducer(conflicted, { type: 'edit', draft: 'base + mine!' })
      expect(typing).toMatchObject({ status: 'conflict', draft: 'base + mine!' })
    })

    it('"keep mine" rebases the draft on the newer version so the next save overwrites it', () => {
      const s = noteReducer(conflicted, { type: 'keepMine' })
      expect(s).toMatchObject({ status: 'dirty', baseVersion: 2, baseContent: 'base + theirs', draft: 'base + mine', latest: null })
      expect(savePayload(s)).toEqual({ content: 'base + mine', version: 2 })
    })

    it('"use newer version" adopts their text', () => {
      const s = noteReducer(conflicted, { type: 'takeTheirs' })
      expect(s).toMatchObject({ status: 'clean', baseVersion: 2, draft: 'base + theirs', latest: null })
    })

    it('"save merged" saves the merged text on top of the newer version', () => {
      const s = noteReducer(conflicted, { type: 'saveMerged', draft: 'base + theirs + mine' })
      expect(s).toMatchObject({ status: 'dirty', baseVersion: 2, draft: 'base + theirs + mine' })
      expect(savePayload(s)).toEqual({ content: 'base + theirs + mine', version: 2 })
    })

    it('a reload during the conflict does not touch the draft', () => {
      const s = noteReducer(conflicted, { type: 'loaded', note: note('base + theirs + more', 3) })
      expect(s).toMatchObject({ status: 'conflict', draft: 'base + mine' })
      expect(s.remoteNewer).toEqual({ version: 3, updatedBy: { userId: 'u2', displayName: 'Minh' } })
    })
  })

  describe('remote updates (meet.notes.updated)', () => {
    it('asks a clean editor to refetch, then applies the new version', () => {
      const s = run({ type: 'loaded', note: note('a', 1) }, { type: 'remoteUpdated', version: 2 })
      expect(needsRefetch(s)).toBe(true)
      const after = noteReducer(s, { type: 'loaded', note: note('a+b', 2) })
      expect(after).toMatchObject({ status: 'clean', draft: 'a+b', baseVersion: 2, remoteNewer: null })
      expect(needsRefetch(after)).toBe(false)
    })

    it('only flags a dirty editor — its text stays', () => {
      const s = run({ type: 'loaded', note: note('a', 1) }, { type: 'edit', draft: 'mine' },
        { type: 'remoteUpdated', version: 2, updatedBy: { userId: 'u2', displayName: 'Minh' } })
      expect(s).toMatchObject({ status: 'dirty', draft: 'mine' })
      expect(s.remoteNewer?.updatedBy?.displayName).toBe('Minh')
      expect(needsRefetch(s)).toBe(false)
      expect(noteReducer(s, { type: 'loaded', note: note('theirs', 2) }).draft).toBe('mine')
    })

    it('ignores its own echo and older versions', () => {
      const s = run({ type: 'loaded', note: note('a', 3) })
      expect(noteReducer(s, { type: 'remoteUpdated', version: 3 })).toBe(s)
      expect(noteReducer(s, { type: 'remoteUpdated', version: 2 })).toBe(s)
    })
  })

  it('a failed save keeps the text and can be retried', () => {
    const failed = run({ type: 'loaded', note: note('a', 1) }, { type: 'edit', draft: 'ab' }, { type: 'saveStarted' },
      { type: 'saveFailed', errorKey: { key: 'errNetwork' } })
    expect(failed).toMatchObject({ status: 'error', draft: 'ab', errorKey: { key: 'errNetwork' } })
    expect(canAutosave(failed)).toBe(false)
    expect(noteReducer(failed, { type: 'retry' }).status).toBe('dirty')
    expect(noteReducer(failed, { type: 'edit', draft: 'abc' })).toMatchObject({ status: 'dirty', errorKey: null })
  })
})
```

- [ ] **Step 2: RED** — `VT lib/meetings/__tests__/note-sync.test.ts`
- [ ] **Step 3: Hiện thực `noteReducer`** — đúng các chuyển trạng thái test mô tả: `loaded` với `status ≠ loading` và `note.version <= baseVersion` ⇒ trả **cùng object** `s` (tiếng vọng của chính lần lưu qua cache); `loaded` chỉ thay `draft` khi `status ∈ loading|clean|saved` (hoặc `error` mà `draft === baseContent`); ngược lại chỉ đặt `remoteNewer` nếu `note.version > baseVersion`. `edit` trong `conflict`/`saving` chỉ đổi `draft`. `saveSucceeded` ⇒ `status = draft === note.content ? 'saved' : 'dirty'`. `remoteUpdated` với `version <= baseVersion` trả **cùng object** `s`. `keepMine/takeTheirs/saveMerged` không có `latest` ⇒ trả `s`.
- [ ] **Step 4: Hiện thực `use-note-editor.ts`** (≤ 160 dòng):

```ts
export interface NoteEditor {
  state: NoteState
  readOnly: boolean
  edit(draft: string): void; retry(): void
  keepMine(): void; takeTheirs(): void; saveMerged(draft: string): void
  flush(): Promise<void>        // save now if dirty (panel close, leaving the room)
}
export function useNoteEditor(meetingId: string, scope: NoteScope,
  opts: { enabled: boolean; canEdit: boolean; remote?: RemoteNewer | null }): NoteEditor
```

  - `useMeetingNote(meetingId, scope, enabled)`; áp `loaded` bằng mẫu **điều chỉnh state trong render** (so `query.dataUpdatedAt` với giá trị đã áp giữ trong `useState`) — không dispatch trong effect.
  - Autosave: `useEffect([state.draft, state.status])` ⇒ khi `canAutosave` đặt `setTimeout(save, 2000)`, cleanup huỷ timer. `save()` (gọi trong callback, không đồng bộ trong effect): `saveStarted` → `meetingsApi.putNote(id, scope, savePayload(state))` → `saveSucceeded(note)` + `queryClient.setQueryData(note key, note)`; lỗi ⇒ `noteConflictLatest(err)` ? `saveConflicted` : `saveFailed(meetingErrorKey(parseMeetingError(err), 'note'))`. Dùng ref giữ state mới nhất để callback không đọc closure cũ (ref chỉ đọc trong callback, không trong render).
  - `opts.remote` đổi (`version` mới) ⇒ dispatch `remoteUpdated` trong effect phụ thuộc `remote?.version` (đây là đồng bộ từ hệ ngoài — dùng `useEffectEvent`/callback của store subscribe nếu lint báo); `needsRefetch(state)` ⇒ `query.refetch()`.
  - Unmount khi còn `dirty` ⇒ gọi `save()` không chờ (best-effort). `readOnly = !opts.canEdit` (ghi chú riêng: luôn `canEdit` khi có records access).
- [ ] **Step 5: Hiện thực `NotesEditor.tsx`** (≤ 250 dòng) — props `{ meetingId: string; canEditShared: boolean; sharedRemote?: RemoteNewer | null; className?: string }`. `Tabs` "Chung" / "Của tôi" (mỗi tab một `NoteTab` con gọi `useNoteEditor` riêng — chỉ tab đang mở fetch: `enabled` theo tab đang chọn hoặc đã từng mở). `NoteTab`:
  - Thanh nhỏ: nút toggle Viết/Xem trước (`aria-pressed`), trạng thái `aria-live="polite"` (`notesSaving|notesSaved|notesUnsaved|notesSaveFailed` + nút `notesRetry`), bộ đếm `notesCounter` khi > 45 000.
  - Viết: `Textarea` (`aria-label` = tên tab, `maxLength={50000}`, `readOnly` khi không được sửa — kèm dòng `notesReadOnly`, font `text-sm`, cao tối thiểu 240px, `resize-y`). Xem trước: `MarkdownContent` (tái dùng `components/chat/MarkdownContent.tsx`).
  - `remoteNewer` khi đang sửa ⇒ dải thông báo `text-xs` `notesRemoteNewer{name}` / `…Unknown` (tên qua `safeDisplayName`).
  - `status === 'conflict'` ⇒ khối cảnh báo (`role="alert"`, `border border-destructive/40 bg-destructive/5 rounded-lg p-3`) `notesConflictTitle` + `notesConflictDesc` + nút `notesConflictReview` mở `NoteConflictDialog`. Textarea **vẫn sửa được**.
  - Tab Của tôi thêm dòng `notesPrivateHint`.
- [ ] **Step 6: Hiện thực `NoteConflictDialog.tsx`** (≤ 150 dòng) — `ResponsiveModal` rộng (`desktopClassName="sm:max-w-3xl"`); hai cột `md:grid-cols-2` (phone xếp dọc): **Bản mới hơn** (`latest.content` trong `<pre className="whitespace-pre-wrap text-sm">` chỉ đọc, kèm "{name}" người lưu) và **Bản của bạn** (`Textarea` khởi tạo từ `draft`, người dùng gộp tay). Footer: `notesConflictTakeTheirs` (outline; bấm lần đầu hiện `notesConflictDiscardWarning` + đổi thành xác nhận), `notesConflictKeepMine` (outline), `notesConflictSaveMerged` (default — `saveMerged(text)`).
- [ ] **Step 7: Test RTL** — `W/components/meeting/__tests__/NotesEditor.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'

const api = vi.hoisted(() => ({ getNote: vi.fn(), putNote: vi.fn() }))
vi.mock('@/lib/api/meetings', () => ({ meetingsApi: api }))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${Object.values(values).join(',')})` : key,
  useLocale: () => 'en',
}))
vi.mock('@/components/chat/MarkdownContent', () => ({ MarkdownContent: ({ content }: { content: string }) => <div>{content}</div> }))

import { NotesEditor } from '@/components/meeting/NotesEditor'

function conflict(latest: unknown): AxiosError {
  const response = { status: 409, data: { code: 'MEETING_NOTE_CONFLICT', statusCode: 409, latest },
    statusText: '', headers: {}, config: { headers: new AxiosHeaders() } }
  return new AxiosError('conflict', 'ERR', undefined, undefined, response as AxiosResponse)
}

function renderEditor() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <NotesEditor meetingId="m1" canEditShared />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  // ResponsiveModal → useIsMobile reads matchMedia, which jsdom lacks (same stub as responsive-modal.test.tsx).
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(),
  }) as unknown as typeof window.matchMedia
  api.getNote.mockResolvedValue({ scope: 'shared', content: 'base', version: 1 })
})
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('NotesEditor', () => {
  it('autosaves 2 seconds after typing stops', async () => {
    api.putNote.mockResolvedValue({ scope: 'shared', content: 'base!', version: 2 })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderEditor()
    const box = await screen.findByRole('textbox', { name: 'notesShared' })
    await user.type(box, '!')
    expect(api.putNote).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(2000) })
    await waitFor(() => expect(api.putNote).toHaveBeenCalledWith('m1', 'shared', { content: 'base!', version: 1 }))
    expect(await screen.findByText('notesSaved')).toBeInTheDocument()
  })

  it('on 409 keeps the typed text, explains, and "keep mine" saves over the newer version', async () => {
    api.putNote
      .mockRejectedValueOnce(conflict({ scope: 'shared', content: 'base theirs', version: 2,
        updatedBy: { userId: 'u2', displayName: 'Minh' } }))
      .mockResolvedValueOnce({ scope: 'shared', content: 'base mine', version: 3 })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderEditor()
    const box = await screen.findByRole('textbox', { name: 'notesShared' })
    await user.clear(box)
    await user.type(box, 'base mine')
    await act(async () => { vi.advanceTimersByTime(2000) })

    expect(await screen.findByRole('alert')).toHaveTextContent('notesConflictTitle')
    expect(box).toHaveValue('base mine')

    await user.click(screen.getByRole('button', { name: 'notesConflictReview' }))
    await user.click(await screen.findByRole('button', { name: 'notesConflictKeepMine' }))
    await act(async () => { vi.advanceTimersByTime(2000) })
    await waitFor(() =>
      expect(api.putNote).toHaveBeenLastCalledWith('m1', 'shared', { content: 'base mine', version: 2 }))
    expect(box).toHaveValue('base mine')
  })

  it('is read-only with an explanation when the user may not edit', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={qc}><NotesEditor meetingId="m1" canEditShared={false} /></QueryClientProvider>)
    const box = await screen.findByRole('textbox', { name: 'notesShared' })
    expect(box).toHaveAttribute('readonly')
    expect(screen.getByText('notesReadOnly')).toBeInTheDocument()
  })
})
```

- [ ] **Step 8: GREEN** — `VT lib/meetings/__tests__/note-sync.test.ts components/meeting/__tests__/NotesEditor.test.tsx lib/__tests__/i18n-parity.test.ts && TSC && pnpm lint`
- [ ] **Step 9: Commit** `feat(web): meeting notes editor with autosave and conflict handling`

---
### Task 12: Trang chi tiết `/meetings/[id]`

**Files:**
- Create: `W/app/(main)/meetings/[id]/page.tsx`, `MC/detail/MeetingInfoCard.tsx`, `MC/detail/MeetingActions.tsx`, `MC/detail/AttendanceList.tsx`, `MC/detail/ChatHistory.tsx`
- Modify: `W/messages/*.json` (khoá Task 12, 7 locale)

**Hành vi:**

`page.tsx` (≤ 160 dòng, `'use client'`): `const { id } = useParams<{ id: string }>()`; `useMeeting(id)`.
- Đang tải ⇒ skeleton (tiêu đề + 2 card). 404 ⇒ card `errNotFound` + link `backToList`. Lỗi khác ⇒ `detailError` + `common.retry` (`refetch`).
- Khung `mx-auto w-full max-w-3xl px-4 py-6 md:px-6 pb-24 md:pb-6 space-y-4`; đầu trang: link `backToList` (`ArrowLeft`, `text-sm text-muted-foreground`), tiêu đề `text-2xl font-semibold tracking-tight` (`title || t('untitled')`), `MeetingStatusBadge` (huỷ = `cancelledAt`).
- `MeetingInfoCard` + `MeetingActions` (cùng một `Card`), rồi các phần hồ sơ:
  - `canSeeRecords(m)` sai ⇒ `guestNotice` (khi chưa ENDED) hoặc không gì.
  - Có quyền ⇒ `AttendanceList` (chỉ khi `attendance?.length` hoặc LIVE/ENDED), `NotesEditor` (`canEditShared = canEditSharedNote(m.viewerRole, m.settings)`, không có `sharedRemote` — trang này không subscribe topic), `ChatHistory`.
  - Query hồ sơ nào trả 403 `MEETING_REMOVED` ⇒ thay **toàn bộ** phần hồ sơ bằng `removedNotice` (không toast đỏ). `NotesEditor`/`ChatHistory` nhận callback `onRemoved` để page chuyển trạng thái (state cục bộ đặt trong handler lỗi của query qua `useEffect`-free: dùng `query.error` dẫn xuất trong render).
  - `{/* P2: AI summary slot */}` sau phần ghi chú (Sai khác #11).

`MeetingInfoCard` (≤ 180 dòng): thời gian (`formatMeetingRange(locale, scheduledStart, scheduledEnd)` hoặc `instantMeeting` + giờ tạo), dòng **mã phòng** (`font-mono text-sm`) + `CopyLinkButton variant="button"` (chỉ khi chưa ENDED); mô tả (`whitespace-pre-wrap break-words text-sm`); "Thành phần": host (avatar 24 + tên + `roleHost`), co-host (`coHosts`), người được mời (`invitees`, tối đa 8 rồi "+N"), phòng ban: tên từ `useDepartments(canDepts)` theo `_id`, không tìm được ⇒ `departmentGeneric`. Không render `removedIds`. Tên qua `safeDisplayName` → `participantFallback`; avatar qua `absoluteMediaUrl`.

`MeetingActions` (≤ 170 dòng): `const a = detailActions(m, useHasCapability('HOST_MEETING'))`.
- **Tham gia** (default) ⇒ `router.push(meetingPath(code))`; LIVE ⇒ nhãn `join`, SCHEDULED ⇒ `join` (màn chờ hiện giờ bắt đầu).
- **Sửa** (outline) ⇒ `MeetingFormDialog mode="edit"`; **Họp lại** (default khi ENDED) ⇒ `mode="again"`.
- **Huỷ cuộc họp** (ghost destructive) ⇒ `ConfirmDialog` (`cancelConfirmTitle/Desc`, `destructive`) ⇒ `useCancelMeeting` ⇒ `toastCancelled`; 409 `MEETING_NOT_CANCELLABLE` ⇒ `toast.error(errNotCancellable)`.
- **Kết thúc cuộc họp** (LIVE, host/co-host; ghost destructive) ⇒ `ConfirmDialog` (`endConfirmTitle/Desc`) ⇒ `useEndMeeting` ⇒ `toastEnded`.
- Phone: nút xếp `flex-wrap gap-2`, nút chính full-width.

`AttendanceList` (≤ 120 dòng): `summarizeAttendance(m.attendance, now, m.endedAt)` với `now = useNow({ updateInterval: 30_000 })` (next-intl) khi LIVE, `new Date(m.endedAt)` khi ENDED. Mỗi hàng: avatar chữ cái, tên, vai trò (`roleHost|roleCohost`, attendee không ghi), `attendanceDuration{minutes}` (làm tròn lên phút), `attendanceSessions` khi > 1, chấm xanh + `attendanceInside` khi `inside`. Rỗng ⇒ `attendanceEmpty`.

`ChatHistory` (≤ 130 dòng): `useMeetingMessages(id, enabled)`; hiển thị `flattenMessages` (cũ → mới) trong vùng `max-h-96 overflow-y-auto`; nút `chatLoadOlder` ở trên khi `hasNextPage`; mỗi dòng: tên người gửi (`text-xs font-medium`), giờ (`Intl.DateTimeFormat(locale, { timeStyle: 'short' })`), nội dung `text-sm whitespace-pre-wrap break-words` (text thuần). Rỗng ⇒ `chatHistoryEmpty`.

- [ ] **Step 1:** Viết 5 file theo mô tả; khoá Task 12 (7 locale).
- [ ] **Step 2: GREEN** — `TSC && VT lib/__tests__/i18n-parity.test.ts && pnpm lint`; `wc -l` ≤ 400.
- [ ] **Step 3: Kiểm tay** — chi tiết cuộc họp SCHEDULED (host: Sửa/Huỷ/Tham gia/Sao chép), LIVE (co-host: Kết thúc), ENDED (Họp lại mở dialog điền sẵn người mời), người bị mời ra (thấy `removedNotice`, không toast đỏ), khách (`guestNotice`). Hai tab cùng sửa ghi chú chung ⇒ tab lưu sau thấy khối xung đột, chữ còn nguyên.
- [ ] **Step 4: Commit** `feat(web): meeting detail page with attendance, notes and chat history`

**MT4 xong** — chạy `TSC && npx vitest run && pnpm lint` trước khi sang MT5.

---

## MT5 — Trong phòng họp

### Task 13: Mở rộng `LiveKitSession` (tương thích ngược với Cuộc gọi)

**Files:**
- Modify: `W/lib/rtc/livekit-session.ts` (≤ 400 dòng sau khi sửa; hiện 224)
- Test: `W/lib/rtc/__tests__/livekit-session.test.ts` — **mở rộng fake** (chỉ thêm) + `describe('meeting extensions')` mới; test cũ không sửa

**Interfaces — Produces** (thêm; chữ ký cũ giữ nguyên):

```ts
export interface ConnectOptions {
  video: boolean
  /** Default true — calls keep publishing the mic on connect. */
  audio?: boolean
  audioDeviceId?: string
  videoDeviceId?: string
}
export interface RemotePeer {
  /* …existing fields… */
  /** From participant metadata {"avatarUrl"}; absent when none / malformed. */
  avatarUrl?: string
  /** Screen share (+ its audio) — never mixed into `stream`. */
  screen: MediaStream | null
}
export interface LocalMediaState { mic: boolean; camera: boolean; screen: boolean }
/** The user cancelled the browser's share picker, or the source is not allowed. */
export class ScreenShareError extends Error {}

export class LiveKitSession {
  /* …existing… */
  onLocalMediaChanged: ((s: LocalMediaState) => void) | null
  onData: ((topic: string, payload: Uint8Array, fromIdentity: string | null) => void) | null
  connect(url: string, token: string, opts: ConnectOptions): Promise<void>
  localMedia(): LocalMediaState
  localScreenStream(): MediaStream | null
  setScreenShare(on: boolean): Promise<void>          // throws ScreenShareError
  switchDevice(kind: 'audioinput' | 'videoinput', deviceId: string): Promise<void>
  publishData(topic: string, payload: Uint8Array, reliable: boolean): void   // never throws
  setPeerVideoEnabled(identity: string, enabled: boolean): void            // stop receiving a hidden tile's camera
}
```

Hành vi mới:
- `new Room({ adaptiveStream: false, dynacast: true, audioCaptureDefaults?: { deviceId }, videoCaptureDefaults?: { deviceId } })` — chỉ thêm khoá khi có device id.
- `connect`: mic chỉ bật khi `opts.audio !== false`.
- `TrackSubscribed/Unsubscribed` với `pub.source ∈ {ScreenShare, ScreenShareAudio}` ⇒ vào/ra `peer.screen` (tạo lười, về `null` khi rỗng); nguồn khác giữ như cũ.
- `TrackMuted/TrackUnmuted` của **participant local** (server `MutePublishedTrack`) và `LocalTrackPublished/Unpublished` (gồm người dùng bấm "Dừng chia sẻ" của trình duyệt) ⇒ `onLocalMediaChanged(localMedia())`; `localMedia()` đọc `localParticipant.isMicrophoneEnabled / isCameraEnabled / isScreenShareEnabled`.
- `RoomEvent.DataReceived (payload, participant?, kind?, topic?)` ⇒ `onData(topic ?? '', payload, participant?.identity ?? null)`.
- `publishData` ⇒ `localParticipant.publishData(payload, { reliable, topic })`, nuốt lỗi (reaction là best-effort).
- `setScreenShare(on)` ⇒ `localParticipant.setScreenShareEnabled(on, { audio: true })`; lỗi `NotAllowedError`/`AbortError`/từ chối quyền ⇒ `ScreenShareError`; sau cùng `onLocalMediaChanged`.
- `avatarUrl`: `JSON.parse(p.metadata)` trong try/catch, chỉ nhận string.

- [ ] **Step 1: Mở rộng fake** trong `livekit-session.test.ts` (thêm, không đổi gì sẵn có):
  - `localParticipant` thêm `isMicrophoneEnabled: true`, `isCameraEnabled: false`, `isScreenShareEnabled: false`, `setScreenShareEnabled: vi.fn<(on: boolean, opts?: unknown) => Promise<unknown>>(async () => undefined)`, `publishData: vi.fn<(data: Uint8Array, opts: unknown) => Promise<void>>(async () => undefined)`.
  - `FakeRoom` thêm `switchActiveDevice = vi.fn<(kind: string, id: string) => Promise<boolean>>(async () => true)`.
  - `RoomEvent` thêm `DataReceived: 'dataReceived'`; `Track.Source` thêm `ScreenShare: 'screen_share', ScreenShareAudio: 'screen_share_audio'`.
- [ ] **Step 2: Test** — thêm cuối file:

```ts
describe('meeting extensions', () => {
  it('can join with the mic off and preferred devices', async () => {
    await session.connect('wss://rtc', 'tok', { video: true, audio: false, audioDeviceId: 'mic-2', videoDeviceId: 'cam-3' })
    expect(room().localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled()
    expect(room().localParticipant.setCameraEnabled).toHaveBeenCalledWith(true)
    expect(room().options).toMatchObject({
      adaptiveStream: false,
      audioCaptureDefaults: { deviceId: 'mic-2' },
      videoCaptureDefaults: { deviceId: 'cam-3' },
    })
  })

  it('keeps a peer’s screen share out of their camera stream', async () => {
    await session.connect('wss://rtc', 'tok', { video: true })
    room().emit('participantConnected', bob)
    room().emit('trackSubscribed', track('video'), pub('camera'), bob)
    room().emit('trackSubscribed', track('video'), pub('screen_share'), bob)
    const peer = session.peer('bob')!
    expect((peer.stream as unknown as FakeMediaStream).getTracks()).toHaveLength(1)
    expect((peer.screen as unknown as FakeMediaStream).getTracks()).toHaveLength(1)
    room().emit('trackUnsubscribed', track('video'), pub('screen_share'), bob)
    expect(session.peer('bob')!.screen).toBeNull()
  })

  it('reads the avatar from metadata and ignores garbage', async () => {
    await session.connect('wss://rtc', 'tok', { video: false })
    room().emit('participantConnected', { ...bob, metadata: '{"avatarUrl":"/api/uploads/a.png"}' })
    expect(session.peer('bob')!.avatarUrl).toBe('/api/uploads/a.png')
    room().emit('participantConnected', { identity: 'eve', name: 'Eve', isLocal: false, metadata: 'not json' })
    expect(session.peer('eve')!.avatarUrl).toBeUndefined()
  })

  it('reports when the server mutes my mic', async () => {
    await session.connect('wss://rtc', 'tok', { video: false })
    const onLocal = vi.fn()
    session.onLocalMediaChanged = onLocal
    room().localParticipant.isMicrophoneEnabled = false
    room().emit('trackMuted', pub('microphone'), { identity: 'me', isLocal: true })
    expect(onLocal).toHaveBeenLastCalledWith({ mic: false, camera: false, screen: false })
  })

  it('starts and stops screen sharing and tells the caller', async () => {
    await session.connect('wss://rtc', 'tok', { video: false })
    const onLocal = vi.fn()
    session.onLocalMediaChanged = onLocal
    room().localParticipant.isScreenShareEnabled = true
    await session.setScreenShare(true)
    expect(room().localParticipant.setScreenShareEnabled).toHaveBeenCalledWith(true, { audio: true })
    expect(onLocal).toHaveBeenLastCalledWith({ mic: true, camera: false, screen: true })

    room().localParticipant.setScreenShareEnabled.mockRejectedValueOnce(
      Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }))
    await expect(session.setScreenShare(true)).rejects.toBeInstanceOf(ScreenShareError)
  })

  it('sends and receives data on a topic', async () => {
    await session.connect('wss://rtc', 'tok', { video: false })
    const onData = vi.fn()
    session.onData = onData
    const bytes = new Uint8Array([1, 2])
    session.publishData('reaction', bytes, false)
    expect(room().localParticipant.publishData).toHaveBeenCalledWith(bytes, { reliable: false, topic: 'reaction' })
    room().emit('dataReceived', bytes, bob, 1, 'reaction')
    expect(onData).toHaveBeenCalledWith('reaction', bytes, 'bob')
  })

  it('switches the active capture device', async () => {
    await session.connect('wss://rtc', 'tok', { video: true })
    await session.switchDevice('audioinput', 'mic-9')
    expect(room().switchActiveDevice).toHaveBeenCalledWith('audioinput', 'mic-9')
  })
})
```

  (import thêm `ScreenShareError` ở dòng import đầu file.)
- [ ] **Step 3: RED** — `VT lib/rtc/__tests__/livekit-session.test.ts` (test mới đỏ, test cũ xanh).
- [ ] **Step 4: Hiện thực** theo "Hành vi mới". `setPeerVideoEnabled`: `room.remoteParticipants.get(identity)?.getTrackPublication(Track.Source.Camera)` ⇒ `setEnabled(enabled)` nếu có hàm (best-effort).
- [ ] **Step 5: GREEN** — `VT lib/rtc lib/webrtc && TSC` (test Cuộc gọi `sfu-call`, `sfu-group-call` phải xanh không sửa).
- [ ] **Step 6: Commit** `feat(web): LiveKitSession screen share, devices, data channel and local mute events`

---

### Task 14: Logic thuần của phòng — pha, bố cục, reaction, phím tắt, thiết bị

**Files:**
- Create: `ML/room-phase.ts`, `ML/stage-layout.ts`, `ML/reactions.ts`, `ML/shortcuts.ts`, `ML/devices.ts`
- Test: `ML/__tests__/{room-phase,stage-layout,reactions,shortcuts,devices}.test.ts`

**Interfaces — Produces:**

```ts
// room-phase.ts
export type RoomPhase = 'loading' | 'notFound' | 'prejoin' | 'joining' | 'waiting' | 'connecting' | 'inRoom'
  | 'denied' | 'removed' | 'locked' | 'full' | 'unavailable' | 'left' | 'connectionLost' | 'ended' | 'error'
export function initialPhase(m: Meeting | undefined, loadError: MeetingErrorInfo | null): RoomPhase
export function phaseAfterJoin(res: MeetingJoinResponse): 'waiting' | 'connecting'
export function phaseAfterJoinError(info: MeetingErrorInfo): RoomPhase
/** 'rejoin' = call join again now (admitted). null = event does not change the phase. */
export function phaseAfterPersonalEvent(phase: RoomPhase, e: MeetingEvent): RoomPhase | 'rejoin' | null
/** 'verify' = room closed by the server: GET the meeting — ENDED ⇒ 'ended', else 'left'. */
export function phaseAfterRoomClosed(reason: 'failed' | 'ended'): 'connectionLost' | 'verify'
export function isTerminal(phase: RoomPhase): boolean   // notFound | denied | removed | ended
export function canRejoin(phase: RoomPhase): boolean    // left | connectionLost | locked | full | unavailable | error

// stage-layout.ts
export type LayoutMode = 'grid' | 'spotlight'
export interface StageTile { key: string; identity: string; kind: 'camera' | 'screen'; isLocal: boolean }
export interface StageInput {
  mode: LayoutMode; pinnedKey: string | null; localIdentity: string
  remoteIds: string[]; screenSharers: string[]; activeSpeakerId: string | null
  /** Grid capacity including the "+N" tile: 25 desktop, 6 phone. */
  maxTiles: number
}
export interface StageLayout { main: StageTile | null; strip: StageTile[]; grid: StageTile[]; overflow: number; hiddenIds: string[] }
export const cameraKey: (identity: string) => string    // `${identity}:camera`
export const screenKey: (identity: string) => string    // `${identity}:screen`
export function computeStage(i: StageInput): StageLayout
export function gridColumns(count: number, mobile: boolean): number

// reactions.ts
export const REACTION_TOPIC = 'reaction'
export function encodeReaction(e: ReactionEmoji): Uint8Array        // UTF-8 of {"e":"👍"}
export function decodeReaction(payload: Uint8Array): ReactionEmoji | null
export function createReactionThrottle(intervalMs?: number): (nowMs: number) => boolean

// shortcuts.ts
export type ShortcutAction = 'toggleMic' | 'toggleCamera' | 'toggleHand'
export interface KeyLike { code: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean;
  isComposing?: boolean; repeat?: boolean }
export function matchShortcut(e: KeyLike, isMac: boolean): ShortcutAction | null
export function shortcutLabel(action: ShortcutAction, isMac: boolean): string
export function isMacPlatform(nav?: { platform?: string; userAgent?: string }): boolean

// devices.ts
export interface DevicePrefs { audioInput?: string; videoInput?: string; audioOutput?: string; micOn: boolean; camOn: boolean }
export const DEVICE_PREFS_KEY = 'pon.meet.devices'
export function loadDevicePrefs(storage: Pick<Storage, 'getItem'> | null | undefined): DevicePrefs
export function saveDevicePrefs(prefs: DevicePrefs, storage: Pick<Storage, 'setItem'> | null | undefined): void
export function pickDeviceId(devices: Pick<MediaDeviceInfo, 'deviceId'>[], preferred?: string): string | undefined
export function deviceLabel(d: Pick<MediaDeviceInfo, 'label' | 'kind'>, index: number, t: Translate): string
export function supportsSpeakerSelection(): boolean      // 'setSinkId' in HTMLMediaElement.prototype
export function supportsScreenShare(): boolean           // !!navigator.mediaDevices?.getDisplayMedia
```

- [ ] **Step 1: Test** — `ML/__tests__/room-phase.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import type { Meeting } from '@/lib/api/meeting-types'
import { DEFAULT_MEETING_SETTINGS } from '@/lib/api/meeting-types'
import {
  canRejoin, initialPhase, isTerminal, phaseAfterJoin, phaseAfterJoinError, phaseAfterPersonalEvent,
  phaseAfterRoomClosed,
} from '@/lib/meetings/room-phase'

const m = (status: Meeting['status']): Meeting => ({ id: 'm1', code: 'abc-defg-hjk', host: { userId: 'h' }, status,
  settings: DEFAULT_MEETING_SETTINGS, viewerRole: 'guest', createdAt: 't' })

describe('room phases', () => {
  it('starts on the pre-join screen, or goes to the details of an ended meeting', () => {
    expect(initialPhase(undefined, null)).toBe('loading')
    expect(initialPhase(m('LIVE'), null)).toBe('prejoin')
    expect(initialPhase(m('SCHEDULED'), null)).toBe('prejoin')
    expect(initialPhase(m('ENDED'), null)).toBe('ended')
    expect(initialPhase(undefined, { status: 404, code: 'MEETING_NOT_FOUND' })).toBe('notFound')
    expect(initialPhase(undefined, { network: true })).toBe('error')
  })

  it('follows the join response', () => {
    expect(phaseAfterJoin({ status: 'waiting' })).toBe('waiting')
    expect(phaseAfterJoin({ status: 'joined', url: 'wss://x', token: 't', role: 'attendee' })).toBe('connecting')
  })

  it.each([
    [{ status: 403, code: 'MEETING_REMOVED' }, 'removed'],
    [{ status: 403, code: 'MEETING_LOCKED' }, 'locked'],
    [{ status: 409, code: 'MEETING_ENDED' }, 'ended'],
    [{ status: 409, code: 'MEETING_FULL' }, 'full'],
    [{ status: 503, code: 'MEETINGS_UNAVAILABLE' }, 'unavailable'],
    [{ status: 503 }, 'unavailable'],
    [{ status: 404, code: 'MEETING_NOT_FOUND' }, 'notFound'],
    [{ network: true }, 'error'],
  ])('join error %o → %s', (info, phase) => {
    expect(phaseAfterJoinError(info)).toBe(phase)
  })

  it('reacts to the waiting room answers only while waiting', () => {
    expect(phaseAfterPersonalEvent('waiting', { event: 'meet.admitted', meetingId: 'm1' })).toBe('rejoin')
    expect(phaseAfterPersonalEvent('inRoom', { event: 'meet.admitted', meetingId: 'm1' })).toBeNull()
    expect(phaseAfterPersonalEvent('waiting', { event: 'meet.denied', meetingId: 'm1' })).toBe('denied')
    expect(phaseAfterPersonalEvent('prejoin', { event: 'meet.denied', meetingId: 'm1' })).toBeNull()
  })

  it('removal and the end win over any live phase, never over a terminal one', () => {
    for (const phase of ['joining', 'waiting', 'connecting', 'inRoom'] as const) {
      expect(phaseAfterPersonalEvent(phase, { event: 'meet.removed', meetingId: 'm1' })).toBe('removed')
    }
    expect(phaseAfterPersonalEvent('prejoin', { event: 'meet.ended', meetingId: 'm1' })).toBe('ended')
    expect(phaseAfterPersonalEvent('waiting', { event: 'meet.cancelled', meetingId: 'm1' })).toBe('ended')
    expect(phaseAfterPersonalEvent('removed', { event: 'meet.ended', meetingId: 'm1' })).toBeNull()
    expect(phaseAfterPersonalEvent('inRoom', { event: 'meet.muted', meetingId: 'm1' })).toBeNull()
  })

  it('tells a dropped connection from a closed room', () => {
    expect(phaseAfterRoomClosed('failed')).toBe('connectionLost')
    expect(phaseAfterRoomClosed('ended')).toBe('verify')
  })

  it('knows which screens offer a way back in', () => {
    expect(isTerminal('removed')).toBe(true)
    expect(isTerminal('left')).toBe(false)
    expect(canRejoin('left')).toBe(true)
    expect(canRejoin('connectionLost')).toBe(true)
    expect(canRejoin('removed')).toBe(false)
    expect(canRejoin('denied')).toBe(false)
  })
})
```

- [ ] **Step 2: Test** — `ML/__tests__/stage-layout.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { computeStage, gridColumns, type StageInput } from '@/lib/meetings/stage-layout'

const base: StageInput = { mode: 'grid', pinnedKey: null, localIdentity: 'me', remoteIds: ['a', 'b'],
  screenSharers: [], activeSpeakerId: null, maxTiles: 25 }
const keys = (tiles: { key: string }[]) => tiles.map((t) => t.key)

describe('computeStage', () => {
  it('grid: me first, then people in join order', () => {
    const s = computeStage(base)
    expect(s.main).toBeNull()
    expect(keys(s.grid)).toEqual(['me:camera', 'a:camera', 'b:camera'])
    expect(s).toMatchObject({ overflow: 0, hiddenIds: [], strip: [] })
  })

  it('a pinned tile takes the stage', () => {
    const s = computeStage({ ...base, pinnedKey: 'b:camera' })
    expect(s.main?.key).toBe('b:camera')
    expect(keys(s.strip)).toEqual(['me:camera', 'a:camera'])
    expect(s.grid).toEqual([])
  })

  it('ignores a pin on someone who left', () => {
    expect(computeStage({ ...base, pinnedKey: 'gone:camera' }).main).toBeNull()
  })

  it('a remote screen share always takes the stage, cameras go to the strip', () => {
    const s = computeStage({ ...base, screenSharers: ['a'] })
    expect(s.main).toMatchObject({ key: 'a:screen', kind: 'screen', isLocal: false })
    expect(keys(s.strip)).toEqual(['me:camera', 'a:camera', 'b:camera'])
  })

  it('a pin beats a share; my own share is staged only when nobody else shares', () => {
    expect(computeStage({ ...base, screenSharers: ['a'], pinnedKey: 'b:camera' }).main?.key).toBe('b:camera')
    expect(computeStage({ ...base, screenSharers: ['me'] }).main).toMatchObject({ key: 'me:screen', isLocal: true })
    const both = computeStage({ ...base, screenSharers: ['me', 'b'] })
    expect(both.main?.key).toBe('b:screen')
    expect(keys(both.strip)).toContain('me:screen')
  })

  it('spotlight follows the active speaker, then the first person, then me', () => {
    expect(computeStage({ ...base, mode: 'spotlight', activeSpeakerId: 'b' }).main?.key).toBe('b:camera')
    expect(computeStage({ ...base, mode: 'spotlight' }).main?.key).toBe('a:camera')
    expect(computeStage({ ...base, mode: 'spotlight', remoteIds: [] }).main?.key).toBe('me:camera')
    expect(computeStage({ ...base, mode: 'spotlight', activeSpeakerId: 'me' }).main?.key).toBe('a:camera')
  })

  it('overflows past capacity and keeps the active speaker visible', () => {
    const many = { ...base, remoteIds: ['a', 'b', 'c', 'd', 'e'], maxTiles: 4 }
    const s = computeStage(many)
    expect(keys(s.grid)).toEqual(['me:camera', 'a:camera', 'b:camera'])
    expect(s.overflow).toBe(3)
    expect(s.hiddenIds).toEqual(['c', 'd', 'e'])

    const talking = computeStage({ ...many, activeSpeakerId: 'e' })
    expect(keys(talking.grid)).toEqual(['me:camera', 'a:camera', 'e:camera'])
    expect(talking.hiddenIds).toEqual(['b', 'c', 'd'])
  })
})

describe('gridColumns', () => {
  it.each([[1, 1], [2, 1], [3, 2], [6, 2]])('phone %i tiles → %i columns', (n, cols) => {
    expect(gridColumns(n, true)).toBe(cols)
  })
  it.each([[1, 1], [2, 2], [4, 2], [5, 3], [9, 3], [10, 4], [16, 4], [17, 5], [25, 5]])(
    'desktop %i tiles → %i columns', (n, cols) => {
      expect(gridColumns(n, false)).toBe(cols)
    })
})
```

- [ ] **Step 3: Test** — `ML/__tests__/reactions.test.ts`, `ML/__tests__/shortcuts.test.ts`, `ML/__tests__/devices.test.ts`

```ts
// reactions.test.ts
import { describe, it, expect } from 'vitest'
import { createReactionThrottle, decodeReaction, encodeReaction } from '@/lib/meetings/reactions'

describe('reactions', () => {
  it('round-trips the six allowed emoji', () => {
    for (const e of ['👍', '❤️', '😂', '😮', '👏', '🎉'] as const) {
      expect(decodeReaction(encodeReaction(e))).toBe(e)
    }
    expect(new TextDecoder().decode(encodeReaction('👍'))).toBe('{"e":"👍"}')
  })

  it('drops anything else a peer could send', () => {
    const enc = (s: string) => new TextEncoder().encode(s)
    expect(decodeReaction(enc('{"e":"💩"}'))).toBeNull()
    expect(decodeReaction(enc('{"e":"<img src=x>"}'))).toBeNull()
    expect(decodeReaction(enc('not json'))).toBeNull()
    expect(decodeReaction(enc(`{"e":"👍","pad":"${'x'.repeat(200)}"}`))).toBeNull()
  })

  it('allows at most one reaction per second', () => {
    const allow = createReactionThrottle()
    expect(allow(1000)).toBe(true)
    expect(allow(1500)).toBe(false)
    expect(allow(1999)).toBe(false)
    expect(allow(2000)).toBe(true)
  })
})

// shortcuts.test.ts
import { describe, it, expect } from 'vitest'
import { isMacPlatform, matchShortcut, shortcutLabel } from '@/lib/meetings/shortcuts'

const key = (code: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) =>
  ({ code, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods })

describe('matchShortcut', () => {
  it('uses Ctrl on Windows/Linux and ⌘ on macOS, like Meet', () => {
    expect(matchShortcut(key('KeyD', { ctrlKey: true }), false)).toBe('toggleMic')
    expect(matchShortcut(key('KeyE', { ctrlKey: true }), false)).toBe('toggleCamera')
    expect(matchShortcut(key('KeyH', { ctrlKey: true, altKey: true }), false)).toBe('toggleHand')
    expect(matchShortcut(key('KeyD', { metaKey: true }), true)).toBe('toggleMic')
    expect(matchShortcut(key('KeyH', { metaKey: true, altKey: true }), true)).toBe('toggleHand')
  })

  it('ignores other combos, repeats and IME composition', () => {
    expect(matchShortcut(key('KeyD', { metaKey: true }), false)).toBeNull()
    expect(matchShortcut(key('KeyD', { ctrlKey: true, shiftKey: true }), false)).toBeNull()
    expect(matchShortcut(key('KeyD', { ctrlKey: true, altKey: true }), false)).toBeNull()
    expect(matchShortcut(key('KeyH', { ctrlKey: true }), false)).toBeNull()
    expect(matchShortcut({ ...key('KeyD', { ctrlKey: true }), repeat: true }, false)).toBeNull()
    expect(matchShortcut({ ...key('KeyD', { ctrlKey: true }), isComposing: true }, false)).toBeNull()
  })

  it('labels shortcuts per platform', () => {
    expect(shortcutLabel('toggleMic', true)).toBe('⌘D')
    expect(shortcutLabel('toggleHand', false)).toBe('Ctrl+Alt+H')
    expect(isMacPlatform({ platform: 'MacIntel' })).toBe(true)
    expect(isMacPlatform({ platform: 'Win32', userAgent: 'Windows' })).toBe(false)
  })
})

// devices.test.ts
import { describe, it, expect, vi } from 'vitest'
import { DEVICE_PREFS_KEY, deviceLabel, loadDevicePrefs, pickDeviceId, saveDevicePrefs } from '@/lib/meetings/devices'

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}(${Object.values(values).join(',')})` : key

describe('device preferences', () => {
  it('defaults to mic and camera on when nothing is stored, storage is blocked or the value is junk', () => {
    const defaults = { micOn: true, camOn: true }
    expect(loadDevicePrefs(null)).toEqual(defaults)
    expect(loadDevicePrefs({ getItem: () => { throw new Error('SecurityError') } })).toEqual(defaults)
    expect(loadDevicePrefs({ getItem: () => '{nope' })).toEqual(defaults)
    expect(loadDevicePrefs({ getItem: () => JSON.stringify({ micOn: 'yes', audioInput: 42 }) })).toEqual(defaults)
  })

  it('round-trips stored choices and never throws on save', () => {
    const prefs = { audioInput: 'mic-2', videoInput: 'cam-1', audioOutput: 'spk-3', micOn: false, camOn: true }
    const store = new Map<string, string>()
    saveDevicePrefs(prefs, { setItem: (k, v) => void store.set(k, v) })
    expect(loadDevicePrefs({ getItem: (k) => store.get(k) ?? null })).toEqual(prefs)
    expect(store.has(DEVICE_PREFS_KEY)).toBe(true)
    expect(() => saveDevicePrefs(prefs, { setItem: vi.fn(() => { throw new Error('QuotaExceeded') }) })).not.toThrow()
  })

  it('keeps the preferred device only if it is still plugged in', () => {
    const devices = [{ deviceId: 'a' }, { deviceId: 'b' }]
    expect(pickDeviceId(devices, 'b')).toBe('b')
    expect(pickDeviceId(devices, 'gone')).toBe('a')
    expect(pickDeviceId([], 'b')).toBeUndefined()
  })

  it('names unlabeled devices (no permission yet) with a localized label', () => {
    expect(deviceLabel({ label: 'MacBook Microphone', kind: 'audioinput' }, 0, t)).toBe('MacBook Microphone')
    expect(deviceLabel({ label: '', kind: 'audioinput' }, 0, t)).toBe('deviceUnnamedMic(1)')
    expect(deviceLabel({ label: '', kind: 'videoinput' }, 1, t)).toBe('deviceUnnamedCamera(2)')
    expect(deviceLabel({ label: '', kind: 'audiooutput' }, 2, t)).toBe('deviceUnnamedSpeaker(3)')
  })
})
```

- [ ] **Step 4: RED** · **Step 5: Hiện thực** 5 file (mỗi file ≤ 140 dòng). `decodeReaction`: `payload.byteLength > 64` ⇒ null; `TextDecoder` + `JSON.parse` trong try; phải là object có đúng `e ∈ REACTION_EMOJIS` (khoá khác ngoài `e` ⇒ null). `matchShortcut` dùng `e.code` (Alt trên macOS đổi `e.key` thành `˙`), yêu cầu đúng modifier chính (meta trên Mac, ctrl nơi khác) và không có modifier chính kia, `shiftKey=false`, `KeyD`/`KeyE` cần `altKey=false`, `KeyH` cần `altKey=true`. `computeStage` theo luật ở Interfaces + test.
- [ ] **Step 6: GREEN** — `VT lib/meetings && TSC`
- [ ] **Step 7: Commit** `feat(web): pure room logic — phases, stage layout, reactions, shortcuts, devices`

---
### Task 15: Store UI phòng + `MeetingRoomController`

**Files:**
- Create: `W/lib/store/meeting.store.ts`, `ML/meeting-room-controller.ts` (nếu > 330 dòng: tách `ML/meeting-room-chat.ts` cho chat chờ + reaction)
- Modify: `W/messages/*.json` (khoá Task 15, 7 locale)
- Test: `ML/__tests__/meeting-room-controller.test.ts`

**Interfaces — Produces** (`meeting.store.ts`):

```ts
export type RoomPanel = 'people' | 'chat' | 'notes' | null
export interface PendingChat { clientId: string; content: string; sentAt: number; error: MessageKey | null }
export interface FloatingReaction { id: number; emoji: ReactionEmoji; name?: string; mine: boolean }
export interface MeetingRoomState {
  meetingId: string | null
  phase: RoomPhase
  myRole: MeetingRoomRole
  mic: boolean; camera: boolean; screen: boolean
  reconnecting: boolean; poorConnection: boolean
  peers: RemotePeer[]; localStream: MediaStream | null; localScreen: MediaStream | null
  activeSpeakerId: string | null           // sticky: last remote who spoke
  layout: LayoutMode; pinnedKey: string | null
  panel: RoomPanel; unreadChat: number
  pendingChat: PendingChat[]
  pendingHost: Partial<Record<HostAction, number>>   // action → sentAt (switch spinners)
  reactions: FloatingReaction[]
  sharedNoteRemote: RemoteNewer | null
  audioOutputId: string | undefined
  reset(): void
  setPanel(panel: RoomPanel): void          // opening chat clears unreadChat
  setLayout(layout: LayoutMode): void
  togglePin(key: string): void
  setAudioOutput(id: string | undefined): void
}
export const useMeetingRoomStore: UseBoundStore<StoreApi<MeetingRoomState>>
```

Dữ liệu server (roster, tay, phòng chờ, chat, ghi chú) **không** ở store — nằm trong Query (Task 7).

**Interfaces — Produces** (`meeting-room-controller.ts`):

```ts
export type RoomSession = Pick<LiveKitSession,
  'onLocalStream' | 'onPeersChanged' | 'onReconnecting' | 'onLocalPoorConnection' | 'onDisconnected'
  | 'onLocalMediaChanged' | 'onData' | 'connect' | 'setMic' | 'setCamera' | 'setScreenShare' | 'switchDevice'
  | 'publishData' | 'setPeerVideoEnabled' | 'disconnect' | 'peers' | 'localStream' | 'localScreenStream' | 'localMedia'>

export interface JoinMedia { mic: boolean; camera: boolean; audioDeviceId?: string; videoDeviceId?: string }
export interface MeetingRoomDeps {
  api: Pick<typeof meetingsApi, 'join' | 'leaveLobby' | 'get' | 'end' | 'admit' | 'deny'>
  queryClient: QueryClient
  publish(destination: string, body: object): void       // stompService.publish
  isRealtimeConnected(): boolean                        // stompService.isConnected
  createSession(): RoomSession                          // () => new LiveKitSession()
  now(): number
  newClientId(): string                                 // 'c-' + 12 random [A-Za-z0-9]
  notify(level: 'info' | 'error', msg: MessageKey): void // page localizes with t(`meeting.${key}`)
}

export class MeetingRoomController {
  constructor(meeting: Meeting, myId: string, deps: MeetingRoomDeps)
  readonly meetingId: string
  activate(): void                  // reset store, register as the active room (personal events)
  dispose(): void                   // disconnect, unregister, reset store
  join(media: JoinMedia): Promise<void>
  rejoin(): Promise<void>           // same media as the last join (fresh token)
  cancelWaiting(): Promise<void>    // DELETE /lobby → prejoin
  leave(): void                     // disconnect → 'left' (rejoin possible)
  endForAll(): Promise<void>        // POST /end → 'ended'
  toggleMic(): Promise<void>; toggleCamera(): Promise<void>; toggleScreenShare(): Promise<void>
  switchDevice(kind: 'audioinput' | 'videoinput', deviceId: string): Promise<void>
  setPeerVideoEnabled(identity: string, enabled: boolean): void
  setHand(raised: boolean): void
  sendChat(content: string): string | null   // clientId, or null when not sendable
  retryChat(clientId: string): void
  discardChat(clientId: string): void
  hostCommand(action: HostAction, targetId?: string): void
  admit(userId: string): Promise<void>; deny(userId: string): Promise<void>
  sendReaction(emoji: ReactionEmoji): boolean
  handle(e: MeetingEvent): void              // personal queue events (ActiveMeetingRoom)
  onRoster(roster: RosterEntry[]): void      // from room-events
  onSettings(settings: MeetingSettings): void
  onChat(e: Extract<MeetingEvent, { event: 'meet.chat' }>): void
  onSharedNoteUpdated(version: number, updatedBy?: MeetingPerson): void
  onEnded(): void
  onRealtimeReconnected(): Promise<void>
}
```

Quy tắc chính (test bên dưới là đặc tả):
- `join`: `phase='joining'` → `api.join` → `waiting` (không connect) | `connecting` → `createSession()` gắn callback → `connect(url, token, {video: camera, audio: mic, audioDeviceId, videoDeviceId})` → `inRoom`, `myRole = role`, `mic/camera` theo media. Lỗi join ⇒ `phaseAfterJoinError`. Lỗi connect: `MediaAccessError` ⇒ thử lại **một lần** với `{audio:false, video:false}` + `notify('error', {key:'mediaFailed'})`; `RoomConnectError` ⇒ `connectionLost`.
- Sự kiện cá nhân qua `phaseAfterPersonalEvent`: `rejoin` ⇒ `rejoin()`; `removed`/`ended` ⇒ ngắt session, xoá `pendingChat`; `meet.muted` ⇒ `mic=false` + `notify('info', mutedBy{name} | mutedByUnknown)`; `meet.lobby` không làm gì (cache đã có); `meet.error`: có `clientId` ⇒ tin chờ đó `error = meetingEventErrorKey(code, params, 'chat')`; có `action` ⇒ xoá `pendingHost[action]` + `notify('error', meetingEventErrorKey(code, params))`; còn lại (`RATE_LIMITED` khi giơ tay…) ⇒ `notify('error', …)`.
- `sendChat`: `trim`; rỗng / > 2000 / `phase !== 'inRoom'` / `!isRealtimeConnected()` ⇒ `null`. Gửi `/app/meet.chat {meetingId, content, clientId}` và thêm `pendingChat`. `onChat` xoá tin chờ có `clientId` khớp; tin của người khác khi `panel !== 'chat'` ⇒ `unreadChat + 1`.
- `hostCommand`: offline ⇒ `notify('error', {key:'realtimeOffline'})`, không gửi. `targetId` chỉ gửi với `TARGETED_HOST_ACTIONS`. Lệnh công tắc (`LOCK, UNLOCK, WAITING_ROOM_*, ATTENDEE_SCREEN_SHARE_*`) ghi `pendingHost[action] = now()`; `onSettings` xoá mọi pending công tắc. Pending quá 8s được UI coi như hết (UI so `now - sentAt`).
- `onSettings`: tôi là attendee, đang share, `allowAttendeeScreenShare=false` ⇒ `setScreenShare(false)` + `notify('info', {key:'shareRevoked'})`.
- `onRoster`: dòng của tôi có `role` khác `myRole` ⇒ cập nhật; attendee → manager ⇒ `notify('info', madeCohost)`; manager → attendee ⇒ `notify('info', revokedCohost)` + `setQueryData(lobby(id), [])`. Không có dòng của tôi ⇒ giữ nguyên.
- `sendReaction`: throttle 1/giây (`createReactionThrottle`), `publishData(REACTION_TOPIC, encodeReaction(e), false)`, thêm `FloatingReaction` (mine) — tự xoá sau 4s (`setTimeout`). `session.onData` topic `reaction` ⇒ `decodeReaction` (null ⇒ bỏ) ⇒ thêm reaction với `name` = `peer.name` (session) nếu có; tối đa 30 reaction đang bay (bỏ cái cũ nhất).
- Session callbacks → store: `onPeersChanged` (peers + `activeSpeakerId` = remote đang nói đầu tiên, giữ người cũ khi không ai nói), `onLocalStream`, `onReconnecting`, `onLocalPoorConnection`, `onLocalMediaChanged` (`mic/camera/screen`), `onDisconnected(reason)` ⇒ `phaseAfterRoomClosed`: `connectionLost`, hoặc `verify` ⇒ `api.get` ⇒ ENDED ? `ended` : `left` (lỗi GET ⇒ `left`).
- `onRealtimeReconnected`: `waiting` ⇒ `api.join` lại (lỡ `meet.admitted`); `inRoom` và tôi là host/co-host ⇒ `api.join` lại **chỉ để** server đẩy lại `meet.lobby` (gap B2) — bỏ token, không connect lại; attendee ⇒ không gọi gì (đồng bộ dữ liệu làm ở Task 16).
- `leave` ⇒ ngắt, `phase='left'`; `endForAll` ⇒ `api.end` ⇒ ngắt, `phase='ended'` (lỗi ⇒ `notify('error', meetingErrorKey(...))`, giữ nguyên phòng).
- `toggleMic/Camera/ScreenShare`: cập nhật lạc quan, lỗi ⇒ hoàn tác + `notify('error', mediaFailed | shareFailed)`; `ScreenShareError` vì người dùng huỷ hộp chọn ⇒ hoàn tác **không** báo lỗi. Attendee khi `!canShareScreen` ⇒ không làm gì.

- [ ] **Step 1: Test** — `ML/__tests__/meeting-room-controller.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import type { Meeting, MeetingSettings } from '@/lib/api/meeting-types'
import { DEFAULT_MEETING_SETTINGS } from '@/lib/api/meeting-types'
import type { LocalMediaState, RemotePeer } from '@/lib/rtc/livekit-session'
import { meetingKeys } from '@/lib/meetings/cache-updates'
import { getActiveMeetingRoom } from '@/lib/meetings/active-room'
import { encodeReaction } from '@/lib/meetings/reactions'
import { MeetingRoomController, type MeetingRoomDeps, type RoomSession } from '@/lib/meetings/meeting-room-controller'
import { useMeetingRoomStore } from '@/lib/store/meeting.store'

type Cb<A extends unknown[]> = ((...args: A) => void) | null

class FakeSession implements RoomSession {
  onLocalStream: Cb<[MediaStream]> = null
  onPeersChanged: Cb<[RemotePeer[]]> = null
  onReconnecting: Cb<[boolean]> = null
  onLocalPoorConnection: Cb<[boolean]> = null
  onDisconnected: Cb<['failed' | 'ended']> = null
  onLocalMediaChanged: Cb<[LocalMediaState]> = null
  onData: Cb<[string, Uint8Array, string | null]> = null
  connect = vi.fn(async (_url: string, _token: string, _opts: unknown) => undefined)
  setMic = vi.fn(async (_on: boolean) => undefined)
  setCamera = vi.fn(async (_on: boolean) => undefined)
  setScreenShare = vi.fn(async (_on: boolean) => undefined)
  switchDevice = vi.fn(async (_kind: 'audioinput' | 'videoinput', _id: string) => undefined)
  publishData = vi.fn((_topic: string, _payload: Uint8Array, _reliable: boolean) => undefined)
  setPeerVideoEnabled = vi.fn((_id: string, _on: boolean) => undefined)
  disconnect = vi.fn(() => undefined)
  peers = () => [] as RemotePeer[]
  localStream = () => null
  localScreenStream = () => null
  localMedia = () => ({ mic: true, camera: false, screen: false })
}

function httpError(status: number, code: string): AxiosError {
  const response = { status, data: { code, statusCode: status }, statusText: '', headers: {},
    config: { headers: new AxiosHeaders() } }
  return new AxiosError('x', 'ERR', undefined, undefined, response as AxiosResponse)
}

const S: MeetingSettings = DEFAULT_MEETING_SETTINGS
const MEETING: Meeting = { id: 'm1', code: 'abc-defg-hjk', host: { userId: 'h' }, status: 'LIVE', settings: S,
  viewerRole: 'invited', createdAt: '2026-10-08T00:00:00Z' }
const JOINED = (role: 'host' | 'cohost' | 'attendee' = 'attendee', token = 'tok') =>
  ({ status: 'joined' as const, url: 'wss://rtc', token, role })
const store = () => useMeetingRoomStore.getState()

let session: FakeSession
let deps: MeetingRoomDeps & {
  api: { [K in keyof MeetingRoomDeps['api']]: ReturnType<typeof vi.fn> }
  publish: ReturnType<typeof vi.fn>; notify: ReturnType<typeof vi.fn>
  now: ReturnType<typeof vi.fn>; isRealtimeConnected: ReturnType<typeof vi.fn>
}
let c: MeetingRoomController

beforeEach(() => {
  session = new FakeSession()
  deps = {
    api: { join: vi.fn(), leaveLobby: vi.fn(async () => undefined), get: vi.fn(), end: vi.fn(async () => undefined),
      admit: vi.fn(async () => undefined), deny: vi.fn(async () => undefined) },
    queryClient: new QueryClient(),
    publish: vi.fn(), isRealtimeConnected: vi.fn(() => true),
    createSession: () => session, now: vi.fn(() => 10_000), newClientId: () => 'c-abc',
    notify: vi.fn(),
  } as unknown as typeof deps
  c = new MeetingRoomController(MEETING, 'me', deps)
  c.activate()
})

async function inRoom(role: 'host' | 'cohost' | 'attendee' = 'attendee') {
  deps.api.join.mockResolvedValueOnce(JOINED(role))
  await c.join({ mic: true, camera: true })
}

describe('joining', () => {
  it('goes straight in with the chosen media and devices', async () => {
    deps.api.join.mockResolvedValueOnce(JOINED('cohost'))
    await c.join({ mic: false, camera: true, audioDeviceId: 'mic-1' })
    expect(session.connect).toHaveBeenCalledWith('wss://rtc', 'tok',
      expect.objectContaining({ video: true, audio: false, audioDeviceId: 'mic-1' }))
    expect(store()).toMatchObject({ phase: 'inRoom', myRole: 'cohost', mic: false, camera: true })
    expect(getActiveMeetingRoom()?.meetingId).toBe('m1')
  })

  it('waits in the lobby, then enters on its own when admitted', async () => {
    deps.api.join.mockResolvedValueOnce({ status: 'waiting' }).mockResolvedValueOnce(JOINED('attendee', 't2'))
    await c.join({ mic: true, camera: false })
    expect(store().phase).toBe('waiting')
    expect(session.connect).not.toHaveBeenCalled()

    c.handle({ event: 'meet.admitted', meetingId: 'm1' })
    await vi.waitFor(() => expect(store().phase).toBe('inRoom'))
    expect(deps.api.join).toHaveBeenCalledTimes(2)
    expect(session.connect).toHaveBeenCalledWith('wss://rtc', 't2', expect.objectContaining({ video: false, audio: true }))
  })

  it('shows the denial, and leaving the lobby tells the server', async () => {
    deps.api.join.mockResolvedValueOnce({ status: 'waiting' })
    await c.join({ mic: true, camera: true })
    await c.cancelWaiting()
    expect(deps.api.leaveLobby).toHaveBeenCalledWith('m1')
    expect(store().phase).toBe('prejoin')

    deps.api.join.mockResolvedValueOnce({ status: 'waiting' })
    await c.join({ mic: true, camera: true })
    c.handle({ event: 'meet.denied', meetingId: 'm1' })
    expect(store().phase).toBe('denied')
  })

  it.each([
    [403, 'MEETING_REMOVED', 'removed'],
    [403, 'MEETING_LOCKED', 'locked'],
    [409, 'MEETING_ENDED', 'ended'],
    [409, 'MEETING_FULL', 'full'],
    [503, 'MEETINGS_UNAVAILABLE', 'unavailable'],
  ])('a %i %s join ends on the %s screen', async (status, code, phase) => {
    deps.api.join.mockRejectedValueOnce(httpError(status, code))
    await c.join({ mic: true, camera: true })
    expect(store().phase).toBe(phase)
    expect(session.connect).not.toHaveBeenCalled()
  })
})

describe('being removed, muted, or the meeting ending', () => {
  it('a removal drops the media and the unsent chat', async () => {
    await inRoom()
    c.sendChat('bye')
    c.handle({ event: 'meet.removed', meetingId: 'm1' })
    expect(session.disconnect).toHaveBeenCalled()
    expect(store()).toMatchObject({ phase: 'removed', pendingChat: [] })
  })

  it('tells me who muted me, never their id', async () => {
    await inRoom()
    c.handle({ event: 'meet.muted', meetingId: 'm1', actor: { userId: 'h', displayName: 'Lan' } })
    expect(store().mic).toBe(false)
    expect(deps.notify).toHaveBeenLastCalledWith('info', { key: 'mutedBy', values: { name: 'Lan' } })
    c.handle({ event: 'meet.muted', meetingId: 'm1', actor: { userId: '64b0aaaaaaaaaaaaaaaaaaaa' } })
    expect(deps.notify).toHaveBeenLastCalledWith('info', { key: 'mutedByUnknown' })
  })

  it('the end of the meeting closes the room', async () => {
    await inRoom()
    c.onEnded()
    expect(session.disconnect).toHaveBeenCalled()
    expect(store().phase).toBe('ended')
  })

  it('ending for everyone calls the server', async () => {
    await inRoom('host')
    await c.endForAll()
    expect(deps.api.end).toHaveBeenCalledWith('m1')
    expect(store().phase).toBe('ended')
  })
})

describe('chat', () => {
  it('sends a trimmed line with a client id and clears it on the echo', async () => {
    await inRoom()
    expect(c.sendChat('  hello  ')).toBe('c-abc')
    expect(deps.publish).toHaveBeenCalledWith('/app/meet.chat', { meetingId: 'm1', content: 'hello', clientId: 'c-abc' })
    expect(store().pendingChat).toEqual([{ clientId: 'c-abc', content: 'hello', sentAt: 10_000, error: null }])
    c.onChat({ event: 'meet.chat', meetingId: 'm1', clientId: 'c-abc',
      message: { id: 'x', sender: { userId: 'me' }, content: 'hello', createdAt: 't' } })
    expect(store().pendingChat).toEqual([])
    expect(store().unreadChat).toBe(0)
  })

  it('marks a refused line and lets me retry or discard it', async () => {
    await inRoom()
    c.sendChat('spam')
    c.handle({ event: 'meet.error', meetingId: 'm1', clientId: 'c-abc', errorCode: 'RATE_LIMITED' })
    expect(store().pendingChat[0].error).toEqual({ key: 'errRateLimited' })
    c.retryChat('c-abc')
    expect(deps.publish).toHaveBeenCalledTimes(2)
    expect(store().pendingChat[0].error).toBeNull()
    c.discardChat('c-abc')
    expect(store().pendingChat).toEqual([])
  })

  it('refuses empty, too long, offline or not-in-room lines', async () => {
    expect(c.sendChat('hi')).toBeNull()
    await inRoom()
    expect(c.sendChat('   ')).toBeNull()
    expect(c.sendChat('x'.repeat(2001))).toBeNull()
    deps.isRealtimeConnected.mockReturnValue(false)
    expect(c.sendChat('hi')).toBeNull()
    expect(deps.publish).not.toHaveBeenCalled()
  })

  it('counts unread lines from others while the chat panel is closed', async () => {
    await inRoom()
    const line = (sender: string) => ({ event: 'meet.chat' as const, meetingId: 'm1',
      message: { id: sender, sender: { userId: sender }, content: 'x', createdAt: 't' } })
    c.onChat(line('bob'))
    c.onChat(line('me'))
    expect(store().unreadChat).toBe(1)
    store().setPanel('chat')
    expect(store().unreadChat).toBe(0)
    c.onChat(line('ann'))
    expect(store().unreadChat).toBe(0)
  })
})

describe('host commands', () => {
  it('sends targetId only for person actions and tracks switch commands until settings arrive', async () => {
    await inRoom('host')
    c.hostCommand('MUTE_MIC', 'u2')
    expect(deps.publish).toHaveBeenLastCalledWith('/app/meet.host', { meetingId: 'm1', action: 'MUTE_MIC', targetId: 'u2' })
    c.hostCommand('LOCK', 'ignored')
    expect(deps.publish).toHaveBeenLastCalledWith('/app/meet.host', { meetingId: 'm1', action: 'LOCK' })
    expect(store().pendingHost.LOCK).toBe(10_000)
    c.onSettings({ ...S, locked: true })
    expect(store().pendingHost.LOCK).toBeUndefined()
  })

  it('clears the pending switch and explains a refused command', async () => {
    await inRoom('cohost')
    c.hostCommand('WAITING_ROOM_OFF')
    c.handle({ event: 'meet.error', meetingId: 'm1', action: 'WAITING_ROOM_OFF', errorCode: 'MEETINGS_UNAVAILABLE' })
    expect(store().pendingHost.WAITING_ROOM_OFF).toBeUndefined()
    expect(deps.notify).toHaveBeenLastCalledWith('error', { key: 'errUnavailable' })
  })

  it('does not send while realtime is down', async () => {
    await inRoom('host')
    deps.isRealtimeConnected.mockReturnValue(false)
    c.hostCommand('MUTE_ALL')
    expect(deps.publish).not.toHaveBeenCalled()
    expect(deps.notify).toHaveBeenLastCalledWith('error', { key: 'realtimeOffline' })
  })

  it('stops my screen share when attendees lose the right to present', async () => {
    await inRoom('attendee')
    useMeetingRoomStore.setState({ screen: true })
    c.onSettings({ ...S, allowAttendeeScreenShare: false })
    expect(session.setScreenShare).toHaveBeenCalledWith(false)
    expect(deps.notify).toHaveBeenLastCalledWith('info', { key: 'shareRevoked' })
  })

  it('a co-host keeps presenting', async () => {
    await inRoom('cohost')
    useMeetingRoomStore.setState({ screen: true })
    c.onSettings({ ...S, allowAttendeeScreenShare: false })
    expect(session.setScreenShare).not.toHaveBeenCalled()
  })
})

describe('roles from the roster', () => {
  it('follows my current role and forgets the lobby when demoted', async () => {
    await inRoom('attendee')
    c.onRoster([{ userId: 'me', role: 'cohost', joinedAt: 't' }])
    expect(store().myRole).toBe('cohost')
    expect(deps.notify).toHaveBeenLastCalledWith('info', { key: 'madeCohost' })

    deps.queryClient.setQueryData(meetingKeys.lobby('m1'), [{ userId: 'g' }])
    c.onRoster([{ userId: 'me', role: 'attendee', joinedAt: 't' }])
    expect(store().myRole).toBe('attendee')
    expect(deps.queryClient.getQueryData(meetingKeys.lobby('m1'))).toEqual([])
    expect(deps.notify).toHaveBeenLastCalledWith('info', { key: 'revokedCohost' })

    c.onRoster([{ userId: 'someone', role: 'host', joinedAt: 't' }])
    expect(store().myRole).toBe('attendee')
  })
})

describe('reactions', () => {
  it('sends at most one per second over the lossy channel', async () => {
    await inRoom()
    expect(c.sendReaction('👍')).toBe(true)
    expect(session.publishData).toHaveBeenCalledWith('reaction', expect.any(Uint8Array), false)
    deps.now.mockReturnValue(10_500)
    expect(c.sendReaction('🎉')).toBe(false)
    expect(store().reactions).toHaveLength(1)
  })

  it('shows allowed reactions from others and drops anything else', async () => {
    await inRoom()
    session.onData?.('reaction', encodeReaction('❤️'), 'bob')
    session.onData?.('reaction', new TextEncoder().encode('{"e":"💩"}'), 'bob')
    session.onData?.('other-topic', encodeReaction('👍'), 'bob')
    expect(store().reactions.map((r) => r.emoji)).toEqual(['❤️'])
  })
})

describe('connection', () => {
  it('a dropped connection offers a rejoin; a closed room is checked against the server', async () => {
    await inRoom()
    session.onDisconnected?.('failed')
    expect(store().phase).toBe('connectionLost')

    await inRoom()
    deps.api.get.mockResolvedValueOnce({ ...MEETING, status: 'ENDED' })
    session.onDisconnected?.('ended')
    await vi.waitFor(() => expect(store().phase).toBe('ended'))

    await inRoom()
    deps.api.get.mockResolvedValueOnce(MEETING)
    session.onDisconnected?.('ended')
    await vi.waitFor(() => expect(store().phase).toBe('left'))
  })

  it('mirrors server-side mutes of my tracks', async () => {
    await inRoom()
    session.onLocalMediaChanged?.({ mic: false, camera: true, screen: false })
    expect(store()).toMatchObject({ mic: false, camera: true, screen: false })
  })

  it('after a STOMP reconnect: re-asks while waiting, refreshes the lobby for hosts only', async () => {
    deps.api.join.mockResolvedValueOnce({ status: 'waiting' })
    await c.join({ mic: true, camera: true })
    deps.api.join.mockResolvedValueOnce({ status: 'waiting' })
    await c.onRealtimeReconnected()
    expect(deps.api.join).toHaveBeenCalledTimes(2)

    await c.cancelWaiting()
    await inRoom('host')
    deps.api.join.mockResolvedValueOnce(JOINED('host', 'unused'))
    await c.onRealtimeReconnected()
    expect(deps.api.join).toHaveBeenCalledTimes(4)
    expect(session.connect).toHaveBeenCalledTimes(1)

    c.leave()
    await inRoom('attendee')
    await c.onRealtimeReconnected()
    expect(deps.api.join).toHaveBeenCalledTimes(5)
  })

  it('leaving keeps the page able to rejoin; dispose unregisters', async () => {
    await inRoom()
    c.leave()
    expect(session.disconnect).toHaveBeenCalled()
    expect(store().phase).toBe('left')
    c.dispose()
    expect(getActiveMeetingRoom()).toBeNull()
  })

  it('raises and lowers my hand', async () => {
    await inRoom()
    c.setHand(true)
    expect(deps.publish).toHaveBeenLastCalledWith('/app/meet.hand', { meetingId: 'm1', raised: true })
  })
})
```

- [ ] **Step 2: RED** — `VT lib/meetings/__tests__/meeting-room-controller.test.ts`
- [ ] **Step 3: Hiện thực store** (Zustand `create`, `reset()` về giá trị đầu; `setPanel('chat')` đặt `unreadChat: 0`; `togglePin(key)` bỏ ghim khi ghim lại cùng key).
- [ ] **Step 4: Hiện thực controller** theo "Quy tắc chính". Mỗi lần `join`/`rejoin` tạo session **mới** (session cũ `disconnect` trước); callback session cũ bị bỏ qua bằng so sánh `this.session !== session` (như `SfuGroupCall`). Timer reaction huỷ trong `dispose`. `newClientId` thật: `'c-' + crypto.getRandomValues` → base62 12 ký tự (ở page, không trong controller).
- [ ] **Step 5: GREEN** — `VT lib/meetings && TSC`; `wc -l lib/meetings/meeting-room-controller.ts` ≤ 400 (tách file nếu cần).
- [ ] **Step 6: Commit** `feat(web): meeting room controller and UI store`

---
### Task 16: `useMeetingRoomStomp` — topic phòng + đồng bộ lại khi nối lại

**Files:**
- Create: `W/lib/hooks/use-meeting-room-stomp.ts`

**Interfaces — Produces:**

```ts
export function useMeetingRoomStomp(args: {
  controller: MeetingRoomController
  meetingId: string
  code: string
  active: boolean            // phase ∈ connecting | inRoom
}): { realtimeConnected: boolean }
```

Hành vi:
- `const connected = useStompConnected()`. Effect `[connected, active, meetingId, controller]`: khi `connected && active` ⇒ `const sub = stompService.subscribe(\`/topic/meeting/${meetingId}\`, frame => { const e = parseMeetingEvent(frame.body); if (e) applyRoomEvent(e, deps) })` với `deps = { queryClient, meetingId, code, now: () => new Date(), onRoster: r => controller.onRoster(r), onSettings: s => controller.onSettings(s), onChat: e => controller.onChat(e), onSharedNoteUpdated: (v, by) => controller.onSharedNoteUpdated(v, by), onEnded: () => controller.onEnded() }`; cleanup `sub?.unsubscribe()`.
- Trong **cùng** effect, sau khi subscribe (subscribe trước, đọc sau — MT3 Sai khác #12): nếu đây không phải lần subscribe đầu của phiên phòng (ref `subscribedOnce`, chỉ đọc/ghi trong effect) ⇒ đồng bộ lại: `invalidateQueries` cho `roster(id)`, `hands(id)`, `detail(id)` (settings), `messages(id)` (trang mới nhất), `note(id,'shared')`; rồi `void controller.onRealtimeReconnected()`. Lần đầu: các query tự fetch khi component mount (Task 18/19/20) — không invalidate. (Ngoại lệ có chủ đích với rule "không refetch": đây là bù khoảng mất kết nối, giống `useRealtimeNotifications` đang làm cho danh sách hội thoại.)
- Trả `realtimeConnected = connected` cho banner `realtimeOffline` và để vô hiệu hoá chat/giơ tay/lệnh host.

- [ ] **Step 1:** Hiện thực (≤ 110 dòng). Không unit test (glue STOMP) — phủ bởi test `applyRoomEvent` (Task 7), controller (Task 15) và checklist tay Task 23 (mục "Nối lại").
- [ ] **Step 2: GREEN** — `TSC && pnpm lint`
- [ ] **Step 3: Commit** `feat(web): meeting room topic subscription with resync on reconnect`

---

### Task 17: Trang `/meet/[code]` — màn chờ thiết bị, phòng chờ, màn trạng thái

**Files:**
- Create: `W/app/(main)/meet/[code]/page.tsx`, `W/lib/hooks/use-media-preview.ts`, `MC/room/MeetingSession.tsx`, `MC/room/PreJoinLobby.tsx`, `MC/room/DeviceSelects.tsx`, `MC/room/MicLevel.tsx`, `MC/room/WaitingScreen.tsx`, `MC/room/RoomStatusScreen.tsx`
- Modify: `ML/devices.ts` (+ `safeLocalStorage(): Storage | null` — truy cập `window.localStorage` trong try/catch), `W/messages/*.json` (khoá Task 17, 7 locale)

**`page.tsx`** (≤ 90 dòng): `const { code: raw } = useParams<{ code: string }>()`; `const code = parseMeetingCodeInput(decodeURIComponent(raw))` (null ⇒ `RoomStatusScreen kind="notFound"`); `useMeetingByCode(code)`; `initialPhase(meeting, error)`:
- `loading` ⇒ khung tối toàn màn + spinner (`aria-busy`).
- `notFound` / `error` ⇒ `RoomStatusScreen` (error có `tryAgain` = `refetch`).
- `ended` ⇒ `router.replace(\`/meetings/${meeting.id}\`)` trong effect (điều hướng, không setState) — Review Focus 5.
- còn lại ⇒ `<MeetingSession key={meeting.id} meeting={meeting} />`.

Trang toàn màn hình: `h-dvh w-full overflow-hidden` (layout đã ẩn tab bar ở Task 9; `PageTransition` vẫn bọc — không thêm sidebar).

**`MeetingSession.tsx`** (≤ 180 dòng): tạo controller **một lần** `const [controller] = useState(() => new MeetingRoomController(meeting, myId, deps))` với `deps` thật: `api: meetingsApi`, `queryClient`, `publish: (d, b) => stompService.publish(d, b)`, `isRealtimeConnected: () => stompService.isConnected()`, `createSession: () => new LiveKitSession()`, `now: Date.now`, `newClientId` (crypto, base62 12 ký tự), `notify: (level, m) => (level === 'error' ? toast.error : toast)(t(m.key, m.values))`. Effect `controller.activate(); return () => controller.dispose()` — **controller phải chịu được StrictMode** (activate → dispose → activate trên cùng instance). `dispose` khi đang `waiting` ⇒ `api.leaveLobby` best-effort. `useMeetingRoomStomp({controller, meetingId, code, active: phase ∈ connecting|inRoom})`. Switch theo `phase` (store):

| phase | Render |
|---|---|
| `prejoin`, `joining`, `connecting` | `PreJoinLobby` (`joining/connecting` ⇒ nút chính loading, mọi điều khiển disabled) |
| `waiting` | `WaitingScreen` |
| `inRoom` | `MeetingRoom` (Task 18) |
| `ended` | effect: `toast(t('endedToast'))` một lần + `router.replace('/meetings/{id}')` |
| khác | `RoomStatusScreen kind={phase}` |

`phase` khởi tạo bởi `activate()` = `'prejoin'`.

**`useMediaPreview`** — `W/lib/hooks/use-media-preview.ts` (≤ 170 dòng):

```ts
export interface MediaPreview {
  stream: MediaStream | null
  mic: boolean; camera: boolean
  setMic(on: boolean): void; setCamera(on: boolean): void
  devices: { audioinput: MediaDeviceInfo[]; videoinput: MediaDeviceInfo[]; audiooutput: MediaDeviceInfo[] }
  audioInput?: string; videoInput?: string; audioOutput?: string
  selectDevice(kind: MediaDeviceKind, deviceId: string): void
  error: 'blocked' | 'unavailable' | null
  /** Stop every preview track (call before LiveKit captures the same devices). */
  release(): void
}
export function useMediaPreview(initial: DevicePrefs): MediaPreview
```

`getUserMedia({ audio: mic && { deviceId }, video: camera && { deviceId } })` mỗi lần bật/đổi thiết bị (setState trong callback promise, không đồng bộ trong effect); dừng track cũ; `NotAllowedError|SecurityError` ⇒ `blocked`, `NotFoundError|OverconstrainedError` ⇒ `unavailable` (và tắt toggle tương ứng); `enumerateDevices` sau khi có quyền + nghe `devicechange`; unmount ⇒ `release()`.

**`PreJoinLobby.tsx`** (≤ 230 dòng) — props `{ meeting, controller, busy: boolean }`:
- `const prefs = loadDevicePrefs(safeLocalStorage())` (một lần, `useState` lazy); muteOnEntry + vai trò sẽ là attendee (`!isManager(meeting.viewerRole)`) ⇒ mic mặc định **tắt** + dòng `prejoinMuteOnEntry`.
- Cột trái (`md:grid md:grid-cols-[1fr_320px] gap-8`, phone xếp dọc): preview `aspect-video rounded-xl bg-neutral-950 overflow-hidden` với `<video muted autoPlay playsInline className="-scale-x-100 object-cover">` (ẩn khi camera tắt ⇒ chữ cái đầu tên + `prejoinCameraOff`), dưới đáy preview hai nút tròn 44px mic/cam (`aria-pressed`, `aria-label` `micOff|micOn`, `camOff|camOn`; bật = `secondary`, tắt = `destructive`), `MicLevel` khi mic bật; dưới preview `DeviceSelects`.
- Cột phải: tiêu đề cuộc họp (`text-xl font-semibold`), `prejoinStartsAt{time}` khi `scheduledStart` còn ở tương lai (`useNow`), `prejoinJoiningAs{name}`, cảnh báo theo thứ tự: `prejoinInCall` (khi `useCallStore` đang có cuộc gọi — nút chính disabled), `prejoinLockedHint` (intent `locked`), lỗi thiết bị `mediaBlocked|mediaUnavailable`. Nút chính duy nhất (`default`, full-width): `joinNow` (intent `join`) / `askToJoin` (intent `ask`) / `joinNow` vẫn cho bấm khi `locked` (server quyết — có thể là người được mời mà cache cũ). Link phụ `backToList` → `/meetings`.
- Bấm vào: `saveDevicePrefs({...ids, micOn, camOn}, safeLocalStorage())`, `preview.release()`, `controller.join({ mic, camera, audioDeviceId, videoDeviceId })`, `useMeetingRoomStore.getState().setAudioOutput(audioOutput)`.

**`DeviceSelects.tsx`** (≤ 110 dòng) — ba `Select` có `Label` (`deviceMic`, `deviceCamera`, `deviceSpeaker` — loa chỉ khi `supportsSpeakerSelection()`), mục đầu `deviceDefault`, nhãn qua `deviceLabel`. Dùng lại ở `RoomDevicesDialog` (Task 18).

**`MicLevel.tsx`** (≤ 60 dòng) — `stream` ⇒ `AudioContext` + `AnalyserNode`, vòng `requestAnimationFrame` ghi `style.transform = scaleX(level)` lên ref của thanh (DOM, không setState mỗi frame); `role="meter"` `aria-label={t('micLevel')}` `aria-valuemin=0 aria-valuemax=100` cập nhật ~4 lần/giây; cleanup đóng AudioContext + `cancelAnimationFrame`; `prefers-reduced-motion` vẫn cập nhật (thông tin, không trang trí).

**`WaitingScreen.tsx`** (≤ 80 dòng) — giữa màn: vòng tròn chữ cái của mình + spinner nhỏ, `waitingTitle` (h1), `waitingDesc`, tiêu đề cuộc họp, nút `waitingCancel` (outline) ⇒ `controller.cancelWaiting()`. `aria-live="polite"` cho câu trạng thái.

**`RoomStatusScreen.tsx`** (≤ 130 dòng) — props `{ kind: 'notFound' | 'denied' | 'removed' | 'locked' | 'full' | 'unavailable' | 'left' | 'connectionLost' | 'error'; meetingId?: string; onRetry?: () => void }`. Bảng icon lucide + khoá: `notFound` SearchX `notFoundTitle/Desc` · `denied` Ban `deniedTitle/Desc` · `removed` UserX `removedTitle/Desc` · `locked` Lock `lockedTitle/Desc` · `full` Users `fullTitle/Desc{max:25}` · `unavailable` CloudOff `unavailableTitle/Desc` · `left` LogOut `leftTitle` · `connectionLost` WifiOff `connectionLostTitle/Desc` · `error` AlertCircle `errGeneric`. Nút: `canRejoin(kind)` ⇒ `rejoin` (left/connectionLost) hoặc `tryAgain` (locked/full/unavailable/error) gọi `onRetry`; có `meetingId` và kind ≠ `notFound` ⇒ `viewDetails`; luôn có `backToList`. Tiêu đề là `<h1 tabIndex={-1}>` được focus khi mount (trình đọc màn hình đọc ngay).

- [ ] **Step 1:** Viết các file theo mô tả + `safeLocalStorage` (kèm 1 test trong `devices.test.ts`: getter `window.localStorage` ném lỗi ⇒ `null`, dùng `vi.spyOn(window, 'localStorage', 'get')`).
- [ ] **Step 2:** Khoá Task 17 (7 locale).
- [ ] **Step 3: GREEN** — `VT lib/meetings lib/__tests__/i18n-parity.test.ts && TSC && pnpm lint`; `wc -l` ≤ 400.
- [ ] **Step 4: Kiểm tay** — mở link khi trình duyệt chặn camera (vẫn vào được với mic/cam tắt); chọn micro khác ⇒ thanh mức âm chạy; tải lại trang ⇒ thiết bị và trạng thái mic/cam được nhớ; ẩn danh (localStorage chặn) vẫn chạy; link sai ⇒ "Không tìm thấy cuộc họp"; link cuộc họp đã kết thúc ⇒ sang trang chi tiết.
- [ ] **Step 5: Commit** `feat(web): meeting pre-join, waiting room and status screens`

---

### Task 18: Phòng họp — sân khấu, ô video, âm thanh, thanh điều khiển, reaction, phím tắt

**Files:**
- Create: `W/components/call/VideoTile.tsx` (tách từ `ParticipantTileGrid.tsx`), `MC/room/MeetingRoom.tsx`, `MC/room/MeetingStage.tsx`, `MC/room/MeetingTile.tsx`, `MC/room/RemoteAudio.tsx`, `MC/room/ControlBar.tsx`, `MC/room/ReactionPicker.tsx`, `MC/room/ReactionOverlay.tsx`, `MC/room/LeaveMenu.tsx`, `MC/room/RoomDevicesDialog.tsx`, `MC/room/SidePanel.tsx`, `W/lib/hooks/use-meeting-shortcuts.ts`
- Modify: `W/components/call/ParticipantTileGrid.tsx` (import `VideoTile`), `W/messages/*.json` (khoá Task 18, 7 locale)

**`VideoTile.tsx`** — chuyển nguyên `VideoTile` (+ `initial`) ra file riêng, `export`; **thêm** prop tuỳ chọn: `badges?: ReactNode` (góc trên phải), `fit?: 'cover' | 'contain'` (mặc định `'cover'`), `avatarUrl?: string` (thay chữ cái khi có), `className?: string`. Mặc định giữ nguyên DOM/class hiện tại ⇒ Cuộc gọi không đổi. `ParticipantTileGrid` chỉ đổi import (diff ≤ 5 dòng). Báo Trí (Module B).

**`MeetingRoom.tsx`** (≤ 200 dòng) — khung:

```
<div className="flex h-dvh flex-col bg-background">
  <div className="flex min-h-0 flex-1">
    <main className="relative min-w-0 flex-1 bg-neutral-950" aria-label={meeting title}>
      <RoomBanners/>            reconnecting · realtimeOffline · poorConnection (role="status")
      <MeetingStage/>
      <ReactionOverlay/>
    </main>
    <SidePanel/>                md+: aside 360px; phone: Sheet bottom
  </div>
  <ControlBar/>
  <RemoteAudio/>
</div>
```

Đọc từ store bằng selector hẹp (`useMeetingRoomStore((s) => s.peers)`…) để không re-render cả cây khi reaction bay. `useMeetingShortcuts(controller)`. `useMeetingHands(id, true)`, `useMeetingRoster(id, true)` (mồi).

**`MeetingStage.tsx`** (≤ 180 dòng) — `computeStage({ mode: layout, pinnedKey, localIdentity: myId, remoteIds: peers.map(p => p.identity), screenSharers: [...(screen ? [myId] : []), ...peers.filter(p => p.screen).map(p => p.identity)], activeSpeakerId, maxTiles: isMobile ? 6 : 25 })`. Effect đồng bộ `hiddenIds` ⇒ `controller.setPeerVideoEnabled(id, false)` cho người bị ẩn và `true` cho người hiện lại (so với lần trước, ref chỉ dùng trong effect). Render:
- Có `main`: ô lớn `flex-1` + dải ô nhỏ (`md`: cột phải 200px cuộn dọc; phone: hàng dưới cuộn ngang, ô 120px) .
- Không: lưới CSS `grid gap-2 p-2` với `gridTemplateColumns: repeat(gridColumns(n, isMobile), minmax(0,1fr))`, ô `aspect-video`; ô "+N" (`overflowTiles`) mở panel Mọi người.

**`MeetingTile.tsx`** (≤ 140 dòng) — props `{ tile: StageTile; variant: 'main' | 'grid' | 'strip' }`; lấy peer từ store theo `identity`, vai trò từ roster query, tay từ hands query (số thứ tự = vị trí + 1). Dùng `VideoTile` với `muted` (âm thanh qua `RemoteAudio`), `fit="contain"` cho ô share, `speaking`, `avatarUrl` (`absoluteMediaUrl`), nhãn `name` (`safeDisplayName(peer.name, identity)` → roster `displayName` → `participantFallback`; ô của mình `nameWithYou{name}`); ô share: `presentingName{name}`; ô share **của mình** ở `main` ⇒ không phát video (tránh gương vô hạn) mà hiện khối `presenting` + nút `stopPresenting`. `badges`: `MicOff` (`micMutedLabel`) khi `micMuted`, `Hand` + số thứ tự (`handRaisedLabel`) khi giơ tay, `Shield` nhỏ cho host/co-host; menu nhỏ khi hover/focus (`DropdownMenu`, nút `MoreVertical` `aria-label`) có `pin/unpin` (`store.togglePin(tile.key)`). Ô `poorConnection` ⇒ icon `SignalLow`.

**`RemoteAudio.tsx`** (≤ 60 dòng) — mỗi peer một `<audio autoPlay>` cho `peer.stream` và một cho `peer.screen` (nếu có), `srcObject` gán trong effect theo ref, `setSinkId(audioOutputId)` khi `supportsSpeakerSelection()` và có id (lỗi ⇒ bỏ qua). Ẩn khỏi cây truy cập (`aria-hidden`).

**`ControlBar.tsx`** (≤ 220 dòng) — `h-16 md:h-[72px] border-t border-border/60 bg-background px-2 md:px-4`, `role="toolbar"` `aria-label` = tiêu đề cuộc họp. Nút tròn `size-11` (`Button size="icon" className="rounded-full"`), mỗi nút có `aria-label` + `title` = `withShortcut{label, shortcut}` khi có phím tắt:
- **Mic** (`aria-pressed={mic}`; bật = `secondary`, tắt = `destructive`) ⇒ `controller.toggleMic()`.
- **Camera** (như mic) ⇒ `toggleCamera()`.
- **Trình bày** (`MonitorUp`/`MonitorOff`) — chỉ khi `supportsScreenShare()`; disabled + tooltip `shareDisabled` khi `!canShareScreen(myRole, settings)`; ⇒ `toggleScreenShare()`.
- **Giơ tay** (`Hand`, `aria-pressed` = tay mình có trong hands query) ⇒ `controller.setHand(!raised)`; disabled khi `!realtimeConnected`.
- **Reaction** (`SmilePlus`) ⇒ `Popover` `ReactionPicker`.
- `md+`: **Mọi người** (`Users` + badge số người chờ cho manager — `useMeetingLobby(id).data.length`), **Chat** (`MessageSquare` + chấm `unreadChat`, `aria-label` kèm `chatUnread{count}`), **Ghi chú** (`NotebookPen`); bấm lại nút đang mở ⇒ đóng panel. Phone: ba mục này trong menu **Thêm** (`MoreHorizontal`).
- **Thêm** (`DropdownMenu`): Bố cục (`layoutGrid` / `layoutSpotlight` dạng radio), `devicesTitle` ⇒ `RoomDevicesDialog`, (manager) `manageTitle` ⇒ mở panel Mọi người ở mục quyền (Task 19).
- **Rời** — `LeaveMenu`: attendee ⇒ một nút `destructive` `leave` (`PhoneOff`) gọi `controller.leave()`; host/co-host ⇒ nút mở menu `leaveMeeting` / `endForAll` (`ConfirmDialog` `endConfirmTitle/Desc`, destructive) ⇒ `controller.endForAll()`.
- Dải trái (`lg+`): giờ hiện tại + mã phòng `font-mono text-xs text-muted-foreground`.

**`ReactionPicker.tsx`** (≤ 60 dòng) — 6 nút emoji (`aria-label` = emoji), bấm ⇒ `controller.sendReaction(e)`; `false` (throttle) ⇒ nút rung nhẹ (`motion-safe:animate-…`) không toast.

**`ReactionOverlay.tsx`** (≤ 90 dòng) — `store.reactions` bay lên từ góc trái dưới (CSS keyframe 3s, `motion-reduce:` hiện tĩnh 2s), kèm tên nhỏ; vùng `aria-live="polite"` ẩn đọc `reactionAria{name, emoji}` cho tối đa 1 reaction/2s (không spam trình đọc màn hình); `pointer-events-none`.

**`RoomDevicesDialog.tsx`** (≤ 100 dòng) — `ResponsiveModal` `devicesTitle` dùng `DeviceSelects` với danh sách `navigator.mediaDevices.enumerateDevices()`; đổi ⇒ `controller.switchDevice(kind, id)` / `store.setAudioOutput(id)`; lưu `saveDevicePrefs`.

**`SidePanel.tsx`** (≤ 80 dòng) — `panel` từ store; `md+`: `<aside className="hidden md:flex w-[360px] flex-col border-l border-border/60 bg-card">` với header (tiêu đề panel `text-base font-semibold` + nút đóng `common.close`); phone: `Sheet side="bottom"` cao `85dvh`, `rounded-t-2xl`. Nội dung: `ParticipantsPanel` / `MeetingChatPanel` / `NotesPanel` (Task 19–21; tạm `null` cho tới khi có). Đóng panel ghi chú ⇒ `flush()` (Task 21).

**`use-meeting-shortcuts.ts`** (≤ 50 dòng) — `keydown` trên `window`: `matchShortcut(e, isMacPlatform(navigator))` ⇒ `preventDefault()` + `toggleMic/toggleCamera/setHand(!raised)`; không chặn khi đang gõ IME (`isComposing`).

- [ ] **Step 1:** Tách `VideoTile` trước, chạy `VT lib/webrtc && TSC` (Cuộc gọi không đổi).
- [ ] **Step 2:** Viết các file còn lại; nối `MeetingSession` (Task 17) render `MeetingRoom` khi `inRoom`.
- [ ] **Step 3:** Khoá Task 18 (7 locale).
- [ ] **Step 4: GREEN** — `VT && TSC && pnpm lint`; `wc -l components/meeting/room/*.tsx components/call/*.tsx` ≤ 400.
- [ ] **Step 5: Kiểm tay** — 2 trình duyệt: vào phòng, thấy/nghe nhau; tắt mic ⇒ ô bên kia có `MicOff`; người nói có viền; đổi Lưới ⇄ Người nói; ghim; trình bày màn hình (Chrome) ⇒ ô lớn bên kia, "Dừng chia sẻ" của trình duyệt ⇒ nút tự về trạng thái tắt; phím `Ctrl/⌘+D`, `Ctrl/⌘+E`, `Ctrl/⌘+Alt+H`; reaction hiện ở cả hai bên, bấm liên tục chỉ gửi 1/giây; bố cục người nói vẫn nghe tiếng người không có ô; phone (375px): thanh không tràn, panel là bottom sheet.
- [ ] **Step 6: Commit** `feat(web): meeting room stage, controls, reactions and shortcuts`

---
### Task 19: Panel Mọi người — giơ tay, phòng chờ, menu host (13 lệnh)

**Files:**
- Create: `MC/room/ParticipantsPanel.tsx`, `MC/room/LobbySection.tsx`, `MC/room/ParticipantRow.tsx`, `MC/room/HostMenu.tsx`, `MC/room/RoomManageMenu.tsx`
- Modify: `MC/room/SidePanel.tsx`, `W/messages/*.json` (khoá Task 19, 7 locale)

**`ParticipantsPanel.tsx`** (≤ 200 dòng) — dữ liệu: `useMeetingRoster(id)`, `useMeetingHands(id)`, `useMeetingLobby(id)`, peers (store, để biết mic), `myRole` (store), settings (`useMeeting(id)` / byCode). Ba mục theo thứ tự, mỗi mục có tiêu đề nhóm `text-xs font-medium uppercase tracking-wide text-muted-foreground` (`<h3>`) và `<ul role="list">`:
1. **Đang giơ tay ({n})** — theo đúng thứ tự `hands` (sớm nhất trước), số thứ tự `1.` `2.`…; manager: nút `actionLowerHand` cạnh mỗi người + `actionLowerAllHands` ở tiêu đề nhóm. Ẩn khi rỗng.
2. **Đang chờ vào ({n})** — chỉ manager (`LobbySection`). Ẩn khi rỗng.
3. **Trong cuộc họp ({n})** — roster (mình đầu, rồi host, co-host, còn lại theo `joinedAt`), mỗi hàng `ParticipantRow`.
4. Manager: khối **Quyền người tổ chức** (`RoomManageMenu`, dạng danh sách công tắc ở cuối panel; nút "Thêm → manageTitle" của ControlBar cuộn tới đây).

**`LobbySection.tsx`** (≤ 90 dòng) — mỗi người chờ: chữ cái + tên (`safeDisplayName` → `participantFallback`) + `admit` (outline, sm) / `deny` (ghost, sm) ⇒ `controller.admit/deny(userId)` (pending ⇒ disabled; lỗi ⇒ toast map lỗi). `admitAll` khi ≥ 2 người (gọi tuần tự). Khi số người chờ **tăng** mà panel đang đóng ⇒ `MeetingRoom` toast `lobbyWaiting{count}` với action mở panel (so sánh trong effect với ref số cũ, không setState trong effect — toast là side-effect hợp lệ).

**`ParticipantRow.tsx`** (≤ 110 dòng) — avatar 32 (chữ cái / `avatarUrl` của peer), tên (+ `you`), nhãn vai trò (`roleHost|roleCohost`), icon `MicOff` khi peer `micMuted`, icon `Hand` khi giơ tay; `HostMenu` khi `personActions(...)` không rỗng.

**`HostMenu.tsx`** (≤ 120 dòng) — `DropdownMenu`, nút `MoreVertical` `aria-label={t('personMenu', { name })}`; mục theo `personActions(myRole, myId, { userId, role, handRaised, micOn: !peer?.micMuted })`:

| action | Nhãn | Xác nhận | Gửi |
|---|---|---|---|
| `MUTE_MIC` | `actionMuteMic` | — | `hostCommand('MUTE_MIC', id)` |
| `LOWER_HAND` | `actionLowerHand` | — | `hostCommand('LOWER_HAND', id)` |
| `MAKE_COHOST` | `actionMakeCohost` | — | `hostCommand('MAKE_COHOST', id)` |
| `REVOKE_COHOST` | `actionRevokeCohost` | — | `hostCommand('REVOKE_COHOST', id)` |
| `REMOVE` | `actionRemove` (destructive) | `ConfirmDialog` `removeConfirmTitle{name}` / `removeConfirmDesc` | `hostCommand('REMOVE', id)` |

**`RoomManageMenu.tsx`** (≤ 160 dòng) — `const rc = roomControls(myRole, settings, hands.length > 0)`; null ⇒ không render.
- Nút `actionMuteAll` (outline) ⇒ `ConfirmDialog` `muteAllConfirmTitle/Desc` ⇒ `hostCommand('MUTE_ALL')`.
- Nút `actionLowerAllHands` khi `rc.lowerAllHands` ⇒ `hostCommand('LOWER_ALL_HANDS')`.
- `Switch` **Khoá cuộc họp** (`settingLocked`, checked = `settings.locked`) ⇒ `hostCommand(rc.lock)`; **Phòng chờ** ⇒ `hostCommand(rc.waitingRoom)`; **Người tham dự được trình bày màn hình** ⇒ `hostCommand(rc.screenShare)`. Mỗi switch `disabled` + spinner khi `pendingHost[action]` còn trong 8s (`useNow({updateInterval: 1000})` chỉ khi có pending).
- `Switch` **Người tham dự được sửa ghi chú chung** — không có lệnh STOMP (MT3 Sai khác #9) ⇒ `useUpdateMeeting(id).mutate({ settings: { attendeesCanEditNotes: !current } })`; server phát `meet.settings` cho cả phòng.
- Tổng cộng 13 action đều có đường gửi: `MUTE_MIC, REMOVE, LOWER_HAND, MAKE_COHOST, REVOKE_COHOST` (HostMenu) + `MUTE_ALL, LOWER_ALL_HANDS, LOCK, UNLOCK, WAITING_ROOM_ON, WAITING_ROOM_OFF, ATTENDEE_SCREEN_SHARE_ON, ATTENDEE_SCREEN_SHARE_OFF` (RoomManageMenu).

- [ ] **Step 1: Test** — thêm vào `ML/__tests__/permissions.test.ts` một kiểm tra phủ đủ 13 action:

```ts
import { HOST_ACTIONS } from '@/lib/api/meeting-types'

it('every host action is reachable from some menu state', () => {
  const reachable = new Set<string>()
  const targets = [
    { userId: 't', role: 'attendee' as const, handRaised: true, micOn: true },
    { userId: 't', role: 'cohost' as const, handRaised: false, micOn: true },
  ]
  for (const tg of targets) personActions('host', 'me', tg).forEach((a) => reachable.add(a))
  for (const s of [S, { ...S, locked: true, waitingRoom: false, allowAttendeeScreenShare: false }]) {
    const rc = roomControls('host', s, true)!
    reachable.add('MUTE_ALL'); if (rc.lowerAllHands) reachable.add('LOWER_ALL_HANDS')
    reachable.add(rc.lock); reachable.add(rc.waitingRoom); reachable.add(rc.screenShare)
  }
  expect([...reachable].sort()).toEqual([...HOST_ACTIONS].sort())
})
```

- [ ] **Step 2: GREEN test** — `VT lib/meetings/__tests__/permissions.test.ts`
- [ ] **Step 3:** Viết 5 component; nối vào `SidePanel` (`panel === 'people'`). Khoá Task 19 (7 locale).
- [ ] **Step 4: GREEN** — `VT && TSC && pnpm lint`; `wc -l` ≤ 400.
- [ ] **Step 5: Kiểm tay** — 3 người giơ tay A, B, C ⇒ thứ tự A, B, C ở mọi máy; A giơ lại ⇒ không đổi chỗ; host "Hạ tất cả" ⇒ rỗng; khách mở link ⇒ host thấy số chờ + toast, Cho vào ⇒ khách vào ngay; Từ chối ⇒ khách thấy màn từ chối; phong co-host ⇒ người đó thấy menu host + phòng chờ; thu hồi ⇒ mất; tắt quyền trình bày khi attendee đang trình bày ⇒ dừng + toast; khoá phòng ⇒ khách mới thấy màn khoá, người đã ở trong vào lại được.
- [ ] **Step 6: Commit** `feat(web): meeting participants panel, waiting room and host controls`

---

### Task 20: Chat trong họp

**Files:**
- Create: `MC/room/MeetingChatPanel.tsx`
- Modify: `MC/room/SidePanel.tsx`, `W/messages/*.json` (khoá Task 20, 7 locale)

**`MeetingChatPanel.tsx`** (≤ 220 dòng; tách `ChatLine`/`ChatComposer` con trong cùng file hoặc file riêng nếu vượt):
- Dữ liệu: `useMeetingMessages(id, true)` ⇒ `flattenMessages` (cũ → mới) + `pendingChat` (store) nối sau cùng. Danh sách `role="log"` `aria-live="polite"` `aria-relevant="additions"`; tự cuộn xuống cuối khi có tin mới **nếu** người dùng đang ở gần cuối (≤ 80px), không thì hiện nút "↓ {chatUnread}"; cuộn lên đầu ⇒ `fetchNextPage` (giữ vị trí cuộn bằng chênh `scrollHeight`), có nút `chatLoadOlder` dự phòng cho bàn phím.
- Mỗi dòng: tên người gửi (gộp liên tiếp cùng người trong 2 phút ⇒ chỉ hiện tên dòng đầu), giờ `Intl.DateTimeFormat(locale, { timeStyle: 'short' })`, nội dung text thuần `whitespace-pre-wrap break-words text-sm`. Tin của mình căn phải nền `accent`. Tin chờ: mờ 60% + `chatSending`; lỗi: viền `destructive` + câu lỗi (`t(error.key, error.values)`) + `chatRetry` / `chatDiscard` ⇒ `controller.retryChat/discardChat`. Tin chờ quá 10s không có tiếng vọng ⇒ coi là lỗi `errNetwork` (tính trong render từ `useNow({updateInterval: 2000})` khi có tin chờ — không setState).
- Ô soạn: `Textarea` tự giãn 1–5 dòng, `aria-label={t('chatPlaceholder')}`, Enter gửi / Shift+Enter xuống dòng (bỏ qua khi `isComposing`), `chatCounter` khi > 1800, vượt 2000 ⇒ nút Gửi disabled + `errChatTooLong{max}`; `!realtimeConnected` ⇒ disabled + dòng `chatOffline`. Gửi ⇒ `controller.sendChat(text)` ⇒ khác `null` thì xoá ô.
- Rỗng ⇒ `chatEmpty`.
- Mở panel chat ⇒ `setPanel('chat')` đã xoá `unreadChat` (store).

- [ ] **Step 1:** Viết component; nối vào `SidePanel`. Khoá Task 20 (7 locale).
- [ ] **Step 2: GREEN** — `VT && TSC && pnpm lint`
- [ ] **Step 3: Kiểm tay** — 2 người chat qua lại; gửi 12 tin trong 3 giây ⇒ tin thứ 11+ hiện lỗi "Bạn gửi quá nhanh" + Gửi lại; ngắt mạng ⇒ ô soạn khoá + dòng chatOffline; vào giữa chừng ⇒ thấy lịch sử; cuộn lên tải tin cũ không nhảy vị trí; nội dung `<b>x</b>` hiện nguyên văn.
- [ ] **Step 4: Commit** `feat(web): in-meeting chat with optimistic lines and errors`

---

### Task 21: Ghi chú trong phòng

**Files:**
- Create: `MC/room/NotesPanel.tsx`
- Modify: `MC/room/SidePanel.tsx`, `MC/NotesEditor.tsx` (prop `onFlushReady?(flush: () => Promise<void>)` để panel gọi khi đóng), `ML/meeting-room-controller.ts` (`onSharedNoteUpdated` ⇒ `store.sharedNoteRemote = {version, updatedBy}`; `leave()`/`endForAll()` gọi `flushNotes` đã đăng ký trước khi ngắt — best-effort, không chặn rời phòng quá 1s)

**`NotesPanel.tsx`** (≤ 70 dòng) — `NotesEditor` với `meetingId`, `canEditShared = canEditSharedNote(myRole, settings)` (vai trò **hiện tại** trong phòng, đổi ngay khi được phong/thu hồi co-host hoặc host bật/tắt `attendeesCanEditNotes`), `sharedRemote = useMeetingRoomStore(s => s.sharedNoteRemote)`. Đăng ký `flush` với controller (`controller.registerNotesFlush(fn)` — thêm method nhỏ, test trong `meeting-room-controller.test.ts`: `leave()` gọi flush đã đăng ký).

- [ ] **Step 1: Test** — thêm vào `meeting-room-controller.test.ts`:

```ts
it('flushes unsaved notes before leaving and remembers the latest shared-note signal', async () => {
  await inRoom()
  const flush = vi.fn(async () => undefined)
  c.registerNotesFlush(flush)
  c.onSharedNoteUpdated(5, { userId: 'u2', displayName: 'Minh' })
  expect(store().sharedNoteRemote).toEqual({ version: 5, updatedBy: { userId: 'u2', displayName: 'Minh' } })
  c.leave()
  expect(flush).toHaveBeenCalled()
  expect(store().phase).toBe('left')
})
```

- [ ] **Step 2: RED → hiện thực → GREEN** — `VT lib/meetings components/meeting && TSC`
- [ ] **Step 3: Kiểm tay** — Review Focus 1 trong phòng: A và B cùng gõ ghi chú chung, B lưu sau ⇒ khối xung đột, chữ B còn; B "Lưu bản đã gộp" ⇒ A thấy dải "Minh vừa lưu bản mới hơn" (A đang sửa) hoặc nội dung mới (A không sửa); host tắt "Người tham dự được sửa ghi chú chung" ⇒ ghi chú chung của attendee thành chỉ đọc ngay; rời phòng khi vừa gõ ⇒ mở trang chi tiết thấy chữ đã lưu.
- [ ] **Step 4: Commit** `feat(web): meeting notes panel in the room`

---

### Task 22: Rà soát a11y, responsive, i18n, không lộ dữ liệu thô

- [ ] **i18n đủ 7 locale có bản dịch thật** (không chép tiếng Anh sang zh/ja/ko/es/fr): `VT lib/__tests__/i18n-parity.test.ts`; soát tay `meeting.*` trong `zh.json`, `ja.json` có ký tự CJK.
- [ ] **Không chuỗi cứng trong JSX:** `grep -rnE ">[A-Za-zÀ-ỹ][^<{]{2,}<" components/meeting app/\(main\)/meet app/\(main\)/meetings` ⇒ rỗng (trừ `abc-defg-hjk` placeholder đi qua `t`).
- [ ] **Không dữ liệu thô:** `grep -rnE "\.(userId|hostId|identity)\}|err(or)?\.message|removedIds" components/meeting app/\(main\)/meet app/\(main\)/meetings` — mọi chỗ còn lại chỉ dùng làm `key`/so sánh, không render. `grep -rn "toast.error(e" components/meeting` ⇒ rỗng.
- [ ] **Bàn phím:** Tab đi hết thanh điều khiển theo thứ tự nhìn thấy; mọi menu mở bằng Enter/Space, đóng bằng Esc và trả focus về nút mở; dialog bẫy focus (Radix); panel đóng ⇒ focus về nút đã mở panel.
- [ ] **Trình đọc màn hình:** nút toggle có `aria-pressed`; badge số có chữ (`chatUnread`, `lobbyWaiting`); banner nối lại `role="status"`; chat `role="log"`; màn trạng thái focus `h1`.
- [ ] **Tương phản:** chữ trên sân khấu tối dùng `text-white` trên nền `bg-black/55` (như `VideoTile`), các chrome khác dùng token — không hex trong component (`grep -rnE "#[0-9a-fA-F]{3,6}" components/meeting` ⇒ rỗng).
- [ ] **Responsive:** 320 / 375 / 768 / 1280px: `/meetings` không cuộn ngang, dialog thành bottom sheet < 768px, phòng họp: thanh điều khiển không tràn (phone gom vào Thêm), lưới 1–2 cột trên phone, `pb-safe` cho thanh dưới.
- [ ] **Reduced motion:** reaction và chuyển trang tôn trọng `prefers-reduced-motion`.
- [ ] **Kích thước:** `wc -l` mọi file mới ≤ 400; JSX ≤ 5 cấp (soát `MeetingRoom`, `ControlBar`, `ParticipantsPanel`, `MeetingFormDialog`).
- [ ] **Commit** `chore(web): meetings a11y, responsive and i18n pass`

---

### Task 23: Kiểm tra toàn bộ + tài liệu + checklist tay

- [ ] **Final gate** (mục cuối plan) xanh.
- [ ] `docs/api-spec.md` § Meetings: thêm một đoạn "Web client" ngắn — web gửi thời gian bằng `toISOString()` (UTC `Z`); `clientId` = `c-` + 12 ký tự base62; web subscribe topic trước rồi `GET /hands` + `GET /{id}` để mồi; nối lại STOMP khi là host/co-host ⇒ gọi lại `POST /join` để nhận lại `meet.lobby` (tới khi có gap B2). Không đổi contract.
- [ ] `apps/web/CLAUDE.md`: thêm `lib/meetings/` (logic thuần + controller), `components/meeting/`, route `/meetings`, `/meetings/[id]`, `/meet/[code]`, store `meeting.store.ts`; ghi chú "`LiveKitSession` dùng chung Cuộc gọi — thay đổi phải giữ test `sfu-*` xanh".
- [ ] `.claude/rules/sync.md` bảng mirror: thêm `app/(main)/meetings/page.tsx ↔ lib/features/meetings/ui/meetings_screen.dart`, `app/(main)/meetings/[id]/page.tsx ↔ ui/meeting_detail_screen.dart`, `app/(main)/meet/[code]/page.tsx ↔ ui/room/meeting_room_screen.dart`, `lib/meetings/meeting-room-controller.ts ↔ state/meeting_room_controller.dart` (cho MT6–MT7).
- [ ] `docs/superpowers/plans/README.md`: dòng `2026-10-05-meetings-p1-core.md` ghi "MT1–MT5 xong trên `feat/meetings-p1`"; thêm dòng `2026-10-07-meetings-mt4-mt5-web.md`.
- [ ] **Checklist tay trên `dev`** (web, 3 trình duyệt/hồ sơ: host H, người được mời I, khách G; 1 máy phone 375px) — đánh dấu từng dòng trong mô tả PR:
  1. H: Họp ngay ⇒ vào thẳng phòng; copy link gửi G. G mở link khi **chưa đăng nhập** ⇒ đăng nhập ⇒ quay lại đúng `/meet/{code}` (Task 8).
  2. G "Yêu cầu tham gia" ⇒ "Đang xin vào…"; H thấy số 1 trên nút Mọi người + toast; Cho vào ⇒ G vào; lặp lại với Từ chối ⇒ màn từ chối (Review Focus 2).
  3. H lên lịch cuộc họp cho I lúc now+12 phút ⇒ I nhận toast mời (tab ẩn: thông báo OS) + hàng mới trong Sắp tới; ~10 phút trước ⇒ toast nhắc; bấm ⇒ màn chờ (Review Focus — thông báo).
  4. H huỷ một cuộc họp đã lên lịch ⇒ I thấy toast huỷ, hàng biến khỏi Sắp tới, trang chi tiết "Đã huỷ".
  5. Trong phòng: I giơ tay, G giơ tay ⇒ thứ tự I, G ở cả 3 máy; H hạ tay G; H "Hạ tất cả".
  6. H tắt mic G ⇒ G thấy toast "{H} đã tắt micro của bạn", nút mic đỏ, G tự bật lại được. H "Tắt micro mọi người" (xác nhận).
  7. G trình bày màn hình; H tắt quyền trình bày ⇒ G dừng + toast; nút trình bày của G disabled có tooltip. H bật lại ⇒ G trình bày được (có thể phải vào lại nếu token cũ — MT3 chấp nhận).
  8. H phong I làm co-host ⇒ I thấy menu host + phòng chờ; I mời G ra ⇒ G thấy màn "Bạn đã bị mời ra", mở lại link ⇒ cùng màn đó, trang chi tiết của G hiện `removedNotice` (Review Focus 3).
  9. H khoá phòng ⇒ khách mới thấy màn khoá; I rời rồi vào lại được.
  10. Chat 3 người; spam ⇒ lỗi RATE_LIMITED có Gửi lại; nội dung HTML hiện nguyên văn.
  11. Ghi chú chung: I và H cùng sửa ⇒ xung đột không mất chữ (Review Focus 1); ghi chú riêng chỉ người viết thấy.
  12. H rời (không kết thúc) ⇒ I (co-host) vẫn điều khiển được (Review Focus 4). H vào lại ⇒ thấy lại phòng chờ đang có người.
  13. Tắt Wi-Fi 20s rồi bật trên máy I ⇒ banner "Đang kết nối lại…" rồi hết; trong lúc mất mạng H đổi cài đặt và G gửi chat ⇒ sau khi nối lại I thấy đúng cài đặt, tay, chat (Review Focus 7). Ngắt lâu hơn ⇒ màn "Mất kết nối" + Vào lại.
  14. H "Kết thúc cho mọi người" ⇒ mọi người về trang chi tiết với toast "Cuộc họp đã kết thúc"; mở lại link ⇒ trang chi tiết (Review Focus 5); điểm danh có thời lượng từng người.
  15. Phone 375px: toàn bộ luồng 1–2 và thanh điều khiển dùng được bằng một tay; panel là bottom sheet.
  16. Cuộc gọi 1-1 và nhóm (Module B) vẫn chạy như cũ (âm thanh, video, nút) — `VideoTile` / `LiveKitSession` không đổi hành vi.
- [ ] Commit `docs: meetings web client (MT4–MT5)`

---

## Quyết định cho owner (đề xuất mặc định — không chặn việc code)

1. **Vị trí điều hướng:** icon "Phòng họp" ở header sidebar khu nhắn tin + tab thứ 5 "Họp" ở `MobileTabBar` web. Flutter (MT6) có thanh dưới khác hẳn (Chats · Archived · Requests · New — design-system §10) ⇒ owner chọn vị trí tương đương bên mobile khi làm MT6.
2. **Trường Phòng ban khi tạo họp** chỉ hiện cho người có `MANAGE_DEPARTMENTS` tới khi có `GET /me/departments` (gap B1). Đổi = làm gap B1 (auth-service, ~1 endpoint) trước MT6 để Flutter dùng chung.
3. **"Họp lại"** chỉ cho host/co-host của cuộc họp cũ **và** đang có `HOST_MEETING`; mở dialog điền sẵn (không tạo ngay).
4. **Không hiện ô "Biên bản AI" rỗng** ở P1 (milestone nói để trống) — P2 thêm component vào slot.
5. **Lịch: chọn ngày + giờ bắt đầu + thời lượng** (15 phút → 4 giờ, giữ giá trị lẻ đã lưu) theo múi giờ trình duyệt, hiện nhãn `GMT+7`; không có ô chọn múi giờ khác.
6. **Nút tắt mic/cam màu `destructive` khi đang tắt** (giống Meet) — design-system chưa có quy ước cho nút trạng thái media; nếu owner muốn trung tính hơn thì đổi sang `outline` ở `ControlBar` (một chỗ).

## Ngoài phạm vi MT4–MT5

| Việc | Thuộc |
|---|---|
| Flutter: danh sách, tạo, chi tiết, FCM `MEETING_*`, `meet.invited/starting/cancelled` | MT6 |
| Flutter: màn chờ, phòng chờ, phòng họp, share màn hình Android (MediaProjection), ẩn share iOS, keep-awake | MT7 |
| Ma trận QC trên thiết bị thật (Android/iOS/4G, 10 và 25 người, kill app giữa họp), `sync-check` | MT8 |
| Phụ đề trực tiếp, biên bản AI, action items, `@AI` trong chat họp, ô "Biên bản AI" | Meetings P2 |
| Ghi hình (LiveKit Egress), khách ngoài không tài khoản, chuyển cuộc gọi nhóm thành phòng họp, breakout, poll, whiteboard, làm mờ nền, co-editing ghi chú realtime (CRDT), file/ảnh trong chat họp | backlog (spec §7) |
| Gap B1–B4 phía server | việc riêng (xem "Backend gaps") |
| Phân trang lưới khi > 25 ô / simulcast theo kích thước ô | không cần (trần 25 người); `setPeerVideoEnabled` đã cắt video ô bị ẩn trên phone |

## Final gate (chạy trước khi PR `feat/meetings-p1` → `dev`)

```bash
# một lần cho worktree mới
pnpm install --frozen-lockfile

cd apps/web
npx tsc --noEmit -p tsconfig.json
npx vitest run                 # toàn bộ, gồm i18n-parity, livekit-session, sfu-* (Cuộc gọi không đổi)
pnpm lint                      # 0 errors
pnpm build
wc -l lib/meetings/*.ts lib/api/meeting*.ts lib/hooks/use-meeting*.ts lib/hooks/use-media-preview.ts \
      lib/hooks/use-note-editor.ts lib/store/meeting.store.ts lib/realtime/meeting-queue.ts lib/rtc/livekit-session.ts \
      components/meeting/*.tsx components/meeting/*/*.tsx components/call/VideoTile.tsx \
      'app/(main)/meetings/page.tsx' 'app/(main)/meetings/[id]/page.tsx' 'app/(main)/meet/[code]/page.tsx'   # mỗi file ≤ 400
cd -

# không lọt file dev-only
git diff origin/main...HEAD --stat   # chỉ file MT1–MT5; không scripts/dev/, *.local, localhost
```
