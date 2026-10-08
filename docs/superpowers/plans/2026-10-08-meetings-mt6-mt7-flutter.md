# Phòng họp P1 — MT6 + MT7 (Flutter: danh sách, tạo, chi tiết, trong phòng họp) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (MT6) Flutter có màn **Phòng họp** giống web MT4: danh sách Sắp tới / Đã qua (cursor), **Họp ngay** một chạm, **Lên lịch** / sửa / **Họp lại** (tiêu đề, mô tả, ngày + giờ + thời lượng theo múi giờ máy → gửi UTC `Z`, người mời, phòng ban, 5 công tắc; sửa chỉ gửi công tắc đã đổi), màn chi tiết `/meetings/:id` (hành động theo `viewerRole`, điểm danh, ghi chú chung + riêng tự lưu 2s + xung đột 409 không mất chữ, lịch sử chat), vào bằng mã/link, deep link `/meet/{code}` + quay lại link sau đăng nhập, banner + thông báo OS cho `meet.invited` / `meet.starting` / `meet.cancelled`, FCM `MEETING_INVITED` / `MEETING_STARTING` (chạm ⇒ mở đúng cuộc họp, chuỗi đẩy dịch sẵn trên máy), mục điều hướng "Phòng họp". (MT7) Màn `/meet/:code` toàn màn hình giống web MT5: **màn chờ** (preview camera, bật/tắt mic/cam, đổi camera trước/sau, chọn loa ngoài/tai nghe), **phòng chờ**, **phòng họp** trên `LiveKitSession` dùng chung với Cuộc gọi (lưới / người nói / ghim, xem share màn hình của người khác, **trình bày màn hình trên Android**, iOS ẩn nút), panel **Mọi người** (giơ tay theo thứ tự, phòng chờ Cho vào/Từ chối, menu host đủ 13 lệnh qua `/app/meet.host`), **chat trong họp** (lạc quan theo `clientId`, Gửi lại cùng `clientId`, `RATE_LIMITED`, tiếng vọng cá nhân không tính chưa đọc), **ghi chú** trong phòng (flush khi rời), reaction, rời / kết thúc cho mọi người, `meet.removed/muted/ended/settings/roster`, nối lại STOMP + LiveKit, vòng đời app (nền/tiền cảnh, rời phòng chờ khi thoát), giữ màn hình sáng, quyền + phiên âm thanh iOS/Android.

**Architecture:** mirror 1-1 lớp logic của web, đổi công cụ cho Flutter. Mỗi file ≤ 400 dòng (widget lẫn logic), cây widget ≤ 5 cấp.
1. **Logic thuần Dart** trong `lib/features/meetings/domain/*.dart` — cùng tên, cùng hành vi với `apps/web/lib/meetings/*.ts` (parse sự kiện, lỗi → khoá l10n, vá cache, lịch/UTC, form, quyền UI, máy trạng thái ghi chú, pha phòng, bố cục sân khấu, reaction, mã phòng, điểm danh). Unit test `flutter test` không cần widget/plugin, **viết test trước** (port từ vitest web).
2. **Dữ liệu server** qua repository Dio (`data/meetings_repository.dart` dựng bằng `DioClient.createChatDio(...)` như `calls_repository.dart`; phòng ban của tôi qua `DioClient.createAuthDio(...)`) + Riverpod: **một cache chuẩn hoá** `MeetingsStore` (keepAlive `Notifier<MeetingsCacheState>`: map id → `Meeting`, mã → id, danh sách Sắp tới / Đã qua) mà mọi bản vá đi qua hàm thuần `domain/cache_updates.dart` (mirror `setQueryData` của web; không refetch trừ lúc nối lại / mở lại tab Đã qua bị đánh dấu cũ). Ghi chú, lịch sử chat ở màn chi tiết là provider riêng.
3. **Phòng họp**: `MeetingRoomController` (lớp Dart thuần, mirror `meeting-room-controller.ts`) điều phối REST join/lobby/end, `/app/meet.*`, `RtcSession` (mở rộng tương thích ngược, dùng chung Cuộc gọi), sự kiện cá nhân; ghi vào **một** trạng thái bất biến `MeetingRoomState` qua interface `RoomStore` (prod: Riverpod `Notifier`; test: `MemoryRoomStore`). Khác web: roster / hands / lobby / chat history của phòng nằm **trong** `MeetingRoomState` (web để trong TanStack) vì chỉ phòng dùng — áp sự kiện topic bằng reducer thuần `room_events.dart`. `StompService` (`FL/features/chat/data/stomp_service.dart`, registry tự subscribe lại khi nối lại) **thêm** 2 đích: `/user/queue/meeting` (đăng ký trong `subscribeNotifications()`, stream `meetingQueue`) và `/topic/meeting/{id}` (`subscribeMeetingTopic/unsubscribeMeetingTopic`, stream `meetingTopic`); gửi bằng `sendRawMessage`. Hàng đợi cá nhân được một listener keepAlive (`MeetingQueueListener`, như `GroupCallSignaling`) xử lý và chuyển sự kiện phòng cho controller đang mở (`active_room.dart`).

UI theo `docs/design-system.md` (Warm Grey & Burgundy, web là chuẩn gốc): `Theme.of(context).colorScheme.*`, `AppTheme.mutedText/hairline/accent(context)`, `PonButton` / `PonTextField` / `PonCard`, Geist, cỡ chữ 12 · 14 · 16 · 18 · 20 · 24, nút 44, hairline thay shadow, bottom sheet thay dialog lớn, Material Symbols Rounded (ánh xạ lucide → Material ở design-system §7). Sân khấu dùng nền tối cố định (như màn Cuộc gọi — "nội dung", không phải chrome).

**Tech Stack:** Flutter 3.44 · Dart 3 · `flutter_riverpod` 2.6 · `go_router` 13.2 · Dio · `stomp_dart_client` · `livekit_client` 2.3.1+hotfix.1 (**giữ dòng 2.3.x** — C3: bản mới hơn đòi `flutter_webrtc` 0.14+) · `flutter_webrtc` 0.12.12 · `wakelock_plus` · `flutter_local_notifications` 17 · `firebase_messaging` · `app_links` · `shared_preferences` · `flutter_markdown` 0.7 (đã có) · `flutter_test` + `mocktail` (đã có; không cần `fake_async` — `testWidgets` đã chạy trong FakeAsync, test controller dùng `now` tiêm vào). **Không thêm plugin mới:** trình bày màn hình Android dùng `Helper.requestCapturePermission()` (flutter_webrtc) + một foreground service `mediaProjection` **tự viết** (~70 dòng Kotlin, Task 13 — owner quyết định 3; phương án B là plugin `flutter_background` của ví dụ LiveKit).

**Nguồn ràng buộc:** milestone `docs/superpowers/plans/2026-10-05-meetings-p1-core.md` (MT6, MT7, Global Constraints, Review Focus); spec `docs/superpowers/specs/2026-10-05-calls-and-meetings-design.md` §1, §4.3, §7 (share iOS tách bản sau — owner chốt 2026-08-28); **contract đã ship** `docs/api-spec.md` § Meetings (gồm "Web client (MT4–MT5)" — Flutter phải khớp) + `GET /api/users/me/departments` (auth-service); **logic mirror = code web thật** trên `feat/meetings-p1` @ `466977e` (`apps/web/lib/meetings/*`, `lib/api/meetings.ts`, `lib/realtime/meeting-queue.ts`, `lib/hooks/use-meeting-room-stomp.ts`, `use-lobby-exit.ts`, `app/(main)/meetings/*`, `app/(main)/meet/[code]/page.tsx`, `components/meeting/**`) và test vitest của nó; plan web `2026-10-07-meetings-mt4-mt5-web.md` (thứ tự task, i18n, checklist). **Code web đã ship + QA thắng plan web** — chỗ lệch ghi ở "Sai khác".

## Global Constraints

- Nhánh `feat/meetings-p1` (worktree hiện tại, sau web MT4–MT5 @ `466977e`). Không commit seed / dart-define trỏ `localhost`/IP LAN / key LiveKit dev (`.claude/rules/dev-local-only.md`); test tay trên `dev` trước khi PR.
- **Mọi lệnh chạy từ `apps/client`.** Viết tắt: `FL/` = `apps/client/lib/`, `FM/` = `apps/client/lib/features/meetings/`, `FT/` = `apps/client/test/features/meetings/`; `FA` = `flutter analyze` (0 issue), `FTEST <path>` = `flutter test <path>`, `GEN` = `flutter gen-l10n`.
- **≤ 400 dòng mỗi file Dart** (widget lẫn domain/state), widget lồng ≤ 5 cấp, builder > 100 dòng ⇒ tách widget (`.claude/rules/clean-code.md`). Mỗi task có bước `wc -l`.
- **Logic ra khỏi widget**: widget chỉ dựng UI; tính toán ở `domain/` (thuần), điều phối ở `state/` (controller/notifier), gọi mạng ở `data/` (repository). `ConsumerWidget`/`ConsumerStatefulWidget`; `AsyncValue.when` luôn có nhánh `error` (đã map l10n). Điều hướng chỉ bằng `go_router` (`context.go/push`), không `Navigator.push` (trừ `showModalBottomSheet`/`showDialog` đã có tiền lệ).
- **Dữ liệu mạng là `Object?` cho tới khi qua parser có kiểm kiểu** (`domain/meeting_models.dart` `fromJson` phòng thủ: sai kiểu ⇒ bỏ dòng / giá trị mặc định, không ném). Không `!` ép non-null không có lý do.
- **API chỉ qua Dio của `DioClient`** (`FL/core/api/dio_client.dart`: `createChatDio` / `createAuthDio` với `onForceLogout` → `authNotifierProvider.notifier.forceLogout()`, có interceptor JWT + refresh qua `TokenManager.shared`) — đúng mẫu `callsRepositoryProvider`. Repository nhận `Dio` qua constructor (test dùng adapter giả). Mọi `{id}`/`{code}`/`{userId}` trong path qua `Uri.encodeComponent`.
- **STOMP:** không tạo client mới — chỉ **thêm** method/stream vào `StompService` (`stompServiceProvider.notifier`), đăng ký qua `StompSubscriptionRegistry` sẵn có (tự subscribe lại sau nối lại). Hàng đợi cá nhân `/user/queue/meeting` đăng ký **một lần** trong `subscribeNotifications()`; topic phòng subscribe khi `phase ∈ {connecting, inRoom}` (không bao giờ khi `waiting` — server trả STOMP ERROR) và **luôn** huỷ khi rời/dispose. Gửi lệnh bằng `sendRawMessage(destination:, body: jsonEncode(...))` — vốn bỏ im khi mất kết nối ⇒ controller kiểm `isConnected` trước và tự báo `realtimeOffline`.
- **Không lộ dữ liệu thô** (`.claude/rules/no-raw-system-data-in-ui.md`): không hiện `userId`, `hostId`, `removedIds`, `identity`, tên room `meet_*`, token, URL `wss://`, `DioException`/`e.toString()`/lỗi LiveKit. Tên vắng hoặc trông như id (`safeDisplayName` Flutter tương đương — Task 3) ⇒ nhãn chung đã dịch (`meetingSomeone` / `meetingParticipantFallback`). Mã phòng `abc-defg-hjk` và link `/meet/{code}` **được** hiện. Chat render text thuần (`SelectableText`/`Text`, không linkify HTML), ghi chú qua `MarkdownBody` (`flutter_markdown`, không HTML thô), reaction chỉ nhận đúng 6 emoji.
- **i18n:** mọi chuỗi qua `context.l10n.meeting*` (tiền tố `meeting` — milestone). Thêm khoá bằng `tool/add_arb_keys.py` (đủ 7 locale trong **cùng commit**), rồi `GEN`. `test/l10n/arb_parity_test.dart` phải xanh. Ngày giờ qua `DateFormat.yMMMd(locale).add_jm()` / `DateFormat.jm(locale)` (cache instance — memory perf), không hardcode pattern. Chuỗi đẩy FCM dịch sẵn ở **native** (Android `values-*/strings.xml`, iOS `*.lproj/Localizable.strings`) — Task 9.
- **Giới hạn (milestone + contract):** tiêu đề ≤ 120, mô tả ≤ 2000, người mời ≤ 100, chat ≤ 2000/tin, ghi chú ≤ 50 000, 25 người/phòng, lịch: bắt đầu ≥ now − 5 phút, kết thúc > bắt đầu và ≤ bắt đầu + 24h; reaction đúng `👍 ❤️ 😂 😮 👏 🎉`, ≤ 1 lần/giây; chat dùng chung hạn mức chat thường (10 tin / 5s — server).
- **Thời gian gửi lên server luôn là ISO UTC có `Z`** (`DateTime.toUtc().toIso8601String()`); form sửa ngày/giờ/thời lượng theo múi giờ của máy.
- **`clientId`** `/app/meet.chat` = `c-` + 12 ký tự base62 từ `Random.secure()` (giống web). Gửi lại dùng **cùng** `clientId`.
- **`LiveKitSession` / `RtcSession` dùng chung với Cuộc gọi (Module B — Phạm Minh Trí):** mọi thay đổi ở `FL/core/rtc/*` phải **giữ nguyên hành vi Cuộc gọi** (tham số mới là tuỳ chọn với mặc định cũ; test `sfu_call_service_test.dart`, `sfu_group_media_test.dart` xanh **không sửa nội dung**; fake cũ chỉ được **thêm** member) — báo Trí trước khi merge (spec §6).
- **Không thêm plugin native mới.** `wakelock_plus` đang là phụ thuộc bắc cầu (từ `chewie`, 1.5.2) ⇒ khai báo trực tiếp `wakelock_plus: ^1.5.2` (lockfile không đổi version, không pod mới). Foreground service trình bày màn hình viết bằng Kotlin trong app (owner quyết định 3).
- Mỗi task: test RED → code → GREEN → `FA` → `wc -l` → commit. Lệnh test cụ thể ghi ở từng task.

## Review Focus

1. **Hai người cùng sửa ghi chú chung** — người lưu sau nhận 409 `MEETING_NOTE_CONFLICT` + `latest`; UI báo "Đã có bản mới hơn", chữ đang gõ **còn nguyên**, cho so sánh và chọn Giữ bản của tôi / Dùng bản mới hơn / Lưu bản đã gộp. Gõ tiếp trong lúc đang lưu không mất chữ. Test Task 11 (`note_sync_test.dart` + `notes_editor_test.dart`).
2. **Người không được mời mở link khi host chưa vào** — màn chờ ghi "Yêu cầu tham gia" → `join` ⇒ `waiting` ⇒ màn "Đang xin vào…"; host vào thì thấy ngay số người chờ ở nút Mọi người + banner. Cho vào ⇒ người chờ tự `join` lại và vào phòng. Test Task 14 (`room_phase`), Task 15 (controller).
3. **Người bị mời ra** — đang trong phòng: rời LiveKit ngay, màn "Bạn đã bị mời ra", không có Vào lại; mở lại link ⇒ màn chờ ⇒ 403 `MEETING_REMOVED` ⇒ cùng màn đó. Màn chi tiết: `removedNotice`, không lộ ghi chú/chat. Test Task 14, 15, 12.
4. **Host rời không bấm Kết thúc** — nút Rời của host/co-host mở sheet "Rời cuộc họp" / "Kết thúc cho mọi người" (xác nhận); rời thường không gọi `/end`. Co-host dùng được mọi lệnh host. Test Task 6 (`permissions`).
5. **Mở link cuộc họp đã kết thúc / đã huỷ** (deep link, mã, thông báo) ⇒ `context.go('/meetings/{id}')`, màn chi tiết hiện Đã kết thúc / Đã huỷ, điểm danh, ghi chú — không phải màn lỗi. Test Task 14 + checklist tay.
6. **Không lộ dữ liệu thô** — mọi `errorCode`/HTTP lỗi ⇒ khoá `meetingErr*` (test bảng mã Task 2); tên vắng ⇒ nhãn chung (Task 3/4/6); `meet.invited.hostId` không bao giờ render; push FCM không bao giờ hiện chuỗi `meeting_push_invited` thô (Task 9).
7. **Nối lại** — STOMP rớt rồi về: topic được subscribe lại, roster/tay/cài đặt/vai trò/chat/ghi chú chung được đọc lại (`GET /api/meetings/{id}` + `GET /hands` + trang chat mới nhất + ghi chú chung); host/co-host đọc lại `GET /lobby`; người **đang chờ** `POST /join` lại (bắt `meet.admitted` bị lỡ). LiveKit chập chờn: banner "Đang kết nối lại…"; đứt hẳn: màn "Mất kết nối" + Vào lại (token mới, **giữ lựa chọn mic/cam đang dùng trong phòng**). Test Task 15 (`meeting_room_controller_sync_test.dart`).
8. **Vòng đời app** — đang ở phòng chờ mà app bị vuốt tắt / chuyển nền quá lâu ⇒ rời phòng chờ (`DELETE /lobby`); quay lại tiền cảnh khi đang chờ ⇒ hỏi lại `join`; trong phòng chuyển nền ⇒ tiếng vẫn chạy và STOMP không bị ngắt (iOS cần `UIBackgroundModes audio` — owner quyết định 4; Android không có service "đang họp" ở P1 — owner quyết định 5), camera tự tắt khi nền và bật lại khi về (như Meet). Test Task 15, 16 + checklist tay.
9. **Cuộc gọi không hồi quy** — `RtcSession`/`LiveKitSession` mở rộng tương thích ngược; test C3 xanh không sửa; checklist tay gọi 1-1 + nhóm.

---

## Ruling khi viết plan

Như plan web: plan ghi **đầy đủ code test** (test là đặc tả) cho mọi module Dart thuần, repository, hàng đợi cá nhân, controller phòng và lớp nối realtime — phần lớn là bản port 1-1 từ vitest web (cùng tên test, cùng dữ liệu) để hai nền tảng chứng minh **cùng hành vi**. Code hiện thực mô tả bằng chữ ký + hành vi chính xác (mirror file web tương ứng — người thực thi đọc file web cạnh bên). Widget mô tả bằng cây widget, tham số, trạng thái, khoá l10n, token theme và tiêu chí a11y (`Semantics`, `tooltip`, vùng chạm ≥ 44); phần không test được bằng `flutter test` (LiveKit native, camera, quyền OS, FCM, MediaProjection) có checklist máy thật ở Task 23. `LiveKitSession` gọi plugin native ⇒ không unit test (như C3); logic nằm ở controller, test với `FakeRtcSession`.

Viết tắt test: `FT/` = `apps/client/test/features/meetings/`. Quy ước: `t` của web (trả khoá) ⇔ Dart so sánh trực tiếp `MeetingNotice(MeetingText.xxx, {...})` — logic không bao giờ cầm chuỗi đã dịch; chỉ lớp UI `meetingText(l10n, notice)` dịch (Task 2).

---

## Sai khác (so với milestone plan và với web — đối chiếu code thật 2026-10-08)

| # | Milestone / web nói | Thực tế Flutter | Plan này làm |
|---|---|---|---|
| 1 | Milestone MT6: `state/meetings_providers.dart` dùng `chatDio` | Không có provider `chatDio`/`authDio`; mỗi repository tự dựng Dio bằng `DioClient.createChatDio(storage, onForceLogout:)` | `meetingsRepositoryProvider` + `myDepartmentsRepositoryProvider` theo đúng mẫu `callsRepositoryProvider` |
| 2 | Milestone MT7: `lib/core/rtc/livekit_session.dart` dùng nguyên | `RtcSession` chỉ có `connect(url, token, {video})` luôn bật mic; `RtcPeer` gộp mọi track video vào `stream` (share màn hình sẽ **đè** camera); mic/cam của peer mặc định `false`-muted và **không đọc từ publication** (người vào với mic tắt vẫn hiện mic bật — lỗi QA web P1 đã sửa); không data channel, không share, không báo server mute, không tắt nhận video ô bị ẩn | ➕ Task 13: mở rộng **tương thích ngược** (tham số mới tuỳ chọn, mặc định cũ): `connect(..., {audio = true, frontCamera = true, preferSpeaker})`, `RtcPeer.screen` + `avatarUrl`, `syncMedia` từ publication, `onLocalMediaChanged`, `localMedia`, `onData`/`publishData`, `setScreenShare` (Android), `setPeerVideoEnabled` (nhớ và áp lại cho publication mới — lỗi QA web "ô ẩn vẫn nhận camera") |
| 3 | Web: `RemoteAudio` (một `<audio>` mỗi người) vì `<video>` của ô bị ẩn làm mất tiếng | Native WebRTC (flutter_webrtc) **tự phát** mọi track âm thanh đã subscribe, không cần phần tử | Không có `RemoteAudio`; ô video chỉ hình. Định tuyến loa qua `setSpeaker` (Loa ngoài / tai nghe) — thay cho chọn loa của web |
| 4 | Web: chọn micro / camera / loa theo `deviceId`, thanh mức âm micro | Điện thoại: 1 micro (hệ thống tự chọn tai nghe/BT), 2 camera trước/sau, ra loa ngoài / tai nghe | "Chọn thiết bị" trên mobile = **đổi camera trước/sau** + **Loa ngoài bật/tắt**; nhớ `{micOn, camOn, frontCamera, speakerOn}` trong `SharedPreferences` (mirror `devices.ts`). Không có thanh mức âm (không có API mức âm cục bộ ổn định ở `livekit_client` 2.3 — ghi ở "Ngoài phạm vi") |
| 5 | Milestone MT7: share màn hình Android `MediaProjection` + foreground service; iOS ẩn nút | `livekit_client` 2.3.1 hỗ trợ Android qua `Helper.requestCapturePermission()` + foreground service `mediaProjection` (README chính thức dùng `flutter_background`); app chưa có service, quyền `FOREGROUND_SERVICE*` | ➕ `ScreenShareService.kt` tự viết (`foregroundServiceType="mediaProjection"`) + MethodChannel `pon/screen_share` + 2 quyền `FOREGROUND_SERVICE*`; nút **Trình bày** chỉ trên Android; iOS ẩn nút (spec §7). **Xem** share của người khác: mọi nền tảng |
| 6 | Web: phím tắt `Ctrl/⌘+D/E/Alt+H` | Không áp dụng trên điện thoại | Không port `shortcuts.ts` (iPad bàn phím: ngoài phạm vi) |
| 7 | Web: `pagehide` ⇒ `DELETE /lobby` keepalive; `pageshow` (bfcache) ⇒ hỏi lại | Flutter: `AppLifecycleState.detached` (best-effort, iOS không đảm bảo) / `resumed`; **`main.dart` ngắt STOMP khi `paused`** (để server gửi FCM) | Task 16: `detached` khi đang chờ ⇒ `leaveLobby` best-effort; `resumed` ⇒ STOMP nối lại ⇒ `onRealtimeReconnected` (đang chờ ⇒ `join` lại). **Không** ngắt STOMP khi `paused` nếu đang `connecting/inRoom` (cuộc họp đang chạy như một cuộc gọi — giữ chat/giơ tay/lệnh host; iOS cần `UIBackgroundModes audio`, owner quyết định 4). Camera tự tắt khi nền, bật lại khi về (Meet làm vậy; iOS cũng tự ngắt camera nền) |
| 8 | Milestone MT6: "mục điều hướng cùng vị trí với web" | Web: icon ở header sidebar + tab thứ 5 `MobileTabBar`. Flutter: thanh dưới là **tab trong `ConversationListScreen`** (Chats · Archived · Requests · New), các mục khác là icon ở header (Explore, Friends, Settings) | Mặc định: icon `videocam_rounded` "Phòng họp" ở header danh sách hội thoại, **giữa Explore và Friends** (= vị trí "cạnh Danh bạ" của web) → `context.push('/meetings')`. **Owner quyết định 1** (thêm tab thứ 4 là đổi kiến trúc thông tin — design-system §10) |
| 9 | Web: middleware lưu `pon_return_to` để quay lại link sau đăng nhập | Flutter: guard đưa về `/login` không nhớ gì; deep link chỉ scheme `platform://` (auth, invite, integrations); **không** có App Links https / Associated Domains | ➕ Task 8: nhớ đường dẫn an toàn `/meet/{code}` / `/meetings/{id}` (bộ nhớ, không lưu đĩa) khi guard đẩy về `/login`, dùng lại sau mọi kiểu đăng nhập; deep link `platform://meet/{code}`. Link https `…/meet/{code}` mở **trong app** = owner quyết định 2 (cần file `.well-known` trên web + Team ID/SHA-256 — gap W1). Hôm nay: dán link vào ô "Mã hoặc link" vẫn vào đúng |
| 10 | Web copy link = `window.location.origin + /meet/{code}` | App không biết origin web (backend sau Cloudflare, web trên Vercel — khác host) | ➕ `AppConfig.webBaseUrl` (`--dart-define=PON_WEB_URL`; mặc định `https://$PON_DOMAIN` khi có proxy domain; debug: map fallback sẵn có thêm `'web': 'http://localhost:3000'`; release không cấu hình ⇒ `null` ⇒ "Sao chép link" chép **mã** thay vì link, không ném). Gap D1: pipeline build mobile phải truyền `PON_WEB_URL` |
| 11 | MT4 web: toast `meet.invited/starting/cancelled` + thông báo OS khi tab ẩn | Flutter: STOMP **ngắt khi app ở nền** ⇒ lúc đó chỉ có FCM; tiền cảnh có `showInAppNotification` (banner chạm được) | Tiền cảnh: banner chạm được (`showInAppNotification`) cho invited/starting, banner info cho cancelled. Nền / app bị tắt: FCM (server gửi `MEETING_INVITED` khi offline, `MEETING_STARTING` luôn) — OS tự hiện vì push có khối `notification` |
| 12 | FCM contract: body = `body_loc_key` / APNs `loc-key` `meeting_push_invited` / `meeting_push_starting`, kênh `pon_meetings` | App **chưa có** `res/values*/strings.xml` cho 2 khoá đó, chưa có `*.lproj/Localizable.strings` (iOS sẽ **hiện nguyên chuỗi khoá** — vi phạm rule dữ liệu thô), chưa tạo kênh `pon_meetings`; `main.dart` chỉ đọc `conversationId` từ push | ➕ Task 9: chuỗi native 7 ngôn ngữ (Android `values`, `values-vi`… ; iOS `en.lproj`… + `knownRegions` trong `project.pbxproj`), tạo kênh `pon_meetings`, route theo `type` (`MEETING_*` ⇒ `/meet/{code}`), background handler bỏ qua `MEETING_*` (OS đã hiện — tránh trùng) |
| 13 | Web giữ roster/hands/lobby/chat trong TanStack theo khoá | Riverpod không có cache khoá kiểu `setQueryData` | Dữ liệu chỉ phòng dùng (roster, hands, lobby, chat của phòng, tín hiệu ghi chú chung) nằm trong `MeetingRoomState` (một nguồn — controller ghi, reducer thuần áp sự kiện topic); dữ liệu nhiều màn dùng (Meeting, 2 danh sách) nằm trong `MeetingsStore` chuẩn hoá. Lịch sử chat màn chi tiết: provider phân trang riêng |
| 14 | Web `MeetingSession` tạo controller trong `useState` + `activate/dispose` (StrictMode) | Flutter không có StrictMode, nhưng widget có thể dựng lại | `MeetingSessionView` (`ConsumerStatefulWidget`) tạo controller trong `initState`, `activate()` ngay, `dispose()` trong `dispose`; controller vẫn chịu được `activate → dispose → activate` (giữ test web) |
| 15 | Milestone MT7 tên file: `participants_sheet.dart`, `meeting_chat_sheet.dart`, `notes_sheet.dart`, `host_actions_sheet.dart`, `control_bar.dart`… | Giới hạn 400 dòng + màn trạng thái + menu Thêm của phone | Giữ đủ tên milestone, thêm: `room_status_screen.dart`, `meeting_session_view.dart`, `meeting_tile.dart`, `room_more_sheet.dart`, `reaction_picker.dart`, `lobby_section.dart`, `participant_row.dart`, `room_manage_section.dart`, `leave_sheet.dart`, `room_banners.dart`, `chat_lines.dart`, `chat_composer.dart` |
| 16 | Web test `MeetingRoom.test.tsx` render cả phòng | `RTCVideoView` cần plugin native trong widget test | Widget test của phòng thay `MeetingTile` video bằng ô chữ cái khi `stream == null` (luôn null trong test) — test được thanh điều khiển, panel, màn trạng thái mà không plugin |
| 17 | Web dùng `safeDisplayName` (`lib/chat/names.ts`) | Flutter chưa có helper chung (chỉ `call_name_resolver.dart` riêng cho cuộc gọi) | `FM/domain/display.dart`: `looksLikeId` (ObjectId 24 hex, `system`, `extbot:`…) + `safeDisplayName` — cùng bảng test với web |

## Backend / web gaps (phát hiện khi viết plan)

Contract server **đủ** cho MT6–MT7 — **không cần sửa chat-service hay auth-service** (gap B1–B4 của plan web đã làm: `GET /api/users/me/departments`, `GET /{id}/lobby`, `meet.cancelled{title,code}`, `past` gồm người đã dự).

| # | Gap | Ảnh hưởng | Mức | Đề xuất |
|---|---|---|---|---|
| W1 | Web chưa phục vụ `/.well-known/assetlinks.json` (Android App Links) và `/.well-known/apple-app-site-association` (iOS Universal Links) cho đường `/meet/*` | Link `https://<web>/meet/{code}` (copy từ web/mobile, gửi qua chat/email) mở trình duyệt chứ không mở app | **Không chặn** — trong app vẫn vào bằng mã/link dán vào, thông báo, deep link `platform://meet/…` | Owner quyết định 2: web thêm 2 file tĩnh (`apps/web/public/.well-known/…`, cần SHA-256 chứng chỉ ký Android + Apple Team ID — owner cung cấp), Flutter thêm intent-filter `autoVerify` + `Runner.entitlements` `applinks:` |
| D1 | Build mobile chưa truyền `--dart-define=PON_WEB_URL` (mới) | Release không có origin web ⇒ "Sao chép link" chép mã thay vì link (vẫn dùng được) | Không chặn | Thêm vào script/CI build mobile (không có localhost) — `docs/environments.md` |
| S1 | `meet.invited` khi app ở nền: server chỉ đẩy FCM `MEETING_INVITED` cho người **offline** (đúng contract); app ngắt STOMP khi `paused` ⇒ Redis "offline" có độ trễ | Có thể lọt lời mời nếu app vừa vào nền (online còn trong Redis) — server bỏ FCM, STOMP đã ngắt | Thấp (lời mời vẫn có trong "Sắp tới"; `meet.starting` luôn đẩy FCM) | Theo dõi ở MT8; nếu gặp: server đẩy `MEETING_INVITED` cho mọi người được mời (như `STARTING`) |

Không có gap nào phá contract đã ship.

---

## Contract phía Flutter (dùng nguyên `docs/api-spec.md` § Meetings — không đổi server)

### REST (`MeetingsApi` — `FM/data/meetings_repository.dart`; phòng ban — `FM/data/my_departments_repository.dart`)

| Hàm Dart | Request | Trả | Dùng ở |
|---|---|---|---|
| `list(scope, {cursor, size = 20})` | `GET /api/meetings?scope=&cursor=&size=` (bỏ `cursor` khi null) | `MeetingPage` (`hasNext`; cursor = `id` dòng cuối) | `/meetings` |
| `get(id)` | `GET /api/meetings/{id}` | `Meeting` | chi tiết, mồi roster/cài đặt, đọc lại khi nối lại |
| `byCode(code)` | `GET /api/meetings/by-code/{code}` | `Meeting` (cả ENDED) | `/meet/:code` |
| `create([input])` | `POST /api/meetings` (body `{}` = họp ngay) | 201 `Meeting` | Họp ngay, Lên lịch, Họp lại |
| `update(id, input)` | `PATCH /api/meetings/{id}` | `Meeting` | Sửa; công tắc "sửa ghi chú chung" trong phòng |
| `cancel(id)` | `DELETE /api/meetings/{id}` | 204 | Huỷ |
| `join(id)` | `POST /api/meetings/{id}/join` | `MeetingJoined{url, token, role}` \| `MeetingWaiting` | màn chờ, phòng chờ, vào lại |
| `lobby(id)` | `GET /api/meetings/{id}/lobby` | `List<LobbyEntry>` (bóc `{entries}`, thiếu ⇒ `[]`) | host/co-host vào phòng + nối lại |
| `leaveLobby(id)` | `DELETE /api/meetings/{id}/lobby` | 204 | huỷ chờ, app bị tắt khi đang chờ |
| `admit(id, userId)` / `deny(id, userId)` | `POST …/lobby/{userId}/admit\|deny` | 204 | panel phòng chờ |
| `end(id)` | `POST /api/meetings/{id}/end` | 204 | Kết thúc cho mọi người |
| `messages(id, {before, size = 50})` | `GET …/messages?before=&size=` | `MeetingMessagePage` **mới nhất trước** | chat trong phòng, lịch sử ở chi tiết |
| `getNote(id, scope)` / `putNote(id, scope, {content, version})` | `GET\|PUT …/notes/shared\|private` | `MeetingNote`; 409 `{code:'MEETING_NOTE_CONFLICT', latest}` | `NotesEditor` |
| `hands(id)` | `GET …/hands` | `List<MeetingHand>` (bóc `{hands}`, thiếu ⇒ `[]`) | mồi giơ tay khi vào / nối lại |
| `MyDepartmentsApi.list()` | auth `GET /api/users/me/departments` | `List<DepartmentOption>` (mảng `{id,name}`, lọc dòng hỏng) | ô Phòng ban |
| (sẵn có) `AdminRepository.listDepartments()` | auth `GET /admin/departments` | `List<Department>` | ô Phòng ban khi có `MANAGE_DEPARTMENTS` (gộp, sắp theo tên — mirror `useMeetingDepartmentOptions`) |
| (sẵn có) `AuthRepository.searchUsers(q)` | auth `GET /api/users/search?q=` | `List<UserModel>` | chọn người mời |

### STOMP

| Hướng | Destination | Payload | Ở đâu |
|---|---|---|---|
| sub (cả phiên, cùng `/user/queue/notifications`) | `/user/queue/meeting` | `meet.lobby · meet.admitted · meet.denied · meet.ended · meet.invited · meet.starting · meet.cancelled · meet.removed · meet.muted · meet.error · meet.chat` (tiếng vọng cá nhân) | `StompService.subscribeNotifications()` → stream `meetingQueue` → `MeetingQueueListener` → `handleMeetingQueueEvent` |
| sub (khi `phase ∈ connecting\|inRoom`) | `/topic/meeting/{id}` | `meet.roster · meet.settings · meet.ended · meet.hands · meet.chat · meet.notes.updated` | `MeetingRoomRealtime` (Task 16) → `controller.onTopicEvent` |
| pub | `/app/meet.hand` | `{meetingId, raised}` | nút Giơ tay |
| pub | `/app/meet.chat` | `{meetingId, content, clientId}` | chat |
| pub | `/app/meet.host` | `{meetingId, action, targetId?}` (`targetId` chỉ với `MUTE_MIC, REMOVE, LOWER_HAND, MAKE_COHOST, REVOKE_COHOST`) | menu host |

### Sự kiện → hành vi Flutter (giống bảng web, chỉ khác nơi lưu)

| Sự kiện | `MeetingsStore` | `MeetingRoomState` / controller | UI |
|---|---|---|---|
| `meet.roster` | — | `roster` ← participants; `myRole` ← dòng của mình; mất co-host ⇒ `lobby = []` | panel Mọi người; banner `madeCohost` / `revokedCohost` |
| `meet.settings` | meeting: `settings` | `settings`; `pendingHost = {}`; attendee đang share mà bị tắt quyền ⇒ dừng share + `shareRevoked` | công tắc hết pending |
| `meet.hands` | — | `hands` | hàng giơ tay, huy hiệu ✋ + số thứ tự |
| `meet.chat` (topic) | — | `chat` thêm (dedupe `id`); xoá pending cùng `clientId`; panel đóng + không phải tin của mình ⇒ `unreadChat++` | chat, chấm trên nút Thêm/Chat |
| `meet.chat` (cá nhân) | — | như trên nhưng **không** tăng `unreadChat` | — |
| `meet.notes.updated` | — | `sharedNoteRemote = {version, updatedBy}` | `NotesEditor` → `remoteUpdated` |
| `meet.ended` (topic/cá nhân) | `markEnded` (khỏi Sắp tới, Đã qua đánh dấu cũ) | `phase = ended`, ngắt LiveKit | banner `endedToast` + `context.go('/meetings/{id}')` |
| `meet.lobby` | — | `lobby` ← waiting | số trên Mọi người; banner `lobbyWaiting{count}` khi tăng và panel đóng |
| `meet.admitted` | — | đang `waiting` ⇒ `join` lại | — |
| `meet.denied` | — | `phase = denied` | màn từ chối |
| `meet.removed` | — | `phase = removed`, ngắt, xoá tin chờ | màn bị mời ra |
| `meet.muted` | — | `mic = false`, nhớ cho lần vào lại | banner `mutedBy{name}` / `mutedByUnknown` |
| `meet.error` | — | có `clientId` ⇒ tin chờ lỗi; có `action` ⇒ bỏ pending | banner theo `errorCode` |
| `meet.invited` | dòng tạm vào Sắp tới | — | banner chạm ⇒ `/meet/{code}` |
| `meet.starting` | — | — | banner chạm ⇒ `/meet/{code}` |
| `meet.cancelled` | `markEnded(cancelled)` | đang ở màn chờ của cuộc họp đó ⇒ `ended` | banner `notifCancelled{title}` / `notifCancelledUnknown` |

### Mã lỗi → `MeetingText` (Task 2) — bảng giống hệt web `meeting-errors.ts`

`MEETING_NOT_FOUND→errNotFound · MEETING_FORBIDDEN→errForbidden · MEETING_CREATE_FORBIDDEN→errCreateForbidden · MEETING_DEPARTMENT_FORBIDDEN→errDepartmentForbidden · MEETING_REMOVED→errRemoved · MEETING_LOCKED→errLocked · MEETING_ENDED→errEnded · MEETING_FULL→errFull{max=params.max??25} · MEETING_NOT_CANCELLABLE→errNotCancellable · MEETINGS_UNAVAILABLE / HTTP 503→errUnavailable · MEETING_NOTES_READ_ONLY→errNotesReadOnly · MEETING_NOTE_CONFLICT→errNoteConflict · RATE_LIMITED / HTTP 429→errRateLimited · MEETING_INVALID{field}`: `title→valTitleTooLong{max}`, `description→valDescriptionTooLong{max}`, `inviteeIds+max→valTooManyInvitees{max}` / không max→`errInviteeInvalid`, `departmentId→errDepartmentInvalid`, `scheduledStart→errStartInvalid`, `scheduledEnd→errEndInvalid`, `targetId→errTargetUnavailable`, `content`+ngữ cảnh note→`errNoteTooLong{max}` / khác→`errChatTooLong{max}`, khác→`errInvalid` · `DioExceptionType.connectionError/connectionTimeout/receiveTimeout/sendTimeout` hoặc không có response→`errNetwork` · còn lại→`errGeneric` (**không bao giờ** `e.toString()`).

---

## Kiến trúc trạng thái

```
                    ┌──────────── MeetingsStore (keepAlive Notifier<MeetingsCacheState>) ────────────┐
REST (MeetingsApi) ►│ byId: {id → Meeting} · idByCode · upcoming: MeetingListData? · past (+ pastStale) │
                    └───────▲──────────────────────▲───────────────────────────▲─────────────────────┘
        meetingListProvider(scope) /       domain/cache_updates.dart        MeetingsCacheSink
        meetingDetailProvider(id) /        (hàm thuần, bất biến)             (controller, queue)
        meetingByCodeProvider(code) ── đọc + ghi ──┘
/user/queue/meeting ─► StompService.meetingQueue ─► MeetingQueueListener ─► domain/meeting_queue.dart
                                                                              │ sự kiện phòng
/topic/meeting/{id} ─► StompService.meetingTopic ─► MeetingRoomRealtime ──┐   ▼
                                                                         ▼  active_room.dart
               MeetingRoomController (Dart thuần) ◄──────────────────────────┘
                 │ REST join/lobby/end · publish /app/meet.* · RtcSession (LiveKitSession, dùng chung Cuộc gọi)
                 ▼
     RoomStore ◄─ meetingRoomStoreProvider (Notifier<MeetingRoomState>, một phòng mở tại một thời điểm)
       MeetingRoomState: phase, myRole, settings, mic/camera/screen/frontCamera/speaker, reconnecting, poorConnection,
       peers, localStream, activeSpeakerId, layout, pinnedKey, panel, unreadChat, pendingChat, pendingHost,
       reactions, roster, hands, lobby, chat (lines + hasOlder), sharedNoteRemote, sharedNoteResync
```

- **Một controller đang hoạt động** (`setActiveMeetingRoom` / `activeMeetingRoom()` trong `state/active_room.dart`); `meeting_queue.dart` chuyển `lobby/admitted/denied/removed/muted/error/ended/cancelled/chat` cho nó khi `meetingId` khớp (như web).
- Widget đọc phòng bằng `ref.watch(meetingRoomStoreProvider.select((s) => s.x))` — **select hẹp** để reaction bay không dựng lại cả cây (memory perf "rebuild storm").
- Ghi chú: `noteEditorProvider((meetingId, scope))` = reducer `note_sync.dart` + autosave 2s + flush; trong phòng nhận `sharedNoteRemote` từ `MeetingRoomState`; màn chi tiết không subscribe topic (cuộc họp có thể đã ENDED).
- Controller nhận mọi phụ thuộc qua `MeetingRoomDeps` (api, cache sink, realtime, `createSession`, `now`, `newClientId`, `notify`) ⇒ unit test không Flutter binding, không plugin.

## Cây widget

```
/meetings                         MeetingsScreen (Scaffold + AppBar "Phòng họp")
 ├─ MeetingsHeader                [Họp ngay] [Lên lịch] (HOST_MEETING) + JoinByCodeField
 ├─ TabBar (Sắp tới | Đã qua) → MeetingListView → MeetingRow (MeetingStatusChip, nút sao chép link)
 └─ CreateMeetingSheet.show(mode: create|edit|again)  (bottom sheet cuộn, 92% chiều cao)
      ├─ MeetingTextFields · MeetingScheduleFields (Bắt đầu ngay / Lên lịch, ngày, giờ, thời lượng, nhãn GMT+7)
      ├─ InviteePicker (+ MeetingDepartmentField khi có lựa chọn)
      └─ MeetingSettingsFields (5 SwitchListTile)

/meetings/:id                     MeetingDetailScreen
 ├─ MeetingInfoCard               tiêu đề, trạng thái, thời gian, mã, host / co-host / được mời / phòng ban
 ├─ MeetingActionsBar             Tham gia · Sao chép link · Sửa · Huỷ · Kết thúc · Họp lại
 ├─ AttendanceList
 ├─ NotesEditor (SegmentedButton Chung | Của tôi; Viết | Xem trước) → NoteConflictSheet
 └─ ChatHistoryView

/meet/:code                       MeetingRoomScreen (toàn màn hình, root navigator): tải theo mã → notFound | ended (→ chi tiết) | MeetingSessionView
 └─ MeetingSessionView            tạo controller + MeetingRoomRealtime + lifecycle + wakelock, MeetingRoomScope(controller), switch theo phase
      ├─ PrejoinScreen → PrejoinPreview (RTCVideoView preview, nút mic/cam/đổi camera, loa ngoài)
      ├─ WaitingScreen
      ├─ RoomStatusScreen          denied · removed · locked · full · unavailable · notFound · left · connectionLost · error
      └─ MeetingRoomView
           ├─ MeetingStage → MeetingTile (RTCVideoView | chữ cái/ảnh; huy hiệu mic tắt, ✋ số, khiên host; nhấn giữ = Ghim)
           ├─ RoomBanners · ReactionOverlay
           └─ ControlBar (mic · cam · giơ tay · reaction · Thêm · Rời)
                ├─ ReactionPicker (sheet nhỏ 6 emoji)
                ├─ RoomMoreSheet  Mọi người (số chờ) · Chat (chưa đọc) · Ghi chú · Trình bày (Android) · Đổi camera · Loa ngoài · Bố cục · Quyền người tổ chức
                ├─ LeaveSheet     attendee: Rời · host/co-host: Rời / Kết thúc cho mọi người (xác nhận)
                ├─ ParticipantsSheet → LobbySection, ParticipantRow → HostActionsSheet; RoomManageSection
                ├─ MeetingChatSheet → ChatLines, ChatComposer
                └─ NotesSheet → NotesEditor
```

Bố cục phòng (phone, mọi chiều rộng): sân khấu toàn màn nền tối cố định (`Colors.black` / `Color(0xFF0A0A0A)` — "nội dung", như màn Cuộc gọi), thanh điều khiển dưới cao 72 + `SafeArea`, panel là `showModalBottomSheet(isScrollControlled, useSafeArea)` cao 85%, bo `AppTheme.radiusSheet`, nền `colorScheme.surface`, hairline trên. Tablet ≥ 768 dp: vẫn sheet (đơn giản, đủ cho P1). Nút tròn 48 (vùng chạm ≥ 44), bật = `colorScheme.surfaceContainerHighest`, tắt mic/cam = `colorScheme.error` (giống web — owner quyết định 6 của plan web).

## Bản đồ file

**Mới — domain (Dart thuần, test trước)** (`FM/domain/`)

| File | Mirror web | ~dòng | Task |
|---|---|---|---|
| `json_read.dart` | (helper parse phòng thủ) | 60 | 1 |
| `meeting_models.dart` | `lib/api/meeting-types.ts` (Meeting, Person, Settings, Attendance, Page, Input, DepartmentOption, hằng số) | 330 | 1 |
| `meeting_room_models.dart` | `meeting-types.ts` (Join, Message, Note, Hand, Lobby, Roster, `HostAction`, emoji) | 230 | 1 |
| `meeting_text.dart` | khoá i18n `meeting.*` dưới dạng enum `MeetingText` + `MeetingNotice` | 130 | 2 |
| `meeting_errors.dart` | `meeting-errors.ts` | 150 | 2 |
| `display.dart` | `safeDisplayName` + `display.ts` | 50 | 3 |
| `meeting_events.dart` | `meeting-events.ts` | 260 | 3 |
| `cache_updates.dart` | `cache-updates.ts` + `applyMeetingEnded` | 280 | 4 |
| `schedule.dart` | `schedule.ts` (+ `LocalZone`) | 190 | 5 |
| `meeting_form.dart` | `meeting-form.ts` | 180 | 5 |
| `meeting_code.dart` | `meeting-code.ts` | 45 | 6 |
| `attendance.dart` | `attendance.ts` | 90 | 6 |
| `permissions.dart` | `permissions.ts` | 140 | 6 |
| `meeting_queue.dart` | `lib/realtime/meeting-queue.ts` | 160 | 7 |
| `note_sync.dart` | `note-sync.ts` | 180 | 11 |
| `room_phase.dart` | `room-phase.ts` | 100 | 14 |
| `stage_layout.dart` | `stage-layout.ts` | 130 | 14 |
| `reactions.dart` | `reactions.ts` | 50 | 14 |
| `room_host.dart` | `room-host.ts` | 100 | 14 |
| `device_prefs.dart` | `devices.ts` (mobile: mic/cam/camera trước/loa) | 70 | 14 |
| `room_events.dart` | `room-events.ts` (áp vào `MeetingRoomState`) | 130 | 15 |

**Mới — data / state** (`FM/data/`, `FM/state/`)

| File | Mirror web | ~dòng | Task |
|---|---|---|---|
| `data/meetings_repository.dart` | `lib/api/meetings.ts` | 210 | 1 |
| `data/my_departments_repository.dart` | `authService.getMyDepartments` | 50 | 1 |
| `state/meetings_store.dart` | cache TanStack (`setQueryData`) | 120 | 4 |
| `state/meetings_providers.dart` | `lib/hooks/use-meetings.ts` | 260 | 7 |
| `state/meeting_queue_listener.dart` | `useRealtimeNotifications` (phần meeting) | 110 | 7 |
| `state/note_editor.dart` | `lib/hooks/use-note-editor.ts` | 200 | 11 |
| `state/meeting_room_state.dart` | `lib/store/meeting.store.ts` | 260 | 15 |
| `state/meeting_room_deps.dart` | `room-session.ts` (deps, `JoinMedia`) | 110 | 15 |
| `state/room_session_wiring.dart` | `room-session.ts` (`wireRoomSession`, `peersPatch`) | 90 | 15 |
| `state/room_sync.dart` | `room-sync.ts` | 100 | 15 |
| `state/active_room.dart` | `active-room.ts` | 25 | 15 |
| `state/meeting_room_chat.dart` | `meeting-room-chat.ts` | 150 | 15 |
| `state/meeting_room_controller.dart` | `meeting-room-controller.ts` | ≤ 400 | 15 |
| `state/meeting_room_realtime.dart` | `use-meeting-room-stomp.ts` + `use-lobby-exit.ts` | 140 | 16 |
| `state/meeting_room_providers.dart` | (store + deps + `inAnyCall`) | 130 | 16 |
| `state/media_preview.dart` | `use-media-preview.ts` | 170 | 17 |

**Mới — UI** (`FM/ui/`) — mỗi file ≤ 400 (mục tiêu ≤ 250)

| File | Task |
|---|---|
| `meeting_text_l10n.dart` (`meetingText(l10n, notice)`, `durationLabel`, `roleLabel`, `statusLabel`) | 2 |
| `meetings_screen.dart`, `widgets/meetings_header.dart`, `widgets/join_by_code_field.dart`, `widgets/meeting_list_view.dart`, `widgets/meeting_row.dart`, `widgets/meeting_status_chip.dart`, `widgets/copy_meeting_link.dart` | 10 |
| `create_meeting_sheet.dart`, `widgets/meeting_text_fields.dart`, `widgets/meeting_schedule_fields.dart`, `widgets/invitee_picker.dart`, `widgets/meeting_department_field.dart`, `widgets/meeting_settings_fields.dart` | 10 |
| `widgets/notes_editor.dart`, `widgets/note_conflict_sheet.dart` | 11 |
| `meeting_detail_screen.dart`, `widgets/detail/meeting_info_card.dart`, `widgets/detail/meeting_actions_bar.dart`, `widgets/detail/attendance_list.dart`, `widgets/detail/chat_history_view.dart` | 12 |
| `room/meeting_room_screen.dart`, `room/meeting_session_view.dart`, `room/meeting_room_scope.dart`, `room/prejoin_screen.dart`, `room/prejoin_preview.dart`, `room/waiting_screen.dart`, `room/room_status_screen.dart` | 17 |
| `room/meeting_room_view.dart`, `room/meeting_stage.dart`, `room/meeting_tile.dart`, `room/room_banners.dart`, `room/control_bar.dart`, `room/room_more_sheet.dart`, `room/leave_sheet.dart`, `room/reaction_picker.dart`, `room/reaction_overlay.dart` | 18 |
| `room/participants_sheet.dart`, `room/lobby_section.dart`, `room/participant_row.dart`, `room/host_actions_sheet.dart`, `room/room_manage_section.dart` | 19 |
| `room/meeting_chat_sheet.dart`, `room/chat_lines.dart`, `room/chat_composer.dart` | 20 |
| `room/notes_sheet.dart` | 21 |

**Mới — core / native**

| File | Nội dung | Task |
|---|---|---|
| `FL/core/router/return_path.dart` | `isSafeReturnPath`, `ReturnPathHolder` (bộ nhớ) | 8 |
| `FL/core/services/push_routes.dart` | `pushRouteFor(Map data)` thuần | 9 |
| `FL/core/rtc/screen_capture.dart` | `ScreenCaptureHost` + `AndroidScreenCapture` (`Helper.requestCapturePermission` + MethodChannel `pon/screen_share`) + `NoScreenCapture` | 13 |
| `android/app/src/main/kotlin/com/platform/platform_client/ScreenShareService.kt` | foreground service `mediaProjection` | 13 |
| `android/app/src/main/res/values{,-vi,-zh,-ja,-ko,-es,-fr}/strings.xml` | `meeting_push_invited`, `meeting_push_starting` | 9 |
| `ios/Runner/{en,vi,zh-Hans,ja,ko,es,fr}.lproj/Localizable.strings` | cùng 2 khoá | 9 |

**Sửa**

| File | Thay đổi | Task |
|---|---|---|
| `FL/features/chat/data/stomp_service.dart`, `stomp_streams.dart` | + `/user/queue/meeting` trong `subscribeNotifications()` (key `meet`) + stream `meetingQueue`; + `subscribeMeetingTopic(id)` / `unsubscribeMeetingTopic(id)` (key `meet_$id`) + stream `meetingTopic` (`Map<String,dynamic>` thô) | 7, 16 |
| `FL/features/chat/domain/conversations_notifier.dart` | đọc sớm `meetingQueueListenerProvider` (như `groupCallSignalingProvider`) | 7 |
| `FL/core/router/app_routes.dart` | + `/meetings`, `/meetings/:id`, `/meet/:code` (root navigator) | 8 |
| `FL/core/router/route_guard.dart`, `app_router.dart` | nhớ / dùng lại đường dẫn họp sau đăng nhập | 8 |
| `FL/core/config/app_config.dart` | + `webBaseUrl` (`PON_WEB_URL`) | 8 |
| `FL/features/chat/ui/conversation_list_screen.dart` | + icon Phòng họp ở header | 8 |
| `FL/main.dart` | deep link `platform://meet/{code}`; FCM theo `type`; vòng đời (giữ STOMP khi đang họp, `detached` rời phòng chờ) | 8, 9, 16 |
| `FL/core/services/notification_service.dart` | kênh `pon_meetings`, `showMeetingNotification`, payload chạm `meet:{code}` | 9 |
| `android/app/src/main/AndroidManifest.xml`, `…/MainActivity.kt` | intent-filter host `meet`; `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PROJECTION`; `<service .ScreenShareService foregroundServiceType="mediaProjection">`; MethodChannel `pon/screen_share` | 8, 13 |
| `ios/Runner/Info.plist`, `ios/Runner.xcodeproj/project.pbxproj` | `UIBackgroundModes: [audio]` (owner quyết định 4); `knownRegions` + nhóm `Localizable.strings` | 9, 16 |
| `FL/core/rtc/rtc_session.dart`, `livekit_session.dart` | mở rộng tương thích ngược (Sai khác #2) | 13 |
| `pubspec.yaml` | `wakelock_plus: ^1.5.2` trực tiếp (đang bắc cầu — lockfile giữ nguyên version) | 16 |
| `lib/l10n/app_{en,vi,zh,ja,ko,es,fr}.arb` (+ `GEN`) | khoá `meeting*` theo task | 2, 7, 9, 10–12, 17–21 |
| `docs/api-spec.md`, `apps/client/CLAUDE.md`, `docs/superpowers/plans/README.md`, `docs/environments.md` | tài liệu | 23 |

**Test mới** (`FT/`): `data/meetings_repository_test.dart`, `domain/{meeting_models,meeting_errors,meeting_events,display,cache_updates,schedule,meeting_form,meeting_code,attendance,permissions,meeting_queue,note_sync,room_phase,stage_layout,reactions,room_host,device_prefs,room_events}_test.dart`, `state/{meetings_store,note_editor,meeting_room_controller,meeting_room_controller_sync,meeting_room_realtime}_test.dart`, `state/fake_room_session.dart` (fake dùng chung), `ui/{meeting_text_l10n,create_meeting_sheet,notes_editor,room_status_screen,participants_sheet,control_bar}_test.dart`; `test/core/{return_path,push_routes}_test.dart`; mở rộng `test/core/route_guard_test.dart`, `test/core/app_config_test.dart`. Test Cuộc gọi `test/features/chat/calls/*` **không sửa**.

---

## i18n — khoá mới (7 locale qua `tool/add_arb_keys.py`)

**Quy tắc đặt tên:** khoá web `meeting.<k>` ⇒ ARB `meeting<K>` (viết hoa chữ đầu): `errNotFound → meetingErrNotFound`, `title → meetingTitle`, `sectionHands → meetingSectionHands`. **Chữ = đúng bản web đã ship** ở cả 7 locale (`apps/web/messages/{en,vi,zh,ja,ko,es,fr}.json` › `meeting`, 285 khoá — bảng en · vi đầy đủ ở plan web mục "i18n"); ICU plural giữ nguyên cú pháp. Không đụng khoá có sẵn `meetingSummary*` (biên bản AI của cuộc gọi nhóm — không trùng tên).

Công cụ (Task 2, commit cùng repo): `tool/web_meeting_keys.py` đọc `apps/web/messages/<loc>.json` › `meeting`, nhận danh sách khoá web, in spec JSON cho `add_arb_keys.py` (placeholder `count|max|n|minutes|hours` = `int`, còn lại `String`; khoá có `plural` ⇒ `count`/`minutes` kiểu `int`). Dùng: `python3 tool/web_meeting_keys.py errNotFound errForbidden … | python3 tool/add_arb_keys.py && flutter gen-l10n`. Khoá chỉ-mobile và khoá đổi chữ cho mobile viết tay trong spec (bảng dưới).

**Khoá web theo task** (port nguyên chữ):

| Task | Khoá web |
|---|---|
| 2 | `err*` (23 khoá), `val*` (5), `untitled`, `someone`, `participantFallback`, `you`, `roleHost`, `roleCohost`, `roleAttendee`, `statusLive`, `statusScheduled`, `statusEnded`, `statusCancelled`, `durationMinutes`, `durationHours`, `durationHoursMinutes`, `realtimeOffline`, `mutedBy`, `mutedByUnknown`, `madeCohost`, `revokedCohost`, `endedToast`, `mediaFailed`, `shareRevoked`, `shareFailed` |
| 7 | `notifInvitedTitle`, `notifInvitedBody`, `notifInvitedBodyAt`, `notifStartingTitle`, `notifStartingBody`, `notifCancelled`, `notifCancelledUnknown`, `notifOpen` |
| 8 | `title` |
| 10 | `subtitle`, `newInstant`, `newScheduled`, `joinByCodeLabel`, `joinByCodePlaceholder`, `joinByCode`, `codeInvalid`, `tabUpcoming`, `tabPast`, `emptyUpcoming`, `emptyPast`, `loadMore`, `listError`, `instantMeeting`, `hostedBy`, `copyLink`, `linkCopied`, `copyFailed`, `join`, `starting`, `formCreateTitle`, `formEditTitle`, `formAgainTitle`, `fieldTitle`, `fieldTitlePlaceholder`, `fieldDescription`, `fieldDescriptionPlaceholder`, `fieldWhen`, `whenNow`, `whenLater`, `fieldDate`, `fieldTime`, `fieldDuration`, `timeZoneHint`, `fieldInvitees`, `inviteeSearchPlaceholder`, `inviteeCount`, `inviteeNone`, `removeInvitee`, `searchNoResults`, `searchFailed`, `fieldDepartment`, `departmentNone`, `departmentHint`, `settingsTitle`, `settingWaitingRoom`, `settingWaitingRoomDesc`, `settingMuteOnEntry`, `settingMuteOnEntryDesc`, `settingScreenShare`, `settingNotes`, `settingLocked`, `settingLockedDesc`, `submitCreate`, `submitStartNow`, `submitSave`, `toastCreated`, `toastUpdated`, `charCounter` |
| 11 | `notesShared`, `notesPrivate`, `notesPrivateHint`, `notesPlaceholder`, `notesWrite`, `notesPreview`, `notesSaving`, `notesSaved`, `notesUnsaved`, `notesSaveFailed`, `notesRetry`, `notesReadOnly`, `notesRemoteNewer`, `notesRemoteNewerUnknown`, `notesCounter`, `notesConflictTitle`, `notesConflictDesc`, `notesConflictReview`, `notesConflictTheirs`, `notesConflictMine`, `notesConflictKeepMine`, `notesConflictTakeTheirs`, `notesConflictSaveMerged`, `notesConflictDiscardWarning` |
| 12 | `edit`, `cancelMeeting`, `meetAgain`, `endMeeting`, `cancelConfirmTitle`, `cancelConfirmDesc`, `endConfirmTitle`, `endConfirmDesc`, `toastCancelled`, `toastEnded`, `backToList`, `detailError`, `meetingCode`, `sectionPeople`, `coHosts`, `invitees`, `moreCount`, `departmentGeneric`, `sectionAttendance`, `attendanceEmpty`, `attendanceInside`, `attendanceDuration`, `attendanceSessions`, `sectionNotes`, `sectionChat`, `chatHistoryEmpty`, `chatLoadOlder`, `chatHistoryError`, `removedNotice`, `guestNotice`, `createdAt` |
| 17 | `joinNow`, `askToJoin`, `prejoinTitle`, `prejoinStartsAt`, `prejoinJoiningAs`, `prejoinCameraOff`, `prejoinMuteOnEntry`, `prejoinLockedHint`, `prejoinInCall`, `micOn`, `micOff`, `camOn`, `camOff`, `mediaUnavailable`, `waitingTitle`, `waitingDesc`, `waitingCancel`, `deniedTitle`, `deniedDesc`, `removedTitle`, `removedDesc`, `lockedTitle`, `lockedDesc`, `fullTitle`, `fullDesc`, `unavailableTitle`, `unavailableDesc`, `notFoundTitle`, `notFoundDesc`, `leftTitle`, `connectionLostTitle`, `connectionLostDesc`, `rejoin`, `tryAgain`, `viewDetails` |
| 18 | `leaveMeeting`, `nameWithYou`, `reconnecting`, `poorConnection`, `presenting`, `stopPresenting`, `presentingName`, `participantCount`, `overflowTiles`, `overflowMore`, `pin`, `unpin`, `tileMenu`, `micMutedLabel`, `handRaisedLabel`, `speakingLabel`, `poorConnectionPeer`, `hostBadge`, `shareStart`, `shareDisabled`, `raiseHand`, `lowerHand`, `reactions`, `chat`, `notes`, `people`, `more`, `layout`, `layoutGrid`, `layoutSpotlight`, `devicesTitle`, `leave`, `endForAll`, `reactionAria` |
| 19 | `peopleTitle`, `manageTitle`, `lobbyWaiting`, `sectionHands`, `sectionLobby`, `sectionInMeeting`, `admit`, `deny`, `admitAll`, `personMenu`, `actionMuteMic`, `actionMuteAll`, `actionRemove`, `actionLowerHand`, `actionLowerAllHands`, `actionMakeCohost`, `actionRevokeCohost`, `removeConfirmTitle`, `removeConfirmDesc`, `muteAllConfirmTitle`, `muteAllConfirmDesc` |
| 20 | `chatTitle`, `chatPlaceholder`, `chatSend`, `chatEmpty`, `chatFailed`, `chatRetry`, `chatDiscard`, `chatSending`, `chatOffline`, `chatCounter`, `chatUnread` |

**Không port** (chỉ có nghĩa trên trình duyệt): `deviceMic`, `deviceCamera`, `deviceSpeaker`, `deviceDefault`, `deviceUnnamedMic`, `deviceUnnamedCamera`, `deviceUnnamedSpeaker`, `micLevel`, `withShortcut`, `mediaBlocked` (thay bằng bản mobile dưới).

**Khoá chỉ-mobile / đổi chữ cho mobile** (en · vi; zh/ja/ko/es/fr dịch lúc thực thi, không chép tiếng Anh):

| Khoá ARB | en | vi | Task |
|---|---|---|---|
| `meetingMediaBlocked` | Microphone or camera access is off. You can still join and turn it on later in Settings. | Quyền micro hoặc camera đang tắt. Bạn vẫn có thể tham gia và bật lại sau trong Cài đặt. | 17 |
| `meetingSwitchCamera` | Switch camera | Đổi camera | 17 |
| `meetingSpeakerOn` / `meetingSpeakerOff` | Use speaker / Use earpiece | Dùng loa ngoài / Dùng loa trong | 17 |
| `meetingPushInvited` | You're invited to a meeting | Bạn được mời tham gia một cuộc họp | 9 |
| `meetingPushStarting` | Your meeting starts in 10 minutes | Cuộc họp của bạn bắt đầu sau 10 phút | 9 |
| `meetingPushChannel` | Meetings | Phòng họp | 9 |
| `meetingShareNotifTitle` | Presenting your screen | Đang trình bày màn hình | 18 |
| `meetingShareNotifBody` | Everyone in the meeting can see your screen | Mọi người trong cuộc họp đang thấy màn hình của bạn | 18 |
| `meetingLinkCodeCopied` | Meeting code copied | Đã sao chép mã cuộc họp | 10 |

Chuỗi đẩy native (Task 9) dùng **đúng** chữ `meetingPushInvited` / `meetingPushStarting` của 7 locale (một nguồn, copy sang `strings.xml` / `Localizable.strings`).

---
# Tasks

Thứ tự theo phụ thuộc. **MT6:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12. **MT7:** 13 → 14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22 → 23. Task 8 (route/return path/nav) và 9 (push) chỉ cần Task 1–3; Task 13 (RTC) độc lập với MT6, làm song song được. Mọi task kết thúc bằng test của task + `FA` + `wc -l` file mới + commit (`feat(mobile): …`).

## MT6 — Danh sách, tạo, chi tiết

### Task 1: Model contract + `MeetingsApi` (repository Dio)

**Files:**
- Create: `FM/domain/json_read.dart`, `FM/domain/meeting_models.dart`, `FM/domain/meeting_room_models.dart`, `FM/data/meetings_repository.dart`, `FM/data/my_departments_repository.dart`
- Test: `FT/domain/meeting_models_test.dart`, `FT/data/meetings_repository_test.dart`

**Interfaces — Produces** (rút gọn; mọi class bất biến, `const` khi được, `==`/`hashCode` cho class giá trị nhỏ dùng trong test — dùng `package:collection` `ListEquality` có sẵn):

```dart
// json_read.dart — mọi dữ liệu mạng đi qua đây; sai kiểu ⇒ null, không ném.
typedef Json = Map<String, dynamic>;
Json? asJson(Object? v) => v is Map ? v.cast<String, dynamic>() : null;
String? str(Object? v) => v is String && v.isNotEmpty ? v : null;
bool? boolOrNull(Object? v) => v is bool ? v : null;
int? intOrNull(Object? v) => v is int ? v : (v is num ? v.toInt() : null);
DateTime? dateOrNull(Object? v) => v is String ? DateTime.tryParse(v)?.toUtc() : null;
/// Rows of a list; a broken row is dropped, never the whole list.
List<T> rowsOf<T>(Object? v, T? Function(Json row) parse);

// meeting_models.dart
enum MeetingStatus { scheduled, live, ended }          // wire 'SCHEDULED' | 'LIVE' | 'ENDED'
enum MeetingViewerRole { host, cohost, invited, guest } // wire tên thường
enum MeetingRoomRole { host, cohost, attendee }
enum MeetingListScope { upcoming, past }
enum NoteScope { shared, private }
MeetingRoomRole roomRoleFromWire(Object? v);           // lạ ⇒ attendee (như web `role()`)

class MeetingPerson { const MeetingPerson({required this.userId, this.displayName, this.avatarUrl}); … static MeetingPerson? fromJson(Object? v); }
class MeetingSettings {
  const MeetingSettings({this.waitingRoom = true, this.muteOnEntry = false, this.allowAttendeeScreenShare = true,
      this.attendeesCanEditNotes = true, this.locked = false});
  static const defaults = MeetingSettings();
  /// null unless all 5 fields are booleans (web `settings()` in meeting-events).
  static MeetingSettings? fromJson(Object? v);
  Map<String, bool> toJson();
  MeetingSettings copyWith({bool? waitingRoom, …});
  /// Only the fields that differ from [initial] (edit form — never a stale copy of the others).
  Map<String, bool> changedFrom(MeetingSettings initial);
}
class MeetingAttendance { userId, displayName?, MeetingRoomRole role, DateTime joinedAt, DateTime? leftAt; static fromJson }
class Meeting {
  final String id, code; final String? title, description; final MeetingPerson host;
  final List<MeetingPerson> coHosts, invitees; final String? departmentId;
  final DateTime? scheduledStart, scheduledEnd; final MeetingStatus status; final MeetingSettings settings;
  final List<MeetingAttendance> attendance;
  /// host/co-host only — raw ids for matching, NEVER rendered.
  final List<String> removedIds;
  final MeetingViewerRole viewerRole; final DateTime createdAt; final DateTime? startedAt, endedAt, cancelledAt;
  /// null when id/code/host/status/viewerRole/createdAt is missing or malformed.
  static Meeting? fromJson(Object? v);
  Meeting copyWith({MeetingStatus? status, MeetingSettings? settings, DateTime? endedAt, DateTime? cancelledAt});
  bool get isCancelled => status == MeetingStatus.ended && cancelledAt != null;
}
class MeetingPage { final List<Meeting> content; final bool hasNext; static MeetingPage fromJson(Object? v); }
/// POST/PATCH body. PATCH: null = unchanged; '' clears title/description/departmentId.
class MeetingInput {
  const MeetingInput({this.title, this.description, this.inviteeIds, this.departmentId,
      this.scheduledStart, this.scheduledEnd, this.settings});
  final Map<String, bool>? settings;        // create: all 5; edit: only changed
  Json toJson();                            // only non-null keys; DateTime → toUtc().toIso8601String() (…Z)
}
class DepartmentOption { const DepartmentOption({required this.id, required this.name}); static DepartmentOption? fromJson(Object? v); }
abstract final class MeetingLimits {
  static const title = 120, description = 2000, invitees = 100, chat = 2000, note = 50000,
      participants = 25, maxDurationMinutes = 24 * 60, startGraceMinutes = 5;
}

// meeting_room_models.dart
sealed class MeetingJoinResponse { static MeetingJoinResponse fromJson(Object? v); }   // lạ ⇒ throw FormatException
final class MeetingJoined extends MeetingJoinResponse { final String url, token; final MeetingRoomRole role; }
final class MeetingWaiting extends MeetingJoinResponse { const MeetingWaiting(); }
class MeetingChatMessage { id, MeetingPerson sender, content, DateTime createdAt; static fromJson }   // web MeetingMessage (tên tránh trùng chat thường)
class MeetingMessagePage { final List<MeetingChatMessage> content; final bool hasNext; }      // newest first
class MeetingNote { NoteScope scope; String content; int version; MeetingPerson? updatedBy; DateTime? updatedAt; static MeetingNote? fromJson }
class MeetingHand { userId, displayName?, DateTime raisedAt }
class LobbyEntry { userId, displayName? }
class RosterEntry { userId, displayName?, MeetingRoomRole role, DateTime joinedAt }
enum HostAction {
  muteMic('MUTE_MIC', targeted: true), muteAll('MUTE_ALL'), remove('REMOVE', targeted: true),
  lowerHand('LOWER_HAND', targeted: true), lowerAllHands('LOWER_ALL_HANDS'), lock('LOCK'), unlock('UNLOCK'),
  waitingRoomOn('WAITING_ROOM_ON'), waitingRoomOff('WAITING_ROOM_OFF'),
  attendeeScreenShareOn('ATTENDEE_SCREEN_SHARE_ON'), attendeeScreenShareOff('ATTENDEE_SCREEN_SHARE_OFF'),
  makeCohost('MAKE_COHOST', targeted: true), revokeCohost('REVOKE_COHOST', targeted: true);
  const HostAction(this.wire, {this.targeted = false});
  final String wire; final bool targeted;
  static HostAction? fromWire(Object? v);
}
const kReactionEmojis = ['👍', '❤️', '😂', '😮', '👏', '🎉'];
```

```dart
// meetings_repository.dart
abstract interface class MeetingsApi {
  Future<MeetingPage> list(MeetingListScope scope, {String? cursor, int size = 20});
  Future<Meeting> get(String id);
  Future<Meeting> byCode(String code);
  Future<Meeting> create([MeetingInput input = const MeetingInput()]);
  Future<Meeting> update(String id, MeetingInput input);
  Future<void> cancel(String id);
  Future<MeetingJoinResponse> join(String id);
  Future<List<LobbyEntry>> lobby(String id);
  Future<void> leaveLobby(String id);
  Future<void> admit(String id, String userId);
  Future<void> deny(String id, String userId);
  Future<void> end(String id);
  Future<MeetingMessagePage> messages(String id, {String? before, int size = 50});
  Future<MeetingNote> getNote(String id, NoteScope scope);
  Future<MeetingNote> putNote(String id, NoteScope scope, {required String content, required int version});
  Future<List<MeetingHand>> hands(String id);
}
class MeetingsRepository implements MeetingsApi { MeetingsRepository(this._dio); … }
/// A malformed 2xx body (Meeting.fromJson == null) ⇒ throws [MeetingFormatException] → errGeneric.
final meetingsRepositoryProvider = Provider<MeetingsApi>((ref) {
  const storage = FlutterSecureStorage();
  return MeetingsRepository(DioClient.createChatDio(storage,
      onForceLogout: () => ref.read(authNotifierProvider.notifier).forceLogout()));
});

// my_departments_repository.dart
abstract interface class MyDepartmentsApi { Future<List<DepartmentOption>> list(); }
class MyDepartmentsRepository implements MyDepartmentsApi { … GET /api/users/me/departments (authDio) … }
final myDepartmentsRepositoryProvider = Provider<MyDepartmentsApi>(…createAuthDio…);
```

(Người thực thi kiểm chữ ký `DioClient.createChatDio` / `createAuthDio` và `forceLogout` trong `calls_repository.dart` rồi chép y mẫu.)

- [ ] **Step 1: Test model** — `FT/domain/meeting_models_test.dart`

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';

Map<String, dynamic> meetingJson([Map<String, dynamic> over = const {}]) => {
      'id': 'm1', 'code': 'abc-defg-hjk', 'title': 'Weekly sync',
      'host': {'userId': 'h1', 'displayName': 'Lan', 'avatarUrl': '/api/uploads/a.png'},
      'coHosts': [{'userId': 'c1'}], 'invitees': [{'userId': 'i1', 'displayName': 'Hoa'}, {'nope': 1}],
      'scheduledStart': '2026-10-08T02:00:00Z', 'scheduledEnd': '2026-10-08T03:00:00Z',
      'status': 'SCHEDULED',
      'settings': {'waitingRoom': true, 'muteOnEntry': false, 'allowAttendeeScreenShare': true,
          'attendeesCanEditNotes': true, 'locked': false},
      'attendance': [{'userId': 'h1', 'role': 'host', 'joinedAt': '2026-10-08T02:00:05Z'}],
      'viewerRole': 'host', 'createdAt': '2026-10-07T09:00:00Z',
      ...over,
    };

void main() {
  group('Meeting.fromJson', () {
    test('reads the shipped contract and drops broken rows', () {
      final m = Meeting.fromJson(meetingJson())!;
      expect(m.id, 'm1');
      expect(m.status, MeetingStatus.scheduled);
      expect(m.viewerRole, MeetingViewerRole.host);
      expect(m.host.displayName, 'Lan');
      expect(m.invitees.map((p) => p.userId), ['i1']);
      expect(m.scheduledStart, DateTime.utc(2026, 10, 8, 2));
      expect(m.attendance.single.role, MeetingRoomRole.host);
      expect(m.attendance.single.leftAt, isNull);
      expect(m.settings, MeetingSettings.defaults);
      expect(m.removedIds, isEmpty);
    });

    test('is null when a required field is missing or of the wrong type', () {
      expect(Meeting.fromJson(meetingJson({'id': null})), isNull);
      expect(Meeting.fromJson(meetingJson({'status': 'PAUSED'})), isNull);
      expect(Meeting.fromJson(meetingJson({'host': 'h1'})), isNull);
      expect(Meeting.fromJson('not a map'), isNull);
    });

    test('falls back to default settings when the block is malformed', () {
      expect(Meeting.fromJson(meetingJson({'settings': {'locked': 'yes'}}))!.settings, MeetingSettings.defaults);
      expect(MeetingSettings.fromJson({'locked': true}), isNull);
    });
  });

  group('MeetingInput.toJson', () {
    test('sends only what is set, times as UTC with Z', () {
      final input = MeetingInput(
        title: 'Sprint review', inviteeIds: const ['a', 'b'],
        scheduledStart: DateTime.parse('2026-10-09T14:00:00+07:00'),
        scheduledEnd: DateTime.parse('2026-10-09T15:00:00+07:00'),
        settings: MeetingSettings.defaults.toJson(),
      );
      expect(input.toJson(), {
        'title': 'Sprint review', 'inviteeIds': ['a', 'b'],
        'scheduledStart': '2026-10-09T07:00:00.000Z', 'scheduledEnd': '2026-10-09T08:00:00.000Z',
        'settings': {'waitingRoom': true, 'muteOnEntry': false, 'allowAttendeeScreenShare': true,
            'attendeesCanEditNotes': true, 'locked': false},
      });
      expect(const MeetingInput().toJson(), isEmpty);
      expect(const MeetingInput(title: '', description: '').toJson(), {'title': '', 'description': ''});
    });

    test('settings diff keeps only flipped switches', () {
      final next = MeetingSettings.defaults.copyWith(muteOnEntry: true);
      expect(next.changedFrom(MeetingSettings.defaults), {'muteOnEntry': true});
      expect(MeetingSettings.defaults.changedFrom(MeetingSettings.defaults), isEmpty);
    });
  });

  group('room models', () {
    test('join answers', () {
      expect(MeetingJoinResponse.fromJson({'status': 'waiting'}), isA<MeetingWaiting>());
      final j = MeetingJoinResponse.fromJson({'status': 'joined', 'url': 'wss://rtc', 'token': 't', 'role': 'cohost'});
      expect(j, isA<MeetingJoined>().having((x) => x.role, 'role', MeetingRoomRole.cohost));
      expect(() => MeetingJoinResponse.fromJson({'status': 'joined'}), throwsFormatException);
    });

    test('host actions round-trip their wire names and know which need a target', () {
      expect(HostAction.values, hasLength(13));
      for (final a in HostAction.values) {
        expect(HostAction.fromWire(a.wire), a);
      }
      expect(HostAction.values.where((a) => a.targeted).map((a) => a.wire).toSet(),
          {'MUTE_MIC', 'REMOVE', 'LOWER_HAND', 'MAKE_COHOST', 'REVOKE_COHOST'});
      expect(HostAction.fromWire('DROP_TABLE'), isNull);
    });
  });
}
```

(Package `platform_client` — đã kiểm `pubspec.yaml`.)

- [ ] **Step 2: Test repository** — `FT/data/meetings_repository_test.dart` (adapter giả ghi lại request; mirror `meetings.test.ts`)

```dart
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/data/meetings_repository.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';

class _Recorder implements HttpClientAdapter {
  final requests = <RequestOptions>[];
  Object? body;
  int status = 200;

  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<Uint8List>? s, Future<void>? cancel) async {
    requests.add(o);
    return ResponseBody.fromString(body == null ? '' : jsonEncode(body), status,
        headers: {Headers.contentTypeHeader: [Headers.jsonContentType]});
  }

  @override
  void close({bool force = false}) {}
}

Map<String, dynamic> meeting(String id) => {
      'id': id, 'code': 'abc-defg-hjk', 'host': {'userId': 'h'}, 'status': 'LIVE',
      'settings': {'waitingRoom': true, 'muteOnEntry': false, 'allowAttendeeScreenShare': true,
          'attendeesCanEditNotes': true, 'locked': false},
      'viewerRole': 'host', 'createdAt': '2026-10-07T00:00:00Z',
    };

void main() {
  late _Recorder http;
  late MeetingsRepository api;
  RequestOptions last() => http.requests.last;

  setUp(() {
    http = _Recorder();
    api = MeetingsRepository(Dio(BaseOptions(baseUrl: 'https://chat.test'))..httpClientAdapter = http);
  });

  test('lists a scope with the cursor only when there is one', () async {
    http.body = {'content': [meeting('m1')], 'page': 0, 'size': 20, 'totalElements': 1, 'hasNext': true};
    final page = await api.list(MeetingListScope.upcoming);
    expect(last().path, '/api/meetings');
    expect(last().queryParameters, {'scope': 'upcoming', 'size': 20});
    expect(page.content.single.id, 'm1');
    expect(page.hasNext, isTrue);
    await api.list(MeetingListScope.past, cursor: 'm9', size: 50);
    expect(last().queryParameters, {'scope': 'past', 'cursor': 'm9', 'size': 50});
  });

  test('encodes ids and codes in paths', () async {
    http.body = meeting('m1');
    await api.byCode('abc-defg-hjk');
    expect(last().path, '/api/meetings/by-code/abc-defg-hjk');
    http.body = null;
    http.status = 204;
    await api.admit('m 1', 'u/2');
    expect(last().method, 'POST');
    expect(last().path, '/api/meetings/m%201/lobby/u%2F2/admit');
  });

  test('creates an instant meeting with an empty body', () async {
    http.status = 201;
    http.body = meeting('m1');
    final m = await api.create();
    expect(last().method, 'POST');
    expect(last().data, <String, dynamic>{});
    expect(m.id, 'm1');
  });

  test('pages chat history newest-first with before + size', () async {
    http.body = {'content': [], 'page': 0, 'size': 50, 'totalElements': 0, 'hasNext': false};
    await api.messages('m1', before: 'msg7');
    expect(last().path, '/api/meetings/m1/messages');
    expect(last().queryParameters, {'before': 'msg7', 'size': 50});
  });

  test('reads and writes notes by scope', () async {
    http.body = {'scope': 'private', 'content': '', 'version': 0};
    await api.getNote('m1', NoteScope.private);
    expect(last().path, '/api/meetings/m1/notes/private');
    http.body = {'scope': 'shared', 'content': '# hi', 'version': 4};
    final saved = await api.putNote('m1', NoteScope.shared, content: '# hi', version: 3);
    expect(last().method, 'PUT');
    expect(last().data, {'content': '# hi', 'version': 3});
    expect(saved.version, 4);
  });

  test('unwraps hands and lobby and tolerates a missing array', () async {
    http.body = {'hands': [{'userId': 'a', 'raisedAt': '2026-10-08T02:06:00Z'}]};
    expect((await api.hands('m1')).single.userId, 'a');
    http.body = {};
    expect(await api.hands('m1'), isEmpty);
    http.body = {'entries': [{'userId': 'g', 'displayName': 'Guest'}, {'bad': true}]};
    expect((await api.lobby('m1')).single.displayName, 'Guest');
    expect(last().path, '/api/meetings/m1/lobby');
  });

  test('maps lobby exit, end and cancel to their routes', () async {
    http.status = 204;
    await api.leaveLobby('m1');
    expect((last().method, last().path), ('DELETE', '/api/meetings/m1/lobby'));
    await api.end('m1');
    expect((last().method, last().path), ('POST', '/api/meetings/m1/end'));
    await api.cancel('m1');
    expect((last().method, last().path), ('DELETE', '/api/meetings/m1'));
  });

  test('a malformed meeting body is an error, not a crash later', () async {
    http.body = {'id': 'm1'};
    await expectLater(api.get('m1'), throwsA(isA<MeetingFormatException>()));
  });
}
```

- [ ] **Step 3: RED** — `FTEST test/features/meetings/domain/meeting_models_test.dart test/features/meetings/data` ⇒ không resolve.
- [ ] **Step 4: Hiện thực** theo Interfaces (web `meeting-types.ts`, `meetings.ts`); `final enc = Uri.encodeComponent`; `queryParameters` chỉ thêm `cursor`/`before` khi khác null. `MyDepartmentsRepository.list()` lọc `{id: String, name: String}` (mirror `authService.getMyDepartments`).
- [ ] **Step 5: GREEN** — `FTEST test/features/meetings && FA`; `wc -l lib/features/meetings/**/*.dart`.
- [ ] **Step 6: Commit** `feat(mobile): meetings API client and contract models`

---

### Task 2: Lỗi họp → `MeetingText` + lớp dịch + khoá ARB nền

**Files:**
- Create: `FM/domain/meeting_text.dart`, `FM/domain/meeting_errors.dart`, `FM/ui/meeting_text_l10n.dart`, `apps/client/tool/web_meeting_keys.py`
- Modify: `lib/l10n/app_*.arb` (khoá Task 2 — bảng i18n), `GEN`
- Test: `FT/domain/meeting_errors_test.dart`, `FT/ui/meeting_text_l10n_test.dart`

**Interfaces — Produces:**

```dart
// meeting_text.dart — every user-facing message the LOGIC can produce. UI maps it (meeting_text_l10n.dart).
enum MeetingText {
  errNotFound, errForbidden, errCreateForbidden, errDepartmentForbidden, errRemoved, errLocked, errEnded,
  errFull, errNotCancellable, errUnavailable, errNotesReadOnly, errNoteConflict, errRateLimited,
  errChatTooLong, errNoteTooLong, errInviteeInvalid, errDepartmentInvalid, errStartInvalid, errEndInvalid,
  errTargetUnavailable, errInvalid, errNetwork, errGeneric,
  valTitleTooLong, valDescriptionTooLong, valTooManyInvitees, valStartPast, valScheduleInvalid,
  realtimeOffline, mutedBy, mutedByUnknown, madeCohost, revokedCohost, endedToast, mediaFailed,
  shareRevoked, shareFailed, lobbyWaiting,
  notifInvitedTitle, notifInvitedBody, notifInvitedBodyAt, notifStartingTitle, notifStartingBody,
  notifCancelled, notifCancelledUnknown,
}
class MeetingNotice {
  const MeetingNotice(this.text, [this.args = const {}]);
  final MeetingText text;
  final Map<String, Object> args;      // max:int, count:int, name/title/time:String
  // == / hashCode / toString for tests
}

// meeting_errors.dart
enum MeetingErrorContext { general, chat, note }
class MeetingErrorInfo { const MeetingErrorInfo({this.status, this.code, this.params, this.network = false}); … }
MeetingErrorInfo parseMeetingError(Object error);          // DioException: response.data top-level {code, params}
MeetingNotice meetingErrorNotice(MeetingErrorInfo info, [MeetingErrorContext context = MeetingErrorContext.general]);
MeetingNotice meetingEventErrorNotice(String errorCode, Map<String, Object>? params,
    [MeetingErrorContext context = MeetingErrorContext.general]);
/// The `latest` of a 409 MEETING_NOTE_CONFLICT (validated), else null.
MeetingNote? noteConflictLatest(Object error);

// ui/meeting_text_l10n.dart
String meetingText(AppLocalizations l, MeetingNotice n);   // exhaustive switch — a new enum value fails to compile
String meetingErrorText(AppLocalizations l, Object error, [MeetingErrorContext c = MeetingErrorContext.general]);
String meetingDurationLabel(AppLocalizations l, int minutes);   // web durationLabel
String meetingRoleLabel(AppLocalizations l, MeetingRoomRole r);
```

- [ ] **Step 1: Test** — `FT/domain/meeting_errors_test.dart` (port `meeting-errors.test.ts`)

```dart
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/meeting_errors.dart';
import 'package:platform_client/features/meetings/domain/meeting_text.dart';

DioException httpError(int status, Object? data) {
  final o = RequestOptions(path: '/x');
  return DioException(requestOptions: o, type: DioExceptionType.badResponse,
      response: Response(requestOptions: o, statusCode: status, data: data));
}

MeetingText key(MeetingErrorInfo i, [MeetingErrorContext c = MeetingErrorContext.general]) =>
    meetingErrorNotice(i, c).text;

void main() {
  group('meetingErrorNotice', () {
    const table = {
      'MEETING_NOT_FOUND': MeetingText.errNotFound, 'MEETING_FORBIDDEN': MeetingText.errForbidden,
      'MEETING_CREATE_FORBIDDEN': MeetingText.errCreateForbidden,
      'MEETING_DEPARTMENT_FORBIDDEN': MeetingText.errDepartmentForbidden,
      'MEETING_REMOVED': MeetingText.errRemoved, 'MEETING_LOCKED': MeetingText.errLocked,
      'MEETING_ENDED': MeetingText.errEnded, 'MEETING_NOT_CANCELLABLE': MeetingText.errNotCancellable,
      'MEETINGS_UNAVAILABLE': MeetingText.errUnavailable, 'MEETING_NOTES_READ_ONLY': MeetingText.errNotesReadOnly,
      'MEETING_NOTE_CONFLICT': MeetingText.errNoteConflict, 'RATE_LIMITED': MeetingText.errRateLimited,
    };
    table.forEach((code, text) {
      test('$code → $text', () => expect(key(MeetingErrorInfo(code: code)), text));
    });

    test('fills the room size into MEETING_FULL', () {
      expect(meetingErrorNotice(const MeetingErrorInfo(code: 'MEETING_FULL')),
          const MeetingNotice(MeetingText.errFull, {'max': 25}));
    });

    test('maps MEETING_INVALID by field, using the server max when present', () {
      MeetingNotice inv(Map<String, Object> p) =>
          meetingErrorNotice(MeetingErrorInfo(code: 'MEETING_INVALID', params: p));
      expect(inv({'field': 'title', 'max': 120}), const MeetingNotice(MeetingText.valTitleTooLong, {'max': 120}));
      expect(inv({'field': 'description'}), const MeetingNotice(MeetingText.valDescriptionTooLong, {'max': 2000}));
      expect(inv({'field': 'inviteeIds', 'max': 100}), const MeetingNotice(MeetingText.valTooManyInvitees, {'max': 100}));
      expect(inv({'field': 'inviteeIds'}).text, MeetingText.errInviteeInvalid);
      expect(inv({'field': 'departmentId'}).text, MeetingText.errDepartmentInvalid);
      expect(inv({'field': 'scheduledStart'}).text, MeetingText.errStartInvalid);
      expect(inv({'field': 'scheduledEnd'}).text, MeetingText.errEndInvalid);
      expect(inv({'field': 'targetId'}).text, MeetingText.errTargetUnavailable);
      expect(inv({'field': 'size'}).text, MeetingText.errInvalid);
      expect(key(const MeetingErrorInfo(code: 'MEETING_INVALID')), MeetingText.errInvalid);
    });

    test('tells chat content from note content', () {
      const p = {'field': 'content', 'max': 2000};
      expect(meetingErrorNotice(const MeetingErrorInfo(code: 'MEETING_INVALID', params: p), MeetingErrorContext.chat),
          const MeetingNotice(MeetingText.errChatTooLong, {'max': 2000}));
      expect(meetingErrorNotice(const MeetingErrorInfo(code: 'MEETING_INVALID', params: {'field': 'content'}),
              MeetingErrorContext.note),
          const MeetingNotice(MeetingText.errNoteTooLong, {'max': 50000}));
    });

    test('falls back on status, network and the generic key — never raw text', () {
      expect(key(const MeetingErrorInfo(status: 429)), MeetingText.errRateLimited);
      expect(key(const MeetingErrorInfo(status: 503)), MeetingText.errUnavailable);
      expect(key(const MeetingErrorInfo(network: true)), MeetingText.errNetwork);
      expect(key(const MeetingErrorInfo(status: 500, code: 'SOMETHING_NEW')), MeetingText.errGeneric);
      expect(key(const MeetingErrorInfo()), MeetingText.errGeneric);
    });
  });

  group('parseMeetingError', () {
    test('reads the top-level code of a Dio error', () {
      final info = parseMeetingError(httpError(403, {'error': 'Forbidden', 'code': 'MEETING_LOCKED', 'statusCode': 403}));
      expect((info.status, info.code, info.network), (403, 'MEETING_LOCKED', false));
    });

    test('a connection failure is a network error; anything else is generic', () {
      final o = RequestOptions(path: '/x');
      expect(parseMeetingError(DioException(requestOptions: o, type: DioExceptionType.connectionError)).network, isTrue);
      expect(parseMeetingError(DioException(requestOptions: o, type: DioExceptionType.receiveTimeout)).network, isTrue);
      expect(key(parseMeetingError(StateError('Bad state: not-authenticated'))), MeetingText.errGeneric);
    });
  });

  test('meet.error codes map the same way', () {
    expect(meetingEventErrorNotice('RATE_LIMITED', null).text, MeetingText.errRateLimited);
    expect(meetingEventErrorNotice('MEETING_INVALID', {'field': 'content', 'max': 2000}, MeetingErrorContext.chat),
        const MeetingNotice(MeetingText.errChatTooLong, {'max': 2000}));
  });

  group('noteConflictLatest', () {
    final latest = {'scope': 'shared', 'content': 'theirs', 'version': 8,
        'updatedBy': {'userId': 'u2', 'displayName': 'Minh'}};

    test('returns the latest note of a 409 conflict', () {
      final n = noteConflictLatest(httpError(409, {'code': 'MEETING_NOTE_CONFLICT', 'statusCode': 409, 'latest': latest}))!;
      expect((n.content, n.version, n.updatedBy?.displayName), ('theirs', 8, 'Minh'));
    });

    test('ignores other errors and malformed bodies', () {
      expect(noteConflictLatest(httpError(409, {'code': 'MEETING_ENDED'})), isNull);
      expect(noteConflictLatest(httpError(409, {'code': 'MEETING_NOTE_CONFLICT', 'latest': {'content': 1}})), isNull);
      expect(noteConflictLatest(Exception('x')), isNull);
    });
  });
}
```

- [ ] **Step 2: Test lớp dịch** — `FT/ui/meeting_text_l10n_test.dart`: mọi `MeetingText` × 7 locale cho ra chuỗi khác rỗng, không chứa `{`, không chứa tên khoá (bắt quên dịch / placeholder sai):

```dart
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/meeting_text.dart';
import 'package:platform_client/features/meetings/ui/meeting_text_l10n.dart';
import 'package:platform_client/l10n/app_localizations.dart';

const sample = <String, Object>{'max': 25, 'count': 2, 'name': 'Lan', 'title': 'Weekly', 'time': '9:00'};

void main() {
  for (final locale in AppLocalizations.supportedLocales) {
    test('every MeetingText is translated in ${locale.languageCode}', () async {
      final l = await AppLocalizations.delegate.load(locale);
      for (final t in MeetingText.values) {
        final s = meetingText(l, MeetingNotice(t, sample));
        expect(s.trim(), isNotEmpty, reason: '$t');
        expect(s, isNot(contains('{')), reason: '$t');
        expect(s, isNot(contains(t.name)), reason: '$t');
      }
    });
  }
}
```

- [ ] **Step 3: RED** — `FTEST test/features/meetings/domain/meeting_errors_test.dart`.
- [ ] **Step 4: Công cụ khoá** — `tool/web_meeting_keys.py` (≤ 60 dòng): đọc `../web/messages/<loc>.json` cho 7 locale, với mỗi khoá web trong argv in `{"meeting<K>": {"translations": {...}, "placeholders": {...}}}`; placeholder lấy bằng regex `\{(\w+)[,}]` trên bản `en`, kiểu `int` cho `count|max|n|minutes|hours`, còn lại `String`; báo lỗi + exit 1 nếu thiếu locale nào. Chạy `python3 tool/web_meeting_keys.py <khoá Task 2> | python3 tool/add_arb_keys.py && flutter gen-l10n`.
- [ ] **Step 5: Hiện thực** `meeting_errors.dart` (mirror `meeting-errors.ts`; `params` chỉ giữ giá trị `String`/`num`), `meeting_text_l10n.dart` (switch đầy đủ; `MeetingText.lobbyWaiting` ↔ `meetingLobbyWaiting(count)`).
- [ ] **Step 6: GREEN** — `FTEST test/features/meetings test/l10n && FA`
- [ ] **Step 7: Commit** `feat(mobile): meeting error mapping and base l10n keys`

---

### Task 3: `parseMeetingEvent` + tên hiển thị an toàn

**Files:**
- Create: `FM/domain/display.dart`, `FM/domain/meeting_events.dart`
- Test: `FT/domain/display_test.dart`, `FT/domain/meeting_events_test.dart`

**Interfaces — Produces:**

```dart
// display.dart
/// Mongo ObjectId (24 hex), 'system', 'extbot:…', or exactly the user's id ⇒ not a name.
bool looksLikeId(String value);
/// Trimmed name, or null when absent / blank / looks like an id / equals [userId].
String? safeDisplayName(String? name, [String? userId]);
String personName(MeetingPerson? p, String fallback);

// meeting_events.dart — STOMP frame body (String) or decoded map → typed event; junk ⇒ null.
sealed class MeetingEvent { String? get meetingId; }
final class RosterEvent extends MeetingEvent { meetingId, List<RosterEntry> participants }
final class SettingsEvent  { meetingId, MeetingSettings settings }
final class EndedEvent     { meetingId }
final class HandsEvent     { meetingId, List<MeetingHand> hands }
final class ChatEvent      { meetingId, String? clientId, MeetingChatMessage message }
final class NotesUpdatedEvent { meetingId, int version, MeetingPerson? updatedBy }
final class LobbyEvent     { meetingId, List<LobbyEntry> waiting }
final class AdmittedEvent / DeniedEvent / RemovedEvent { meetingId }
final class CancelledEvent { meetingId, String? title, String? code }
final class MutedEvent     { meetingId, MeetingPerson? actor }
final class MeetErrorEvent { String? meetingId; HostAction? action; String? clientId; String errorCode; Map<String, Object>? params }
/// hostId: identity only (placeholder row) — NEVER rendered.
final class InvitedEvent   { meetingId, code, title?, hostId?, hostName?, DateTime? scheduledStart }
final class StartingEvent  { meetingId, code, title?, DateTime? scheduledStart }
MeetingEvent? parseMeetingEvent(Object? frame);   // String ⇒ jsonDecode trong try; Map ⇒ dùng luôn
```

- [ ] **Step 1: Test** — `FT/domain/display_test.dart`

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/display.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';

void main() {
  test('ids are never names', () {
    expect(looksLikeId('64b0aaaaaaaaaaaaaaaaaaaa'), isTrue);
    expect(looksLikeId('system'), isTrue);
    expect(looksLikeId('extbot:abc'), isTrue);
    expect(looksLikeId('Lan Nguyen'), isFalse);
    expect(safeDisplayName('  Lan  ', 'u1'), 'Lan');
    expect(safeDisplayName('u1', 'u1'), isNull);
    expect(safeDisplayName('64b0aaaaaaaaaaaaaaaaaaaa'), isNull);
    expect(safeDisplayName('   '), isNull);
    expect(personName(const MeetingPerson(userId: '64b0aaaaaaaaaaaaaaaaaaaa'), 'Someone'), 'Someone');
    expect(personName(null, 'Someone'), 'Someone');
  });
}
```

- [ ] **Step 2: Test** — `FT/domain/meeting_events_test.dart` (port `meeting-events.test.ts`)

```dart
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/meeting_events.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';

MeetingEvent? p(Map<String, dynamic> m) => parseMeetingEvent(jsonEncode(m));

void main() {
  test('roster keeps good rows, drops broken ones, defaults unknown roles to attendee', () {
    final e = p({'event': 'meet.roster', 'meetingId': 'm1', 'participants': [
      {'userId': 'a', 'displayName': 'An', 'role': 'cohost', 'joinedAt': '2026-10-08T02:00:00Z'},
      {'userId': 'b', 'role': 'emperor', 'joinedAt': '2026-10-08T02:01:00Z'},
      {'displayName': 'no id'}, 'junk',
    ]}) as RosterEvent;
    expect(e.participants.map((r) => (r.userId, r.role)),
        [('a', MeetingRoomRole.cohost), ('b', MeetingRoomRole.attendee)]);
  });

  test('settings need all five booleans', () {
    expect(p({'event': 'meet.settings', 'meetingId': 'm1', 'settings': {'locked': true}}), isNull);
    final ok = p({'event': 'meet.settings', 'meetingId': 'm1', 'settings': {'waitingRoom': false,
        'muteOnEntry': true, 'allowAttendeeScreenShare': false, 'attendeesCanEditNotes': true, 'locked': true}});
    expect((ok as SettingsEvent).settings.locked, isTrue);
  });

  test('hands keep the server order', () {
    final e = p({'event': 'meet.hands', 'meetingId': 'm1', 'hands': [
      {'userId': 'c', 'raisedAt': '2026-10-08T02:06:00Z'}, {'userId': 'a', 'raisedAt': '2026-10-08T02:07:00Z'}]});
    expect((e as HandsEvent).hands.map((h) => h.userId), ['c', 'a']);
  });

  test('chat needs a full message; the clientId rides along', () {
    final e = p({'event': 'meet.chat', 'meetingId': 'm1', 'clientId': 'c-abc', 'message': {
      'id': 'x', 'sender': {'userId': 'u'}, 'content': 'hi', 'createdAt': '2026-10-08T02:05:11.120Z'}});
    expect((e as ChatEvent).clientId, 'c-abc');
    expect(e.message.content, 'hi');
    expect(p({'event': 'meet.chat', 'meetingId': 'm1', 'message': {'id': 'x'}}), isNull);
  });

  test('meet.error keeps only known host actions and scalar params', () {
    final e = p({'event': 'meet.error', 'meetingId': 'm1', 'action': 'LOCK', 'errorCode': 'MEETINGS_UNAVAILABLE',
      'params': {'field': 'content', 'max': 2000, 'nested': {'x': 1}}}) as MeetErrorEvent;
    expect((e.action, e.errorCode), (HostAction.lock, 'MEETINGS_UNAVAILABLE'));
    expect(e.params, {'field': 'content', 'max': 2000});
    expect((p({'event': 'meet.error', 'action': 'DROP', 'errorCode': 'X'}) as MeetErrorEvent).action, isNull);
    expect(p({'event': 'meet.error', 'meetingId': 'm1'}), isNull);
  });

  test('invitations need a code; the host id is kept for identity only', () {
    final e = p({'event': 'meet.invited', 'meetingId': 'm2', 'code': 'xyz-wxyz-xyz', 'title': 'Planning',
      'hostId': 'h1', 'hostName': 'Lan', 'scheduledStart': '2026-10-08T02:00:00Z'}) as InvitedEvent;
    expect((e.code, e.hostId, e.hostName, e.scheduledStart), ('xyz-wxyz-xyz', 'h1', 'Lan', DateTime.utc(2026, 10, 8, 2)));
    expect(p({'event': 'meet.starting', 'meetingId': 'm2'}), isNull);
  });

  test('simple events, cancelled with optional title, muted with optional actor', () {
    expect(p({'event': 'meet.admitted', 'meetingId': 'm1'}), isA<AdmittedEvent>());
    expect(p({'event': 'meet.removed', 'meetingId': 'm1'}), isA<RemovedEvent>());
    expect((p({'event': 'meet.cancelled', 'meetingId': 'm1', 'title': 'T'}) as CancelledEvent).title, 'T');
    expect((p({'event': 'meet.muted', 'meetingId': 'm1'}) as MutedEvent).actor, isNull);
    expect((p({'event': 'meet.notes.updated', 'meetingId': 'm1', 'version': 7,
      'updatedBy': {'userId': 'u2', 'displayName': 'Minh'}}) as NotesUpdatedEvent).version, 7);
  });

  test('junk is null', () {
    expect(parseMeetingEvent('not json'), isNull);
    expect(parseMeetingEvent('[]'), isNull);
    expect(p({'event': 'meet.roster'}), isNull);
    expect(p({'event': 'meet.unknown', 'meetingId': 'm1'}), isNull);
    expect(p({'event': 'meet.notes.updated', 'meetingId': 'm1', 'version': '7'}), isNull);
  });
}
```

- [ ] **Step 3: RED → hiện thực** (mirror `meeting-events.ts`; `looksLikeId` = `RegExp(r'^[0-9a-f]{24}$', caseSensitive: false)` ∨ `== 'system'` ∨ `startsWith('extbot:')` — xem `call_name_resolver.dart` để dùng lại regex nếu đã export) **→ GREEN** — `FTEST test/features/meetings/domain && FA`
- [ ] **Step 4: Commit** `feat(mobile): typed meeting STOMP events and safe display names`

---

### Task 4: Cache chuẩn hoá — hàm vá thuần + `MeetingsStore`

**Files:**
- Create: `FM/domain/cache_updates.dart`, `FM/state/meetings_store.dart`
- Test: `FT/domain/cache_updates_test.dart`, `FT/state/meetings_store_test.dart`

**Interfaces — Produces:**

```dart
// cache_updates.dart — pure, immutable; mirror cache-updates.ts + room-events.applyMeetingEnded
DateTime meetingSortAt(Meeting m) => m.scheduledStart ?? m.createdAt;

class MeetingListData {
  const MeetingListData({required this.rows, required this.hasNext});
  final List<Meeting> rows; final bool hasNext;
  String? get nextCursor => hasNext && rows.isNotEmpty ? rows.last.id : null;
  MeetingListData appendPage(MeetingPage p);     // dedupe by id (a row may have moved pages)
}
MeetingListData? upsertUpcoming(MeetingListData? d, Meeting m);  // replace same id, else insert by sortAt;
                                                                  // later than all rows + hasNext ⇒ unchanged
MeetingListData? removeFromList(MeetingListData? d, String id);
MeetingListData? replaceInList(MeetingListData? d, Meeting m);  // only if present
Meeting invitedPlaceholder(InvitedEvent e, DateTime now);       // SCHEDULED, invited, default settings, createdAt=now
Meeting markEnded(Meeting m, DateTime at, {required bool cancelled});   // already ENDED ⇒ same instance
List<RosterEntry> rosterFromMeeting(Meeting m);                 // open attendance, current role, latest joinedAt per user

/// Room chat / detail history: oldest → newest, deduped by id.
class ChatHistory {
  const ChatHistory({this.lines = const [], this.hasOlder = false});
  factory ChatHistory.fromNewestPage(MeetingMessagePage p);
  ChatHistory prependOlder(MeetingMessagePage p);
  ChatHistory append(MeetingChatMessage m);       // no-op (same instance) when the id is known
  String? get oldestId;
}

class MeetingsCacheState {
  const MeetingsCacheState({this.byId = const {}, this.idByCode = const {}, this.upcoming, this.past, this.pastStale = false});
  MeetingListData? list(MeetingListScope s);
  Meeting? byCode(String code);
  MeetingsCacheState setList(MeetingListScope s, MeetingListData d);   // also puts every row in byId; past ⇒ pastStale=false
  MeetingsCacheState put(Meeting m);              // byId + idByCode; not ENDED ⇒ upsertUpcoming; replaceInList(past)
  MeetingsCacheState markEnded(String id, DateTime at, {required bool cancelled});  // byId, out of upcoming, pastStale=true
  MeetingsCacheState withSettings(String id, MeetingSettings s);
  MeetingsCacheState addInvited(InvitedEvent e, DateTime now);   // placeholder only when not already in upcoming
  String? cachedTitle(String id);                 // detail first, then any list row; blank ⇒ null
}

// state/meetings_store.dart
abstract interface class MeetingsCacheSink {
  MeetingsCacheState get cache;
  void updateCache(MeetingsCacheState Function(MeetingsCacheState) fn);
}
@Riverpod(keepAlive: true)
class MeetingsStore extends _$MeetingsStore implements MeetingsCacheSink {
  @override MeetingsCacheState build() => const MeetingsCacheState();
  @override MeetingsCacheState get cache => state;
  @override void updateCache(MeetingsCacheState Function(MeetingsCacheState) fn) => state = fn(state);
}
/// In-memory sink for unit tests (controller, queue).
class MemoryMeetingsCache implements MeetingsCacheSink { MeetingsCacheState cache = const MeetingsCacheState(); … }
```

Đăng xuất: `MeetingsStore` reset khi `authNotifierProvider` thành signed-out (`ref.listen` trong `build`) — không lộ cuộc họp của tài khoản trước.

- [ ] **Step 1: Test** — `FT/domain/cache_updates_test.dart` (port `cache-updates.test.ts`)

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/cache_updates.dart';
import 'package:platform_client/features/meetings/domain/meeting_events.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';

Meeting meeting(String id, {DateTime? start, MeetingStatus status = MeetingStatus.scheduled,
    List<MeetingAttendance> attendance = const [], List<MeetingPerson> coHosts = const [], String? title}) =>
    Meeting(id: id, code: '$id-code', title: title, host: const MeetingPerson(userId: 'h', displayName: 'Host'),
        coHosts: coHosts, invitees: const [], scheduledStart: start, status: status,
        settings: MeetingSettings.defaults, attendance: attendance, removedIds: const [],
        viewerRole: MeetingViewerRole.invited, createdAt: DateTime.utc(2026, 10, 7));

List<String> ids(MeetingListData? d) => d?.rows.map((m) => m.id).toList() ?? const [];

void main() {
  final a = meeting('a', start: DateTime.utc(2026, 10, 8, 1));
  final c = meeting('c', start: DateTime.utc(2026, 10, 8, 3));

  group('upcoming list', () {
    test('sorts by scheduledStart, instant meetings by creation', () {
      expect(meetingSortAt(a), DateTime.utc(2026, 10, 8, 1));
      expect(meetingSortAt(meeting('i')), DateTime.utc(2026, 10, 7));
    });

    test('inserts a new meeting in start order and replaces an existing one', () {
      final b = meeting('b', start: DateTime.utc(2026, 10, 8, 2));
      final data = upsertUpcoming(MeetingListData(rows: [a, c], hasNext: false), b);
      expect(ids(data), ['a', 'b', 'c']);
      final renamed = upsertUpcoming(data, meeting('b', start: DateTime.utc(2026, 10, 8, 2), title: 'Renamed'));
      expect(renamed!.rows[1].title, 'Renamed');
      expect(ids(renamed), ['a', 'b', 'c']);
    });

    test('appends past the last loaded row only when there is no next page', () {
      final late = meeting('z', start: DateTime.utc(2026, 12, 1));
      expect(ids(upsertUpcoming(MeetingListData(rows: [a, c], hasNext: true), late)), ['a', 'c']);
      expect(ids(upsertUpcoming(MeetingListData(rows: [a, c], hasNext: false), late)), ['a', 'c', 'z']);
    });

    test('leaves an unloaded list alone and removes rows by id', () {
      expect(upsertUpcoming(null, a), isNull);
      expect(ids(removeFromList(MeetingListData(rows: [a, c], hasNext: false), 'c')), ['a']);
      expect(ids(replaceInList(MeetingListData(rows: [a], hasNext: false), meeting('nope'))), ['a']);
    });

    test('appending a page dedupes rows that moved', () {
      final d = MeetingListData(rows: [a], hasNext: true)
          .appendPage(MeetingPage(content: [a, c], hasNext: false));
      expect(ids(d), ['a', 'c']);
      expect(d.nextCursor, isNull);
      expect(MeetingListData(rows: [a, c], hasNext: true).nextCursor, 'c');
    });
  });

  test('invitedPlaceholder builds a scheduled row — host name only, id kept for identity', () {
    final m = invitedPlaceholder(
        InvitedEvent(meetingId: 'm1', code: 'abc-defg-hjk', title: 'Sync', hostId: 'h1', hostName: 'Lan',
            scheduledStart: DateTime.utc(2026, 10, 8, 2)),
        DateTime.utc(2026, 10, 7, 9));
    expect((m.id, m.code, m.title, m.status, m.viewerRole, m.host.userId, m.host.displayName),
        ('m1', 'abc-defg-hjk', 'Sync', MeetingStatus.scheduled, MeetingViewerRole.invited, 'h1', 'Lan'));
    expect(m.settings, MeetingSettings.defaults);
    expect(m.createdAt, DateTime.utc(2026, 10, 7, 9));
  });

  test('marks a meeting ended or cancelled', () {
    final t = DateTime.utc(2026, 10, 8, 4);
    expect(markEnded(meeting('a', status: MeetingStatus.live), t, cancelled: false).endedAt, t);
    final x = markEnded(meeting('a'), t, cancelled: true);
    expect((x.status, x.cancelledAt, x.isCancelled), (MeetingStatus.ended, t, true));
  });

  test('builds the roster from open attendance rows with the current role', () {
    DateTime at(int m) => DateTime.utc(2026, 10, 8, 2, m);
    final m = meeting('a', coHosts: const [MeetingPerson(userId: 'co')], attendance: [
      MeetingAttendance(userId: 'h', displayName: 'Host', role: MeetingRoomRole.host, joinedAt: at(0)),
      MeetingAttendance(userId: 'co', displayName: 'Co', role: MeetingRoomRole.attendee, joinedAt: at(1)),
      MeetingAttendance(userId: 'x', role: MeetingRoomRole.attendee, joinedAt: at(2), leftAt: at(3)),
      MeetingAttendance(userId: 'y', role: MeetingRoomRole.attendee, joinedAt: at(2)),
      MeetingAttendance(userId: 'y', displayName: 'Yen', role: MeetingRoomRole.attendee, joinedAt: at(9)),
    ]);
    expect(rosterFromMeeting(m).map((r) => (r.userId, r.displayName, r.role, r.joinedAt)), [
      ('h', 'Host', MeetingRoomRole.host, at(0)),
      ('co', 'Co', MeetingRoomRole.cohost, at(1)),
      ('y', 'Yen', MeetingRoomRole.attendee, at(9)),
    ]);
  });

  group('chat history', () {
    MeetingChatMessage msg(String id) => MeetingChatMessage(id: id,
        sender: const MeetingPerson(userId: 'a'), content: id, createdAt: DateTime.utc(2026, 10, 8));
    test('newest-first pages become oldest-first lines, deduped by id', () {
      final h = ChatHistory.fromNewestPage(MeetingMessagePage(content: [msg('m2'), msg('m1')], hasNext: true));
      expect(h.lines.map((m) => m.id), ['m1', 'm2']);
      expect(h.oldestId, 'm1');
      final older = h.prependOlder(MeetingMessagePage(content: [msg('m0')], hasNext: false));
      expect(older.lines.map((m) => m.id), ['m0', 'm1', 'm2']);
      expect(older.hasOlder, isFalse);
      final live = older.append(msg('m3'));
      expect(live.lines.last.id, 'm3');
      expect(identical(live.append(msg('m0')), live), isTrue);
    });
  });

  group('MeetingsCacheState', () {
    test('put indexes by id and code and updates both lists; markEnded moves it out of upcoming', () {
      var s = const MeetingsCacheState()
          .setList(MeetingListScope.upcoming, MeetingListData(rows: [a], hasNext: false))
          .put(c);
      expect(s.byCode('c-code')?.id, 'c');
      expect(ids(s.upcoming), ['a', 'c']);
      s = s.markEnded('c', DateTime.utc(2026, 10, 8, 4), cancelled: true);
      expect(ids(s.upcoming), ['a']);
      expect(s.byId['c']!.isCancelled, isTrue);
      expect(s.pastStale, isTrue);
      expect(s.cachedTitle('a'), isNull);
    });

    test('an invitation adds a placeholder once', () {
      final e = InvitedEvent(meetingId: 'm2', code: 'xyz-wxyz-xyz', title: 'Planning');
      var s = const MeetingsCacheState().setList(MeetingListScope.upcoming, MeetingListData(rows: [a], hasNext: false));
      s = s.addInvited(e, DateTime.utc(2026, 10, 7, 9)).addInvited(e, DateTime.utc(2026, 10, 7, 9));
      expect(ids(s.upcoming), ['m2', 'a']);
      expect(s.cachedTitle('m2'), 'Planning');
    });
  });
}
```

- [ ] **Step 2: Test** — `FT/state/meetings_store_test.dart`: `ProviderContainer` → `read(meetingsStoreProvider.notifier).updateCache((s) => s.put(m))` ⇒ `read(meetingsStoreProvider).byId['m1']` có; auth chuyển signed-out (override `authNotifierProvider` như `member_mfa_reset_test.dart`) ⇒ state rỗng.
- [ ] **Step 3: RED → hiện thực → GREEN** — `dart run build_runner build --delete-conflicting-outputs && FTEST test/features/meetings && FA`
- [ ] **Step 4: Commit** `feat(mobile): normalized meetings cache with pure patches`

---

### Task 5: Lịch (giờ máy ⇄ UTC) + form tạo/sửa/họp lại

**Files:**
- Create: `FM/domain/schedule.dart`, `FM/domain/meeting_form.dart`
- Test: `FT/domain/schedule_test.dart`, `FT/domain/meeting_form_test.dart`

Dart không đổi được `TZ` trong tiến trình test như vitest (`process.env.TZ`) ⇒ mọi hàm lịch nhận một `LocalZone`; prod dùng `DeviceZone` (giờ của máy), test dùng `FixedOffsetZone(Duration(hours: 7))` (Asia/Ho_Chi_Minh, không DST) — cùng dữ liệu với test web.

**Interfaces — Produces:**

```dart
// schedule.dart
abstract interface class LocalZone {
  /// Wall clock → UTC instant; null when that local time does not exist (DST gap) or is malformed.
  DateTime? toUtc(int year, int month, int day, int hour, int minute);
  /// UTC instant → wall clock fields (returned as a DateTime whose y/m/d/h/min are local).
  DateTime wallClock(DateTime utc);
  Duration offsetAt(DateTime utc);
}
class DeviceZone implements LocalZone { const DeviceZone(); … DateTime(y, mo, d, h, mi) + kiểm lại từng trường … }
class FixedOffsetZone implements LocalZone { const FixedOffsetZone(this.offset); final Duration offset; … }

class LocalSchedule { const LocalSchedule({required this.date, required this.time, required this.durationMinutes});
  final String date;  /* YYYY-MM-DD local */ final String time; /* HH:mm local */ final int durationMinutes; … == }
const kDurationPresets = [15, 30, 45, 60, 90, 120, 180, 240];
DateTime? localToUtc(String date, String time, LocalZone zone);
({DateTime start, DateTime end})? buildSchedule(LocalSchedule s, LocalZone zone);
LocalSchedule? scheduleFromMeeting(Meeting m, LocalZone zone);   // no start ⇒ null; no/invalid end ⇒ 30 min
LocalSchedule defaultSchedule(DateTime now, LocalZone zone);     // next :00/:30 strictly after now, 30 min
List<int> durationOptions([int? current]);
({int hours, int minutes}) splitDuration(int minutes);
String timeZoneLabel(Duration offset);                           // 'GMT+7', 'GMT+5:30', 'GMT-3', 'GMT'
/// Locale-formatted "date, start – end" (same day) or just the start — DateFormat, never a fixed pattern.
String formatMeetingRange(String locale, DateTime start, DateTime? end, LocalZone zone);
String toDateString(DateTime wallClock);  DateTime? parseDateString(String date);   // cho date picker

// meeting_form.dart
enum MeetingFormMode { create, edit, again }
enum MeetingFormField { title, description, invitees, schedule }
class MeetingFormValues {
  const MeetingFormValues({required this.title, required this.description, required this.invitees,
      required this.departmentId, required this.scheduled, required this.schedule, required this.settings});
  final String title, description; final List<MeetingPerson> invitees;
  final String departmentId;          // '' = none
  final bool scheduled; final LocalSchedule schedule; final MeetingSettings settings;
  MeetingFormValues copyWith({…});
}
MeetingFormValues emptyMeetingForm(DateTime now, LocalZone zone);
MeetingFormValues formFromMeeting(Meeting m, MeetingFormMode mode, DateTime now, LocalZone zone);   // again: unscheduled
Map<MeetingFormField, MeetingNotice> validateMeetingForm(MeetingFormValues v, DateTime now, LocalZone zone, {Meeting? original});
/// Create (no original) or PATCH body. `original` = the meeting as the sheet opened it.
MeetingInput toMeetingInput(MeetingFormValues v, LocalZone zone, {Meeting? original});
```

- [ ] **Step 1: Test** — `FT/domain/schedule_test.dart` (port `schedule.test.ts`)

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/schedule.dart';

const zone = FixedOffsetZone(Duration(hours: 7)); // Asia/Ho_Chi_Minh, no DST
const s = LocalSchedule.new;

Meeting m({DateTime? start, DateTime? end}) => Meeting(id: 'm', code: 'c', host: const MeetingPerson(userId: 'h'),
    coHosts: const [], invitees: const [], scheduledStart: start, scheduledEnd: end, status: MeetingStatus.scheduled,
    settings: MeetingSettings.defaults, attendance: const [], removedIds: const [],
    viewerRole: MeetingViewerRole.host, createdAt: DateTime.utc(2026, 10, 7));

void main() {
  setUpAll(() async {
    await initializeDateFormatting('en');
    await initializeDateFormatting('vi');
  });

  group('local wall clock ⇄ UTC', () {
    test('sends UTC', () {
      expect(localToUtc('2026-10-08', '09:00', zone), DateTime.utc(2026, 10, 8, 2));
      expect(localToUtc('2026-10-08', '00:30', zone), DateTime.utc(2026, 10, 7, 17, 30));
      expect(localToUtc('2026-10-08', '09:00', zone)!.toIso8601String(), '2026-10-08T02:00:00.000Z');
    });

    test('rejects malformed and impossible dates', () {
      expect(localToUtc('2026-02-30', '09:00', zone), isNull);
      expect(localToUtc('2026-10-08', '9:00', zone), isNull);
      expect(localToUtc('', '09:00', zone), isNull);
      expect(localToUtc('2026-10-08', '24:00', zone), isNull);
    });

    test('builds start and end from a duration', () {
      final b = buildSchedule(s(date: '2026-10-08', time: '09:00', durationMinutes: 90), zone)!;
      expect((b.start, b.end), (DateTime.utc(2026, 10, 8, 2), DateTime.utc(2026, 10, 8, 3, 30)));
      expect(buildSchedule(s(date: 'x', time: '09:00', durationMinutes: 30), zone), isNull);
    });

    test('reads a stored schedule back in local time', () {
      expect(scheduleFromMeeting(m(start: DateTime.utc(2026, 10, 8, 2), end: DateTime.utc(2026, 10, 8, 2, 45)), zone),
          s(date: '2026-10-08', time: '09:00', durationMinutes: 45));
      expect(scheduleFromMeeting(m(start: DateTime.utc(2026, 10, 8, 2)), zone),
          s(date: '2026-10-08', time: '09:00', durationMinutes: 30));
      expect(scheduleFromMeeting(m(), zone), isNull);
    });

    test('defaults to the next half hour', () {
      expect(defaultSchedule(DateTime.utc(2026, 10, 8, 2, 10), zone), s(date: '2026-10-08', time: '09:30', durationMinutes: 30));
      expect(defaultSchedule(DateTime.utc(2026, 10, 8, 2, 30), zone), s(date: '2026-10-08', time: '10:00', durationMinutes: 30));
      expect(defaultSchedule(DateTime.utc(2026, 10, 8, 16, 50), zone), s(date: '2026-10-09', time: '00:00', durationMinutes: 30));
    });

    test('labels the zone with its offset', () {
      expect(timeZoneLabel(const Duration(hours: 7)), 'GMT+7');
      expect(timeZoneLabel(const Duration(hours: 5, minutes: 30)), 'GMT+5:30');
      expect(timeZoneLabel(const Duration(hours: -3)), 'GMT-3');
      expect(timeZoneLabel(Duration.zero), 'GMT');
    });

    test('the device zone round-trips any wall clock it accepts', () {
      const device = DeviceZone();
      final utc = device.toUtc(2026, 10, 8, 9, 0)!;
      final wall = device.wallClock(utc);
      expect((wall.year, wall.month, wall.day, wall.hour, wall.minute), (2026, 10, 8, 9, 0));
    });
  });

  group('durations', () {
    test('keeps a custom stored duration selectable', () {
      expect(durationOptions(), [15, 30, 45, 60, 90, 120, 180, 240]);
      expect(durationOptions(50), [15, 30, 45, 50, 60, 90, 120, 180, 240]);
      expect(durationOptions(60), hasLength(8));
    });
    test('splits minutes for display', () {
      expect(splitDuration(90), (hours: 1, minutes: 30));
      expect(splitDuration(45), (hours: 0, minutes: 45));
    });
  });

  test('formatMeetingRange uses the locale, never a hardcoded pattern', () {
    final en = formatMeetingRange('en', DateTime.utc(2026, 10, 8, 2), DateTime.utc(2026, 10, 8, 3), zone);
    expect(en, contains('9:00'));
    expect(en, contains('10:00'));
    expect(formatMeetingRange('vi', DateTime.utc(2026, 10, 8, 2), null, zone), contains('09:00'));
  });

  test('date picker helpers round-trip a local calendar day', () {
    final d = parseDateString('2026-10-08')!;
    expect(toDateString(d), '2026-10-08');
    expect(parseDateString('2026-02-30'), isNull);
    expect(parseDateString('nope'), isNull);
  });
}
```

- [ ] **Step 2: Test** — `FT/domain/meeting_form_test.dart` (port `meeting-form.test.ts`)

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/meeting_form.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_text.dart';
import 'package:platform_client/features/meetings/domain/schedule.dart';

const zone = FixedOffsetZone(Duration(hours: 7));
final now = DateTime.utc(2026, 10, 8, 2, 10); // 09:10 local

MeetingFormValues form({String title = '', String description = '', List<MeetingPerson> invitees = const [],
    String departmentId = '', bool scheduled = false, LocalSchedule? schedule}) =>
    emptyMeetingForm(now, zone).copyWith(title: title, description: description, invitees: invitees,
        departmentId: departmentId, scheduled: scheduled, schedule: schedule);

Meeting meeting({MeetingStatus status = MeetingStatus.scheduled, DateTime? start, DateTime? end}) => Meeting(
    id: 'm1', code: 'abc-defg-hjk', title: 'Weekly', description: 'Agenda', host: const MeetingPerson(userId: 'h'),
    coHosts: const [], invitees: const [MeetingPerson(userId: 'a', displayName: 'An')], departmentId: 'd1',
    scheduledStart: start ?? DateTime.utc(2026, 10, 9, 2), scheduledEnd: end ?? DateTime.utc(2026, 10, 9, 3),
    status: status, settings: MeetingSettings.defaults.copyWith(waitingRoom: false), attendance: const [],
    removedIds: const [], viewerRole: MeetingViewerRole.host, createdAt: DateTime.utc(2026, 10, 7));

LocalSchedule at(String date, String time, [int d = 30]) => LocalSchedule(date: date, time: time, durationMinutes: d);

void main() {
  group('validateMeetingForm', () {
    test('accepts an empty instant meeting', () => expect(validateMeetingForm(form(), now, zone), isEmpty));

    test('enforces the contract limits', () {
      final errors = validateMeetingForm(form(title: 'x' * 121, description: 'y' * 2001,
          invitees: [for (var i = 0; i < 101; i++) MeetingPerson(userId: 'u$i')]), now, zone);
      expect(errors, {
        MeetingFormField.title: const MeetingNotice(MeetingText.valTitleTooLong, {'max': 120}),
        MeetingFormField.description: const MeetingNotice(MeetingText.valDescriptionTooLong, {'max': 2000}),
        MeetingFormField.invitees: const MeetingNotice(MeetingText.valTooManyInvitees, {'max': 100}),
      });
      expect(validateMeetingForm(form(title: '  ${'x' * 120}  '), now, zone), isEmpty);
    });

    test('checks a new schedule but allows the 5-minute grace', () {
      expect(validateMeetingForm(form(scheduled: true, schedule: at('2026-10-08', '09:00')), now, zone)[MeetingFormField.schedule],
          const MeetingNotice(MeetingText.valStartPast));
      expect(validateMeetingForm(form(scheduled: true, schedule: at('2026-10-08', '09:06')), now, zone), isEmpty);
      expect(validateMeetingForm(form(scheduled: true, schedule: at('2026-02-30', '09:00')), now, zone)[MeetingFormField.schedule],
          const MeetingNotice(MeetingText.valScheduleInvalid));
      expect(validateMeetingForm(form(scheduled: true, schedule: at('2026-10-09', '09:00', 1441)), now, zone)[MeetingFormField.schedule],
          const MeetingNotice(MeetingText.valScheduleInvalid));
    });

    test('does not re-check an unchanged past schedule, nor a LIVE one', () {
      final past = meeting(start: DateTime.utc(2026, 10, 8, 1), end: DateTime.utc(2026, 10, 8, 2));
      expect(validateMeetingForm(formFromMeeting(past, MeetingFormMode.edit, now, zone), now, zone, original: past), isEmpty);
      final live = meeting(status: MeetingStatus.live);
      final edited = formFromMeeting(live, MeetingFormMode.edit, now, zone).copyWith(schedule: at('2026-10-08', '08:00'));
      expect(validateMeetingForm(edited, now, zone, original: live), isEmpty);
    });
  });

  group('toMeetingInput — create', () {
    test('sends only the settings for an untouched form', () {
      expect(toMeetingInput(form(), zone).toJson(), {'settings': MeetingSettings.defaults.toJson()});
    });

    test('sends a trimmed title, unique invitees, the department and a UTC schedule', () {
      final input = toMeetingInput(form(title: '  Sprint review ', description: 'Demo', departmentId: 'd1',
          invitees: const [MeetingPerson(userId: 'a'), MeetingPerson(userId: 'b'), MeetingPerson(userId: 'a')],
          scheduled: true, schedule: at('2026-10-09', '14:00', 60)), zone);
      expect(input.toJson(), {
        'title': 'Sprint review', 'description': 'Demo', 'inviteeIds': ['a', 'b'], 'departmentId': 'd1',
        'scheduledStart': '2026-10-09T07:00:00.000Z', 'scheduledEnd': '2026-10-09T08:00:00.000Z',
        'settings': MeetingSettings.defaults.toJson(),
      });
    });
  });

  group('toMeetingInput — edit (PATCH)', () {
    test('clears fields with empty strings and always replaces invitees', () {
      final m = meeting();
      final v = formFromMeeting(m, MeetingFormMode.edit, now, zone)
          .copyWith(title: '', description: '', departmentId: '', invitees: const []);
      expect(toMeetingInput(v, zone, original: m).toJson(),
          {'title': '', 'description': '', 'departmentId': '', 'inviteeIds': <String>[]});
    });

    test('sends only the switches the user changed, never a stale copy of the others', () {
      final m = meeting(status: MeetingStatus.live);
      final untouched = formFromMeeting(m, MeetingFormMode.edit, now, zone);
      expect(toMeetingInput(untouched, zone, original: m).toJson().containsKey('settings'), isFalse);
      final flipped = untouched.copyWith(settings: untouched.settings.copyWith(muteOnEntry: true));
      expect(toMeetingInput(flipped, zone, original: m).toJson()['settings'], {'muteOnEntry': true});
      final back = flipped.copyWith(settings: untouched.settings);
      expect(toMeetingInput(back, zone, original: m).toJson().containsKey('settings'), isFalse);
    });

    test('sends the schedule only when it changed and the meeting is not LIVE', () {
      final m = meeting();
      final moved = formFromMeeting(m, MeetingFormMode.edit, now, zone).copyWith(schedule: at('2026-10-09', '10:00', 60));
      expect(toMeetingInput(moved, zone, original: m).toJson(),
          containsPair('scheduledStart', '2026-10-09T03:00:00.000Z'));
      expect(toMeetingInput(formFromMeeting(m, MeetingFormMode.edit, now, zone), zone, original: m).toJson()
          .containsKey('scheduledStart'), isFalse);
      expect(toMeetingInput(moved, zone, original: meeting(status: MeetingStatus.live)).toJson()
          .containsKey('scheduledStart'), isFalse);
    });
  });

  group('formFromMeeting', () {
    test('"meet again" copies people and options but starts now', () {
      final v = formFromMeeting(meeting(status: MeetingStatus.ended), MeetingFormMode.again, now, zone);
      expect((v.title, v.description, v.departmentId, v.scheduled), ('Weekly', 'Agenda', 'd1', false));
      expect(v.invitees.single.displayName, 'An');
      expect(v.settings.waitingRoom, isFalse);
    });

    test('"edit" loads the stored schedule in local time', () {
      final v = formFromMeeting(meeting(), MeetingFormMode.edit, now, zone);
      expect((v.scheduled, v.schedule), (true, at('2026-10-09', '09:00', 60)));
    });
  });
}
```

- [ ] **Step 3: RED → hiện thực** (mirror `schedule.ts`, `meeting-form.ts`; `copyWith` của form chỉ đổi trường được truyền — dùng tham số nullable + sentinel cho `schedule`) **→ GREEN** — `FTEST test/features/meetings/domain && FA`
- [ ] **Step 4: Commit** `feat(mobile): meeting schedule (local ⇄ UTC) and form logic`

---

### Task 6: Mã cuộc họp, điểm danh, quyền UI

**Files:**
- Create: `FM/domain/meeting_code.dart`, `FM/domain/attendance.dart`, `FM/domain/permissions.dart`
- Test: `FT/domain/meeting_code_test.dart`, `FT/domain/attendance_test.dart`, `FT/domain/permissions_test.dart`

**Interfaces — Produces** (mirror 1-1 web):

```dart
// meeting_code.dart
final meetingCodePattern = RegExp(r'^[a-hjkmnp-z]{3}-[a-hjkmnp-z]{4}-[a-hjkmnp-z]{3}$');
String? parseMeetingCodeInput(String raw);         // code / pasted https link / platform://meet/… → "abc-defg-hjk"
String meetingPath(String code) => '/meet/$code';
String? meetingLink(String code, String? webBase); // null webBase ⇒ null (caller copies the code)

// attendance.dart
class AttendanceSummary { userId, displayName?, MeetingRoomRole role, DateTime firstJoinedAt, DateTime? lastLeftAt,
    int totalSeconds, int sessions, bool inside }
List<AttendanceSummary> summarizeAttendance(List<MeetingAttendance> rows, DateTime now, {DateTime? endedAt});

// permissions.dart
bool isManagerRoom(MeetingRoomRole r);  bool isManagerViewer(MeetingViewerRole r);
class DetailActions { join, copyLink, edit, cancel, end, meetAgain }
DetailActions detailActions(Meeting m, {required bool canHost});
bool canSeeRecords(Meeting m);
bool canEditSharedNoteAs({required bool manager, required bool guest, required MeetingSettings settings});
bool canEditSharedNoteViewer(MeetingViewerRole r, MeetingSettings s);   // detail screen
bool canEditSharedNoteRoom(MeetingRoomRole r, MeetingSettings s);       // in the room (current role)
enum PrejoinIntent { join, ask, locked }
PrejoinIntent prejoinIntent(Meeting m);
MeetingRoomRole myRoomRole(List<RosterEntry>? roster, String myId, MeetingRoomRole fallback);
class PersonTarget { userId, MeetingRoomRole role, bool handRaised, bool micOn }
List<HostAction> personActions(MeetingRoomRole myRole, String myId, PersonTarget t);
class RoomControls { final bool lowerAllHands; final HostAction lock, waitingRoom, screenShare; }  // muteAll luôn có
RoomControls? roomControls(MeetingRoomRole myRole, MeetingSettings s, {required bool anyHands});
bool canShareScreen(MeetingRoomRole myRole, MeetingSettings s);
```

(Dart không có union `MeetingRoomRole | MeetingViewerRole` như TS ⇒ tách hàm theo kiểu vai trò; hành vi giống hệt.)

- [ ] **Step 1: Test** — `FT/domain/meeting_code_test.dart`

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/meeting_code.dart';

void main() {
  const ok = {
    'abc-defg-hjk': 'abc-defg-hjk', 'ABC-DEFG-HJK': 'abc-defg-hjk', 'abcdefghjk': 'abc-defg-hjk',
    '  abc defg hjk ': 'abc-defg-hjk', 'https://pon.example.com/meet/abc-defg-hjk': 'abc-defg-hjk',
    'https://pon.example.com/meet/abc-defg-hjk?x=1#y': 'abc-defg-hjk', '/meet/ABCDEFGHJK': 'abc-defg-hjk',
    'platform://meet/abc-defg-hjk': 'abc-defg-hjk',
  };
  ok.forEach((raw, code) => test('$raw → $code', () => expect(parseMeetingCodeInput(raw), code)));

  for (final raw in ['', 'abc', 'abc-defg-hji', 'abc-defg-hjl', 'abc-defg-hjo', 'abc-defg-hj1', 'https://evil.com/x']) {
    test('rejects "$raw"', () => expect(parseMeetingCodeInput(raw), isNull));
  }

  test('builds the path and the shareable link', () {
    expect(meetingPath('abc-defg-hjk'), '/meet/abc-defg-hjk');
    expect(meetingLink('abc-defg-hjk', 'https://pon.example.com/'), 'https://pon.example.com/meet/abc-defg-hjk');
    expect(meetingLink('abc-defg-hjk', null), isNull);
  });
}
```

(`platform://meet/…`: `indexOf('/meet/')` không khớp vì host là `meet` ⇒ xử lý thêm `uri.scheme == 'platform' && uri.host == 'meet'` trước nhánh `://` ⇒ `null`.)

- [ ] **Step 2: Test** — `FT/domain/attendance_test.dart` (port 4 test `attendance.test.ts` với `DateTime.utc`; `now = DateTime.utc(2026, 10, 8, 3)`): gộp phiên + cộng giờ (`totalSeconds` 1200 và 60, `sessions` 2/1); hai thiết bị chồng giờ tính một lần (1800); phiên mở chạy tới `endedAt` hoặc `now` (600, `inside: true` / 300, `inside: false`); giữ vai trò cao nhất + tên mới nhất; `[]` ⇒ `[]`.

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/attendance.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';

DateTime t(int h, int m) => DateTime.utc(2026, 10, 8, h, m);
MeetingAttendance row(String id, MeetingRoomRole r, DateTime j, [DateTime? l, String? name]) =>
    MeetingAttendance(userId: id, displayName: name, role: r, joinedAt: j, leftAt: l);
final now = t(3, 0);

void main() {
  test('merges sessions per person and sums their time', () {
    final out = summarizeAttendance([
      row('a', MeetingRoomRole.host, t(2, 0), t(2, 10), 'An'),
      row('b', MeetingRoomRole.attendee, t(2, 5), t(2, 6)),
      row('a', MeetingRoomRole.host, t(2, 20), t(2, 30), 'An'),
    ], now);
    expect(out.map((s) => (s.userId, s.displayName, s.totalSeconds, s.sessions, s.inside, s.lastLeftAt)), [
      ('a', 'An', 1200, 2, false, t(2, 30)),
      ('b', null, 60, 1, false, t(2, 6)),
    ]);
  });

  test('counts overlapping sessions from two devices once', () {
    final out = summarizeAttendance([
      row('a', MeetingRoomRole.attendee, t(2, 0), t(2, 30)),
      row('a', MeetingRoomRole.attendee, t(2, 10), t(2, 20)),
    ], now);
    expect(out.single.totalSeconds, 1800);
  });

  test('runs an open session until the end of the meeting, or now', () {
    final rows = [row('a', MeetingRoomRole.cohost, t(2, 50))];
    expect((summarizeAttendance(rows, now).single.totalSeconds, summarizeAttendance(rows, now).single.inside), (600, true));
    final ended = summarizeAttendance(rows, now, endedAt: t(2, 55)).single;
    expect((ended.totalSeconds, ended.inside), (300, false));
  });

  test('keeps the highest role and the latest name', () {
    final a = summarizeAttendance([
      row('a', MeetingRoomRole.attendee, t(2, 0), t(2, 1)),
      row('a', MeetingRoomRole.cohost, t(2, 2), t(2, 3), 'An'),
    ], now).single;
    expect((a.role, a.displayName), (MeetingRoomRole.cohost, 'An'));
    expect(summarizeAttendance(const [], now), isEmpty);
  });
}
```

- [ ] **Step 3: Test** — `FT/domain/permissions_test.dart` (port đủ `permissions.test.ts`, kể cả "13 lệnh đều tới được")

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';
import 'package:platform_client/features/meetings/domain/permissions.dart';

const base = MeetingSettings.defaults;
Meeting meeting({MeetingStatus status = MeetingStatus.scheduled, MeetingViewerRole role = MeetingViewerRole.host,
    MeetingSettings settings = base, List<MeetingAttendance> attendance = const []}) => Meeting(id: 'm1',
    code: 'abc-defg-hjk', host: const MeetingPerson(userId: 'h'), coHosts: const [], invitees: const [],
    status: status, settings: settings, attendance: attendance, removedIds: const [], viewerRole: role,
    createdAt: DateTime.utc(2026, 10, 7));
PersonTarget target({String userId = 't', MeetingRoomRole role = MeetingRoomRole.attendee, bool hand = false, bool mic = true}) =>
    PersonTarget(userId: userId, role: role, handRaised: hand, micOn: mic);
(bool, bool, bool, bool, bool, bool) flags(DetailActions a) => (a.join, a.copyLink, a.edit, a.cancel, a.end, a.meetAgain);

void main() {
  group('detailActions', () {
    test('host of a scheduled meeting nobody joined: join, copy, edit, cancel', () {
      expect(flags(detailActions(meeting(), canHost: true)), (true, true, true, true, false, false));
    });
    test('cannot cancel once someone joined or when LIVE; managers can end a LIVE meeting', () {
      final joined = meeting(attendance: [MeetingAttendance(userId: 'a', role: MeetingRoomRole.attendee,
          joinedAt: DateTime.utc(2026, 10, 8))]);
      expect(detailActions(joined, canHost: true).cancel, isFalse);
      expect(flags(detailActions(meeting(status: MeetingStatus.live, role: MeetingViewerRole.cohost), canHost: false)),
          (true, true, true, false, true, false));
    });
    test('invitees and guests only join and copy', () {
      for (final r in [MeetingViewerRole.invited, MeetingViewerRole.guest]) {
        expect(flags(detailActions(meeting(status: MeetingStatus.live, role: r), canHost: true)),
            (true, true, false, false, false, false));
      }
    });
    test('an ended meeting offers "meet again" to its hosts who can still host', () {
      expect(flags(detailActions(meeting(status: MeetingStatus.ended), canHost: true)), (false, false, false, false, false, true));
      expect(detailActions(meeting(status: MeetingStatus.ended), canHost: false).meetAgain, isFalse);
      expect(detailActions(meeting(status: MeetingStatus.ended, role: MeetingViewerRole.invited), canHost: true).meetAgain, isFalse);
    });
  });

  test('records and notes', () {
    expect(canSeeRecords(meeting(role: MeetingViewerRole.guest)), isFalse);
    expect(canSeeRecords(meeting(role: MeetingViewerRole.invited)), isTrue);
    final closed = base.copyWith(attendeesCanEditNotes: false);
    expect(canEditSharedNoteRoom(MeetingRoomRole.host, closed), isTrue);
    expect(canEditSharedNoteRoom(MeetingRoomRole.cohost, closed), isTrue);
    expect(canEditSharedNoteRoom(MeetingRoomRole.attendee, closed), isFalse);
    expect(canEditSharedNoteViewer(MeetingViewerRole.invited, base), isTrue);
    expect(canEditSharedNoteViewer(MeetingViewerRole.guest, closed), isFalse);
  });

  test('prejoinIntent: invited people join, strangers ask or are locked out', () {
    expect(prejoinIntent(meeting(role: MeetingViewerRole.invited)), PrejoinIntent.join);
    expect(prejoinIntent(meeting(role: MeetingViewerRole.cohost, settings: base.copyWith(locked: true))), PrejoinIntent.join);
    expect(prejoinIntent(meeting(role: MeetingViewerRole.guest)), PrejoinIntent.ask);
    expect(prejoinIntent(meeting(role: MeetingViewerRole.guest, settings: base.copyWith(waitingRoom: false))), PrejoinIntent.join);
    expect(prejoinIntent(meeting(role: MeetingViewerRole.guest, settings: base.copyWith(locked: true))), PrejoinIntent.locked);
  });

  group('room roles and host menus', () {
    test('my role follows the roster, else the join role', () {
      final roster = [RosterEntry(userId: 'me', role: MeetingRoomRole.cohost, joinedAt: DateTime.utc(2026))];
      expect(myRoomRole(roster, 'me', MeetingRoomRole.attendee), MeetingRoomRole.cohost);
      expect(myRoomRole(const [], 'me', MeetingRoomRole.attendee), MeetingRoomRole.attendee);
      expect(myRoomRole(null, 'me', MeetingRoomRole.host), MeetingRoomRole.host);
    });
    test('host can do everything to an attendee', () {
      expect(personActions(MeetingRoomRole.host, 'me', target(hand: true)),
          [HostAction.muteMic, HostAction.lowerHand, HostAction.makeCohost, HostAction.remove]);
    });
    test('host manages co-hosts; co-hosts only attendees; nobody targets the host or themselves', () {
      expect(personActions(MeetingRoomRole.host, 'me', target(role: MeetingRoomRole.cohost, mic: false)),
          [HostAction.revokeCohost, HostAction.remove]);
      expect(personActions(MeetingRoomRole.cohost, 'me', target()), [HostAction.muteMic, HostAction.remove]);
      expect(personActions(MeetingRoomRole.cohost, 'me', target(role: MeetingRoomRole.cohost)), [HostAction.muteMic]);
      expect(personActions(MeetingRoomRole.cohost, 'me', target(role: MeetingRoomRole.host, hand: true)),
          [HostAction.muteMic, HostAction.lowerHand]);
      expect(personActions(MeetingRoomRole.host, 'me', target(userId: 'me', role: MeetingRoomRole.host)), isEmpty);
      expect(personActions(MeetingRoomRole.attendee, 'me', target()), isEmpty);
    });
    test('room controls send the opposite of the current setting', () {
      expect(roomControls(MeetingRoomRole.attendee, base, anyHands: true), isNull);
      final c = roomControls(MeetingRoomRole.cohost, base, anyHands: false)!;
      expect((c.lowerAllHands, c.lock, c.waitingRoom, c.screenShare),
          (false, HostAction.lock, HostAction.waitingRoomOff, HostAction.attendeeScreenShareOff));
      final h = roomControls(MeetingRoomRole.host,
          base.copyWith(locked: true, waitingRoom: false, allowAttendeeScreenShare: false), anyHands: true)!;
      expect((h.lowerAllHands, h.lock, h.waitingRoom, h.screenShare),
          (true, HostAction.unlock, HostAction.waitingRoomOn, HostAction.attendeeScreenShareOn));
    });
    test('attendees present only when allowed', () {
      expect(canShareScreen(MeetingRoomRole.attendee, base), isTrue);
      expect(canShareScreen(MeetingRoomRole.attendee, base.copyWith(allowAttendeeScreenShare: false)), isFalse);
      expect(canShareScreen(MeetingRoomRole.cohost, base.copyWith(allowAttendeeScreenShare: false)), isTrue);
    });
    test('every host action is reachable from some menu state', () {
      final reachable = <HostAction>{};
      for (final t in [target(hand: true), target(role: MeetingRoomRole.cohost)]) {
        reachable.addAll(personActions(MeetingRoomRole.host, 'me', t));
      }
      for (final s in [base, base.copyWith(locked: true, waitingRoom: false, allowAttendeeScreenShare: false)]) {
        final rc = roomControls(MeetingRoomRole.host, s, anyHands: true)!;
        reachable.add(HostAction.muteAll);
        if (rc.lowerAllHands) reachable.add(HostAction.lowerAllHands);
        reachable.addAll([rc.lock, rc.waitingRoom, rc.screenShare]);
      }
      expect(reachable, HostAction.values.toSet());
    });
  });
}
```

- [ ] **Step 4: RED → hiện thực → GREEN** — `FTEST test/features/meetings/domain && FA`
- [ ] **Step 5: Commit** `feat(mobile): meeting codes, attendance summary and UI permissions`

---

### Task 7: Provider dữ liệu + hàng đợi cá nhân `/user/queue/meeting`

**Files:**
- Create: `FM/domain/meeting_queue.dart`, `FM/state/meetings_providers.dart`, `FM/state/meeting_queue_listener.dart`, `FM/state/active_room.dart`
- Modify: `FL/features/chat/data/stomp_service.dart` (+ `stomp_streams.dart`): đích `/user/queue/meeting` (key `meet`) đăng ký trong `subscribeNotifications()`, stream `Stream<Map<String, dynamic>> get meetingQueue` (frame body `jsonDecode` trong try — lỗi ⇒ bỏ); `FL/features/chat/domain/conversations_notifier.dart` (đọc sớm `meetingQueueListenerProvider` cạnh `groupCallSignalingProvider`); ARB khoá Task 7 (+ `MeetingText.someone`, `MeetingText.untitled` thêm vào enum Task 2 và lớp dịch)
- Test: `FT/domain/meeting_queue_test.dart`, `FT/state/meetings_providers_test.dart`

**Interfaces — Produces:**

```dart
// domain/meeting_queue.dart  (mirror lib/realtime/meeting-queue.ts)
abstract interface class ActiveMeetingRoom { String get meetingId; void handle(MeetingEvent e); }
class MeetingQueueNotice { const MeetingQueueNotice({required this.title, required this.body, required this.route});
  final MeetingNotice title, body; final String route; … == }
abstract interface class MeetingQueueContext {
  MeetingsCacheSink get cache;
  DateTime now();
  bool notificationsEnabled();
  String label(MeetingText t);                       // 'someone' / 'untitled' đã dịch (test: t.name)
  String formatTime(DateTime utc);                   // formatMeetingRange(locale, utc, null, DeviceZone())
  void notify(MeetingQueueNotice n);                 // banner chạm được → route
  void info(MeetingNotice n);                        // banner thông tin
  ActiveMeetingRoom? activeRoom();
}
void handleMeetingQueueEvent(MeetingEvent e, MeetingQueueContext ctx);

// state/active_room.dart
void setActiveMeetingRoom(ActiveMeetingRoom? room);  ActiveMeetingRoom? activeMeetingRoom();

// state/meetings_providers.dart
final meetingListProvider = AsyncNotifierProvider.autoDispose.family<MeetingListNotifier, MeetingListData, MeetingListScope>(…);
class MeetingListNotifier … {
  // build: store có list (và past không stale) ⇒ trả luôn; không thì GET trang đầu → store.setList.
  // ref.listen(meetingsStoreProvider.select((s) => s.list(arg))) ⇒ state = AsyncData(next) (vá STOMP hiện ngay).
  Future<void> loadMore();      // cursor = data.nextCursor; lỗi ⇒ giữ data, phát lỗi qua callback cho banner
  Future<void> refresh();       // kéo để làm mới
}
final meetingDetailProvider = AsyncNotifierProvider.autoDispose.family<MeetingDetailNotifier, Meeting, String>(…);
  // build: GET /{id} → store.put; theo dõi store.byId[id] để nhận vá. 4xx không retry.
final meetingByCodeProvider = FutureProvider.autoDispose.family<Meeting, String>(…);   // GET by-code → store.put
final meetingChatHistoryProvider = AsyncNotifierProvider.autoDispose.family<ChatHistoryNotifier, ChatHistory, String>(…);
  // build: trang mới nhất; loadOlder() với before = oldestId
final myDepartmentsProvider = FutureProvider.autoDispose<List<DepartmentOption>>(…);
/// Mine ∪ (MANAGE_DEPARTMENTS ⇒ departmentsProvider của admin), unique by id, sorted by name (mirror useMeetingDepartmentOptions).
final meetingDepartmentOptionsProvider = Provider.autoDispose<List<DepartmentOption>>(…);
final meetingActionsProvider = Provider<MeetingActions>(…);
class MeetingActions {
  Future<Meeting> create(MeetingInput input);   // → store.put; MEETING_CREATE_FORBIDDEN ⇒ capabilitiesProvider.refreshSilently()
  Future<Meeting> update(String id, MeetingInput input);
  Future<void> cancel(String id);               // → store.markEnded(cancelled: true)
  Future<void> end(String id);                  // → store.markEnded(cancelled: false)
}

// state/meeting_queue_listener.dart
@Riverpod(keepAlive: true)
class MeetingQueueListener extends _$MeetingQueueListener {
  // build(): sub = stomp.meetingQueue.listen((m) { final e = parseMeetingEvent(m); if (e != null) handleMeetingQueueEvent(e, ctx); });
  // ctx thật: cache = meetingsStoreProvider.notifier; label/formatTime qua appL10n() (+ localeName);
  // notify ⇒ showInAppNotification(title, body, onTap: () => rootNavigatorKey.currentContext?.push(route));
  // info ⇒ showInfoSnackBar; activeRoom ⇒ activeMeetingRoom(); notificationsEnabled ⇒ cờ thông báo trong app nếu
  // đã có (tìm provider cài đặt thông báo hiện hành), không có ⇒ true. ref.onDispose(sub.cancel).
}
```

- [ ] **Step 1: Test** — `FT/domain/meeting_queue_test.dart` (port `meeting-queue.test.ts`)

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/cache_updates.dart';
import 'package:platform_client/features/meetings/domain/meeting_events.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_queue.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_text.dart';
import 'package:platform_client/features/meetings/state/meetings_store.dart';

final clock = DateTime.utc(2026, 10, 7, 9);

Meeting meeting(String id, {String? title = 'Weekly'}) => Meeting(id: id, code: 'abc-defg-hjk', title: title,
    host: const MeetingPerson(userId: 'h', displayName: 'Lan'), coHosts: const [], invitees: const [],
    scheduledStart: DateTime.utc(2026, 10, 8, 2), status: MeetingStatus.scheduled, settings: MeetingSettings.defaults,
    attendance: const [], removedIds: const [], viewerRole: MeetingViewerRole.invited, createdAt: DateTime.utc(2026, 10, 7));

class _Room implements ActiveMeetingRoom {
  _Room(this.meetingId);
  @override
  final String meetingId;
  final handled = <MeetingEvent>[];
  @override
  void handle(MeetingEvent e) => handled.add(e);
}

class _Ctx implements MeetingQueueContext {
  @override
  final MemoryMeetingsCache cache = MemoryMeetingsCache();
  bool enabled = true;
  _Room? room;
  final notices = <MeetingQueueNotice>[];
  final infos = <MeetingNotice>[];
  @override
  DateTime now() => clock;
  @override
  bool notificationsEnabled() => enabled;
  @override
  String label(MeetingText t) => t.name;
  @override
  String formatTime(DateTime utc) => 'T(${utc.toIso8601String()})';
  @override
  void notify(MeetingQueueNotice n) => notices.add(n);
  @override
  void info(MeetingNotice n) => infos.add(n);
  @override
  ActiveMeetingRoom? activeRoom() => room;
}

List<String> upcomingIds(_Ctx c) => c.cache.cache.upcoming?.rows.map((m) => m.id).toList() ?? const [];
void seedUpcoming(_Ctx c, List<Meeting> rows) => c.cache.updateCache(
    (s) => s.setList(MeetingListScope.upcoming, MeetingListData(rows: rows, hasNext: false)));

void main() {
  late _Ctx ctx;
  setUp(() => ctx = _Ctx());
  final invited = InvitedEvent(meetingId: 'm2', code: 'xyz-wxyz-xyz', title: 'Planning',
      hostId: '64b0aaaaaaaaaaaaaaaaaaaa', hostName: 'Lan');

  group('invitations and reminders', () {
    test('adds a placeholder row and notifies with the host name, linking to the room', () {
      seedUpcoming(ctx, [meeting('m1')]);
      handleMeetingQueueEvent(invited, ctx);
      expect(upcomingIds(ctx), ['m2', 'm1']); // instant ⇒ sorted by creation (now), before m1's start
      expect(ctx.notices.single, const MeetingQueueNotice(
          title: MeetingNotice(MeetingText.notifInvitedTitle),
          body: MeetingNotice(MeetingText.notifInvitedBody, {'name': 'Lan', 'title': 'Planning'}),
          route: '/meet/xyz-wxyz-xyz'));
    });

    test('never shows the raw host id and falls back to generic labels', () {
      handleMeetingQueueEvent(InvitedEvent(meetingId: 'm2', code: 'xyz-wxyz-xyz',
          hostId: '64b0aaaaaaaaaaaaaaaaaaaa', hostName: '64b0aaaaaaaaaaaaaaaaaaaa'), ctx);
      expect(ctx.notices.single.body,
          const MeetingNotice(MeetingText.notifInvitedBody, {'name': 'someone', 'title': 'untitled'}));
    });

    test('does not overwrite a real row and stays silent when notifications are off', () {
      final real = meeting('m2', title: 'Real one');
      seedUpcoming(ctx, [real]);
      ctx.enabled = false;
      handleMeetingQueueEvent(invited, ctx);
      expect(identical(ctx.cache.cache.upcoming!.rows.single, real), isTrue);
      expect(ctx.notices, isEmpty);
    });

    test('reminds with the start time', () {
      handleMeetingQueueEvent(StartingEvent(meetingId: 'm1', code: 'abc-defg-hjk', title: 'Weekly',
          scheduledStart: DateTime.utc(2026, 10, 8, 2)), ctx);
      final n = ctx.notices.single;
      expect(n.title.text, MeetingText.notifStartingTitle);
      expect(n.body, const MeetingNotice(MeetingText.notifStartingBody,
          {'title': 'Weekly', 'time': 'T(2026-10-08T02:00:00.000Z)'}));
      expect(n.route, '/meet/abc-defg-hjk');
    });
  });

  group('cancellation and end', () {
    test('drops a cancelled meeting from upcoming, marks it cancelled and names it', () {
      seedUpcoming(ctx, [meeting('m1'), meeting('m3')]);
      handleMeetingQueueEvent(CancelledEvent(meetingId: 'm1'), ctx);
      expect(upcomingIds(ctx), ['m3']);
      expect(ctx.cache.cache.byId['m1']!.cancelledAt, clock);
      expect(ctx.infos.single, const MeetingNotice(MeetingText.notifCancelled, {'title': 'Weekly'}));
    });

    test('prefers the title the cancellation carries', () {
      ctx.cache.updateCache((s) => s.put(meeting('m1', title: 'Old title')));
      handleMeetingQueueEvent(CancelledEvent(meetingId: 'm1', title: 'Planning', code: 'abc-defg-hjk'), ctx);
      expect(ctx.infos.single, const MeetingNotice(MeetingText.notifCancelled, {'title': 'Planning'}));
    });

    test('forwards a cancellation to the open room of that meeting; generic sentence when unknown', () {
      ctx.room = _Room('m1');
      final e = CancelledEvent(meetingId: 'm1');
      handleMeetingQueueEvent(e, ctx);
      expect(ctx.room!.handled, [e]);
      handleMeetingQueueEvent(CancelledEvent(meetingId: 'zz'), ctx);
      expect(ctx.infos.last, const MeetingNotice(MeetingText.notifCancelledUnknown));
    });

    test('an end marks the past list stale without refetching it', () {
      handleMeetingQueueEvent(EndedEvent(meetingId: 'm1'), ctx);
      expect(ctx.cache.cache.pastStale, isTrue);
    });
  });

  group('room events', () {
    test('forwards room events to the open room only; meet.error without id goes to it too', () {
      ctx.room = _Room('m1');
      final lobby = LobbyEvent(meetingId: 'm1', waiting: const [LobbyEntry(userId: 'g', displayName: 'Guest')]);
      handleMeetingQueueEvent(lobby, ctx);
      handleMeetingQueueEvent(RemovedEvent(meetingId: 'other'), ctx);
      final err = MeetErrorEvent(errorCode: 'RATE_LIMITED');
      handleMeetingQueueEvent(err, ctx);
      expect(ctx.room!.handled, [lobby, err]);
    });

    test('my own chat line re-sent on the personal queue goes to that meeting’s room only, silently', () {
      ctx.room = _Room('m1');
      ChatEvent line(String id) => ChatEvent(meetingId: id, clientId: 'c-abc', message: MeetingChatMessage(
          id: 'x1', sender: const MeetingPerson(userId: 'me'), content: 'hi', createdAt: DateTime.utc(2026, 10, 8)));
      handleMeetingQueueEvent(line('m1'), ctx);
      handleMeetingQueueEvent(line('other'), ctx);
      expect(ctx.room!.handled, hasLength(1));
      expect(ctx.notices, isEmpty);
    });

    test('ignores room events when no room is open', () {
      expect(() => handleMeetingQueueEvent(AdmittedEvent(meetingId: 'm1'), ctx), returnsNormally);
      expect(ctx.notices, isEmpty);
    });
  });
}
```

(Class event có constructor `const` khi mọi trường final; test dùng `const` ở chỗ được.)

- [ ] **Step 2: Test** — `FT/state/meetings_providers_test.dart` (`ProviderContainer` + `meetingsRepositoryProvider.overrideWithValue(_FakeApi())`, `_FakeApi implements MeetingsApi` với `noSuchMethod` dự phòng như `member_mfa_reset_test.dart`):
  1. `meetingListProvider(upcoming)` tải trang đầu, `loadMore()` gọi `list(cursor: <id dòng cuối>)` và nối trang; `hasNext=false` ⇒ `loadMore` không gọi API.
  2. Vá store (`updateCache((s) => s.markEnded(...))`) ⇒ `read(meetingListProvider(upcoming)).value` không còn dòng đó (không gọi lại API).
  3. `pastStale` ⇒ lần `read(meetingListProvider(past))` kế tiếp sau khi invalidate provider gọi lại API.
  4. `meetingDepartmentOptionsProvider`: mine `[{d2,Beta}]` + admin `[{d1,Alpha},{d2,Beta}]` (khi `hasCapabilityProvider(MANAGE_DEPARTMENTS)` true) ⇒ `[Alpha, Beta]`; không quyền ⇒ chỉ `[Beta]`.
  5. `MeetingActions.create` lỗi `MEETING_CREATE_FORBIDDEN` ⇒ gọi `capabilitiesProvider.notifier.refreshSilently()` (override notifier ghi lại) và ném lại lỗi.
- [ ] **Step 3: RED → hiện thực → GREEN** — `dart run build_runner build --delete-conflicting-outputs && FTEST test/features/meetings test/features/chat && FA` (test chat cũ phải xanh — `FakeStompService` hiện có override stream bằng `Stream.empty()`: thêm `meetingQueue`/`meetingTopic` vào fake **chỉ khi** analyzer báo thiếu).
- [ ] **Step 4: Commit** `feat(mobile): meetings providers and the personal meeting queue`

---

### Task 8: Route, quay lại link sau đăng nhập, deep link `platform://meet/…`, origin web, mục điều hướng

**Files:**
- Create: `FL/core/router/return_path.dart`
- Modify: `FL/core/router/app_routes.dart` (+ `/meetings`, `/meetings/:id` bằng `slidePage`; `/meet/:code` thêm ở Task 17 — giữa hai task link `/meet/…` chưa mở được, nhánh chưa phát hành nên chấp nhận), `FL/core/router/route_guard.dart` (+ tham số `returnTo`), `FL/core/router/app_router.dart` (nhớ / dùng lại), `FL/main.dart` (`_handleDeepLink`: `uri.host == 'meet'` ⇒ `parseMeetingCodeInput(uri.toString())` ⇒ `_goWhenReady('/meet/$code')`), `android/app/src/main/AndroidManifest.xml` (thêm `<data android:scheme="platform" android:host="meet"/>` vào intent-filter VIEW sẵn có; iOS đã có scheme `platform`), `FL/core/config/app_config.dart` (+ `webBaseUrl`), `FL/features/chat/ui/conversation_list_screen.dart` (icon), ARB: khoá web `title` (→ `meetingTitle`, dùng làm tooltip icon + tiêu đề màn) thêm ở task này
- Test: `test/core/return_path_test.dart`, mở rộng `test/core/route_guard_test.dart`, `test/core/app_config_test.dart`

**Interfaces — Produces:**

```dart
// return_path.dart
/// Only `/meet/<valid code>` and `/meetings/<id [A-Za-z0-9]{1,64}>` — never an open redirect.
bool isSafeReturnPath(String path);
class ReturnPathHolder {            // memory only (a cold start after kill forgets it — fine)
  void remember(String path);       // ignores unsafe paths
  String? peek();
  String? take();
}
final returnPathHolderProvider = Provider<ReturnPathHolder>((_) => ReturnPathHolder());

// route_guard.dart — every "signed in, go home" bounce uses `returnTo ?? '/'`
String? resolveAuthRedirect({required String path, required bool isAuthenticated, required bool mustSetPassword,
    required bool onboardingCompleted, bool mfaPending = false, String? returnTo});
String? redirectForAuthState(AuthState? auth, {required String path, required bool onboardingCompleted, String? returnTo});

// app_config.dart
/// Origin of the web app for shareable links: PON_WEB_URL, else https://$PON_DOMAIN, else (debug) the local
/// web dev server; a release build without either ⇒ null (callers copy the bare code). Never throws.
static String? get webBaseUrl;
```

`app_router.dart` `redirect`: tính `target = redirectForAuthState(..., returnTo: holder.peek())`; nếu `target == '/login'` và `isSafeReturnPath(state.uri.path)` ⇒ `holder.remember(state.uri.path)`; nếu `target != null && target == holder.peek()` ⇒ `holder.take()`. Mọi kiểu đăng nhập (mật khẩu, OAuth `platform://auth`, 2FA, đặt mật khẩu lần đầu, onboarding giao diện) đều đi qua guard này ⇒ đều quay lại đúng link.

- [ ] **Step 1: Test** — `test/core/return_path_test.dart`

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/router/return_path.dart';

void main() {
  test('only meeting paths are safe return targets', () {
    expect(isSafeReturnPath('/meet/abc-defg-hjk'), isTrue);
    expect(isSafeReturnPath('/meetings/670f1c2ab9e4d21f0c3a9e11'), isTrue);
    for (final p in ['/', '/settings', '/meet/not-a-code', '//evil.com/meet/abc-defg-hjk', 'https://evil.com',
        '/meetings/../admin', '/meetings/a b', '/meet/abc-defg-hjk/extra']) {
      expect(isSafeReturnPath(p), isFalse, reason: p);
    }
  });

  test('remembers a safe path once', () {
    final h = ReturnPathHolder()..remember('/settings');
    expect(h.peek(), isNull);
    h.remember('/meet/abc-defg-hjk');
    expect(h.take(), '/meet/abc-defg-hjk');
    expect(h.take(), isNull);
  });
}
```

- [ ] **Step 2: Test** — thêm vào `test/core/route_guard_test.dart`:

```dart
  group('return to a meeting link after signing in', () {
    const link = '/meet/abc-defg-hjk';
    test('signed out on a meeting link ⇒ login', () {
      expect(resolveAuthRedirect(path: link, isAuthenticated: false, mustSetPassword: false,
          onboardingCompleted: true), '/login');
    });
    test('signed in on a guest-only page ⇒ the remembered link instead of home', () {
      expect(resolveAuthRedirect(path: '/login', isAuthenticated: true, mustSetPassword: false,
          onboardingCompleted: true, returnTo: link), link);
      expect(resolveAuthRedirect(path: '/login', isAuthenticated: true, mustSetPassword: false,
          onboardingCompleted: true), '/');
    });
    test('set-password and onboarding still come first; the link waits', () {
      expect(resolveAuthRedirect(path: '/login', isAuthenticated: true, mustSetPassword: true,
          onboardingCompleted: true, returnTo: link), '/set-password');
      expect(resolveAuthRedirect(path: '/theme-onboarding', isAuthenticated: true, mustSetPassword: false,
          onboardingCompleted: true, returnTo: link), link);
    });
  });
```

  (Giá trị khớp hằng `kSetPasswordPath` = `/set-password`, `kThemeOnboardingPath` = `/theme-onboarding` — đã kiểm.)
- [ ] **Step 3: Test** — thêm vào `test/core/app_config_test.dart`: `expect(AppConfig.webBaseUrl, 'http://localhost:3000')` trong nhóm "no --dart-define" (debug fallback — cùng bản đồ `_debugFallback` sẵn có, thêm khoá `'web'`).
- [ ] **Step 4: RED → hiện thực → GREEN** — `FTEST test/core && FA`
- [ ] **Step 5: Mục điều hướng** — `conversation_list_screen.dart`: `IconButton(icon: const Icon(Icons.videocam_rounded), tooltip: context.l10n.meetingTitle, onPressed: () => context.push('/meetings'))` đặt **giữa** Explore và Friends (owner quyết định 1). Không đổi `ConversationBottomBar`. Chạy `test/core/design_system_sync_test.dart` + `DESIGN_SHOTS=1 flutter test test/design/design_shots_test.dart` (header không tràn ở 320 dp: 4 icon + logo).
- [ ] **Step 6: Kiểm tay** — `adb shell am start -a android.intent.action.VIEW -d "platform://meet/abc-defg-hjk"` khi đã đăng nhập ⇒ `/meet/abc-defg-hjk` (sau Task 17); khi chưa đăng nhập ⇒ `/login` ⇒ đăng nhập ⇒ quay lại link. iOS: `xcrun simctl openurl booted platform://meet/abc-defg-hjk`.
- [ ] **Step 7: Commit** `feat(mobile): meeting routes, return-to-link after sign-in and meet deep links`

---

### Task 9: Thông báo đẩy `MEETING_*` + chuỗi đẩy dịch sẵn trên máy

**Files:**
- Create: `FL/core/services/push_routes.dart`, `android/app/src/main/res/values{,-vi,-zh,-ja,-ko,-es,-fr}/strings.xml`, `ios/Runner/{en,vi,zh-Hans,ja,ko,es,fr}.lproj/Localizable.strings`
- Modify: `FL/main.dart` (route theo `pushRouteFor` ở `onMessageOpenedApp` / `getInitialMessage` / tap thông báo cục bộ; background handler bỏ qua push họp; foreground `onMessage` push họp khi STOMP **không** kết nối ⇒ `showMeetingNotification`), `FL/core/services/notification_service.dart` (kênh `pon_meetings` tạo ở `initNotifications()` với tên `meetingPushChannel`; `showMeetingNotification({title, body, route})` payload `route:<path>`; `notificationTapStream` vẫn phát payload — `main.dart` phân biệt `route:` với `conversationId` cũ), `ios/Runner.xcodeproj/project.pbxproj` (`knownRegions` += `vi, zh-Hans, ja, ko, es, fr`; `PBXVariantGroup "Localizable.strings"` + thêm vào Resources build phase — mẫu như nhóm `Main.storyboard`), ARB khoá Task 9
- Test: `test/core/push_routes_test.dart`, `test/core/native_push_strings_test.dart`

**Interfaces — Produces:**

```dart
// push_routes.dart
const kMeetingPushTypes = {'MEETING_INVITED', 'MEETING_STARTING'};
bool isMeetingPush(Map<String, dynamic> data);
/// MEETING_* ⇒ '/meet/{code}' (code hợp lệ) hoặc '/meetings/{meetingId}'; tin nhắn ⇒ '/chat/{conversationId}'; khác ⇒ null.
String? pushRouteFor(Map<String, dynamic> data);
```

- [ ] **Step 1: Test** — `test/core/push_routes_test.dart`

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/services/push_routes.dart';

void main() {
  test('meeting pushes open the room by code, else the meeting page', () {
    expect(pushRouteFor({'type': 'MEETING_INVITED', 'meetingId': 'm1', 'code': 'abc-defg-hjk'}), '/meet/abc-defg-hjk');
    expect(pushRouteFor({'type': 'MEETING_STARTING', 'meetingId': 'm1', 'code': ''}), '/meetings/m1');
    expect(pushRouteFor({'type': 'MEETING_STARTING', 'code': 'javascript:alert(1)'}), isNull);
    expect(isMeetingPush({'type': 'MEETING_INVITED'}), isTrue);
  });

  test('message pushes keep opening the conversation', () {
    expect(pushRouteFor({'conversationId': 'c1'}), '/chat/c1');
    expect(isMeetingPush({'conversationId': 'c1'}), isFalse);
    expect(pushRouteFor({}), isNull);
  });
}
```

- [ ] **Step 2: Test** — `test/core/native_push_strings_test.dart` (chạy từ `apps/client`): với 7 cặp (ARB locale ↔ thư mục Android ↔ thư mục iOS: `en↔values↔en.lproj`, `vi↔values-vi↔vi.lproj`, `zh↔values-zh↔zh-Hans.lproj`, `ja`, `ko`, `es`, `fr`) đọc file, kiểm có `meeting_push_invited` + `meeting_push_starting`, nội dung **trùng** `meetingPushInvited` / `meetingPushStarting` của ARB cùng locale (Android: bỏ escape `\'`), không rỗng — một nguồn chữ, không lệch. Kiểm thêm `knownRegions` trong `project.pbxproj` chứa đủ 7 vùng.

```dart
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

const locales = {'en': ('values', 'en'), 'vi': ('values-vi', 'vi'), 'zh': ('values-zh', 'zh-Hans'),
    'ja': ('values-ja', 'ja'), 'ko': ('values-ko', 'ko'), 'es': ('values-es', 'es'), 'fr': ('values-fr', 'fr')};

String? androidString(String xml, String name) => RegExp('<string name="$name">(.*?)</string>')
    .firstMatch(xml)?.group(1)?.replaceAll(r"\'", "'").replaceAll('&amp;', '&');
String? iosString(String strings, String name) => RegExp('"$name"\\s*=\\s*"(.*?)";').firstMatch(strings)?.group(1);

void main() {
  locales.forEach((loc, dirs) {
    test('push strings for $loc match the ARB', () {
      final arb = jsonDecode(File('lib/l10n/app_$loc.arb').readAsStringSync()) as Map<String, dynamic>;
      final xml = File('android/app/src/main/res/${dirs.$1}/strings.xml').readAsStringSync();
      final ios = File('ios/Runner/${dirs.$2}.lproj/Localizable.strings').readAsStringSync();
      for (final (native, key) in [('meeting_push_invited', 'meetingPushInvited'), ('meeting_push_starting', 'meetingPushStarting')]) {
        final expected = arb[key] as String;
        expect(expected.trim(), isNotEmpty);
        expect(androidString(xml, native), expected, reason: 'android $loc $native');
        expect(iosString(ios, native), expected, reason: 'ios $loc $native');
      }
    });
  });

  test('the Xcode project knows every region', () {
    final pbx = File('ios/Runner.xcodeproj/project.pbxproj').readAsStringSync();
    for (final r in ['en', 'vi', '"zh-Hans"', 'ja', 'ko', 'es', 'fr']) {
      expect(pbx, contains(r));
    }
    expect(pbx, contains('Localizable.strings'));
  });
}
```

- [ ] **Step 3: RED → hiện thực → GREEN** — `FTEST test/core && FA`; `plutil -lint ios/Runner/*.lproj/Localizable.strings`.
- [ ] **Step 4: Build kiểm** — `flutter build apk --debug` (aapt bắt XML hỏng) và `flutter build ios --simulator --debug` (bắt pbxproj hỏng; nếu CocoaPods báo "higher minimum deployment version" ⇒ `pod install --repo-update` — memory dự án).
- [ ] **Step 5: Kiểm tay (thiết bị thật, cần Firebase)** — app bị tắt / ở nền: tạo cuộc họp mời người đó ⇒ push hiện **tiêu đề cuộc họp + câu đã dịch theo ngôn ngữ máy** (không bao giờ `meeting_push_invited`); chạm ⇒ mở `/meet/{code}`; nhắc 10 phút ⇒ như trên; Android: thông báo thuộc kênh "Phòng họp". App tiền cảnh + STOMP kết nối ⇒ chỉ banner trong app (iOS `alert: false` sẵn có ⇒ không trùng).
- [ ] **Step 6: Commit** `feat(mobile): meeting push routing and localized push strings`

---

### Task 10: Màn `/meetings` + sheet Lên lịch / Sửa / Họp lại

**Files:**
- Create: `FM/ui/meetings_screen.dart`, `FM/ui/widgets/{meetings_header,join_by_code_field,meeting_list_view,meeting_row,meeting_status_chip,copy_meeting_link}.dart`, `FM/ui/create_meeting_sheet.dart`, `FM/ui/widgets/{meeting_text_fields,meeting_schedule_fields,invitee_picker,meeting_department_field,meeting_settings_fields}.dart`, `FT/ui/meeting_test_harness.dart` (dùng chung mọi widget test họp)
- Modify: `FL/core/router/app_routes.dart` (`/meetings` → `MeetingsScreen`), ARB khoá Task 10
- Test: `FT/ui/create_meeting_sheet_test.dart`, `FT/ui/meetings_screen_test.dart`

**`MeetingsScreen`** (≤ 200 dòng) — `Scaffold` + `AppBar(title: meetingTitle)`, body `NestedScrollView`/`Column`: `MeetingsHeader` → `TabBar(meetingTabUpcoming | meetingTabPast)` → `TabBarView` 2 × `MeetingListView(scope)`. Mở tab Đã qua khi `pastStale` ⇒ `ref.invalidate(meetingListProvider(past))` (refetch có chủ đích, như web `refetchType:'none'` rồi mở tab).

**`MeetingsHeader`** (≤ 130) — `meetingSubtitle` (`bodyMedium`, `mutedText`); khi `hasCapabilityProvider(Cap.hostMeeting)`: `PonButton(meetingNewInstant)` (một nút chính mỗi màn) ⇒ `MeetingActions.create(const MeetingInput())` ⇒ `context.push('/meet/${m.code}')`, đang chạy ⇒ `isLoading` + chữ `meetingStarting`; `OutlinedButton.icon(event_rounded, meetingNewScheduled)` ⇒ `CreateMeetingSheet.show(context, mode: create)`. Lỗi ⇒ `showErrorSnackBar(meetingErrorText(l10n, e))` (không bao giờ `e.toString()`). Dưới cùng `JoinByCodeField`.

**`JoinByCodeField`** (≤ 80) — `PonTextField(labelText: meetingJoinByCodeLabel, prefixIcon: Icons.keyboard_rounded, hint meetingJoinByCodePlaceholder)` + `TextButton(meetingJoinByCode)`; `parseMeetingCodeInput(text)` null ⇒ lỗi dưới ô `meetingCodeInvalid`, có ⇒ `context.push('/meet/$code')`. Bàn phím `TextInputAction.go`.

**`MeetingListView`** (≤ 150) — `ref.watch(meetingListProvider(scope))`: loading ⇒ 3 khung `PonCard` mờ; error ⇒ `meetingListError` + `TextButton(commonRetry)` (dùng khoá retry chung sẵn có); rỗng ⇒ `meetingEmptyUpcoming/Past` (`mutedText`); có ⇒ `RefreshIndicator` + `ListView.separated` (hairline) các `MeetingRow`, cuối danh sách `hasNext` ⇒ tự `loadMore()` khi cuộn tới 300 dp cuối + nút dự phòng `meetingLoadMore`.

**`MeetingRow`** (≤ 130) — `InkWell` → `/meetings/{id}`; dòng 1 tiêu đề (`title?.trim()` ‖ `meetingUntitled`, 14/500, 1 dòng ellipsis) + `MeetingStatusChip`; dòng 2 `formatMeetingRange(locale, start, end, DeviceZone())` hoặc `meetingInstantMeeting`, rồi `meetingHostedBy{personName(host, someone)}` (12, `mutedText`); trailing: LIVE + chưa kết thúc ⇒ `TextButton(meetingJoin)` → `/meet/{code}`; `CopyMeetingLink(code)` (icon `link_rounded`, tooltip `meetingCopyLink`).

**`MeetingStatusChip`** (≤ 40) — LIVE: chấm `colorScheme.primary` + `meetingStatusLive`; SCHEDULED: `meetingStatusScheduled`; ENDED: `isCancelled ? meetingStatusCancelled : meetingStatusEnded` (`mutedText`). Không màu cứng.

**`CopyMeetingLink`** (≤ 50) — `meetingLink(code, AppConfig.webBaseUrl)`; null ⇒ chép mã + `showInfoSnackBar(meetingLinkCodeCopied)`; có ⇒ chép link + `meetingLinkCopied`; lỗi clipboard ⇒ `meetingCopyFailed`.

**`CreateMeetingSheet`** (≤ 280) — `static Future<void> show(BuildContext, {required MeetingFormMode mode, Meeting? meeting})` = `showModalBottomSheet(isScrollControlled: true, useSafeArea: true)`, cao tối đa 92%, header tiêu đề `meetingFormCreateTitle|EditTitle|AgainTitle` + nút đóng; body cuộn: `MeetingTextFields` → `MeetingScheduleFields` → `InviteePicker` → `MeetingDepartmentField` (khi `meetingDepartmentOptionsProvider` không rỗng và giá trị hiện tại nằm trong danh sách hoặc rỗng — mirror web) → `MeetingSettingsFields`; footer cố định: `TextButton(commonCancel)` + `PonButton(submit)` (`meetingSubmitSave` khi sửa, `meetingSubmitCreate` khi lên lịch, `meetingSubmitStartNow` khi "Bắt đầu ngay"). State = `MeetingFormValues` trong `State` (form cục bộ — không cần provider); `now` lấy lúc mở sheet; `checkedAt` đặt khi bấm gửi ⇒ hiện lỗi `validateMeetingForm`; lỗi server `MEETING_INVALID{field}` ∈ {title, description, inviteeIds, scheduledStart, scheduledEnd} ⇒ hiện **dưới ô** (bảng `SERVER_FIELDS` của web), lỗi khác ⇒ `showErrorSnackBar`; `MEETING_CREATE_FORBIDDEN` ⇒ `capabilities.refreshSilently()`. Thành công: sửa ⇒ đóng + `meetingToastUpdated`; tạo có lịch ⇒ đóng + `meetingToastCreated`; tạo ngay ⇒ đóng + `context.push('/meet/{code}')`. Sửa: `toMeetingInput(values, zone, original: meetingLúcMởSheet)` ⇒ chỉ công tắc đã đổi (QA web).

**`MeetingScheduleFields`** (≤ 200) — `SegmentedButton(whenNow | whenLater)` (ẩn "Bắt đầu ngay" khi sửa cuộc họp đã có lịch — `allowNow: original?.scheduledStart == null`); khi `scheduled`: 3 ô chạm mở `showDatePicker` (firstDate hôm nay, lastDate +1 năm, `locale` của app), `showTimePicker` (24h theo `MediaQuery.alwaysUse24HourFormat`/locale), `DropdownButtonFormField<int>` thời lượng (`durationOptions(current)`, nhãn `meetingDurationLabel`); dòng `meetingTimeZoneHint{zone: timeZoneLabel(DateTime.now().timeZoneOffset)}`; LIVE ⇒ cả khối disabled (server từ chối đổi lịch khi LIVE).

**`InviteePicker`** (≤ 200) — `meetingFieldInvitees`; ô tìm (`PonTextField` + debounce 400 ms) gọi `authRepositoryProvider.searchUsers(q)` (đã có); kết quả bỏ chính mình + người đã chọn; mỗi kết quả `ListTile(leading: ConversationAvatar(avatarUrl, fallbackLetter), title: safeDisplayName(...) ‖ meetingParticipantFallback)`; chọn ⇒ chip (`InputChip` có nút xoá `tooltip: meetingRemoveInvitee{name}`); đếm `meetingInviteeCount{count}` / `meetingInviteeNone`; lỗi tìm ⇒ `meetingSearchFailed`; không kết quả ⇒ `meetingSearchNoResults`. Không bao giờ hiện id/email thô ngoài tên.

**`MeetingDepartmentField`** (≤ 60) — `DropdownButtonFormField<String>` mục đầu `meetingDepartmentNone` (giá trị `''`), các phòng ban theo tên + `meetingDepartmentHint`.

**`MeetingSettingsFields`** (≤ 80) — `meetingSettingsTitle` + 5 `SwitchListTile` (`settingWaitingRoom`+Desc, `settingMuteOnEntry`+Desc, `settingScreenShare`, `settingNotes`, `settingLocked`+Desc).

- [ ] **Step 1: Harness** — `FT/ui/meeting_test_harness.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:platform_client/l10n/app_localizations.dart';

/// Pumps [child] at '/' inside ProviderScope + MaterialApp.router (en) with stub routes that
/// render their location, so navigation can be asserted with `find.text('/meet/abc-defg-hjk')`.
Future<void> pumpMeetingWidget(WidgetTester tester, Widget child,
    {List<Override> overrides = const [], Locale locale = const Locale('en')}) async {
  final router = GoRouter(routes: [
    GoRoute(path: '/', builder: (_, __) => Scaffold(body: child)),
    GoRoute(path: '/meet/:code', builder: (_, s) => Text(s.uri.path)),
    GoRoute(path: '/meetings/:id', builder: (_, s) => Text(s.uri.path)),
  ]);
  await tester.pumpWidget(ProviderScope(
    overrides: overrides,
    child: MaterialApp.router(
      routerConfig: router, locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
    ),
  ));
  await tester.pumpAndSettle();
}

AppLocalizations l10nOf(WidgetTester tester) =>
    AppLocalizations.of(tester.element(find.byType(Scaffold).first));
```

- [ ] **Step 2: Test** — `FT/ui/create_meeting_sheet_test.dart` (port `MeetingFormDialog.test.tsx` + sửa chỉ gửi công tắc đã đổi)

```dart
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/admin/state/capabilities_provider.dart';
import 'package:platform_client/features/meetings/data/meetings_repository.dart';
import 'package:platform_client/features/meetings/data/my_departments_repository.dart';
import 'package:platform_client/features/meetings/domain/meeting_form.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/ui/create_meeting_sheet.dart';

import 'meeting_test_harness.dart';

class _Api implements MeetingsApi {
  final created = <MeetingInput>[];
  final updated = <MeetingInput>[];
  Object? failWith;
  @override
  Future<Meeting> create([MeetingInput input = const MeetingInput()]) async {
    created.add(input);
    if (failWith != null) throw failWith!;
    return sample(scheduled: input.scheduledStart != null);
  }
  @override
  Future<Meeting> update(String id, MeetingInput input) async {
    updated.add(input);
    return sample(scheduled: true);
  }
  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

class _Depts implements MyDepartmentsApi {
  _Depts(this.items);
  final List<DepartmentOption> items;
  @override
  Future<List<DepartmentOption>> list() async => items;
}

Meeting sample({bool scheduled = false, MeetingStatus status = MeetingStatus.live}) => Meeting(id: 'm1',
    code: 'abc-defg-hjk', title: 'Weekly', host: const MeetingPerson(userId: 'me'), coHosts: const [],
    invitees: const [], scheduledStart: scheduled ? DateTime.utc(2030, 1, 1, 2) : null,
    scheduledEnd: scheduled ? DateTime.utc(2030, 1, 1, 3) : null, status: status,
    settings: MeetingSettings.defaults, attendance: const [], removedIds: const [],
    viewerRole: MeetingViewerRole.host, createdAt: DateTime.utc(2026, 10, 7));

DioException invalid(String field, int max) {
  final o = RequestOptions(path: '/api/meetings');
  return DioException(requestOptions: o, type: DioExceptionType.badResponse, response: Response(requestOptions: o,
      statusCode: 400, data: {'code': 'MEETING_INVALID', 'params': {'field': field, 'max': max}}));
}

void main() {
  late _Api api;
  setUp(() => api = _Api());

  Future<void> open(WidgetTester tester, {MeetingFormMode mode = MeetingFormMode.create, Meeting? meeting,
      List<DepartmentOption> depts = const []}) async {
    await pumpMeetingWidget(tester, Builder(builder: (context) => TextButton(
        onPressed: () => CreateMeetingSheet.show(context, mode: mode, meeting: meeting), child: const Text('open'))),
      overrides: [
        meetingsRepositoryProvider.overrideWithValue(api),
        myDepartmentsRepositoryProvider.overrideWithValue(_Depts(depts)),
        hasCapabilityProvider.overrideWith((ref, cap) => false),
      ]);
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
  }

  testWidgets('shows a server field error under the field instead of a banner', (tester) async {
    api.failWith = invalid('title', 120);
    await open(tester);
    await tester.tap(find.text(l10nOf(tester).meetingSubmitCreate));
    await tester.pumpAndSettle();
    expect(find.text(l10nOf(tester).meetingValTitleTooLong(120)), findsOneWidget);
  });

  testWidgets('starts an instant meeting and opens the room when "Start now" is picked', (tester) async {
    await open(tester);
    await tester.tap(find.text(l10nOf(tester).meetingWhenNow));
    await tester.pumpAndSettle();
    await tester.tap(find.text(l10nOf(tester).meetingSubmitStartNow));
    await tester.pumpAndSettle();
    expect(api.created.single.scheduledStart, isNull);
    expect(find.text('/meet/abc-defg-hjk'), findsOneWidget);
  });

  testWidgets('offers the caller departments only when there are some', (tester) async {
    await open(tester, depts: const [DepartmentOption(id: 'd1', name: 'Sales')]);
    expect(find.text(l10nOf(tester).meetingFieldDepartment), findsOneWidget);
  });

  testWidgets('hides the department field for someone without departments', (tester) async {
    await open(tester);
    expect(find.text(l10nOf(tester).meetingFieldDepartment), findsNothing);
  });

  testWidgets('editing sends only the switch that was flipped', (tester) async {
    await open(tester, mode: MeetingFormMode.edit, meeting: sample(scheduled: true, status: MeetingStatus.scheduled));
    await tester.tap(find.text(l10nOf(tester).meetingSettingLocked));
    await tester.pumpAndSettle();
    await tester.tap(find.text(l10nOf(tester).meetingSubmitSave));
    await tester.pumpAndSettle();
    expect(api.updated.single.toJson()['settings'], {'locked': true});
    expect(api.updated.single.toJson().containsKey('scheduledStart'), isFalse);
  });
}
```

  (Nếu `hasCapabilityProvider` là `Provider.family<bool, String>` như báo cáo — cú pháp override trên đúng với Riverpod 2.6.)
- [ ] **Step 3: Test** — `FT/ui/meetings_screen_test.dart`: (a) có `HOST_MEETING` ⇒ thấy `meetingNewInstant` + `meetingNewScheduled`; không có ⇒ không thấy, ô mã vẫn có; (b) nhập `ABC DEFG HJK` + bấm `meetingJoinByCode` ⇒ điều hướng `/meet/abc-defg-hjk`; nhập `abc` ⇒ `meetingCodeInvalid`; (c) danh sách hiện tiêu đề + `meetingStatusLive`, **không** chứa id host (`find.textContaining('64b0')` ⇒ nothing).
- [ ] **Step 4: RED → hiện thực → GREEN** — khoá Task 10 (7 locale, `web_meeting_keys.py` + `meetingLinkCodeCopied` viết tay) ⇒ `GEN`; `FTEST test/features/meetings && FA`; `wc -l` ≤ 400.
- [ ] **Step 5: Kiểm tay** — 320 dp + 412 dp, sáng/tối: không tràn; sheet cuộn được khi bàn phím mở; date/time picker theo ngôn ngữ app; Họp ngay ⇒ vào màn chờ (sau Task 17).
- [ ] **Step 6: Commit** `feat(mobile): meetings list, start now, schedule / edit / meet again`

---

### Task 11: Ghi chú — máy trạng thái, autosave 2s, 409 không mất chữ

**Files:**
- Create: `FM/domain/note_sync.dart`, `FM/state/note_editor.dart`, `FM/ui/widgets/notes_editor.dart`, `FM/ui/widgets/note_conflict_sheet.dart`
- Modify: ARB khoá Task 11
- Test: `FT/domain/note_sync_test.dart`, `FT/ui/notes_editor_test.dart`

**Interfaces — Produces:**

```dart
// note_sync.dart — mirror note-sync.ts 1-1
enum NoteStatus { loading, clean, dirty, saving, saved, conflict, error }
class RemoteNewer { const RemoteNewer(this.version, [this.updatedBy]); final int version; final MeetingPerson? updatedBy; … == }
class NoteState {
  const NoteState({this.status = NoteStatus.loading, this.baseVersion = 0, this.baseContent = '', this.draft = '',
      this.savingDraft, this.latest, this.remoteNewer, this.error});
  … copyWith (nullable fields cleared with explicit flags) …
  static const initial = NoteState();
}
sealed class NoteAction {}   // Loaded(note) · Edit(draft) · SaveStarted · SaveSucceeded(note) · SaveConflicted(latest)
                             // · SaveFailed(MeetingNotice) · Retry · RemoteUpdated(version, by) · KeepMine · TakeTheirs · SaveMerged(draft)
NoteState noteReducer(NoteState s, NoteAction a);   // returns the SAME instance when nothing changes
bool canAutosave(NoteState s); ({String content, int version}) savePayload(NoteState s);
bool needsRefetch(NoteState s); bool hasUnsavedText(NoteState s);

// state/note_editor.dart
typedef NoteKey = ({String meetingId, NoteScope scope});
final noteAutosaveDelayProvider = Provider<Duration>((_) => const Duration(seconds: 2));
class NoteEditorView { final NoteState note; final MeetingErrorInfo? loadError; }
final noteEditorProvider = NotifierProvider.autoDispose.family<NoteEditorNotifier, NoteEditorView, NoteKey>(…);
class NoteEditorNotifier … {
  // build: GET note → Loaded; lỗi tải ⇒ loadError (403 MEETING_REMOVED / guest …). ref.onDispose: huỷ timer + flush best-effort.
  void setCanEdit(bool v);          // false ⇒ không autosave (vai trò / attendeesCanEditNotes đổi giữa họp)
  void edit(String draft); void retry(); void keepMine(); void takeTheirs(); void saveMerged(String draft);
  void remoteUpdated(int version, MeetingPerson? by);   // + tự GET lại khi needsRefetch (sạch)
  Future<void> flush();             // lưu ngay nếu dirty (đóng panel, rời phòng, dispose)
}
```

Autosave: sau mỗi action, nếu `canAutosave && canEdit` ⇒ huỷ timer cũ, đặt `Timer(delay, _save)`; `_save` chặn chạy chồng (`_saving`), `PUT` với `savePayload`, `SaveSucceeded` / `noteConflictLatest(e)` ⇒ `SaveConflicted` / khác ⇒ `SaveFailed(meetingErrorNotice(parseMeetingError(e), MeetingErrorContext.note))`.

**`NotesEditor`** (≤ 260) — props `{required String meetingId, required bool canEditShared, RemoteNewer? sharedRemote, void Function(Future<void> Function() flush)? onFlushReady}`. `SegmentedButton(notesShared | notesPrivate)` (+ `notesPrivateHint` dưới tab Của tôi); `SegmentedButton(notesWrite | notesPreview)`; Viết = `TextField(maxLines: null, minLines: 8, keyboardType: multiline, readOnly: !canEdit, decoration: hint notesPlaceholder)` có `Semantics(label: notesShared|notesPrivate)`; Xem trước = `MarkdownBody(data: draft, selectable: true)` (`flutter_markdown`, không HTML); dòng trạng thái `notesSaving|notesSaved|notesUnsaved|notesSaveFailed` + `TextButton(notesRetry)`; `notesCounter{count,max}` khi > 45 000; read-only ⇒ `notesReadOnly`; `remoteNewer` khi đang sửa ⇒ dải `notesRemoteNewer{name}` / `notesRemoteNewerUnknown`; `conflict` ⇒ khối `Semantics(liveRegion: true)` `notesConflictTitle` + `notesConflictDesc` + `TextButton(notesConflictReview)` ⇒ `NoteConflictSheet`. `TextEditingController` đồng bộ một chiều: chỉ ghi đè text khi `draft` đổi **không** do người dùng gõ (takeTheirs/loaded), giữ con trỏ cuối. Gọi `onFlushReady(notifier.flush)` sau frame đầu.

**`NoteConflictSheet`** (≤ 180) — bottom sheet: `SegmentedButton(notesConflictTheirs | notesConflictMine)` hiển thị hai bản (`SelectableText`), ô "bản gộp" (khởi tạo = bản của tôi) và 3 nút: `notesConflictKeepMine` (chính), `notesConflictTakeTheirs` (kèm `notesConflictDiscardWarning`, `colorScheme.error`), `notesConflictSaveMerged`.

- [ ] **Step 1: Test** — `FT/domain/note_sync_test.dart` (port đủ `note-sync.test.ts`)

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_text.dart';
import 'package:platform_client/features/meetings/domain/note_sync.dart';

MeetingNote note(String content, int version, [String by = 'Minh']) => MeetingNote(scope: NoteScope.shared,
    content: content, version: version, updatedBy: MeetingPerson(userId: 'u2', displayName: by));
NoteState run(List<NoteAction> actions) => actions.fold(NoteState.initial, noteReducer);

void main() {
  test('loads a note as clean', () {
    final s = run([Loaded(note('base', 1))]);
    expect((s.status, s.baseVersion, s.baseContent, s.draft), (NoteStatus.clean, 1, 'base', 'base'));
    expect(canAutosave(s), isFalse);
  });

  test('becomes dirty on edit and clean again when the edit is undone', () {
    final dirty = run([Loaded(note('base', 1)), Edit('base!')]);
    expect(dirty.status, NoteStatus.dirty);
    expect(canAutosave(dirty), isTrue);
    expect(savePayload(dirty), (content: 'base!', version: 1));
    expect(noteReducer(dirty, Edit('base')).status, NoteStatus.clean);
  });

  test('keeps typing that happens while a save is in flight', () {
    final s = run([Loaded(note('a', 1)), Edit('ab'), SaveStarted(), Edit('abc'), SaveSucceeded(note('ab', 2))]);
    expect((s.status, s.baseVersion, s.baseContent, s.draft), (NoteStatus.dirty, 2, 'ab', 'abc'));
    expect(savePayload(s), (content: 'abc', version: 2));
  });

  test('marks a save as saved when nothing changed meanwhile; the echo changes nothing', () {
    final s = run([Loaded(note('a', 1)), Edit('ab'), SaveStarted(), SaveSucceeded(note('ab', 2))]);
    expect((s.status, s.baseVersion, s.draft), (NoteStatus.saved, 2, 'ab'));
    expect(identical(noteReducer(s, Loaded(note('ab', 2))), s), isTrue);
  });

  group('409 conflict', () {
    final conflicted = run([Loaded(note('base', 1)), Edit('base + mine'), SaveStarted(),
        SaveConflicted(note('base + theirs', 2))]);

    test('never loses the text being typed', () {
      expect((conflicted.status, conflicted.draft, conflicted.baseVersion), (NoteStatus.conflict, 'base + mine', 1));
      expect(conflicted.latest?.content, 'base + theirs');
      expect(canAutosave(conflicted), isFalse);
      expect(hasUnsavedText(conflicted), isTrue);
      final typing = noteReducer(conflicted, Edit('base + mine!'));
      expect((typing.status, typing.draft), (NoteStatus.conflict, 'base + mine!'));
    });

    test('"keep mine" rebases the draft on the newer version so the next save overwrites it', () {
      final s = noteReducer(conflicted, KeepMine());
      expect((s.status, s.baseVersion, s.baseContent, s.draft, s.latest),
          (NoteStatus.dirty, 2, 'base + theirs', 'base + mine', null));
      expect(savePayload(s), (content: 'base + mine', version: 2));
    });

    test('"use newer version" adopts their text', () {
      final s = noteReducer(conflicted, TakeTheirs());
      expect((s.status, s.baseVersion, s.draft, s.latest), (NoteStatus.clean, 2, 'base + theirs', null));
    });

    test('"save merged" saves the merged text on top of the newer version', () {
      final s = noteReducer(conflicted, SaveMerged('base + theirs + mine'));
      expect((s.status, s.baseVersion, s.draft), (NoteStatus.dirty, 2, 'base + theirs + mine'));
      expect(savePayload(s), (content: 'base + theirs + mine', version: 2));
    });

    test('a reload during the conflict does not touch the draft', () {
      final s = noteReducer(conflicted, Loaded(note('base + theirs + more', 3)));
      expect((s.status, s.draft), (NoteStatus.conflict, 'base + mine'));
      expect(s.remoteNewer, RemoteNewer(3, const MeetingPerson(userId: 'u2', displayName: 'Minh')));
    });
  });

  group('remote updates (meet.notes.updated)', () {
    test('asks a clean editor to refetch, then applies the new version', () {
      final s = run([Loaded(note('a', 1)), RemoteUpdated(2)]);
      expect(needsRefetch(s), isTrue);
      final after = noteReducer(s, Loaded(note('a+b', 2)));
      expect((after.status, after.draft, after.baseVersion, after.remoteNewer), (NoteStatus.clean, 'a+b', 2, null));
      expect(needsRefetch(after), isFalse);
    });

    test('only flags a dirty editor — its text stays', () {
      final s = run([Loaded(note('a', 1)), Edit('mine'),
          RemoteUpdated(2, const MeetingPerson(userId: 'u2', displayName: 'Minh'))]);
      expect((s.status, s.draft, s.remoteNewer?.updatedBy?.displayName), (NoteStatus.dirty, 'mine', 'Minh'));
      expect(needsRefetch(s), isFalse);
      expect(noteReducer(s, Loaded(note('theirs', 2))).draft, 'mine');
    });

    test('ignores its own echo and older versions', () {
      final s = run([Loaded(note('a', 3))]);
      expect(identical(noteReducer(s, RemoteUpdated(3)), s), isTrue);
      expect(identical(noteReducer(s, RemoteUpdated(2)), s), isTrue);
    });
  });

  test('a failed save keeps the text and can be retried', () {
    final failed = run([Loaded(note('a', 1)), Edit('ab'), SaveStarted(), SaveFailed(const MeetingNotice(MeetingText.errNetwork))]);
    expect((failed.status, failed.draft, failed.error), (NoteStatus.error, 'ab', const MeetingNotice(MeetingText.errNetwork)));
    expect(canAutosave(failed), isFalse);
    expect(noteReducer(failed, Retry()).status, NoteStatus.dirty);
    final typed = noteReducer(failed, Edit('abc'));
    expect((typed.status, typed.error), (NoteStatus.dirty, null));
  });
}
```

- [ ] **Step 2: Test** — `FT/ui/notes_editor_test.dart` (port `NotesEditor.test.tsx`; `testWidgets` chạy trong FakeAsync ⇒ `tester.pump(Duration(seconds: 2))` đẩy timer autosave)

```dart
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/data/meetings_repository.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';
import 'package:platform_client/features/meetings/ui/widgets/notes_editor.dart';

import 'meeting_test_harness.dart';

class _Api implements MeetingsApi {
  final puts = <(String, int)>[];
  final replies = <Object>[];   // MeetingNote or an error to throw, in order
  @override
  Future<MeetingNote> getNote(String id, NoteScope scope) async =>
      MeetingNote(scope: scope, content: 'base', version: 1);
  @override
  Future<MeetingNote> putNote(String id, NoteScope scope, {required String content, required int version}) async {
    puts.add((content, version));
    final r = replies.isEmpty ? MeetingNote(scope: scope, content: content, version: version + 1) : replies.removeAt(0);
    if (r is MeetingNote) return r;
    throw r;
  }
  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

DioException conflict(MeetingNote latest) {
  final o = RequestOptions(path: '/n');
  return DioException(requestOptions: o, type: DioExceptionType.badResponse, response: Response(requestOptions: o,
      statusCode: 409, data: {'code': 'MEETING_NOTE_CONFLICT', 'latest': {'scope': 'shared', 'content': latest.content,
          'version': latest.version, 'updatedBy': {'userId': 'u2', 'displayName': 'Minh'}}}));
}

void main() {
  late _Api api;
  setUp(() => api = _Api());
  Future<void> pump(WidgetTester t, {bool canEdit = true, void Function(Future<void> Function())? onFlush}) =>
      pumpMeetingWidget(t, NotesEditor(meetingId: 'm1', canEditShared: canEdit, onFlushReady: onFlush),
          overrides: [meetingsRepositoryProvider.overrideWithValue(api)]);
  Finder box() => find.byType(TextField);

  testWidgets('autosaves 2 seconds after typing stops', (tester) async {
    await pump(tester);
    await tester.enterText(box(), 'base!');
    await tester.pump(const Duration(seconds: 1));
    expect(api.puts, isEmpty);
    await tester.pump(const Duration(seconds: 1));
    await tester.pumpAndSettle();
    expect(api.puts, [('base!', 1)]);
    expect(find.text(l10nOf(tester).meetingNotesSaved), findsOneWidget);
  });

  testWidgets('on 409 keeps the typed text, explains, and "keep mine" saves over the newer version', (tester) async {
    api.replies.add(conflict(const MeetingNote(scope: NoteScope.shared, content: 'base theirs', version: 2)));
    await pump(tester);
    await tester.enterText(box(), 'base mine');
    await tester.pump(const Duration(seconds: 2));
    await tester.pumpAndSettle();
    final l = l10nOf(tester);
    expect(find.text(l.meetingNotesConflictTitle), findsOneWidget);
    expect(tester.widget<TextField>(box()).controller!.text, 'base mine');
    await tester.tap(find.text(l.meetingNotesConflictReview));
    await tester.pumpAndSettle();
    await tester.tap(find.text(l.meetingNotesConflictKeepMine));
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 2));
    await tester.pumpAndSettle();
    expect(api.puts.last, ('base mine', 2));
    expect(tester.widget<TextField>(box()).controller!.text, 'base mine');
  });

  testWidgets('is read-only with an explanation when the user may not edit', (tester) async {
    await pump(tester, canEdit: false);
    expect(tester.widget<TextField>(box()).readOnly, isTrue);
    expect(find.text(l10nOf(tester).meetingNotesReadOnly), findsOneWidget);
  });

  testWidgets('hands the room a flush that saves unsaved text right away', (tester) async {
    Future<void> Function()? flush;
    await pump(tester, onFlush: (f) => flush = f);
    await tester.enterText(box(), 'base?');
    expect(flush, isNotNull);
    await tester.runAsync(() => flush!());
    expect(api.puts, [('base?', 1)]);
  });
}
```

- [ ] **Step 3: RED → hiện thực → GREEN** — khoá Task 11 ⇒ `GEN`; `FTEST test/features/meetings && FA`; `wc -l`.
- [ ] **Step 4: Commit** `feat(mobile): meeting notes editor with autosave and conflict handling`

---

### Task 12: Màn chi tiết `/meetings/:id`

**Files:**
- Create: `FM/ui/meeting_detail_screen.dart`, `FM/ui/widgets/detail/{meeting_info_card,meeting_actions_bar,attendance_list,chat_history_view}.dart`
- Modify: `FL/core/router/app_routes.dart` (`/meetings/:id`), ARB khoá Task 12
- Test: `FT/ui/meeting_detail_screen_test.dart`

**`MeetingDetailScreen`** (≤ 220) — mirror `app/(main)/meetings/[id]/page.tsx`: `ref.watch(meetingDetailProvider(id))`: loading ⇒ khung mờ; lỗi 404/`MEETING_NOT_FOUND` ⇒ `meetingErrNotFound` (không nút thử lại); lỗi khác ⇒ `meetingDetailError` + thử lại; có ⇒ `ListView`: tiêu đề (24/600) + `MeetingStatusChip` → `PonCard(MeetingInfoCard + MeetingActionsBar)` → (removed) `meetingRemovedNotice` / (guest không có quyền) `meetingGuestNotice` → `PonCard` hồ sơ: `AttendanceList` (member && (có điểm danh ‖ không SCHEDULED)), `meetingSectionNotes` + `NotesEditor(canEditShared: canEditSharedNoteViewer(viewerRole, settings))`, `ChatHistoryView`. Quyết định hiện hồ sơ y web: `member = canSeeRecords(m)`; guest vẫn **thử** tải chat (người được cho vào từ phòng chờ có quyền); `meetingChatHistoryProvider` lỗi 403 `MEETING_REMOVED` ⇒ removed; 403 khác ⇒ denied ⇒ không hiện hồ sơ. Không render slot "Biên bản AI" (P2 thêm vào chỗ comment `// P2: AI summary slot`). AppBar có nút quay lại `meetingBackToList`.

**`MeetingInfoCard`** (≤ 150) — thời gian (`formatMeetingRange` hoặc `meetingInstantMeeting`), `meetingCreatedAt{time}`, mã phòng (`meetingMeetingCode`, `SelectableText` Geist Mono), mô tả (`SelectableText`), `meetingSectionPeople`: host (`meetingHostedBy`), `meetingCoHosts`, `meetingInvitees` (tối đa 6 avatar + `meetingMoreCount{count}`), phòng ban (tên từ `meetingDepartmentOptionsProvider`, không có ⇒ `meetingDepartmentGeneric`). Tên qua `personName(…, someone)` — không bao giờ `userId`/`removedIds`.

**`MeetingActionsBar`** (≤ 160) — `detailActions(m, canHost: hasCapability(HOST_MEETING))`: `PonButton(meetingJoin)` → `/meet/{code}` · `CopyMeetingLink` · `meetingEdit` → `CreateMeetingSheet(edit)` · `meetingCancelMeeting` → dialog `meetingCancelConfirmTitle/Desc` → `MeetingActions.cancel` → `meetingToastCancelled` · `meetingEndMeeting` → dialog `meetingEndConfirmTitle/Desc` → `end` → `meetingToastEnded` · `meetingMeetAgain` → `CreateMeetingSheet(again)`. Lỗi ⇒ `meetingErrorText`.

**`AttendanceList`** (≤ 90) — `summarizeAttendance(m.attendance, now, endedAt: m.endedAt)`; mỗi dòng avatar + tên + vai trò + `meetingAttendanceDuration{minutes}` + `meetingAttendanceSessions{count}` (khi > 1) + `meetingAttendanceInside`; rỗng ⇒ `meetingAttendanceEmpty`. `now` lấy một lần khi build (không timer).

**`ChatHistoryView`** (≤ 120) — `meetingSectionChat`; `meetingChatHistoryProvider(id)`: rỗng ⇒ `meetingChatHistoryEmpty`; lỗi ⇒ `meetingChatHistoryError` (403 xử lý ở màn cha); mỗi dòng tên (gộp liên tiếp cùng người ≤ 2 phút) + giờ `DateFormat.jm(locale)` + nội dung `SelectableText` thuần; `hasOlder` ⇒ `TextButton(meetingChatLoadOlder)`.

- [ ] **Step 1: Test** — `FT/ui/meeting_detail_screen_test.dart` (port `MeetingDetailPage.test.tsx`; `_Api implements MeetingsApi` trả `get` + `messages` + `getNote` theo kịch bản):
  1. viewer bị mời ra: `messages` ném 403 `MEETING_REMOVED` ⇒ thấy `meetingRemovedNotice`, **không** thấy `meetingSectionNotes`.
  2. guest của cuộc họp LIVE: `messages` ném 403 `MEETING_FORBIDDEN` ⇒ `meetingGuestNotice`.
  3. guest đã dự (messages OK) ⇒ thấy `meetingSectionChat` + `meetingSectionNotes`.
  4. host, SCHEDULED, chưa ai vào ⇒ thấy `meetingJoin`, `meetingEdit`, `meetingCancelMeeting`; `removedIds: ['64b0aaaaaaaaaaaaaaaaaaaa']` + host không tên ⇒ `find.textContaining('64b0')` ⇒ nothing, thấy `meetingSomeone`.
  5. `get` ném 404 ⇒ `meetingErrNotFound`, không có nút thử lại.
- [ ] **Step 2: RED → hiện thực → GREEN** — khoá Task 12 ⇒ `GEN`; `FTEST test/features/meetings && FA`; `wc -l`.
- [ ] **Step 3: Kiểm tay** — chi tiết cuộc họp đã huỷ ⇒ "Đã huỷ", không nút Tham gia; đã kết thúc ⇒ điểm danh có thời lượng, "Họp lại" (host có `HOST_MEETING`) mở sheet điền sẵn, không lịch.
- [ ] **Step 4: Commit** `feat(mobile): meeting detail with attendance, notes and chat history`

**Hết MT6 — kiểm gộp:** `GEN && FA && flutter test && flutter build apk --debug`; tick các mục MT6 của checklist Task 23 trên `dev`.

## MT7 — Trong phòng họp

### Task 13: Mở rộng RTC (tương thích ngược với Cuộc gọi) + dịch vụ trình bày màn hình Android

**Files:**
- Modify: `FL/core/rtc/rtc_session.dart` (thêm, **không đổi** member cũ), `FL/core/rtc/livekit_session.dart`, `android/app/src/main/kotlin/com/platform/platform_client/MainActivity.kt`, `android/app/src/main/AndroidManifest.xml`
- Create: `FL/core/rtc/screen_capture.dart`, `android/app/src/main/kotlin/com/platform/platform_client/ScreenShareService.kt`

**Vì sao không đổi `RtcSession`:** 2 fake `_Session implements RtcSession` trong `test/features/chat/calls/*` sẽ gãy biên dịch nếu thêm member trừu tượng hay đổi chữ ký `connect` — trái ràng buộc "test Cuộc gọi không sửa". ⇒ Interface mới **mở rộng** `RtcSession`; `LiveKitSession` cài cả hai; Cuộc gọi vẫn thấy đúng `RtcSession` cũ.

**Interfaces — Produces** (`rtc_session.dart`, chỉ thêm):

```dart
class RtcPeer {
  RtcPeer({required this.identity, required this.name, this.stream, this.screen, this.avatarUrl});   // 2 tham số mới tuỳ chọn
  …
  /// Screen share (+ its audio) — never mixed into [stream].
  MediaStream? screen;
  /// From participant metadata {"avatarUrl"}; null when none / malformed.
  String? avatarUrl;
}
class LocalMediaState { const LocalMediaState({required this.mic, required this.camera, required this.screen}); final bool mic, camera, screen; … == }
class MeetingConnectOptions {
  const MeetingConnectOptions({required this.video, this.audio = true, this.frontCamera = true, this.preferSpeaker});
  final bool video, audio, frontCamera; final bool? preferSpeaker;   // null ⇒ = video (hành vi Cuộc gọi)
}
class ScreenShareNotice { const ScreenShareNotice({required this.title, required this.body}); final String title, body; }
/// The user dismissed the system capture dialog — not an error to report.
class ScreenShareCancelled implements Exception { const ScreenShareCancelled(); }
abstract class MeetingRtcSession implements RtcSession {
  void Function(LocalMediaState state)? onLocalMediaChanged;          // server mute, share stopped from the system UI
  void Function(String topic, List<int> payload, String? fromIdentity)? onData;
  Future<void> connectMeeting(String url, String token, MeetingConnectOptions options);
  LocalMediaState get localMedia;
  MediaStream? get localScreenStream;
  bool get supportsScreenShare;                                       // Android only (spec §7)
  Future<void> setScreenShare(bool on, {ScreenShareNotice? notice});   // throws ScreenShareCancelled
  void publishData(String topic, List<int> payload, {bool reliable = false});   // best-effort, never throws
  void setPeerVideoEnabled(String identity, bool enabled);            // remembered, re-applied to new publications
}
typedef MeetingRtcSessionFactory = MeetingRtcSession Function();
```

**Hành vi mới `LiveKitSession`** (`class LiveKitSession implements MeetingRtcSession`; constructor thêm tham số tuỳ chọn `ScreenCaptureHost? capture` — `LiveKitSession.new` của Cuộc gọi vẫn chạy):
- `connect(url, token, {required video})` = `connectMeeting(url, token, MeetingConnectOptions(video: video))` ⇒ Cuộc gọi y hệt cũ.
- `connectMeeting`: `setPreferSpeakerOutput(options.preferSpeaker ?? options.video)`; mic chỉ bật khi `options.audio`; camera `setCameraEnabled(true, cameraCaptureOptions: CameraCaptureOptions(cameraPosition: frontCamera ? CameraPosition.front : CameraPosition.back))`.
- **Trạng thái mic/cam của peer từ publication** (QA web P1): `_syncMedia(peer, participant)` ở `_ensure`, `TrackPublishedEvent`, `TrackUnpublishedEvent`, `TrackSubscribedEvent`: `micMuted = pub(microphone) == null || pub.muted`, tương tự camera — người vào với mic tắt hiện đúng mic tắt (Cuộc gọi cũng đúng hơn — báo Trí).
- `TrackSubscribedEvent` với `publication.source ∈ {screenShareVideo, screenShareAudio}` ⇒ `peer.screen = e.track.mediaStream` (không đè `peer.stream`); `TrackUnsubscribedEvent` nguồn share ⇒ `peer.screen = null` khi hết track share.
- `avatarUrl` từ `participant.metadata` (`jsonDecode` trong try, chỉ nhận String khác rỗng).
- `DataReceivedEvent` ⇒ `onData(e.topic ?? '', e.data, e.participant?.identity)`; `publishData` ⇒ `localParticipant.publishData(payload, reliable: reliable, topic: topic)` trong try, `unawaited(...catchError)`.
- `TrackMutedEvent/TrackUnmutedEvent` của `LocalParticipant`, `LocalTrackPublishedEvent`, `LocalTrackUnpublishedEvent` ⇒ `onLocalMediaChanged(localMedia)`; `localMedia` đọc `isMicrophoneEnabled() / isCameraEnabled() / isScreenShareEnabled()` của `localParticipant`.
- `setPeerVideoEnabled(id, on)`: cập nhật set `_videoOff`; `remoteParticipants[id]?.getTrackPublicationBySource(TrackSource.camera)` ⇒ `on ? enable() : disable()` trong try; `TrackPublishedEvent` camera của người trong `_videoOff` ⇒ `disable()` ngay (QA web "ô ẩn vẫn nhận camera").
- `setScreenShare(on)`: `!supportsScreenShare` ⇒ return; bật: `if (!await capture.begin(notice)) throw const ScreenShareCancelled()` rồi `setScreenShareEnabled(true, captureScreenAudio: false)`; lỗi ⇒ `capture.end()` + ném lại; tắt: `setScreenShareEnabled(false)` rồi `capture.end()`; cuối cùng `onLocalMediaChanged`.
- `disconnect()` cũng `capture.end()` + xoá `_videoOff`.

**`screen_capture.dart`:**

```dart
abstract interface class ScreenCaptureHost {
  bool get supported;
  /// Ask the system for capture consent, then start the mediaProjection foreground service. false = user said no.
  Future<bool> begin(ScreenShareNotice notice);
  Future<void> end();
}
class AndroidScreenCapture implements ScreenCaptureHost {
  // supported = Platform.isAndroid
  // begin: if (!await rtc.Helper.requestCapturePermission()) return false;
  //        await _channel.invokeMethod('start', {'title': notice.title, 'body': notice.body}); return true;
  // end:   await _channel.invokeMethod('stop') (lỗi ⇒ bỏ qua)
  static const _channel = MethodChannel('pon/screen_share');
}
class NoScreenCapture implements ScreenCaptureHost { supported = false … }
ScreenCaptureHost platformScreenCapture() => Platform.isAndroid ? AndroidScreenCapture() : NoScreenCapture();
```

**Native Android** (owner quyết định 3 — mặc định **service tự viết**, không plugin):
- `ScreenShareService.kt` (~70 dòng): `Service`; `onStartCommand` tạo kênh `pon_screen_share` (`NotificationManager.IMPORTANCE_LOW`), dựng `Notification.Builder` (icon `R.mipmap.ic_launcher`, tiêu đề/nội dung từ extras — đã dịch ở Dart), `startForeground(42, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)` khi `SDK_INT >= 29`, không thì `startForeground(42, n)`; `ACTION_STOP` ⇒ `stopForeground(STOP_FOREGROUND_REMOVE)` + `stopSelf()`.
- `MainActivity.kt`: `configureFlutterEngine` đăng ký `MethodChannel("pon/screen_share")`: `start` ⇒ `startForegroundService(intent+extras)` (≥ 26), `stop` ⇒ `startService(ACTION_STOP)`.
- Manifest: `<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>`, `FOREGROUND_SERVICE_MEDIA_PROJECTION`, `<service android:name=".ScreenShareService" android:exported="false" android:foregroundServiceType="mediaProjection"/>`.
- Thứ tự bắt buộc của Android 14: đồng ý capture (`requestCapturePermission`) → start service type `mediaProjection` → `setScreenShareEnabled(true)` (LiveKit README).
- (Phương án B nếu owner chọn: `flutter_background` như ví dụ LiveKit — nhưng plugin đó xin `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` lúc `initialize`, là quyền nhạy cảm với chính sách Google Play.)

- [ ] **Step 1: Test hồi quy Cuộc gọi trước** — `FTEST test/features/chat` ⇒ xanh (mốc).
- [ ] **Step 2: Hiện thực** theo trên. `LiveKitSession` ≤ 400 dòng (hiện 209) — nếu vượt, tách `_wire` sang `livekit_session_events.dart` (`part`/extension).
- [ ] **Step 3: GREEN** — `FTEST test/features/chat && FA` (test Cuộc gọi xanh **không sửa**); `flutter build apk --debug` (Kotlin + manifest biên dịch).
- [ ] **Step 4: Kiểm tay nhanh (Android thật)** — gọi 1-1 + nhóm trên `sfu`: âm thanh, video, mic/cam/loa, đổi camera như trước (Review Focus 9). Màn hình chia sẻ thử ở Task 18.
- [ ] **Step 5: Commit** `feat(mobile): meeting RTC extensions and Android screen-share service` — mô tả PR ghi rõ cho Trí: `RtcSession` không đổi; `RtcPeer` +2 trường tuỳ chọn; mic/cam peer giờ đọc từ publication.

---

### Task 14: Logic thuần của phòng — pha, bố cục, reaction, lệnh host, thiết bị

**Files:**
- Create: `FM/domain/room_phase.dart`, `FM/domain/stage_layout.dart`, `FM/domain/reactions.dart`, `FM/domain/room_host.dart`, `FM/domain/device_prefs.dart`
- Test: `FT/domain/{room_phase,stage_layout,reactions,room_host,device_prefs}_test.dart`

**Interfaces — Produces** (mirror web, tên Dart):

```dart
// room_phase.dart
enum RoomPhase { loading, notFound, prejoin, joining, waiting, connecting, inRoom, denied, removed, locked, full,
  unavailable, left, connectionLost, ended, error }
bool isTerminal(RoomPhase p);  bool canRejoin(RoomPhase p);
RoomPhase phaseAfterJoinError(MeetingErrorInfo info);
RoomPhase initialPhase(Meeting? m, MeetingErrorInfo? loadError);
RoomPhase phaseAfterJoin(MeetingJoinResponse r);            // waiting | connecting
/// RoomPhase, or [PhaseRejoin] (call join again now), or null (no change).
sealed class PhaseChange {}  final class PhaseTo extends PhaseChange { final RoomPhase phase; }  final class PhaseRejoin extends PhaseChange {}
PhaseChange? phaseAfterPersonalEvent(RoomPhase phase, MeetingEvent e);
enum RoomClosedNext { connectionLost, verify }
RoomClosedNext phaseAfterRoomClosed(RtcEnd reason);

// stage_layout.dart
enum LayoutMode { grid, spotlight }
enum TileKind { camera, screen }
class StageTile { key, identity, TileKind kind, bool isLocal; … == }
class StageInput { mode, pinnedKey?, localIdentity, remoteIds, screenSharers, activeSpeakerId?, maxTiles }
class StageLayout { StageTile? main; List<StageTile> strip, grid; int overflow; List<String> hiddenIds; }
String cameraKey(String id) => '$id:camera';  String screenKey(String id) => '$id:screen';
StageLayout computeStage(StageInput i);
int gridColumns(int count, {required bool mobile});
const kPhoneMaxTiles = 6, kWideMaxTiles = 25;     // width < 768 dp ⇒ phone (web useIsMobile)

// reactions.dart
const kReactionTopic = 'reaction';
List<int> encodeReaction(String emoji);            // utf8 '{"e":"👍"}'
String? decodeReaction(List<int> payload);         // > 64 byte / JSON lạ / khoá thừa / emoji ngoài 6 ⇒ null
bool Function(DateTime now) createReactionThrottle([Duration interval = const Duration(seconds: 1)]);

// room_host.dart
const kSwitchActions = {HostAction.lock, HostAction.unlock, HostAction.waitingRoomOn, HostAction.waitingRoomOff,
  HostAction.attendeeScreenShareOn, HostAction.attendeeScreenShareOff};
Map<String, Object> hostCommandBody(String meetingId, HostAction a, [String? targetId]);
MeetingNotice mutedNotice(MeetingPerson? actor);
MeetingRoomRole initialRoomRole(Meeting m);
class RoleChange { final MeetingRoomRole role; final MeetingNotice? notice; final bool lostLobby; }
RoleChange? roleChange(List<RosterEntry> roster, String myId, MeetingRoomRole was);

// device_prefs.dart — SharedPreferences key 'pon.meet.devices' (JSON), every access guarded
class DevicePrefs { const DevicePrefs({this.micOn = true, this.camOn = true, this.frontCamera = true, this.speakerOn = true}); … }
DevicePrefs parseDevicePrefs(String? raw);   String encodeDevicePrefs(DevicePrefs p);
Future<DevicePrefs> loadDevicePrefs(SharedPreferences? prefs);  Future<void> saveDevicePrefs(DevicePrefs p, SharedPreferences? prefs);
```

- [ ] **Step 1: Test** — `FT/domain/room_phase_test.dart`

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/rtc/rtc_session.dart';
import 'package:platform_client/features/meetings/domain/meeting_errors.dart';
import 'package:platform_client/features/meetings/domain/meeting_events.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';
import 'package:platform_client/features/meetings/domain/room_phase.dart';

Meeting m(MeetingStatus status) => Meeting(id: 'm1', code: 'abc-defg-hjk', host: const MeetingPerson(userId: 'h'),
    coHosts: const [], invitees: const [], status: status, settings: MeetingSettings.defaults, attendance: const [],
    removedIds: const [], viewerRole: MeetingViewerRole.guest, createdAt: DateTime.utc(2026));
RoomPhase? to(PhaseChange? c) => c is PhaseTo ? c.phase : null;

void main() {
  test('starts on the pre-join screen, or goes to the details of an ended meeting', () {
    expect(initialPhase(null, null), RoomPhase.loading);
    expect(initialPhase(m(MeetingStatus.live), null), RoomPhase.prejoin);
    expect(initialPhase(m(MeetingStatus.scheduled), null), RoomPhase.prejoin);
    expect(initialPhase(m(MeetingStatus.ended), null), RoomPhase.ended);
    expect(initialPhase(null, const MeetingErrorInfo(status: 404, code: 'MEETING_NOT_FOUND')), RoomPhase.notFound);
    expect(initialPhase(null, const MeetingErrorInfo(network: true)), RoomPhase.error);
  });

  test('follows the join response', () {
    expect(phaseAfterJoin(const MeetingWaiting()), RoomPhase.waiting);
    expect(phaseAfterJoin(const MeetingJoined(url: 'wss://x', token: 't', role: MeetingRoomRole.attendee)),
        RoomPhase.connecting);
  });

  const errors = <(MeetingErrorInfo, RoomPhase)>[
    (MeetingErrorInfo(status: 403, code: 'MEETING_REMOVED'), RoomPhase.removed),
    (MeetingErrorInfo(status: 403, code: 'MEETING_LOCKED'), RoomPhase.locked),
    (MeetingErrorInfo(status: 409, code: 'MEETING_ENDED'), RoomPhase.ended),
    (MeetingErrorInfo(status: 409, code: 'MEETING_FULL'), RoomPhase.full),
    (MeetingErrorInfo(status: 503, code: 'MEETINGS_UNAVAILABLE'), RoomPhase.unavailable),
    (MeetingErrorInfo(status: 503), RoomPhase.unavailable),
    (MeetingErrorInfo(status: 404, code: 'MEETING_NOT_FOUND'), RoomPhase.notFound),
    (MeetingErrorInfo(network: true), RoomPhase.error),
  ];
  for (final (info, phase) in errors) {
    test('join error ${info.code ?? info.status} → $phase', () => expect(phaseAfterJoinError(info), phase));
  }

  test('reacts to the waiting room answers only while waiting', () {
    expect(phaseAfterPersonalEvent(RoomPhase.waiting, const AdmittedEvent(meetingId: 'm1')), isA<PhaseRejoin>());
    expect(phaseAfterPersonalEvent(RoomPhase.inRoom, const AdmittedEvent(meetingId: 'm1')), isNull);
    expect(to(phaseAfterPersonalEvent(RoomPhase.waiting, const DeniedEvent(meetingId: 'm1'))), RoomPhase.denied);
    expect(phaseAfterPersonalEvent(RoomPhase.prejoin, const DeniedEvent(meetingId: 'm1')), isNull);
  });

  test('removal and the end win over any live phase, never over a terminal one', () {
    for (final p in [RoomPhase.joining, RoomPhase.waiting, RoomPhase.connecting, RoomPhase.inRoom]) {
      expect(to(phaseAfterPersonalEvent(p, const RemovedEvent(meetingId: 'm1'))), RoomPhase.removed);
    }
    expect(to(phaseAfterPersonalEvent(RoomPhase.prejoin, const EndedEvent(meetingId: 'm1'))), RoomPhase.ended);
    expect(to(phaseAfterPersonalEvent(RoomPhase.waiting, const CancelledEvent(meetingId: 'm1'))), RoomPhase.ended);
    expect(phaseAfterPersonalEvent(RoomPhase.removed, const EndedEvent(meetingId: 'm1')), isNull);
    expect(phaseAfterPersonalEvent(RoomPhase.inRoom, const MutedEvent(meetingId: 'm1')), isNull);
  });

  test('tells a dropped connection from a closed room', () {
    expect(phaseAfterRoomClosed(RtcEnd.failed), RoomClosedNext.connectionLost);
    expect(phaseAfterRoomClosed(RtcEnd.ended), RoomClosedNext.verify);
  });

  test('knows which screens offer a way back in', () {
    expect(isTerminal(RoomPhase.removed), isTrue);
    expect(isTerminal(RoomPhase.left), isFalse);
    expect(canRejoin(RoomPhase.left), isTrue);
    expect(canRejoin(RoomPhase.connectionLost), isTrue);
    expect(canRejoin(RoomPhase.removed), isFalse);
    expect(canRejoin(RoomPhase.denied), isFalse);
  });
}
```

(`MeetingErrorInfo` có `const` constructor.)

- [ ] **Step 2: Test** — `FT/domain/stage_layout_test.dart` (port `stage-layout.test.ts`)

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/stage_layout.dart';

const base = StageInput(mode: LayoutMode.grid, pinnedKey: null, localIdentity: 'me', remoteIds: ['a', 'b'],
    screenSharers: [], activeSpeakerId: null, maxTiles: 25);
List<String> keys(List<StageTile> t) => t.map((x) => x.key).toList();

void main() {
  test('grid: me first, then people in join order', () {
    final s = computeStage(base);
    expect(s.main, isNull);
    expect(keys(s.grid), ['me:camera', 'a:camera', 'b:camera']);
    expect(s.overflow, 0);
    expect(s.hiddenIds, isEmpty);
    expect(s.strip, isEmpty);
  });

  test('a pinned tile takes the stage; a pin on someone who left is ignored', () {
    final s = computeStage(base.copyWith(pinnedKey: 'b:camera'));
    expect(s.main?.key, 'b:camera');
    expect(keys(s.strip), ['me:camera', 'a:camera']);
    expect(s.grid, isEmpty);
    expect(computeStage(base.copyWith(pinnedKey: 'gone:camera')).main, isNull);
  });

  test('a remote screen share always takes the stage, cameras go to the strip', () {
    final s = computeStage(base.copyWith(screenSharers: ['a']));
    expect((s.main?.key, s.main?.kind, s.main?.isLocal), ('a:screen', TileKind.screen, false));
    expect(keys(s.strip), ['me:camera', 'a:camera', 'b:camera']);
  });

  test('a pin beats a share; my own share is staged only when nobody else shares', () {
    expect(computeStage(base.copyWith(screenSharers: ['a'], pinnedKey: 'b:camera')).main?.key, 'b:camera');
    expect(computeStage(base.copyWith(screenSharers: ['me'])).main?.isLocal, isTrue);
    final both = computeStage(base.copyWith(screenSharers: ['me', 'b']));
    expect(both.main?.key, 'b:screen');
    expect(keys(both.strip), contains('me:screen'));
  });

  test('spotlight follows the active speaker, then the first person, then me', () {
    final sp = base.copyWith(mode: LayoutMode.spotlight);
    expect(computeStage(sp.copyWith(activeSpeakerId: 'b')).main?.key, 'b:camera');
    expect(computeStage(sp).main?.key, 'a:camera');
    expect(computeStage(sp.copyWith(remoteIds: [])).main?.key, 'me:camera');
    expect(computeStage(sp.copyWith(activeSpeakerId: 'me')).main?.key, 'a:camera');
  });

  test('overflows past capacity and keeps the active speaker visible', () {
    final many = base.copyWith(remoteIds: ['a', 'b', 'c', 'd', 'e'], maxTiles: 4);
    final s = computeStage(many);
    expect(keys(s.grid), ['me:camera', 'a:camera', 'b:camera']);
    expect(s.overflow, 3);
    expect(s.hiddenIds, ['c', 'd', 'e']);
    final talking = computeStage(many.copyWith(activeSpeakerId: 'e'));
    expect(keys(talking.grid), ['me:camera', 'a:camera', 'e:camera']);
    expect(talking.hiddenIds, ['b', 'c', 'd']);
  });

  test('grid columns', () {
    expect([1, 2, 3, 6].map((n) => gridColumns(n, mobile: true)), [1, 1, 2, 2]);
    expect([1, 2, 4, 5, 9, 10, 16, 17, 25].map((n) => gridColumns(n, mobile: false)), [1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });
}
```

(`StageInput.copyWith` với `pinnedKey`/`activeSpeakerId` có thể đặt về null bằng tham số sentinel — chỉ test dùng.)

- [ ] **Step 3: Test** — `FT/domain/reactions_test.dart`, `room_host_test.dart`, `device_prefs_test.dart`

```dart
// reactions_test.dart
import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/reactions.dart';

void main() {
  test('round-trips the six allowed emoji in the exact envelope', () {
    for (final e in ['👍', '❤️', '😂', '😮', '👏', '🎉']) {
      expect(decodeReaction(encodeReaction(e)), e);
    }
    expect(utf8.decode(encodeReaction('👍')), '{"e":"👍"}');
  });
  test('drops anything else a peer could send', () {
    List<int> enc(String s) => utf8.encode(s);
    expect(decodeReaction(enc('{"e":"💩"}')), isNull);
    expect(decodeReaction(enc('{"e":"<img src=x>"}')), isNull);
    expect(decodeReaction(enc('not json')), isNull);
    expect(decodeReaction(enc('{"e":"👍","pad":"${'x' * 200}"}')), isNull);
    expect(decodeReaction(enc('{"e":"👍","x":1}')), isNull);
  });
  test('allows at most one reaction per second', () {
    final allow = createReactionThrottle();
    final t0 = DateTime.utc(2026);
    expect(allow(t0.add(const Duration(milliseconds: 1000))), isTrue);
    expect(allow(t0.add(const Duration(milliseconds: 1500))), isFalse);
    expect(allow(t0.add(const Duration(milliseconds: 1999))), isFalse);
    expect(allow(t0.add(const Duration(milliseconds: 2000))), isTrue);
  });
}
```

```dart
// room_host_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_text.dart';
import 'package:platform_client/features/meetings/domain/room_host.dart';

RosterEntry r(String id, MeetingRoomRole role) => RosterEntry(userId: id, role: role, joinedAt: DateTime.utc(2026));

void main() {
  test('targetId only for person actions', () {
    expect(hostCommandBody('m1', HostAction.muteMic, 'u2'), {'meetingId': 'm1', 'action': 'MUTE_MIC', 'targetId': 'u2'});
    expect(hostCommandBody('m1', HostAction.lock, 'ignored'), {'meetingId': 'm1', 'action': 'LOCK'});
  });
  test('muted notice never shows an id', () {
    expect(mutedNotice(const MeetingPerson(userId: 'h', displayName: 'Lan')),
        const MeetingNotice(MeetingText.mutedBy, {'name': 'Lan'}));
    expect(mutedNotice(const MeetingPerson(userId: '64b0aaaaaaaaaaaaaaaaaaaa')), const MeetingNotice(MeetingText.mutedByUnknown));
    expect(mutedNotice(null), const MeetingNotice(MeetingText.mutedByUnknown));
  });
  test('role changes from the roster', () {
    expect(roleChange([r('me', MeetingRoomRole.cohost)], 'me', MeetingRoomRole.attendee)!.notice,
        const MeetingNotice(MeetingText.madeCohost));
    final demoted = roleChange([r('me', MeetingRoomRole.attendee)], 'me', MeetingRoomRole.cohost)!;
    expect((demoted.role, demoted.notice, demoted.lostLobby),
        (MeetingRoomRole.attendee, const MeetingNotice(MeetingText.revokedCohost), true));
    expect(roleChange([r('me', MeetingRoomRole.host)], 'me', MeetingRoomRole.host), isNull);
    expect(roleChange([r('other', MeetingRoomRole.host)], 'me', MeetingRoomRole.attendee), isNull);
  });
}
```

```dart
// device_prefs_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/device_prefs.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('tolerates missing or broken data', () {
    expect(parseDevicePrefs(null), const DevicePrefs());
    expect(parseDevicePrefs('not json'), const DevicePrefs());
    expect(parseDevicePrefs('{"micOn":"yes","camOn":false}'), const DevicePrefs(camOn: false));
  });
  test('round-trips through SharedPreferences', () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    const p = DevicePrefs(micOn: false, camOn: true, frontCamera: false, speakerOn: false);
    await saveDevicePrefs(p, prefs);
    expect(await loadDevicePrefs(prefs), p);
    expect(await loadDevicePrefs(null), const DevicePrefs());
  });
}
```

- [ ] **Step 4: RED → hiện thực → GREEN** — `FTEST test/features/meetings/domain && FA`
- [ ] **Step 5: Commit** `feat(mobile): pure meeting-room logic (phases, stage, reactions, host, devices)`

---

### Task 15: Trạng thái phòng + `MeetingRoomController`

**Files:**
- Create: `FM/state/meeting_room_state.dart`, `FM/state/meeting_room_deps.dart`, `FM/state/room_session_wiring.dart`, `FM/state/room_sync.dart`, `FM/state/meeting_room_chat.dart`, `FM/state/meeting_room_controller.dart`, `FM/domain/room_events.dart` (`active_room.dart` đã có từ Task 7)
- Test: `FT/state/fake_room_session.dart`, `FT/state/fake_meetings_api.dart`, `FT/state/meeting_room_controller_test.dart`, `FT/state/meeting_room_controller_sync_test.dart`, `FT/domain/room_events_test.dart`

**Interfaces — Produces:**

```dart
// meeting_room_state.dart — mirror meeting.store.ts + room data (roster/hands/lobby/chat)
enum RoomPanel { people, chat, notes }
class PendingChat { const PendingChat({required this.clientId, required this.content, required this.sentAt, this.error});
  final String clientId, content; final DateTime sentAt; final MeetingNotice? error; … copyWith, == }
class FloatingReaction { const FloatingReaction({required this.id, required this.emoji, this.name, required this.mine}); … }
/// Immutable snapshot of an RtcPeer (the session mutates its peers in place).
class MeetingPeer { identity, name, MediaStream? stream, MediaStream? screen, speaking, micMuted, camMuted, poorConnection, avatarUrl;
  factory MeetingPeer.of(RtcPeer p); }
class MeetingRoomState {
  const MeetingRoomState({this.phase = RoomPhase.loading, this.myRole = MeetingRoomRole.attendee,
      this.settings = MeetingSettings.defaults, this.mic = false, this.camera = false, this.screen = false,
      this.frontCamera = true, this.speakerOn = true, this.reconnecting = false, this.poorConnection = false,
      this.peers = const [], this.localStream, this.localScreen, this.activeSpeakerId, this.layout = LayoutMode.grid,
      this.pinnedKey, this.panel, this.unreadChat = 0, this.pendingChat = const [], this.pendingHost = const {},
      this.reactions = const [], this.roster = const [], this.hands = const [], this.lobby = const [],
      this.chat = const ChatHistory(), this.sharedNoteRemote, this.sharedNoteResync = 0});
  … // + copyWith có sentinel để đặt null (activeSpeakerId, pinnedKey, panel, localScreen, sharedNoteRemote)
  static const initial = MeetingRoomState();
}
abstract interface class RoomStore {
  MeetingRoomState get value;
  void update(MeetingRoomState Function(MeetingRoomState s) fn);
  void reset();
}
class MemoryRoomStore implements RoomStore { MeetingRoomState value = MeetingRoomState.initial; … }

// meeting_room_deps.dart
enum NoticeLevel { info, error }
class JoinMedia { const JoinMedia({required this.mic, required this.camera, this.frontCamera = true}); … copyWith }
abstract interface class MeetingRealtime {
  bool get isConnected;
  void publish(String destination, Map<String, Object?> body);   // StompService.sendRawMessage(jsonEncode)
  void subscribeTopic(String meetingId);
  void unsubscribeTopic(String meetingId);
}
class MeetingRoomDeps {
  const MeetingRoomDeps({required this.api, required this.cache, required this.realtime, required this.createSession,
      required this.now, required this.newClientId, required this.notify, this.screenShareNotice});
  final MeetingsApi api; final MeetingsCacheSink cache; final MeetingRealtime realtime;
  final MeetingRtcSessionFactory createSession; final DateTime Function() now; final String Function() newClientId;
  final void Function(NoticeLevel level, MeetingNotice notice) notify;
  final ScreenShareNotice Function()? screenShareNotice;   // localized foreground-service texts (UI provides)
}
String newMeetingClientId([Random? random]);              // 'c-' + 12 base62 from Random.secure()

// domain/room_events.dart — pure part of a topic event (data only)
MeetingRoomState applyTopicEvent(MeetingRoomState s, MeetingEvent e, {required String meetingId});
  // roster ⇒ roster; hands ⇒ hands; settings ⇒ settings; chat ⇒ chat.append(message); khác / sai meetingId ⇒ s

// meeting_room_controller.dart — mirror meeting-room-controller.ts
class MeetingRoomController implements ActiveMeetingRoom {
  MeetingRoomController({required Meeting meeting, required String myId, required MeetingRoomDeps deps, required RoomStore store});
  @override String get meetingId;
  void activate();  void dispose();
  Future<void> join(JoinMedia media);  Future<void> rejoin();  Future<void> cancelWaiting();
  void leaveLobbyOnExit();                                   // app detached while waiting (best-effort DELETE)
  void registerNotesFlush(Future<void> Function()? flush);
  void leave();  Future<void> endForAll();
  Future<void> toggleMic();  Future<void> toggleCamera();  Future<void> toggleScreenShare();
  Future<void> switchCamera();  Future<void> setSpeaker(bool on);
  void setPeerVideoEnabled(String identity, bool enabled);
  void setHand(bool raised);  String? sendChat(String content);  void retryChat(String clientId);  void discardChat(String clientId);
  bool sendReaction(String emoji);  void hostCommand(HostAction action, [String? targetId]);
  Future<void> admit(String userId);  Future<void> deny(String userId);
  Future<void> loadOlderChat();
  void setPanel(RoomPanel? panel);  void setLayout(LayoutMode mode);  void togglePin(String key);
  @override void handle(MeetingEvent e);                     // personal queue (lobby/admitted/denied/removed/muted/error/ended/cancelled/chat)
  void onTopicEvent(MeetingEvent e);                         // /topic/meeting/{id}
  void onRoster(List<RosterEntry> r); void onSettings(MeetingSettings s); void onChat(ChatEvent e);
  void onSharedNoteUpdated(int version, MeetingPerson? by); void onEnded();
  Future<void> onRealtimeReconnected();
  Future<void> onAppPaused();  Future<void> onAppResumed();   // camera off in background, back on return
}
```

Hành vi = file web cùng tên (đọc song song), cộng các điểm Flutter:
- **Epoch** (`_epoch`) tăng ở mỗi join/leave/dispose — câu trả lời muộn của lượt cũ bị bỏ (test "late join answer").
- `_media` (`JoinMedia`) = lựa chọn màn chờ, rồi **mọi** toggle thành công + server mute ⇒ `rejoin()` giữ đúng mic/cam đang dùng (QA web P2-4); toggle lỗi và `onLocalMediaChanged` lúc LiveKit tháo track khi rớt **không** đổi `_media`.
- `connect` lỗi `MediaAccessException` ⇒ `mediaFailed` + vào lại **không** mic/cam; `RoomConnectException`/khác ⇒ `connectionLost`.
- Sau khi `inRoom`: **mồi phòng** `_seedRoom(run)` (subscribe topic đã làm ở Task 16 lúc `connecting` — "subscribe trước, đọc sau"): `api.get` ⇒ `roster = rosterFromMeeting`, `settings`, `onRoster` (vai trò hiện tại); `api.hands`; manager ⇒ `api.lobby`; `api.messages` trang mới nhất ⇒ `chat`. Mỗi lời gọi lỗi riêng ⇒ bỏ qua (sự kiện topic sẽ tới).
- `onRealtimeReconnected`: `waiting` ⇒ `join` lại **im lặng** (lỗi mạng/unavailable không thay màn chờ); `connecting|inRoom` ⇒ đọc lại meeting (ENDED ⇒ đóng; có ⇒ `onRoster` + `onSettings` + cache), `hands`, trang chat mới nhất (gộp, dedupe), `sharedNoteResync++` (ghi chú chung tự GET lại nếu sạch), manager ⇒ `lobby` — **không bao giờ** `join` lại khi đang trong phòng (QA web P2-2).
- `handle(ChatEvent)` (tiếng vọng cá nhân của lần gửi lại) ⇒ gộp vào `chat` + settle pending, **không** tăng `unreadChat` (QA web P3-2). `retryChat` dùng **cùng** `clientId`.
- `onAppPaused` (chỉ khi `inRoom`): camera đang bật ⇒ `session.setCamera(false)`, nhớ `_cameraPausedByApp = true` (không đổi `_media`); `onAppResumed`: nếu `_cameraPausedByApp` ⇒ bật lại. Mic giữ nguyên (họp tiếp khi khoá màn hình — cần `UIBackgroundModes audio` trên iOS, owner quyết định 4).
- `toggleScreenShare` truyền `deps.screenShareNotice?.call()`; `ScreenShareCancelled` ⇒ im lặng; lỗi khác ⇒ `shareFailed`.
- `setPanel(RoomPanel.chat)` ⇒ `unreadChat = 0` (store web `setPanel`).
- `dispose()` **idempotent** (test `tearDown` gọi lại sau khi test đã dispose; màn hình có thể dispose hai lần khi route bị thay).

- [ ] **Step 1: Fakes** — `FT/state/fake_room_session.dart`, `FT/state/fake_meetings_api.dart`

```dart
// fake_room_session.dart
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:platform_client/core/rtc/rtc_session.dart';

class FakeRoomSession implements MeetingRtcSession {
  @override void Function(MediaStream stream)? onLocalStream;
  @override void Function(List<RtcPeer> peers)? onPeersChanged;
  @override void Function(bool reconnecting)? onReconnecting;
  @override void Function(bool poor)? onLocalPoorConnection;
  @override void Function(RtcEnd reason)? onDisconnected;
  @override void Function(LocalMediaState state)? onLocalMediaChanged;
  @override void Function(String topic, List<int> payload, String? fromIdentity)? onData;

  final connects = <(String url, String token, MeetingConnectOptions options)>[];
  final connectErrors = <Object>[];
  final micCalls = <bool>[], cameraCalls = <bool>[], shareCalls = <bool>[];
  final sent = <(String topic, List<int> payload, bool reliable)>[];
  final videoEnabled = <(String, bool)>[];
  int disconnects = 0;
  Object? micError, shareError;
  LocalMediaState media = const LocalMediaState(mic: true, camera: false, screen: false);

  @override
  Future<void> connectMeeting(String url, String token, MeetingConnectOptions options) async {
    connects.add((url, token, options));
    if (connectErrors.isNotEmpty) throw connectErrors.removeAt(0);
  }
  @override
  Future<void> connect(String url, String token, {required bool video}) =>
      connectMeeting(url, token, MeetingConnectOptions(video: video));
  @override
  Future<void> setMic(bool on) async {
    micCalls.add(on);
    final e = micError;
    micError = null;
    if (e != null) throw e;
  }
  @override
  Future<void> setCamera(bool on) async => cameraCalls.add(on);
  @override
  Future<void> setScreenShare(bool on, {ScreenShareNotice? notice}) async {
    shareCalls.add(on);
    final e = shareError;
    shareError = null;
    if (e != null) throw e;
  }
  @override
  void publishData(String topic, List<int> payload, {bool reliable = false}) => sent.add((topic, payload, reliable));
  @override
  void setPeerVideoEnabled(String identity, bool enabled) => videoEnabled.add((identity, enabled));
  @override
  Future<void> disconnect() async => disconnects++;
  @override Future<void> switchCamera() async {}
  @override Future<void> setSpeaker(bool on) async {}
  @override RtcPeer? peer(String identity) => null;
  @override List<RtcPeer> get peers => const [];
  @override MediaStream? get localStream => null;
  @override MediaStream? get localScreenStream => null;
  @override LocalMediaState get localMedia => media;
  @override bool get supportsScreenShare => true;
}
```

```dart
// fake_meetings_api.dart
import 'dart:async';
import 'package:dio/dio.dart';
import 'package:platform_client/features/meetings/data/meetings_repository.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';

DioException httpError(int status, String code) {
  final o = RequestOptions(path: '/x');
  return DioException(requestOptions: o, type: DioExceptionType.badResponse,
      response: Response(requestOptions: o, statusCode: status, data: {'code': code, 'statusCode': status}));
}

class FakeMeetingsApi implements MeetingsApi {
  FakeMeetingsApi(this.base);
  Meeting base;
  /// Queued join answers: MeetingJoinResponse | Future<MeetingJoinResponse> | an error to throw.
  final joins = <Object>[];
  final gets = <Object>[];          // Meeting | error; empty ⇒ [base]
  final lobbies = <List<LobbyEntry>>[];
  List<MeetingHand> handsAnswer = const [];
  MeetingMessagePage messagesAnswer = const MeetingMessagePage(content: [], hasNext: false);
  int joinCalls = 0, getCalls = 0, lobbyCalls = 0, leaveLobbyCalls = 0, endCalls = 0;
  final admitted = <String>[], denied = <String>[];

  @override
  Future<MeetingJoinResponse> join(String id) async {
    joinCalls++;
    final a = joins.removeAt(0);
    if (a is Future<MeetingJoinResponse>) return a;
    if (a is MeetingJoinResponse) return a;
    throw a;
  }
  @override
  Future<Meeting> get(String id) async {
    getCalls++;
    if (gets.isEmpty) return base;
    final a = gets.removeAt(0);
    if (a is Meeting) return a;
    throw a;
  }
  @override
  Future<List<LobbyEntry>> lobby(String id) async {
    lobbyCalls++;
    return lobbies.isEmpty ? const [] : lobbies.removeAt(0);
  }
  @override
  Future<void> leaveLobby(String id) async => leaveLobbyCalls++;
  @override
  Future<void> end(String id) async => endCalls++;
  @override
  Future<void> admit(String id, String userId) async => admitted.add(userId);
  @override
  Future<void> deny(String id, String userId) async => denied.add(userId);
  @override
  Future<List<MeetingHand>> hands(String id) async => handsAnswer;
  @override
  Future<MeetingMessagePage> messages(String id, {String? before, int size = 50}) async => messagesAnswer;
  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}
```

- [ ] **Step 2: Test** — `FT/state/meeting_room_controller_test.dart` (port 1-1 `meeting-room-controller.test.ts` + mồi phòng + vòng đời app)

```dart
import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/rtc/rtc_session.dart';
import 'package:platform_client/features/meetings/domain/meeting_events.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_text.dart';
import 'package:platform_client/features/meetings/domain/reactions.dart';
import 'package:platform_client/features/meetings/domain/room_phase.dart';
import 'package:platform_client/features/meetings/state/active_room.dart';
import 'package:platform_client/features/meetings/state/meeting_room_controller.dart';
import 'package:platform_client/features/meetings/state/meeting_room_deps.dart';
import 'package:platform_client/features/meetings/state/meeting_room_state.dart';
import 'package:platform_client/features/meetings/state/meetings_store.dart';

import 'fake_meetings_api.dart';
import 'fake_room_session.dart';

const defaults = MeetingSettings.defaults;
final meeting = Meeting(id: 'm1', code: 'abc-defg-hjk', host: const MeetingPerson(userId: 'h'), coHosts: const [],
    invitees: const [], status: MeetingStatus.live, settings: defaults, attendance: const [], removedIds: const [],
    viewerRole: MeetingViewerRole.invited, createdAt: DateTime.utc(2026, 10, 8));
MeetingJoined joined([MeetingRoomRole role = MeetingRoomRole.attendee, String token = 'tok']) =>
    MeetingJoined(url: 'wss://rtc', token: token, role: role);

class FakeRealtime implements MeetingRealtime {
  bool connected = true;
  final sent = <(String, Map<String, Object?>)>[];
  @override bool get isConnected => connected;
  @override void publish(String d, Map<String, Object?> body) => sent.add((d, body));
  @override void subscribeTopic(String id) {}
  @override void unsubscribeTopic(String id) {}
}

Future<void> settle() async {
  for (var i = 0; i < 20; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

late FakeRoomSession session;
late FakeMeetingsApi api;
late FakeRealtime rt;
late MemoryRoomStore store;
late MemoryMeetingsCache cache;
late List<(NoticeLevel, MeetingNotice)> notices;
late DateTime clock;
late MeetingRoomController c;
MeetingRoomState get s => store.value;

Future<void> inRoom([MeetingRoomRole role = MeetingRoomRole.attendee]) async {
  api.joins.add(joined(role));
  await c.join(const JoinMedia(mic: true, camera: true));
}

void main() {
  setUp(() {
    session = FakeRoomSession();
    api = FakeMeetingsApi(meeting);
    rt = FakeRealtime();
    store = MemoryRoomStore();
    cache = MemoryMeetingsCache();
    notices = [];
    clock = DateTime.utc(2026, 10, 8, 0, 0, 10);
    c = MeetingRoomController(meeting: meeting, myId: 'me', store: store, deps: MeetingRoomDeps(
      api: api, cache: cache, realtime: rt, createSession: () => session, now: () => clock,
      newClientId: () => 'c-abc', notify: (level, n) => notices.add((level, n)),
    ));
    c.activate();
  });
  tearDown(() => c.dispose());

  group('joining', () {
    test('goes straight in with the chosen media', () async {
      api.joins.add(joined(MeetingRoomRole.cohost));
      await c.join(const JoinMedia(mic: false, camera: true, frontCamera: false));
      final o = session.connects.single.$3;
      expect((o.video, o.audio, o.frontCamera), (true, false, false));
      expect((s.phase, s.myRole, s.mic, s.camera), (RoomPhase.inRoom, MeetingRoomRole.cohost, false, true));
      expect(activeMeetingRoom()?.meetingId, 'm1');
    });

    test('waits in the lobby, then enters on its own when admitted', () async {
      api.joins.addAll([const MeetingWaiting(), joined(MeetingRoomRole.attendee, 't2')]);
      await c.join(const JoinMedia(mic: true, camera: false));
      expect(s.phase, RoomPhase.waiting);
      expect(session.connects, isEmpty);
      c.handle(const AdmittedEvent(meetingId: 'm1'));
      await settle();
      expect(s.phase, RoomPhase.inRoom);
      expect(api.joinCalls, 2);
      expect((session.connects.single.$2, session.connects.single.$3.video, session.connects.single.$3.audio), ('t2', false, true));
    });

    test('shows the denial, and leaving the lobby tells the server', () async {
      api.joins.add(const MeetingWaiting());
      await c.join(const JoinMedia(mic: true, camera: true));
      await c.cancelWaiting();
      expect(api.leaveLobbyCalls, 1);
      expect(s.phase, RoomPhase.prejoin);
      api.joins.add(const MeetingWaiting());
      await c.join(const JoinMedia(mic: true, camera: true));
      c.handle(const DeniedEvent(meetingId: 'm1'));
      expect(s.phase, RoomPhase.denied);
    });

    for (final (status, code, phase) in [
      (403, 'MEETING_REMOVED', RoomPhase.removed), (403, 'MEETING_LOCKED', RoomPhase.locked),
      (409, 'MEETING_ENDED', RoomPhase.ended), (409, 'MEETING_FULL', RoomPhase.full),
      (503, 'MEETINGS_UNAVAILABLE', RoomPhase.unavailable),
    ]) {
      test('a $status $code join ends on the $phase screen', () async {
        api.joins.add(httpError(status, code));
        await c.join(const JoinMedia(mic: true, camera: true));
        expect(s.phase, phase);
        expect(session.connects, isEmpty);
      });
    }

    test('seeds roster, hands, chat and — for managers — the lobby after entering', () async {
      api.base = Meeting.fromJson({...{'id': 'm1', 'code': 'abc-defg-hjk', 'host': {'userId': 'h'}, 'status': 'LIVE',
        'viewerRole': 'host', 'createdAt': '2026-10-08T00:00:00Z', 'settings': defaults.toJson()},
        'attendance': [{'userId': 'me', 'displayName': 'Me', 'role': 'host', 'joinedAt': '2026-10-08T00:01:00Z'}]})!;
      api.handsAnswer = [MeetingHand(userId: 'a', raisedAt: DateTime.utc(2026))];
      api.lobbies.add(const [LobbyEntry(userId: 'g', displayName: 'Guest')]);
      await inRoom(MeetingRoomRole.host);
      await settle();
      expect(s.roster.single.userId, 'me');
      expect(s.hands.single.userId, 'a');
      expect(s.lobby.single.displayName, 'Guest');
      expect(api.lobbyCalls, 1);
    });
  });

  group('being removed, muted, or the meeting ending', () {
    test('a removal drops the media and the unsent chat', () async {
      await inRoom();
      c.sendChat('bye');
      c.handle(const RemovedEvent(meetingId: 'm1'));
      expect(session.disconnects, 1);
      expect(s.phase, RoomPhase.removed);
      expect(s.pendingChat, isEmpty);
    });

    test('tells me who muted me, never their id', () async {
      await inRoom();
      c.handle(const MutedEvent(meetingId: 'm1', actor: MeetingPerson(userId: 'h', displayName: 'Lan')));
      expect(s.mic, isFalse);
      expect(notices.last, (NoticeLevel.info, const MeetingNotice(MeetingText.mutedBy, {'name': 'Lan'})));
      c.handle(const MutedEvent(meetingId: 'm1', actor: MeetingPerson(userId: '64b0aaaaaaaaaaaaaaaaaaaa')));
      expect(notices.last, (NoticeLevel.info, const MeetingNotice(MeetingText.mutedByUnknown)));
    });

    test('the end of the meeting closes the room; ending for everyone calls the server', () async {
      await inRoom();
      c.onEnded();
      expect((session.disconnects, s.phase), (1, RoomPhase.ended));
      await inRoom(MeetingRoomRole.host);
      await c.endForAll();
      expect((api.endCalls, s.phase), (1, RoomPhase.ended));
      expect(cache.cache.byId['m1']?.status, MeetingStatus.ended);
    });
  });

  group('chat', () {
    test('sends a trimmed line with a client id and clears it on the echo', () async {
      await inRoom();
      expect(c.sendChat('  hello  '), 'c-abc');
      expect(rt.sent.last.$1, '/app/meet.chat');
      expect(rt.sent.last.$2, {'meetingId': 'm1', 'content': 'hello', 'clientId': 'c-abc'});
      expect(s.pendingChat.single, PendingChat(clientId: 'c-abc', content: 'hello', sentAt: clock));
      c.onTopicEvent(ChatEvent(meetingId: 'm1', clientId: 'c-abc', message: MeetingChatMessage(id: 'x',
          sender: const MeetingPerson(userId: 'me'), content: 'hello', createdAt: clock)));
      expect(s.pendingChat, isEmpty);
      expect(s.chat.lines.single.id, 'x');
      expect(s.unreadChat, 0);
    });

    test('marks a refused line and lets me retry (same clientId) or discard it', () async {
      await inRoom();
      c.sendChat('spam');
      c.handle(const MeetErrorEvent(meetingId: 'm1', clientId: 'c-abc', errorCode: 'RATE_LIMITED'));
      expect(s.pendingChat.single.error, const MeetingNotice(MeetingText.errRateLimited));
      c.retryChat('c-abc');
      expect(rt.sent.where((x) => x.$1 == '/app/meet.chat'), hasLength(2));
      expect(rt.sent.last.$2['clientId'], 'c-abc');
      expect(s.pendingChat.single.error, isNull);
      c.discardChat('c-abc');
      expect(s.pendingChat, isEmpty);
    });

    test('refuses empty, too long, offline or not-in-room lines', () async {
      expect(c.sendChat('hi'), isNull);
      await inRoom();
      expect(c.sendChat('   '), isNull);
      expect(c.sendChat('x' * 2001), isNull);
      rt.connected = false;
      expect(c.sendChat('hi'), isNull);
      expect(rt.sent.where((x) => x.$1 == '/app/meet.chat'), isEmpty);
    });

    test('counts unread lines from others while the chat panel is closed', () async {
      await inRoom();
      ChatEvent line(String sender) => ChatEvent(meetingId: 'm1', message: MeetingChatMessage(id: sender,
          sender: MeetingPerson(userId: sender), content: 'x', createdAt: clock));
      c.onTopicEvent(line('bob'));
      c.onTopicEvent(line('me'));
      expect(s.unreadChat, 1);
      c.setPanel(RoomPanel.chat);
      expect(s.unreadChat, 0);
      c.onTopicEvent(line('ann'));
      expect(s.unreadChat, 0);
    });
  });

  group('host commands', () {
    test('sends targetId only for person actions and tracks switch commands until settings arrive', () async {
      await inRoom(MeetingRoomRole.host);
      c.hostCommand(HostAction.muteMic, 'u2');
      expect(rt.sent.last.$1, '/app/meet.host');
      expect(rt.sent.last.$2, {'meetingId': 'm1', 'action': 'MUTE_MIC', 'targetId': 'u2'});
      c.hostCommand(HostAction.lock, 'ignored');
      expect(rt.sent.last.$1, '/app/meet.host');
      expect(rt.sent.last.$2, {'meetingId': 'm1', 'action': 'LOCK'});
      expect(s.pendingHost[HostAction.lock], clock);
      c.onSettings(defaults.copyWith(locked: true));
      expect(s.pendingHost, isEmpty);
    });

    test('clears the pending switch and explains a refused command', () async {
      await inRoom(MeetingRoomRole.cohost);
      c.hostCommand(HostAction.waitingRoomOff);
      c.handle(const MeetErrorEvent(meetingId: 'm1', action: HostAction.waitingRoomOff, errorCode: 'MEETINGS_UNAVAILABLE'));
      expect(s.pendingHost.containsKey(HostAction.waitingRoomOff), isFalse);
      expect(notices.last, (NoticeLevel.error, const MeetingNotice(MeetingText.errUnavailable)));
    });

    test('does not send while realtime is down', () async {
      await inRoom(MeetingRoomRole.host);
      rt.connected = false;
      c.hostCommand(HostAction.muteAll);
      expect(rt.sent.where((x) => x.$1 == '/app/meet.host'), isEmpty);
      expect(notices.last, (NoticeLevel.error, const MeetingNotice(MeetingText.realtimeOffline)));
    });

    test('stops my screen share when attendees lose the right to present; a co-host keeps presenting', () async {
      await inRoom();
      store.update((x) => x.copyWith(screen: true));
      c.onSettings(defaults.copyWith(allowAttendeeScreenShare: false));
      expect(session.shareCalls, [false]);
      expect(notices.last, (NoticeLevel.info, const MeetingNotice(MeetingText.shareRevoked)));
      c.leave();
      await inRoom(MeetingRoomRole.cohost);
      store.update((x) => x.copyWith(screen: true));
      c.onSettings(defaults.copyWith(allowAttendeeScreenShare: false));
      expect(session.shareCalls, [false]);
    });

    test('admit / deny answer the lobby and drop the person from it', () async {
      await inRoom(MeetingRoomRole.host);
      c.handle(const LobbyEvent(meetingId: 'm1', waiting: [LobbyEntry(userId: 'g'), LobbyEntry(userId: 'k')]));
      await c.admit('g');
      await c.deny('k');
      expect(api.admitted, ['g']);
      expect(api.denied, ['k']);
      expect(s.lobby, isEmpty);
    });
  });

  test('roles follow the roster and the lobby is forgotten when demoted', () async {
    await inRoom();
    RosterEntry me(MeetingRoomRole r) => RosterEntry(userId: 'me', role: r, joinedAt: clock);
    c.onRoster([me(MeetingRoomRole.cohost)]);
    expect(s.myRole, MeetingRoomRole.cohost);
    expect(notices.last.$2, const MeetingNotice(MeetingText.madeCohost));
    c.handle(const LobbyEvent(meetingId: 'm1', waiting: [LobbyEntry(userId: 'g')]));
    c.onRoster([me(MeetingRoomRole.attendee)]);
    expect(s.myRole, MeetingRoomRole.attendee);
    expect(s.lobby, isEmpty);
    expect(notices.last.$2, const MeetingNotice(MeetingText.revokedCohost));
    c.onRoster([RosterEntry(userId: 'someone', role: MeetingRoomRole.host, joinedAt: clock)]);
    expect(s.myRole, MeetingRoomRole.attendee);
  });

  group('reactions', () {
    test('sends at most one per second over the lossy channel', () async {
      await inRoom();
      expect(c.sendReaction('👍'), isTrue);
      expect((session.sent.single.$1, session.sent.single.$3), (kReactionTopic, false));
      clock = clock.add(const Duration(milliseconds: 500));
      expect(c.sendReaction('🎉'), isFalse);
      expect(s.reactions, hasLength(1));
    });

    test('shows allowed reactions from others and drops anything else', () async {
      await inRoom();
      session.onData?.call(kReactionTopic, encodeReaction('❤️'), 'bob');
      session.onData?.call(kReactionTopic, utf8.encode('{"e":"💩"}'), 'bob');
      session.onData?.call('other-topic', encodeReaction('👍'), 'bob');
      expect(s.reactions.map((r) => r.emoji), ['❤️']);
    });
  });

  group('connection', () {
    test('a dropped connection offers a rejoin; a closed room is checked against the server', () async {
      await inRoom();
      session.onDisconnected?.call(RtcEnd.failed);
      expect(s.phase, RoomPhase.connectionLost);
      await inRoom();
      api.gets.add(meeting.copyWith(status: MeetingStatus.ended));
      session.onDisconnected?.call(RtcEnd.ended);
      await settle();
      expect(s.phase, RoomPhase.ended);
      await inRoom();
      api.gets.add(meeting);
      session.onDisconnected?.call(RtcEnd.ended);
      await settle();
      expect(s.phase, RoomPhase.left);
    });

    test('mirrors server-side mutes of my tracks', () async {
      await inRoom();
      session.onLocalMediaChanged?.call(const LocalMediaState(mic: false, camera: true, screen: false));
      expect((s.mic, s.camera, s.screen), (false, true, false));
    });

    test('after a STOMP reconnect: re-asks while waiting, re-reads the lobby for hosts only, never re-joins in the room', () async {
      api.joins.add(const MeetingWaiting());
      await c.join(const JoinMedia(mic: true, camera: true));
      api.joins.add(const MeetingWaiting());
      await c.onRealtimeReconnected();
      expect((api.joinCalls, s.phase), (2, RoomPhase.waiting));

      await c.cancelWaiting();
      await inRoom(MeetingRoomRole.host);
      await settle();
      final lobbyBefore = api.lobbyCalls;
      api.lobbies.add(const [LobbyEntry(userId: 'g', displayName: 'Guest')]);
      await c.onRealtimeReconnected();
      expect(api.joinCalls, 3);
      expect(api.lobbyCalls, lobbyBefore + 1);
      expect(s.lobby.single.displayName, 'Guest');
      expect(session.connects, hasLength(1));

      c.leave();
      await inRoom();
      await settle();
      final lobbyAttendee = api.lobbyCalls;
      await c.onRealtimeReconnected();
      expect(api.joinCalls, 4);
      expect(api.lobbyCalls, lobbyAttendee);
    });

    test('enters the room when the re-ask after a reconnect finds me admitted', () async {
      api.joins.add(const MeetingWaiting());
      await c.join(const JoinMedia(mic: false, camera: true));
      api.joins.add(joined(MeetingRoomRole.attendee, 't3'));
      await c.onRealtimeReconnected();
      expect(s.phase, RoomPhase.inRoom);
      expect((session.connects.single.$2, session.connects.single.$3.video, session.connects.single.$3.audio), ('t3', true, false));
    });

    test('leaving keeps the screen able to rejoin; dispose unregisters', () async {
      await inRoom();
      c.leave();
      expect((session.disconnects, s.phase), (1, RoomPhase.left));
      c.dispose();
      expect(activeMeetingRoom(), isNull);
    });

    test('raises my hand', () async {
      await inRoom();
      c.setHand(true);
      expect(rt.sent.last.$1, '/app/meet.hand');
      expect(rt.sent.last.$2, {'meetingId': 'm1', 'raised': true});
    });
  });

  group('lifecycle', () {
    test('survives activate → dispose → activate and leaves the lobby on dispose', () async {
      c.dispose();
      c.activate();
      expect(activeMeetingRoom()?.meetingId, 'm1');
      expect(s.phase, RoomPhase.prejoin);
      api.joins.add(const MeetingWaiting());
      await c.join(const JoinMedia(mic: true, camera: true));
      c.dispose();
      expect(api.leaveLobbyCalls, 1);
      expect(s.phase, RoomPhase.loading);
    });

    test('ignores a join answer that arrives after the screen closed', () async {
      final answer = Completer<MeetingJoinResponse>();
      api.joins.add(answer.future);
      final joining = c.join(const JoinMedia(mic: true, camera: true));
      c.dispose();
      answer.complete(joined());
      await joining;
      expect(session.connects, isEmpty);
    });

    test('falls back to joining without media when the device blocks it', () async {
      session.connectErrors.add(const MediaAccessException());
      api.joins.add(joined());
      await c.join(const JoinMedia(mic: true, camera: true));
      final o = session.connects.last.$3;
      expect((o.video, o.audio), (false, false));
      expect((s.phase, s.mic, s.camera), (RoomPhase.inRoom, false, false));
      expect(notices, contains((NoticeLevel.error, const MeetingNotice(MeetingText.mediaFailed))));
    });

    test('a room that cannot be reached offers a rejoin', () async {
      session.connectErrors.add(const RoomConnectException());
      api.joins.add(joined());
      await c.join(const JoinMedia(mic: true, camera: true));
      expect(s.phase, RoomPhase.connectionLost);
    });

    test('undoes a failed toggle and stays quiet when I cancel the share dialog', () async {
      await inRoom();
      session.micError = Exception('x');
      await c.toggleMic();
      expect(s.mic, isTrue);
      expect(notices.last, (NoticeLevel.error, const MeetingNotice(MeetingText.mediaFailed)));
      notices.clear();
      session.shareError = const ScreenShareCancelled();
      await c.toggleScreenShare();
      expect(s.screen, isFalse);
      expect(notices, isEmpty);
    });

    test('flushes unsaved notes before leaving and remembers the latest shared-note signal', () async {
      await inRoom();
      var flushed = 0;
      c.registerNotesFlush(() async => flushed++);
      c.onSharedNoteUpdated(5, const MeetingPerson(userId: 'u2', displayName: 'Minh'));
      expect(s.sharedNoteRemote?.version, 5);
      c.leave();
      expect((flushed, s.phase), (1, RoomPhase.left));
    });

    test('ending for everyone flushes notes too, and a failing flush never blocks it', () async {
      await inRoom(MeetingRoomRole.host);
      c.registerNotesFlush(() async => throw Exception('offline'));
      await c.endForAll();
      expect((api.endCalls, s.phase), (1, RoomPhase.ended));
    });

    test('the camera pauses in the background and comes back, without changing what a rejoin uses', () async {
      await inRoom();
      await c.onAppPaused();
      expect(session.cameraCalls.last, isFalse);
      await c.onAppResumed();
      expect(session.cameraCalls.last, isTrue);
      session.onDisconnected?.call(RtcEnd.failed);
      api.joins.add(joined());
      await c.rejoin();
      expect(session.connects.last.$3.video, isTrue);
    });
  });
}
```

  Quy ước: record trong `expect((a, b), (x, y))` chỉ chứa giá trị có `==` theo giá trị (số, chuỗi, enum, `DateTime`, class có `==`) — List/Map/matcher luôn `expect` riêng.

- [ ] **Step 3: Test** — `FT/state/meeting_room_controller_sync_test.dart` (port 1-1 `meeting-room-controller-sync.test.ts`, cùng 4 nhóm):
  - **P2-2:** `api.gets.add(later)` (locked, attendance của mình, `coHosts:[me]`) ⇒ `onRealtimeReconnected()` ⇒ `api.getCalls` tăng, `s.myRole == cohost`, `cache.cache.byId['m1']!.settings.locked`, `s.roster.first.role == cohost`, `api.lobbyCalls` tăng (được phong lúc offline ⇒ đọc lobby); settings đọc lại mở lại quyền trình bày (toggle sau đó gọi `session.shareCalls == [true]`); đọc lỗi ⇒ vẫn `inRoom`; đọc thấy ENDED ⇒ `ended`.
  - **P2-4:** tự tắt mic + cam rồi rớt `failed` ⇒ `rejoin()` dùng `audio:false, video:false`; host tắt mic (`MutedEvent`) rồi `leave` + `rejoin` ⇒ `audio:false, video:true`; toggle lỗi + `onLocalMediaChanged(all false)` lúc rớt ⇒ `rejoin` vẫn `audio:false(lựa chọn đầu), video:true`.
  - **P3-3:** `leaveLobbyOnExit()` khi không chờ ⇒ không gọi; khi đang chờ ⇒ `api.leaveLobbyCalls == 1`.
  - **P3-2:** gửi → lỗi `RATE_LIMITED` → `retryChat` (cùng `clientId`) → tiếng vọng topic `x1` rồi tiếng vọng cá nhân `x1` (`c.handle(ChatEvent…)`) ⇒ `s.chat.lines.map(id) == ['x1']`, `pendingChat` rỗng, `unreadChat == 0`; chỉ tiếng vọng cá nhân ⇒ cũng settle + thêm vào lịch sử, không tăng chưa đọc.
- [ ] **Step 4: Test** — `FT/domain/room_events_test.dart`: roster/hands/settings thay thế; chat append dedupe; sự kiện của `meetingId` khác ⇒ `identical(result, s)`.
- [ ] **Step 5: RED → hiện thực → GREEN** — `FTEST test/features/meetings && FA`; `wc -l lib/features/meetings/state/*.dart` (controller ≤ 400 — nếu vượt, tách thêm `room_media.dart` cho toggle/share/app pause như web tách `room-host`/`room-sync`).
- [ ] **Step 6: Commit** `feat(mobile): meeting room controller and state`

---

### Task 16: Topic phòng + đồng bộ lại khi nối lại + vòng đời app + giữ màn hình sáng

**Files:**
- Create: `FM/state/meeting_room_realtime.dart`, `FM/state/meeting_room_providers.dart`
- Modify: `FL/features/chat/data/stomp_service.dart` (+ `stomp_streams.dart`): `void subscribeMeetingTopic(String meetingId)` / `void unsubscribeMeetingTopic(String meetingId)` (registry key `meet_$id`, đích `/topic/meeting/$id`, frame `jsonDecode` trong try ⇒ `meetingTopic` stream; registry tự subscribe lại sau nối lại); `FL/main.dart` (`paused`: **không** `stomp.disconnect()` khi `meetingInProgress()`), `FM/state/active_room.dart` (+ `bool meetingInProgress()` = phòng đang mở ở `connecting|inRoom`), `pubspec.yaml` (`wakelock_plus: ^1.5.2`), `ios/Runner/Info.plist` (`UIBackgroundModes` = `[audio]` — owner quyết định 4); `StompService` thêm `Stream<bool> get connectionChanges` (true khi `onConnect`, false khi `onDisconnect`/`onWebSocketDone`/`disconnect()`), và `stompConnectedProvider` (`StreamProvider<bool>`, giá trị đầu = `isConnected`) trong `meeting_room_providers.dart` — nguồn cho banner `realtimeOffline` (web: `useStompConnected`)
- Test: `FT/state/meeting_room_realtime_test.dart`

**Interfaces — Produces:**

```dart
// meeting_room_realtime.dart — mirror use-meeting-room-stomp.ts + use-lobby-exit.ts
abstract interface class RoomRealtimeTarget {
  void onTopicEvent(MeetingEvent e);
  Future<void> onRealtimeReconnected();
}
class MeetingRoomRealtime {
  MeetingRoomRealtime({required this.meetingId, required this.target, required this.realtime,
      required Stream<Map<String, dynamic>> topicFrames, required Stream<void> connections});
  /// Called on every phase change (session view listens to the store).
  void onPhase(RoomPhase phase);   // connecting|inRoom ⇒ subscribeTopic (once); other ⇒ unsubscribeTopic
  void dispose();                  // cancel listeners; unsubscribe if subscribed
  // topicFrames: parseMeetingEvent; chỉ chuyển sự kiện có meetingId khớp
  // connections (mỗi lần STOMP kết nối lại trong đời binding): subscribed ⇒ target.onRealtimeReconnected()
  //   (đọc lại roster/hands/meeting/chat/ghi chú/lobby); phase == waiting ⇒ target.onRealtimeReconnected() (join lại)
}

// meeting_room_providers.dart
@Riverpod(keepAlive: true)
class MeetingRoomStoreNotifier extends _$MeetingRoomStoreNotifier implements RoomStore { … build() => MeetingRoomState.initial … }
final meetingRealtimeProvider = Provider<MeetingRealtime>((ref) => StompMeetingRealtime(ref.read(stompServiceProvider.notifier)));
final meetingRoomDepsProvider = Provider<MeetingRoomDeps>((ref) => MeetingRoomDeps(
  api: ref.read(meetingsRepositoryProvider), cache: ref.read(meetingsStoreProvider.notifier),
  realtime: ref.read(meetingRealtimeProvider),
  createSession: () => LiveKitSession(capture: platformScreenCapture()),
  now: DateTime.now, newClientId: newMeetingClientId,
  notify: (level, n) { final text = meetingText(appL10n(), n);
    level == NoticeLevel.error ? showErrorSnackBar(text) : showInfoSnackBar(text); },
  screenShareNotice: () => ScreenShareNotice(title: appL10n().meetingShareNotifTitle, body: appL10n().meetingShareNotifBody),
));
/// A call (1-1 or group) is in progress — pre-join blocks joining (web prejoinInCall).
final inAnyCallProvider = Provider<bool>(…);
```

`inAnyCallProvider`: nhóm = trạng thái `groupCallControllerProvider` đang có cuộc gọi (đọc trường hiện có của `GroupCallState`); 1-1 = cờ sẵn có của màn `/call` nếu có; nếu không có cờ quan sát được thì thêm `ValueNotifier<bool> active` vào `SfuCallService` **và** `WebRTCService` (đặt ở bắt đầu/kết thúc — không đổi hành vi, test Cuộc gọi không sửa).

`MeetingRoomController` thêm `implements RoomRealtimeTarget` (đã có đủ 2 method) và `bool get isLive` (`phase ∈ {connecting, inRoom}`) cho `meetingInProgress()`.

`StompMeetingRealtime implements MeetingRealtime`: `isConnected` = `stomp.isConnected`; `publish` = `stomp.sendRawMessage(destination: d, body: jsonEncode(body))`; `subscribeTopic/unsubscribeTopic` ⇒ method mới của `StompService`.

**`main.dart` vòng đời:** hiện tại `paused` ⇒ `stomp.disconnect()` (để server thấy offline và đẩy FCM). Khi `meetingInProgress()` ⇒ **bỏ qua** ngắt (đang họp như đang gọi: chat, giơ tay, lệnh host, `meet.ended` tiếp tục). `resumed` giữ như cũ (`_reconnectStomp` — đã kết nối thì `connect` là no-op; kiểm `StompService.connect` không tạo client thứ hai khi đang kết nối — memory "connect() must tear down stale-token client").

**`MeetingSessionView` (Task 17) dùng:** `AppLifecycleListener(onPause: controller.onAppPaused, onResume: controller.onAppResumed, onDetach: controller.leaveLobbyOnExit)`; `ref.listen(meetingRoomStoreProvider.select((s) => s.phase), (_, p) { binding.onPhase(p); p == RoomPhase.inRoom ? WakelockPlus.enable() : WakelockPlus.disable(); })`; dispose ⇒ `binding.dispose()`, `WakelockPlus.disable()`.

- [ ] **Step 1: Test** — `FT/state/meeting_room_realtime_test.dart`

```dart
import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/meeting_events.dart';
import 'package:platform_client/features/meetings/domain/room_phase.dart';
import 'package:platform_client/features/meetings/state/meeting_room_deps.dart';
import 'package:platform_client/features/meetings/state/meeting_room_realtime.dart';

class _Rt implements MeetingRealtime {
  final log = <String>[];
  @override bool get isConnected => true;
  @override void publish(String d, Map<String, Object?> b) {}
  @override void subscribeTopic(String id) => log.add('sub:$id');
  @override void unsubscribeTopic(String id) => log.add('unsub:$id');
}

class _Target implements RoomRealtimeTarget {
  final events = <MeetingEvent>[];
  var resyncs = 0;
  @override void onTopicEvent(MeetingEvent e) => events.add(e);
  @override Future<void> onRealtimeReconnected() async => resyncs++;
}

Future<void> settle() => Future<void>.delayed(Duration.zero);

void main() {
  late _Rt rt;
  late _Target target;
  late StreamController<Map<String, dynamic>> frames;
  late StreamController<void> connections;
  late MeetingRoomRealtime b;

  setUp(() {
    rt = _Rt();
    target = _Target();
    frames = StreamController.broadcast();
    connections = StreamController.broadcast();
    b = MeetingRoomRealtime(meetingId: 'm1', target: target, realtime: rt,
        topicFrames: frames.stream, connections: connections.stream);
  });
  tearDown(() => b.dispose());

  test('subscribes only while connecting / in the room — never while waiting', () {
    b.onPhase(RoomPhase.prejoin);
    b.onPhase(RoomPhase.waiting);
    expect(rt.log, isEmpty);
    b.onPhase(RoomPhase.connecting);
    b.onPhase(RoomPhase.inRoom);
    expect(rt.log, ['sub:m1']);
    b.onPhase(RoomPhase.left);
    expect(rt.log, ['sub:m1', 'unsub:m1']);
  });

  test('forwards only this meeting’s parsed topic events', () async {
    b.onPhase(RoomPhase.inRoom);
    frames.add({'event': 'meet.ended', 'meetingId': 'm1'});
    frames.add({'event': 'meet.ended', 'meetingId': 'other'});
    frames.add({'junk': true});
    await settle();
    expect(target.events, hasLength(1));
    expect(target.events.single, isA<EndedEvent>());
  });

  test('a STOMP comeback resyncs the room, and re-asks from the lobby', () async {
    b.onPhase(RoomPhase.inRoom);
    connections.add(null);
    await settle();
    expect(target.resyncs, 1);
    b.onPhase(RoomPhase.waiting);
    connections.add(null);
    await settle();
    expect(target.resyncs, 2);
    b.onPhase(RoomPhase.prejoin);
    connections.add(null);
    await settle();
    expect(target.resyncs, 2);
  });

  test('dispose unsubscribes and stops listening', () async {
    b.onPhase(RoomPhase.inRoom);
    b.dispose();
    expect(rt.log.last, 'unsub:m1');
    frames.add({'event': 'meet.ended', 'meetingId': 'm1'});
    await settle();
    expect(target.events, isEmpty);
  });
}
```

- [ ] **Step 2: RED → hiện thực → GREEN** — `dart run build_runner build --delete-conflicting-outputs && FTEST test/features/meetings test/features/chat && FA`
- [ ] **Step 3: Commit** `feat(mobile): meeting topic subscription, resync on reconnect, lifecycle and keep-awake`

---

### Task 17: Màn `/meet/:code` — màn chờ thiết bị, phòng chờ, màn trạng thái

**Files:**
- Create: `FM/state/media_preview.dart`, `FM/ui/room/{meeting_room_screen,meeting_session_view,meeting_room_scope,prejoin_screen,prejoin_preview,waiting_screen,room_status_screen}.dart`, `FT/ui/room_test_harness.dart`
- Modify: `FL/core/router/app_routes.dart` (`GoRoute('/meet/:code', parentNavigatorKey: rootNavigatorKey, pageBuilder: slidePage(MeetingRoomScreen(code)))` — toàn màn hình, như `/call`), ARB khoá Task 17 (+ `meetingMediaBlocked`, `meetingSwitchCamera`, `meetingSpeakerOn/Off` viết tay)
- Test: `FT/ui/room_status_screen_test.dart`, `FT/ui/prejoin_screen_test.dart`

**`MeetingRoomScreen`** (≤ 120) — `code = parseMeetingCodeInput(Uri.decodeComponent(raw))`; null ⇒ `RoomStatusScreen(kind: notFound)`. `ref.watch(meetingByCodeProvider(code))`: loading ⇒ nền tối + `CircularProgressIndicator` (`Semantics(label: …)`); lỗi ⇒ `initialPhase(null, parseMeetingError(e))` ⇒ `RoomStatusScreen(notFound|error, onRetry: invalidate)`; có meeting ⇒ `ENDED` ⇒ `WidgetsBinding.instance.addPostFrameCallback((_) => context.go('/meetings/${m.id}'))` (Review Focus 5 — không setState trong build); còn lại ⇒ `MeetingSessionView(key: ValueKey(m.id), meeting: m)`.

**`MeetingSessionView`** (`ConsumerStatefulWidget`, ≤ 200) — `initState`: `controller = MeetingRoomController(meeting, myId: auth user id, deps: ref.read(meetingRoomDepsProvider), store: ref.read(meetingRoomStoreProvider.notifier))..activate()`; `binding = MeetingRoomRealtime(meetingId, target: controller, realtime, topicFrames: stomp.meetingTopic, connections: stomp.connections)`; `AppLifecycleListener` + wakelock (Task 16); `dispose` ⇒ `binding.dispose(); controller.dispose(); lifecycle.dispose(); WakelockPlus.disable()`. Build: `MeetingRoomScope(controller, meeting, myId, child: switch(phase))`:

| phase | Widget |
|---|---|
| `prejoin`, `joining`, `connecting` | `PrejoinScreen(busy: phase != prejoin)` |
| `waiting` | `WaitingScreen` |
| `inRoom` | `MeetingRoomView` (Task 18) |
| `ended` | listener một lần: `showInfoSnackBar(meetingEndedToast)` + `context.go('/meetings/{id}')` |
| `loading` | nền tối |
| khác | `RoomStatusScreen(kind: phase, meetingId, onRetry: controller.rejoin)` |

`PopScope`: back khi `inRoom` ⇒ mở `LeaveSheet` (không rời im lặng); khi `waiting` ⇒ `cancelWaiting()` rồi pop.

**`MediaPreviewController`** (`state/media_preview.dart`, `ChangeNotifier`, ≤ 170) — mirror `use-media-preview.ts` cho mobile: `start(DevicePrefs)`, `setMic(bool)`, `setCamera(bool)`, `flipCamera()`, `release()`; `navigator.mediaDevices.getUserMedia({'audio': mic, 'video': camera ? {'facingMode': front ? 'user' : 'environment'} : false})` (flutter_webrtc) vào một `RTCVideoRenderer`; lỗi quyền (`NotAllowedError`/`PermissionDenied`/chuỗi `denied`) ⇒ `error = blocked` + tắt toggle; không có thiết bị ⇒ `unavailable`. **`release()` bắt buộc trước khi `controller.join`** (Android không cho mở camera hai lần). Factory qua `mediaPreviewFactoryProvider` để test thay fake.

**`PrejoinScreen`** (≤ 220) — mirror `PreJoinLobby.tsx`: `prefs = loadDevicePrefs` (một lần); `muteOnEntry && !isManagerViewer(viewerRole)` ⇒ mic mặc định tắt + `meetingPrejoinMuteOnEntry`. Bố cục dọc (phone) / 2 cột ≥ 768 dp: `PrejoinPreview` (khung 16:9 bo 12 nền tối; camera tắt ⇒ avatar chữ cái + `meetingPrejoinCameraOff`; dưới đáy 3 nút tròn 48: mic, cam (`Semantics(toggled:)`, tooltip `meetingMicOn/Off`, `meetingCamOn/Off`, tắt = `colorScheme.error`), đổi camera `meetingSwitchCamera`), hàng `SwitchListTile(meetingSpeakerOn)` loa ngoài; cột thông tin: `meetingPrejoinTitle`, tiêu đề cuộc họp, `meetingPrejoinStartsAt{time}` khi còn ở tương lai, `meetingPrejoinJoiningAs{name}`; thông báo theo thứ tự `meetingPrejoinInCall` (`inAnyCallProvider` — nút chính disabled), `meetingPrejoinLockedHint` (intent locked), `meetingMediaBlocked` / `meetingMediaUnavailable`; **một** `PonButton` full-width: `meetingAskToJoin` (intent ask) / `meetingJoinNow`; `busy` ⇒ `isLoading` + mọi điều khiển disabled; `TextButton(meetingBackToList)` → `/meetings`. Bấm: `saveDevicePrefs`, `preview.release()`, `controller.join(JoinMedia(mic, camera, frontCamera))`, `controller.setSpeaker(speakerOn)` sau khi vào.

**`WaitingScreen`** (≤ 90) — giữa màn: avatar của mình + `CircularProgressIndicator` nhỏ, `meetingWaitingTitle` (`Semantics(header: true, liveRegion: true)`), `meetingWaitingDesc`, tiêu đề cuộc họp, `OutlinedButton(meetingWaitingCancel)` ⇒ `cancelWaiting()`.

**`RoomStatusScreen`** (≤ 140) — props `{required RoomPhase kind, String? meetingId, VoidCallback? onRetry}`; bảng icon Material + khoá: notFound `search_off_rounded` `meetingNotFoundTitle/Desc` · denied `block_rounded` `meetingDeniedTitle/Desc` · removed `person_remove_rounded` `meetingRemovedTitle/Desc` · locked `lock_rounded` `meetingLockedTitle/Desc` · full `groups_rounded` `meetingFullTitle` + `meetingFullDesc(25)` · unavailable `cloud_off_rounded` · left `logout_rounded` `meetingLeftTitle` · connectionLost `wifi_off_rounded` · error `error_outline_rounded` `meetingErrGeneric`. Nút: `canRejoin(kind)` ⇒ `meetingRejoin` (left, connectionLost) / `meetingTryAgain` (locked, full, unavailable, error) gọi `onRetry`; có `meetingId` và kind ≠ notFound ⇒ `meetingViewDetails` → `/meetings/{id}`; luôn `meetingBackToList`. Tiêu đề `Semantics(header: true)` + focus khi mount (`FocusNode` autofocus).

- [ ] **Step 1: Harness** — `FT/ui/room_test_harness.dart`: dựng `FakeRoomSession` + `FakeMeetingsApi` + `FakeRealtime` (tái dùng từ `FT/state/`), `ProviderScope(overrides: [meetingRoomDepsProvider.overrideWithValue(deps), mediaPreviewFactoryProvider.overrideWithValue(() => FakePreview()), inAnyCallProvider.overrideWithValue(false), authNotifierProvider.overrideWith(() => _TestAuth(user me))])`; hàm `Future<MeetingRoomController> pumpRoom(tester, {role, phase})` tạo controller với `store = container.read(meetingRoomStoreProvider.notifier)`, `join` tới `inRoom` (hoặc dừng ở phase yêu cầu), rồi pump `MeetingRoomScope(controller: c, meeting: m, myId: 'me', child: …)`.
- [ ] **Step 2: Test** — `FT/ui/room_status_screen_test.dart`: với mỗi kind ⇒ đúng tiêu đề; `left`/`connectionLost` có `meetingRejoin` và bấm gọi `onRetry`; `removed`/`denied` **không** có nút vào lại; `notFound` không có `meetingViewDetails`; `full` hiện "25".
- [ ] **Step 3: Test** — `FT/ui/prejoin_screen_test.dart`: (a) guest + phòng chờ ⇒ nút `meetingAskToJoin`; invited ⇒ `meetingJoinNow`; (b) `muteOnEntry` + attendee ⇒ nút mic ở trạng thái tắt + `meetingPrejoinMuteOnEntry`; host ⇒ không; (c) `inAnyCallProvider = true` ⇒ `meetingPrejoinInCall` + nút chính disabled; (d) bấm Tham gia ⇒ `FakePreview.released == true` **trước** `session.connects` có phần tử, và `JoinMedia` khớp toggle.
- [ ] **Step 4: RED → hiện thực → GREEN** — khoá Task 17 ⇒ `GEN`; `FTEST test/features/meetings && FA`; `wc -l`.
- [ ] **Step 5: Kiểm tay (máy thật)** — từ chối quyền camera ⇒ vẫn vào được với mic/cam tắt + `meetingMediaBlocked`; đổi camera trước/sau trong preview; mở lại ⇒ lựa chọn mic/cam/camera/loa được nhớ; link sai ⇒ "Không tìm thấy cuộc họp"; link cuộc họp đã kết thúc ⇒ màn chi tiết; nút back hệ thống ở phòng chờ ⇒ rời phòng chờ.
- [ ] **Step 6: Commit** `feat(mobile): meeting pre-join, waiting room and status screens`

---

### Task 18: Phòng họp — sân khấu, ô video, thanh điều khiển, menu Thêm, rời / kết thúc, reaction, trình bày màn hình

**Files:**
- Create: `FM/ui/room/{meeting_room_view,meeting_stage,meeting_tile,room_banners,control_bar,room_more_sheet,leave_sheet,reaction_picker,reaction_overlay}.dart`
- Modify: ARB khoá Task 18 (+ `meetingShareNotifTitle/Body` viết tay)
- Test: `FT/ui/control_bar_test.dart`

**`MeetingRoomView`** (≤ 160) — `Scaffold(backgroundColor: Color(0xFF0A0A0A))` (nền "nội dung" cố định như màn Cuộc gọi; chrome dùng token): `Stack[ MeetingStage, RoomBanners (trên cùng, SafeArea), ReactionOverlay (IgnorePointer) ]` + `bottomNavigationBar: ControlBar`. Đọc store bằng `select` hẹp. Banner người chờ: `ref.listen(select((s) => s.lobby.length))` — tăng **và** panel ≠ people **và** là manager ⇒ `showInAppNotification(meetingPeopleTitle, meetingLobbyWaiting(count), onTap: mở ParticipantsSheet)`.

**`MeetingStage`** (≤ 180) — `computeStage(StageInput(mode: layout, pinnedKey, localIdentity: myId, remoteIds: peers.map(identity), screenSharers: [if (screen) myId, ...peers.where(p.screen != null)], activeSpeakerId, maxTiles: width < 768 ? 6 : 25))`; **ô bị ẩn ngừng nhận camera**: giữ `Set<String> _disabled` trong `State`, sau mỗi build so `hiddenIds` ⇒ `controller.setPeerVideoEnabled(id, false/true)` cho phần chênh (trong `didUpdateWidget`/post-frame, không trong build). Có `main` ⇒ cột: ô lớn `Expanded` + dải ngang cao 112 (`ListView` cuộn ngang, ô 16:9); không ⇒ lưới `gridColumns(n, mobile)` cột, hàng chia đều chiều cao; ô "+N" (`meetingOverflowTiles`, `Semantics(label: meetingOverflowMore(count))`) ⇒ mở People.

**`MeetingTile`** (≤ 170) — props `{required StageTile tile, required TileVariant variant}`; peer từ store theo `identity` (ô của mình dùng `localStream`/`localScreen`), vai trò từ `roster`, tay + số thứ tự từ `hands`. Video: `RTCVideoView` trên `RTCVideoRenderer` của **ô** (tạo trong `initState`, gán `srcObject` khi stream đổi, `dispose` renderer — memory "giao stream cho UI một lần"); `objectFit: contain` cho share, `cover` cho camera; gương cho camera trước của mình. Không video / `camMuted` ⇒ avatar (`ConversationAvatar(avatarUrl: absoluteMediaUrl(peer.avatarUrl), fallbackLetter)`). Nhãn dưới-trái nền `Colors.black.withValues(alpha: 0.55)` chữ trắng: tên = `safeDisplayName(peer.name, identity)` → roster `displayName` → `meetingParticipantFallback`; ô của mình `meetingNameWithYou{name}`; ô share `meetingPresentingName{name}`; **ô share của mình ở `main`** ⇒ không phát video (tránh gương vô hạn) mà hiện khối `meetingPresenting` + `FilledButton(meetingStopPresenting)`. Huy hiệu trên-phải: `mic_off_rounded` (`meetingMicMutedLabel`), `back_hand_rounded` + số (`meetingHandRaisedLabel`), `shield_rounded` (`meetingHostBadge`) cho host/co-host, `signal_cellular_alt_1_bar_rounded` (`meetingPoorConnectionPeer`). Viền 2 dp `colorScheme.primary` khi `speaking`. Nhấn giữ ⇒ menu `meetingPin`/`meetingUnpin` (`controller.togglePin(tile.key)`), `Semantics(label: meetingTileMenu{name})`.

**`RoomBanners`** (≤ 60) — `reconnecting` ⇒ `meetingReconnecting` (spinner); `!realtimeConnected` (`ref.watch(stompConnectedProvider)` — Task 16) ⇒ `meetingRealtimeOffline` (cũng khoá nút Giơ tay, ô chat, lệnh host); `poorConnection` ⇒ `meetingPoorConnection`. Viên thuốc giữa-trên, `Semantics(liveRegion: true)`.

**`ControlBar`** (≤ 220) — cao 72 + `SafeArea(top: false)`, nền `colorScheme.surface`, hairline trên; 6 nút tròn 48 cách đều (đủ ở 320 dp): **Mic** (`toggleMic`; tắt = `colorScheme.error`; `Semantics(toggled: mic)`; tooltip `meetingMicOff|On`), **Camera**, **Giơ tay** (`back_hand_rounded`; bật khi tay mình trong `hands`; `setHand(!raised)`; disabled khi mất realtime), **Reaction** (`add_reaction_rounded` ⇒ `ReactionPicker`), **Thêm** (`more_horiz_rounded`, chấm đỏ khi `unreadChat > 0` hoặc (manager) `lobby.isNotEmpty`; `Semantics(label: meetingMore + meetingChatUnread(count) nếu có)`) ⇒ `RoomMoreSheet`, **Rời** (`call_end_rounded`, `colorScheme.error`) ⇒ attendee: `controller.leave()` ngay; host/co-host: `LeaveSheet`.

**`RoomMoreSheet`** (≤ 200) — bottom sheet danh sách: `meetingPeople` (+ số chờ cho manager) ⇒ `ParticipantsSheet`; `meetingChat` (+ `meetingChatUnread`) ⇒ `MeetingChatSheet`; `meetingNotes` ⇒ `NotesSheet`; **`meetingShareStart`/`meetingStopPresenting`** — chỉ khi `session.supportsScreenShare` (Android); `!canShareScreen(myRole, settings)` ⇒ disabled + phụ đề `meetingShareDisabled`; `meetingSwitchCamera` (khi camera bật); `SwitchListTile(meetingSpeakerOn)`; `meetingLayout`: `SegmentedButton(meetingLayoutGrid | meetingLayoutSpotlight)`; manager ⇒ `meetingManageTitle` ⇒ `ParticipantsSheet(scrollToManage: true)`. Mọi panel mở bằng `controller.setPanel(...)` và đóng ⇒ `setPanel(null)` (đóng sheet ghi chú ⇒ `flush`, Task 21).

**`LeaveSheet`** (≤ 90) — `meetingLeaveMeeting` ⇒ `leave()`; `meetingEndForAll` (`colorScheme.error`) ⇒ `AlertDialog(meetingEndConfirmTitle/Desc)` ⇒ `endForAll()`.

**`ReactionPicker`** (≤ 60) — 6 emoji (`Semantics(label: emoji)`), bấm ⇒ `controller.sendReaction(e)`; `false` (throttle) ⇒ rung nhẹ `HapticFeedback.selectionClick()`, không banner.

**`ReactionOverlay`** (≤ 100) — `reactions` bay lên từ góc trái dưới (AnimatedBuilder 3 s; `MediaQuery.disableAnimations` ⇒ hiện tĩnh 2 s) kèm tên nhỏ; `SemanticsService.announce(meetingReactionAria{name, emoji})` tối đa 1 lần / 2 s.

**Trình bày màn hình (Android):** `controller.toggleScreenShare()` ⇒ hộp thoại hệ thống "Bắt đầu ghi/truyền" ⇒ thông báo foreground `meetingShareNotifTitle/Body`; dừng từ thông báo/thanh hệ thống ⇒ LiveKit unpublish ⇒ `onLocalMediaChanged(screen:false)` ⇒ nút tự về tắt. Bị host tắt quyền ⇒ controller dừng + `meetingShareRevoked` (Task 15).

- [ ] **Step 1: Test** — `FT/ui/control_bar_test.dart` (port `MeetingRoom.test.tsx` 3 case đầu, dùng harness Task 17)

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/room_phase.dart';
import 'package:platform_client/features/meetings/ui/room/meeting_room_view.dart';

import '../state/fake_room_session.dart';
import 'meeting_test_harness.dart';
import 'room_test_harness.dart';

void main() {
  testWidgets('shows me and the other person, and the mic button drives the controller', (tester) async {
    final room = await pumpRoom(tester, role: MeetingRoomRole.attendee, peers: [fakePeer('bob', 'Bob')],
        child: const MeetingRoomView());
    final l = l10nOf(tester);
    expect(find.text(l.meetingNameWithYou('Me')), findsOneWidget);
    expect(find.text('Bob'), findsOneWidget);
    await tester.tap(find.byTooltip(l.meetingMicOff));
    await tester.pump();
    expect(room.session.micCalls, [false]);
    expect(find.byTooltip(l.meetingMicOn), findsOneWidget);
  });

  testWidgets('an attendee leaves with one button and sees no host controls', (tester) async {
    final room = await pumpRoom(tester, role: MeetingRoomRole.attendee, child: const MeetingRoomView());
    final l = l10nOf(tester);
    await tester.tap(find.byTooltip(l.meetingMore));
    await tester.pumpAndSettle();
    expect(find.text(l.meetingManageTitle), findsNothing);
    Navigator.of(tester.element(find.text(l.meetingPeople))).pop();
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip(l.meetingLeave));
    await tester.pumpAndSettle();
    expect(room.store.value.phase, RoomPhase.left);
    expect(find.text(l.meetingEndForAll), findsNothing);
  });

  testWidgets('a host can end the meeting for everyone after confirming', (tester) async {
    final room = await pumpRoom(tester, role: MeetingRoomRole.host, child: const MeetingRoomView());
    final l = l10nOf(tester);
    await tester.tap(find.byTooltip(l.meetingLeave));
    await tester.pumpAndSettle();
    await tester.tap(find.text(l.meetingEndForAll));
    await tester.pumpAndSettle();
    expect(find.text(l.meetingEndConfirmTitle), findsOneWidget);
    await tester.tap(find.widgetWithText(TextButton, l.meetingEndForAll).last);
    await tester.pumpAndSettle();
    expect(room.api.endCalls, 1);
    expect(room.store.value.phase, RoomPhase.ended);
  });
}
```

  (`pumpRoom` trả `({MeetingRoomController controller, FakeRoomSession session, FakeMeetingsApi api, RoomStore store})`; `fakePeer(id, name)` dựng `RtcPeer(identity: id, name: name)` và phát `session.onPeersChanged`; `RTCVideoView` không dựng khi `stream == null` nên test không cần plugin. Tên của mình lấy từ user giả `displayName: 'Me'`.)
- [ ] **Step 2: RED → hiện thực → GREEN** — khoá Task 18 ⇒ `GEN`; `FTEST test/features/meetings && FA`; `wc -l lib/features/meetings/ui/room/*.dart` ≤ 400.
- [ ] **Step 3: Kiểm tay (2 máy + 1 trình duyệt web)** — thấy/nghe nhau; tắt mic ⇒ ô bên kia có mic tắt (kể cả người **vào với mic tắt** — QA web P1); người nói có viền; Lưới ⇄ Người nói; ghim (nhấn giữ); Android trình bày màn hình ⇒ web thấy ô lớn, dừng từ thông báo hệ thống ⇒ nút về tắt; web trình bày ⇒ mobile thấy ô lớn `contain`; reaction 2 chiều, bấm liên tục chỉ gửi 1/giây; ≥ 7 người trên phone ⇒ ô "+N", người bị ẩn **không** tốn băng thông video (kiểm `chrome://webrtc-internals` phía web: track của họ ngừng gửi tới máy này) nhưng **vẫn nghe tiếng**; khoá màn hình 30 s ⇒ vẫn nghe/nói, camera tắt rồi tự bật lại khi mở.
- [ ] **Step 4: Commit** `feat(mobile): meeting room stage, controls, reactions and Android screen share`

---

### Task 19: Panel Mọi người — giơ tay, phòng chờ, menu host (13 lệnh)

**Files:**
- Create: `FM/ui/room/{participants_sheet,lobby_section,participant_row,host_actions_sheet,room_manage_section}.dart`
- Modify: ARB khoá Task 19
- Test: `FT/ui/participants_sheet_test.dart`

**`ParticipantsSheet`** (≤ 200) — bottom sheet 85%, tiêu đề `meetingPeopleTitle`; dữ liệu từ store (`roster`, `hands`, `lobby`, `peers` để biết mic, `myRole`, `settings`). Thứ tự mục (tiêu đề nhóm 12/500 `mutedText`, `Semantics(header: true)`):
1. `meetingSectionHands{count}` — đúng thứ tự `hands` (sớm nhất trước), số `1.` `2.`…; manager: `TextButton(meetingActionLowerHand)` mỗi dòng + `meetingActionLowerAllHands` ở tiêu đề. Ẩn khi rỗng.
2. `meetingSectionLobby{count}` — chỉ manager (`LobbySection`). Ẩn khi rỗng.
3. `meetingSectionInMeeting{count}` — roster: mình đầu, rồi host, co-host, còn lại theo `joinedAt`; mỗi dòng `ParticipantRow`.
4. Manager: `RoomManageSection` cuối sheet (`scrollToManage` ⇒ `Scrollable.ensureVisible`).

**`LobbySection`** (≤ 90) — mỗi người: avatar chữ cái + tên (`safeDisplayName` → `meetingParticipantFallback`) + `OutlinedButton(meetingAdmit)` / `TextButton(meetingDeny)` ⇒ `controller.admit/deny(userId)` (đang gọi ⇒ disabled); `meetingAdmitAll` khi ≥ 2 (gọi tuần tự).

**`ParticipantRow`** (≤ 110) — avatar 32, tên (+ `meetingYou`), nhãn `meetingRoleHost|Cohost`, icon mic tắt (peer `micMuted`), icon tay; `IconButton(more_vert_rounded, tooltip: meetingPersonMenu{name})` ⇒ `HostActionsSheet` khi `personActions(myRole, myId, PersonTarget(…, micOn: !peer.micMuted))` không rỗng.

**`HostActionsSheet`** (≤ 110) — danh sách theo `personActions`: `muteMic → meetingActionMuteMic`, `lowerHand → meetingActionLowerHand`, `makeCohost → meetingActionMakeCohost`, `revokeCohost → meetingActionRevokeCohost`, `remove → meetingActionRemove` (`colorScheme.error`, `AlertDialog(meetingRemoveConfirmTitle{name}, meetingRemoveConfirmDesc)`) ⇒ `controller.hostCommand(action, userId)`.

**`RoomManageSection`** (≤ 160) — `rc = roomControls(myRole, settings, anyHands: hands.isNotEmpty)`; null ⇒ không dựng. `OutlinedButton(meetingActionMuteAll)` ⇒ `AlertDialog(meetingMuteAllConfirmTitle/Desc)` ⇒ `hostCommand(muteAll)`; `meetingActionLowerAllHands` khi `rc.lowerAllHands`; 3 `SwitchListTile`: `meetingSettingLocked` (value `settings.locked`) ⇒ `hostCommand(rc.lock)`, `meetingSettingWaitingRoom` ⇒ `rc.waitingRoom`, `meetingSettingScreenShare` ⇒ `rc.screenShare` — mỗi switch disabled + spinner nhỏ khi `pendingHost[action]` còn trong 8 s (timer 1 s trong `State` chỉ chạy khi có pending); `meetingSettingNotes` ⇒ **PATCH** `MeetingActions.update(id, MeetingInput(settings: {'attendeesCanEditNotes': !current}))` (không có lệnh STOMP — api-spec). Đủ 13 lệnh: `MUTE_MIC, REMOVE, LOWER_HAND, MAKE_COHOST, REVOKE_COHOST` (HostActionsSheet) + `MUTE_ALL, LOWER_ALL_HANDS, LOCK, UNLOCK, WAITING_ROOM_ON/OFF, ATTENDEE_SCREEN_SHARE_ON/OFF` (RoomManageSection) — đã chứng minh ở test permissions Task 6.

- [ ] **Step 1: Test** — `FT/ui/participants_sheet_test.dart` (port case 4 `MeetingRoom.test.tsx` + thứ tự tay):
  1. host + `LobbyEvent(g: Guest)` ⇒ thấy `meetingSectionLobby(1)`, bấm `meetingAdmit` ⇒ `api.admitted == ['g']`, mục chờ biến mất.
  2. bấm menu của `bob` ⇒ `meetingActionMuteMic` ⇒ `rt.sent.last.$2 == {'meetingId':'m1','action':'MUTE_MIC','targetId':'bob'}`.
  3. switch `meetingSettingLocked` ⇒ gửi `LOCK`, switch disabled tới khi `c.onSettings(locked: true)` ⇒ bật lại và ở trạng thái on.
  4. `HandsEvent([c, a])` ⇒ hai dòng đầu theo đúng thứ tự `1. C`, `2. A`.
  5. attendee ⇒ không có `meetingSectionLobby`, không có nút menu người khác, không có `meetingManageTitle`.
  6. Không text nào chứa `64b0` khi roster có người không tên (id dạng ObjectId) ⇒ hiện `meetingParticipantFallback`.
- [ ] **Step 2: RED → hiện thực → GREEN** — khoá Task 19 ⇒ `GEN`; `FTEST test/features/meetings && FA`; `wc -l`.
- [ ] **Step 3: Kiểm tay** — 3 người giơ tay A, B, C ⇒ cùng thứ tự trên mọi máy (web + 2 mobile); A giơ lại ⇒ không đổi chỗ; "Hạ tất cả" ⇒ rỗng; khách mở link ⇒ host mobile thấy banner + số chờ, Cho vào ⇒ khách vào ngay; phong co-host ⇒ người đó thấy quyền host + phòng chờ; thu hồi ⇒ mất; tắt quyền trình bày khi attendee Android đang trình bày ⇒ dừng + banner.
- [ ] **Step 4: Commit** `feat(mobile): meeting participants, waiting room and host controls`

---

### Task 20: Chat trong họp

**Files:**
- Create: `FM/ui/room/{meeting_chat_sheet,chat_lines,chat_composer}.dart`
- Modify: ARB khoá Task 20
- Test: `FT/ui/meeting_chat_sheet_test.dart`

**`MeetingChatSheet`** (≤ 200) — mở ⇒ `setPanel(chat)` (xoá chưa đọc), đóng ⇒ `setPanel(null)`. `ListView` đảo (`reverse: true`) dòng `chat.lines` + `pendingChat` nối sau; tới đầu danh sách & `chat.hasOlder` ⇒ `controller.loadOlderChat()` (+ nút dự phòng `meetingChatLoadOlder`); người dùng đã cuộn khỏi đáy > 80 dp mà có dòng mới ⇒ nút nổi `meetingChatUnread{count}` về đáy; rỗng ⇒ `meetingChatEmpty`. `Semantics(liveRegion: true)` cho dòng mới.

**`ChatLines`** (≤ 140) — dòng: tên người gửi (gộp liên tiếp cùng người ≤ 2 phút ⇒ chỉ dòng đầu), giờ `DateFormat.jm(locale)` (instance cache), nội dung `SelectableText` thuần (không markdown/link HTML). Dòng của mình căn phải nền `AppTheme.accentTint(context)`. Dòng chờ: mờ 60% + `meetingChatSending`; lỗi (`p.error ?? (now − sentAt > 10 s ⇒ errNetwork)`, `now` từ `Timer.periodic(2 s)` chỉ chạy khi có dòng chờ) ⇒ viền `colorScheme.error` + `meetingText(l10n, error)` + `TextButton(meetingChatRetry)` / `TextButton(meetingChatDiscard)` ⇒ `retryChat/discardChat(clientId)`.

**`ChatComposer`** (≤ 100) — `TextField(minLines: 1, maxLines: 5, textInputAction: send)` `Semantics(label: meetingChatPlaceholder)`; `meetingChatCounter{count,max}` khi > 1800; > 2000 ⇒ nút Gửi disabled + `meetingErrChatTooLong(2000)`; mất realtime ⇒ disabled + `meetingChatOffline`. Gửi ⇒ `controller.sendChat(text)` khác null ⇒ xoá ô.

- [ ] **Step 1: Test** — `FT/ui/meeting_chat_sheet_test.dart`: (1) gõ + gửi ⇒ `rt.sent.last.$1 == '/app/meet.chat'`, ô trống, dòng chờ có `meetingChatSending`; (2) `MeetErrorEvent(clientId: 'c-abc', RATE_LIMITED)` ⇒ thấy `meetingErrRateLimited` + `meetingChatRetry`; bấm ⇒ gửi lại cùng `clientId`; (3) quá 10 s không tiếng vọng (`tester.pump(Duration(seconds: 12))`) ⇒ `meetingErrNetwork`; (4) nội dung `<b>x</b>` hiện nguyên văn; (5) `rt.connected = false` + `connectionChanges` false ⇒ composer disabled + `meetingChatOffline`.
- [ ] **Step 2: RED → hiện thực → GREEN** — khoá Task 20 ⇒ `GEN`; `FTEST test/features/meetings && FA`; `wc -l`.
- [ ] **Step 3: Kiểm tay** — web ⇄ mobile chat qua lại; gửi 12 tin trong 3 s ⇒ tin 11+ lỗi "Bạn gửi quá nhanh" + Gửi lại (gửi lại **không** nhân đôi dòng ở máy kia); tắt mạng ⇒ composer khoá; vào giữa chừng ⇒ thấy lịch sử; kéo lên tải tin cũ không nhảy vị trí.
- [ ] **Step 4: Commit** `feat(mobile): in-meeting chat with optimistic lines, retry and errors`

---

### Task 21: Ghi chú trong phòng

**Files:**
- Create: `FM/ui/room/notes_sheet.dart`
- Test: thêm vào `FT/ui/notes_editor_test.dart`

**`NotesSheet`** (≤ 80) — bottom sheet 85% chứa `NotesEditor(meetingId, canEditShared: canEditSharedNoteRoom(myRole, settings), sharedRemote: s.sharedNoteRemote, onFlushReady: controller.registerNotesFlush)`; `canEditShared` đổi **ngay** khi được phong/thu hồi co-host hoặc host bật/tắt `attendeesCanEditNotes` (`notifier.setCanEdit`); `sharedNoteResync` tăng (nối lại) ⇒ `notifier.remoteUpdated(...)` hoặc `ref.invalidate` khi sạch; đóng sheet ⇒ `flush()` + `registerNotesFlush(null)`; `leave()/endForAll()` đã gọi flush đã đăng ký (Task 15).

- [ ] **Step 1: Test** — thêm: `canEditShared` từ `true` sang `false` khi đang mở ⇒ ô chuyển read-only + `meetingNotesReadOnly`, và autosave không chạy sau 2 s; `sharedRemote = RemoteNewer(5, Minh)` khi đang sửa ⇒ dải `meetingNotesRemoteNewer('Minh')`, chữ giữ nguyên.
- [ ] **Step 2: RED → hiện thực → GREEN** — `FTEST test/features/meetings && FA`
- [ ] **Step 3: Kiểm tay** — Review Focus 1 web ⇄ mobile: hai người cùng sửa ghi chú chung, mobile lưu sau ⇒ khối xung đột, chữ còn; "Lưu bản đã gộp" ⇒ web thấy dải "… vừa lưu bản mới hơn"; host tắt "Người tham dự được sửa ghi chú chung" ⇒ attendee mobile chỉ đọc ngay; rời phòng khi vừa gõ ⇒ màn chi tiết thấy chữ đã lưu.
- [ ] **Step 4: Commit** `feat(mobile): meeting notes in the room`

---

### Task 22: Rà soát a11y, giao diện, i18n, không lộ dữ liệu thô

- [ ] **i18n đủ 7 locale, có bản dịch thật** (zh/ja/ko/es/fr lấy đúng chữ web, khoá chỉ-mobile dịch tay — không chép tiếng Anh): `FTEST test/l10n test/features/meetings/ui/meeting_text_l10n_test.dart`.
- [ ] **Không chuỗi cứng trong widget:** `grep -rnE "Text\('[A-Za-zÀ-ỹ]|Text\(\"[A-Za-zÀ-ỹ]|tooltip: '|label: '" lib/features/meetings` ⇒ rỗng.
- [ ] **Không dữ liệu thô:** `grep -rnE "\.(userId|hostId|identity)\b" lib/features/meetings/ui` — mọi chỗ còn lại chỉ dùng làm key/so sánh, không vào `Text`; `grep -rnE "e\.toString\(\)|\\\$e\b|\.message\b|removedIds" lib/features/meetings/ui` ⇒ rỗng; push không bao giờ hiện `meeting_push_*` (Task 9 test).
- [ ] **Theme:** `grep -rnE "Color\(0x|Colors\.(red|blue|green|amber)" lib/features/meetings` — chỉ cho phép nền sân khấu tối + chữ trắng trên nhãn video (như màn Cuộc gọi); còn lại `colorScheme.*` / `AppTheme.*`. `test/core/design_system_sync_test.dart` xanh. `DESIGN_SHOTS=1 flutter test test/design/design_shots_test.dart` — thêm `MeetingsScreen`, `MeetingDetailScreen`, `PrejoinScreen`, `RoomStatusScreen(removed)` vào bộ chụp (sáng/tối) và soát bằng mắt.
- [ ] **A11y:** mọi nút icon có `tooltip`; toggle có `Semantics(toggled:)`; vùng chạm ≥ 44 (`MaterialTapTargetSize.padded`); sheet có tiêu đề `header`; banner nối lại `liveRegion`; TalkBack/VoiceOver đọc được thanh điều khiển theo thứ tự nhìn thấy; chữ phóng 200% (`textScaler`) không tràn ở thanh điều khiển (nhãn chỉ ở tooltip).
- [ ] **Hiệu năng:** widget phòng đọc store bằng `select` hẹp; `MeetingTile` bọc `RepaintBoundary`; reaction không dựng lại sân khấu (memory "rebuild storm"); đo bằng `--profile` trên máy thật, không debug.
- [ ] **Kích thước:** `wc -l lib/features/meetings/**/*.dart lib/core/rtc/*.dart` ≤ 400; cây widget ≤ 5 cấp (soát `MeetingRoomView`, `ControlBar`, `ParticipantsSheet`, `CreateMeetingSheet`).
- [ ] **Commit** `chore(mobile): meetings a11y, theme and i18n pass`

---

### Task 23: Kiểm tra toàn bộ + tài liệu + checklist máy thật

- [ ] **Final gate** (mục cuối plan) xanh.
- [ ] `docs/api-spec.md` § Meetings: thêm đoạn "Mobile client (MT6–MT7)" ngắn — cùng quy ước web (UTC `Z`, `clientId`, subscribe trước rồi đọc, nối lại: đọc lại + `GET /lobby` cho host/co-host, người chờ `POST /join` lại); khác biệt: không giữ STOMP ngắt khi app ở nền **trong lúc họp**; push `MEETING_*` mở `/meet/{code}`; chuỗi `meeting_push_*` dịch sẵn trong app; trình bày màn hình chỉ Android. Không đổi contract.
- [ ] `apps/client/CLAUDE.md`: thêm `features/meetings/` (domain thuần + controller), route `/meetings`, `/meetings/:id`, `/meet/:code`, ghi chú "`LiveKitSession`/`RtcSession` dùng chung Cuộc gọi — `MeetingRtcSession` mở rộng, test `test/features/chat/calls/*` phải xanh không sửa"; mục "Implemented Screens" thêm Meetings.
- [ ] `.claude/rules/sync.md`: mirror Meetings đã có — bổ sung `apps/web/lib/meetings/*.ts ↔ apps/client/lib/features/meetings/domain/*.dart` (cùng tên file) và `components/meeting/NotesEditor.tsx ↔ ui/widgets/notes_editor.dart`.
- [ ] `docs/superpowers/plans/README.md`: dòng `2026-10-05-meetings-p1-core.md` ⇒ "MT1–MT7 xong trên `feat/meetings-p1`, còn MT8"; thêm dòng `2026-10-08-meetings-mt6-mt7-flutter.md`.
- [ ] `docs/environments.md`: `--dart-define=PON_WEB_URL=https://<web host>` cho build mobile (gap D1).
- [ ] **Checklist máy thật trên `dev`** (1 Android ≥ 12, 1 Android 14 cho share, 1 iPhone iOS ≥ 16, + web; H = host, I = được mời, G = khách) — tick trong mô tả PR:
  1. H (mobile): Họp ngay ⇒ màn chờ ⇒ vào phòng; copy link (đúng `PON_WEB_URL`); G (mobile, **chưa đăng nhập**) mở `platform://meet/{code}` ⇒ đăng nhập ⇒ quay lại đúng màn chờ (Task 8).
  2. G "Yêu cầu tham gia" ⇒ "Đang xin vào…"; H thấy banner + số chờ; Cho vào ⇒ G vào; lặp với Từ chối ⇒ màn từ chối (Review Focus 2).
  3. H (web) lên lịch cho I (mobile) lúc now+12 phút ⇒ I tiền cảnh: banner mời + dòng mới trong Sắp tới; I **tắt app**: push "Bạn được mời…" đúng ngôn ngữ máy; ~10 phút trước: push nhắc; chạm ⇒ mở đúng màn chờ (Review Focus — thông báo).
  4. H huỷ cuộc họp đã lên lịch ⇒ I thấy banner huỷ, dòng biến khỏi Sắp tới, chi tiết "Đã huỷ".
  5. Trong phòng: I giơ tay, G giơ tay ⇒ thứ tự I, G ở mọi máy; H hạ tay G; "Hạ tất cả".
  6. H tắt mic G ⇒ G thấy banner "{H} đã tắt micro của bạn", nút mic đỏ, tự bật lại được; "Tắt micro mọi người".
  7. G (Android 14) trình bày màn hình ⇒ web/iOS thấy; dừng từ thông báo hệ thống ⇒ nút về tắt; H tắt quyền trình bày ⇒ G dừng + banner; iPhone **không** có nút Trình bày nhưng **xem** được share.
  8. H phong I co-host ⇒ I thấy quyền host + phòng chờ; I mời G ra ⇒ G thấy "Bạn đã bị mời ra"; mở lại link ⇒ cùng màn; chi tiết của G hiện `removedNotice` (Review Focus 3).
  9. H khoá phòng ⇒ khách mới thấy màn khoá; I rời rồi vào lại được.
  10. Chat 3 người web ⇄ mobile; spam ⇒ lỗi RATE_LIMITED + Gửi lại không nhân đôi; `<b>x</b>` hiện nguyên văn.
  11. Ghi chú chung web ⇄ mobile cùng sửa ⇒ xung đột không mất chữ (Review Focus 1); ghi chú riêng chỉ người viết thấy.
  12. H rời (không kết thúc) ⇒ I (co-host) vẫn điều khiển (Review Focus 4); H vào lại ⇒ thấy phòng chờ đang có người.
  13. Bật chế độ máy bay 20 s trên I ⇒ banner "Đang kết nối lại…" rồi hết; trong lúc đó H đổi cài đặt, G chat ⇒ sau khi về I thấy đúng cài đặt, tay, chat (Review Focus 7); lâu hơn ⇒ "Mất kết nối" + Vào lại ⇒ vào lại **với đúng mic/cam đang dùng**.
  14. I khoá màn hình 1 phút giữa họp (iOS + Android) ⇒ vẫn nghe/nói (iOS cần `UIBackgroundModes audio`), chat/giơ tay của người khác vẫn tới khi mở lại (STOMP không bị ngắt khi đang họp); camera tắt khi nền, bật lại khi về.
  15. G đang ở phòng chờ thì vuốt tắt app ⇒ host thấy G biến khỏi phòng chờ (Android chắc chắn; iOS best-effort — ghi kết quả).
  16. H "Kết thúc cho mọi người" ⇒ mọi người về chi tiết với banner "Cuộc họp đã kết thúc"; mở lại link ⇒ chi tiết (Review Focus 5); điểm danh có thời lượng.
  17. 7+ người trên phone ⇒ ô "+N", người bị ẩn vẫn nghe tiếng; 320 dp: thanh điều khiển không tràn, sheet dùng được một tay.
  18. Cuộc gọi 1-1 và nhóm (Module B) vẫn chạy như cũ — âm thanh, video, mic/cam/loa, đổi camera, chuông (Review Focus 9).
- [ ] Commit `docs: meetings mobile client (MT6–MT7)`

---

## Quyết định cho owner (đề xuất mặc định — không chặn việc code)

1. **Vị trí điều hướng mobile:** icon "Phòng họp" ở header danh sách hội thoại, giữa Khám phá và Danh bạ (tương ứng icon ở header sidebar web). Không thêm tab thứ 4 vào thanh dưới (Chats · Archived · Requests · New) vì đó là đổi kiến trúc thông tin (design-system §10). Đổi = thêm một `Tab` vào `ConversationBottomBar` (một chỗ).
2. **Link https `…/meet/{code}` mở thẳng app** (Android App Links + iOS Universal Links): cần web phục vụ `/.well-known/assetlinks.json` + `apple-app-site-association` và owner cấp SHA-256 chứng chỉ ký Android + Apple Team ID (gap W1). Mặc định P1: chưa làm — vào bằng mã/link dán vào, thông báo, `platform://meet/…`.
3. **Foreground service trình bày màn hình Android:** mặc định **tự viết** `ScreenShareService.kt` (~70 dòng, không plugin, không xin quyền tối ưu pin). Phương án B: `flutter_background` như ví dụ LiveKit (ít code hơn nhưng xin `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` — rủi ro duyệt Google Play).
4. **iOS `UIBackgroundModes: audio`:** bật để cuộc họp tiếp tục khi khoá màn hình / chuyển app (như Meet/Teams). Ảnh hưởng: Cuộc gọi cũng được hưởng (tốt hơn), App Store cần mô tả lý do (âm thanh cuộc họp). Không bật ⇒ iOS tắt mic/tiếng sau vài giây ở nền, STOMP vẫn giữ nhưng app bị treo.
5. **Android ở nền khi không trình bày:** P1 không có foreground service "đang họp" (loại `microphone`) ⇒ từ Android 11, micro có thể bị hệ thống tắt khi app ở nền lâu. Đề xuất đo ở MT8; nếu cần, thêm service `microphone|camera` cùng mẫu `ScreenShareService` (P1.1).
6. **Nút mic/cam tắt màu `colorScheme.error`** — giống quyết định 6 của plan web (Meet làm vậy). Đổi = một hằng trong `ControlBar`/`PrejoinPreview`.
7. **Không có thanh mức âm micro trên màn chờ mobile** (web có): `livekit_client` 2.3 không có API mức âm cục bộ ổn định; nâng SDK bị chặn bởi `flutter_webrtc` 0.12 (C3).

## Ngoài phạm vi MT6–MT7

| Việc | Thuộc |
|---|---|
| Ma trận QC thiết bị thật đầy đủ (4G, 10 và 25 người, kill app giữa họp ⇒ `leftAt`), `sync-check` toàn tính năng họp | MT8 |
| Phụ đề, biên bản AI, action items, `@AI` trong chat họp, ô "Biên bản AI" | Meetings P2 |
| Trình bày màn hình **iOS** (Broadcast Upload Extension) | bản sau (owner chốt 2026-08-28, spec §7) |
| CallKit / ConnectionService (đổ chuông khi app tắt), PiP / thu nhỏ phòng họp, phím tắt bàn phím iPad, chọn micro/loa Bluetooth chi tiết | backlog |
| Ghi hình, khách ngoài không tài khoản, breakout, poll, whiteboard, làm mờ nền, co-editing ghi chú realtime | backlog (spec §7) |
| Gap W1 (App Links / Universal Links), D1 (`PON_WEB_URL` trong pipeline), S1 (FCM invited cho người vừa vào nền) | việc riêng (xem "Backend / web gaps") |

## Final gate (chạy trước khi merge `feat/meetings-p1` → `dev`, từ `apps/client`)

```bash
cd apps/client
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter gen-l10n
flutter analyze                    # 0 issues
flutter test                       # toàn bộ — gồm test/l10n, test/core, test/features/chat/calls/* (Cuộc gọi KHÔNG sửa)
flutter build apk --debug          # Kotlin service + manifest + strings.xml
flutter build ios --simulator --debug --no-codesign   # pbxproj + Localizable.strings + Info.plist
# Không thêm plugin mới ⇒ không cần `pod install`; nếu lỡ thêm: (cd ios && pod install), lỗi
# "higher minimum deployment version" ⇒ `pod install --repo-update` (memory CocoaPods).
wc -l lib/features/meetings/*/*.dart lib/features/meetings/ui/*/*.dart lib/features/meetings/ui/widgets/*/*.dart \
      lib/core/rtc/*.dart     # mỗi file ≤ 400
cd -

# không lọt file dev-only
git diff origin/main...HEAD --stat   # chỉ file MT1–MT7; không scripts/dev/, *.local, dart-define localhost
```
