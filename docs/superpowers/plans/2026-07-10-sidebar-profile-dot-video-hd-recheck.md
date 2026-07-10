# Plan: Sidebar Own-Avatar Green Dot (mới) + Recheck Video/HD (đã fix, chỉ cần rebuild)

> **Ngày:** 2026-07-10
> **Scope:** Web (`apps/web/`) — 1 bug thật sự mới. 2 mục còn lại là recheck, KHÔNG cần code mới.

---

## Bối cảnh

User báo lại 3 vấn đề trong 1 tin nhắn kèm screenshot (account bar "Test Owner" / owner@example.com
với chấm xanh). Đã verify từng cái bằng cách đọc trực tiếp code hiện tại trên branch:

| # | Vấn đề user báo | Đã có code fix chưa? |
|---|---|---|
| 1 | Chấm xanh "đang hoạt động" trên avatar chính mình (account bar dưới cùng sidebar) | ❌ **CHƯA — bug thật, chưa từng có plan nào đụng tới chỗ này** |
| 2 | HD toggle vẫn per-image thay vì 1 nút global | ✅ Đã fix — `use-staged-attachments.ts` (`isAllHD`) + `staged_attachments_provider.dart` (`isAllHDProvider`), cả web lẫn Flutter, single global toggle, không còn per-tile button |
| 3 | Video: bấm xem bị nhảy trang tải về thay vì phát trực tiếp | ✅ Đã fix — web `VideoContent` (`ImageContent.tsx`) mở `<Dialog>` với `<video controls autoPlay>`, nút download tách riêng có `stopPropagation`; Flutter `VideoContent` (`image_content.dart`) gọi `showVideoPlayer()` → `VideoPlayerDialog` (chewie), nút download tách riêng |

**Kết luận cho #2 và #3:** code đã đúng theo đúng bug user mô tả. Nhiều khả năng bản build/app user
đang test chưa pick up các commit gần nhất (`a6655116`, `b0d8b852`). **Không viết plan mới cho 2
mục này** — việc cần làm là rebuild + restart, không phải sửa code (xem mục "Việc cần làm ngay" cuối
file). Nếu sau khi rebuild mà vẫn còn bug y hệt, quay lại báo — lúc đó mới cần investigate thêm (có
thể là bug khác, hoặc do CDN/proxy cache).

---

## Bug thật — Chấm xanh trên account bar (own avatar), không bao giờ tắt

### Root cause

`apps/web/components/layout/SidebarProfileBar.tsx` dòng 78:

```tsx
<span className="absolute bottom-0.5 right-0.5 size-3 rounded-full border-2 border-background bg-emerald-500" />
```

Đây là component pin ở cuối sidebar desktop (`hidden md:block`), khác với `settings/page.tsx` (đã bỏ
dot ở `228eb28f`) và `active_friends_row.dart` (đã lọc own-user ở `a6655116`). Chấm xanh ở đây là
**hardcoded**, không dựa vào state nào cả — luôn hiện bất kể có đang "online" hay không. Vì đây là
avatar của chính mình, hiển thị "tôi đang online" cho chính mình là vô nghĩa (không giống dot trên
avatar bạn bè, biểu thị trạng thái của NGƯỜI KHÁC).

Đã grep toàn bộ `apps/web` cho `bg-emerald-500`/`bg-online-green` cạnh avatar — đây là **chỗ duy
nhất còn sót lại**. `settings/page.tsx` và `ActiveFriendsRow.tsx` đều sạch.

Đã check Flutter (`apps/client/lib`) — không có widget tương đương (mobile dùng entry point khác,
đơn giản hơn, không có account-switcher bar này) — **fix chỉ cần trên web.**

### Fix

```tsx
// Tìm (SidebarProfileBar.tsx, trong JSX của <DropdownMenuTrigger>):
            {/* Avatar with PON-gradient ring + presence dot */}
            <span className="relative shrink-0">
              <span className="block rounded-full bg-gradient-to-br from-pon-cyan via-pon-peach to-pon-pink p-[2px] shadow-[0_0_12px_-2px] shadow-pon-peach/40">
                <Avatar className="size-11 border-2 border-background">
                  {user.avatarUrl && (
                    <AvatarImage src={absoluteMediaUrl(user.avatarUrl)} alt={user.displayName} />
                  )}
                  <AvatarFallback className="bg-background text-sm font-semibold text-foreground">
                    {getInitials(user.displayName)}
                  </AvatarFallback>
                </Avatar>
              </span>
              <span className="absolute bottom-0.5 right-0.5 size-3 rounded-full border-2 border-background bg-emerald-500" />
            </span>

// Thay thành (xoá dòng presence dot, giữ nguyên avatar):
            <span className="relative shrink-0">
              <span className="block rounded-full bg-gradient-to-br from-pon-cyan via-pon-peach to-pon-pink p-[2px] shadow-[0_0_12px_-2px] shadow-pon-peach/40">
                <Avatar className="size-11 border-2 border-background">
                  {user.avatarUrl && (
                    <AvatarImage src={absoluteMediaUrl(user.avatarUrl)} alt={user.displayName} />
                  )}
                  <AvatarFallback className="bg-background text-sm font-semibold text-foreground">
                    {getInitials(user.displayName)}
                  </AvatarFallback>
                </Avatar>
              </span>
            </span>
```

Cũng xoá comment `{/* Avatar with PON-gradient ring + presence dot */}` → đổi thành
`{/* Avatar with PON-gradient ring */}` cho khỏi lệch với code thật.

### Verification

1. `pnpm build` trong `apps/web/` — PASS, không lỗi TS/lint.
2. Mở web app (đăng nhập bất kỳ), resize ≥768px (md breakpoint) để account bar hiện — xác nhận
   avatar KHÔNG còn chấm xanh ở góc dưới-phải.
3. Chấm xanh trên avatar BẠN BÈ (ví dụ trong danh sách hội thoại / active friends row) vẫn phải còn
   nguyên — đây là fix có chủ đích chỉ cho own-avatar, không đụng tới presence indicator của người
   khác.

---

## Việc cần làm ngay (không phải code) — cho mục #2 và #3

Trước khi coi 2 mục HD-toggle và video-playback là "chưa fix", cần loại trừ khả năng build cũ:

1. **Web:** deploy lại / `pnpm build && pnpm start` (hoặc restart container nếu chạy Docker) để lấy
   code từ `a6655116` trở đi. Hard-refresh browser (Cmd+Shift+R) để bỏ qua cache JS bundle cũ.
2. **Mobile (Flutter):** rebuild lại app (`flutter run` / rebuild APK-IPA) — nếu user đang test bản
   cài cũ trên máy/simulator thì chưa có `video_player`/`chewie` (mới thêm vào `pubspec.yaml` ở
   `a6655116`), chưa có `isAllHDProvider`.
3. Sau khi rebuild, test lại đúng kịch bản user mô tả: "A up video → B bấm xem". Nếu vẫn y hệt bug
   cũ (nhảy trang tải về) sau khi đã chắc chắn rebuild — báo lại kèm: platform (web/mobile), OS/browser,
   và video có phải file lớn/định dạng lạ không (một số codec browser không decode được qua thẻ
   `<video>`, sẽ fallback khác nhau tùy trình duyệt).

---

## Lưu ý cho Claude Code

- Chỉ 1 file cần sửa: `apps/web/components/layout/SidebarProfileBar.tsx`.
- Không cần thêm i18n key nào (không có text mới).
- Không cần đụng Flutter — không có component tương đương.
- Build verification: `pnpm build` trong `apps/web/` là đủ.
