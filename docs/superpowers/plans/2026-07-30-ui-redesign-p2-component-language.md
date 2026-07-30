# Plan: UI Redesign — P2: Shared component visual language

> **Ngày:** 2026-07-30 | **Trạng thái:** ✅ Done, commit `a26f492c`
> **Scope:** Layer 2 của program redesign — xem `docs/superpowers/UI-REDESIGN-DIRECTION.md`
> §3 để biết vị trí trong chuỗi. Plan này được viết *trong lúc* thực thi (owner yêu cầu chạy
> tiếp ngay sau L1), nên nó là bản ghi quyết định chứ không phải spec viết trước.

---

## Bối cảnh

L1 (`2026-07-30-ui-redesign-p1-design-tokens.md`, commit `86ca2212`) chỉ đổi **giá trị** token tại
2 file nguồn, cố tình để lại nợ: symbol vẫn tên cũ (`ponCyan`/`--color-pon-cyan`) nhưng mang giá
trị burgundy, và mọi thứ hardcode ngoài token vẫn là neon. L2 trả nợ đó và bỏ hẳn ngôn ngữ thị
giác cũ (gradient trang trí, glow neon, glassmorphism, accent thứ 2).

Inventory đầu L2:

| | Web | Flutter |
|---|---|---|
| Ref qua symbol/token | 211 ref / 74 file | 460 ref / 117 file |
| Hex neon hardcoded | 16 ref / 7 file | **0** (đã đổi sẵn nhờ L1) |
| Accent thứ 2 (tím AI) | 26 ref (`#B47FFF`) | 45 ref (`#B47FFF`/`#2D1B69`/…) |
| Glow/aura neon dạng `rgba()` | 27 ref | rải rác per-screen |

---

## Quyết định đã chốt

1. **Web: `pon-cyan/peach/pink` → `primary`, KHÔNG phải `pon-accent`.**
   Đổi sang một token `pon-accent` cố định sẽ giữ 1 giá trị burgundy cho cả light lẫn dark.
   Dùng thẳng `primary` cho phép burgundy khác nhau theo theme (`#7A2E3A` light / `#A8475A` dark)
   như bảng palette đã spec, và xoá được 3 token thừa. → 3 `--color-pon-*` bị xoá khỏi `globals.css`.

2. **Flutter: `ponCyan/ponPeach/ponPink` → 1 `ponAccent`.**
   Flutter chỉ có 1 hằng số cho cả 2 theme (kiến trúc có sẵn), nên giữ `#96435B` trung gian.
   `ponGradient` bị xoá hẳn — không còn call site nào cần gradient.

3. **Gradient degenerate → phẳng.** Sau khi 3 màu collapse thành 1, mọi
   `bg-gradient-to-* from-X via-Y to-Z` mà tất cả stop đều là accent thì không còn là gradient.
   Guard bằng allow-list stop nên **gradient nhiều hue thật vẫn nguyên** — cụ thể là
   `wallpaper-presets.ts` / `chat_wallpaper_*.dart` (wallpaper là *content* người dùng chọn,
   không phải chrome) và avatar violet→teal của bot ngoài.

4. **Accent thứ 2 (tím AI) bị gộp vào accent duy nhất** — `UI-REDESIGN-DIRECTION.md` §2 rule 1
   chỉ cho phép 1 accent. Web `#B47FFF`; Flutter cả họ `#B47FFF`/`#9B7FFF`/`#7C3AED` →
   `#96435B`, `#6B2FA0`/`#831843` → `#7A2E3A`, `#2D1B69`/`#2A1020` → `#3A2A2C` (accent tint),
   `#D6BBFF`/`#D8C5FF` → `#E8B4BE`.

5. **Glow/shadow màu bị xoá** (rule 3: elevation bằng border 1px + bậc nền, không dùng shadow):
   top-loader glow, glow xanh mint của connector card, focus-glow của `PonTextField`,
   glow của `PonButton`/`PonCard`, `drop-shadow` neon của tab bar, glow bubble đã gửi.

6. **Aura mờ trang trí bị xoá** thay vì đổi màu — đây chính là "look" cũ, đổi hue vẫn còn sai:
   2 orb ở `(auth)/layout.tsx` + `(legal)/layout.tsx`, 2 orb ở `AuthShowcasePanel`, radial ở
   hero `ai-hub`, hover-glow ở `AiHubCard` (thay bằng `bg-accent/60` phẳng).

7. **`AuthShowcasePanel` viết lại.** Nền cũ là gradient indigo hardcoded
   (`#181030`/`#2a1350`/`#120a24`) + `backdrop-blur` + `shadow-2xl` — đúng hướng "dark indigo AI
   SaaS" đã bị reject. Bản mới bọc class `dark` để **toàn bộ subtree resolve token dark**, nhờ đó
   panel cam kết một look tối duy nhất mà không hardcode màu nào.

8. **Logo mark → phẳng `currentColor`.** Bỏ `<defs>`/`linearGradient` ở cả 3 SVG inline và
   `ShaderMask` bên Flutter. **Ngoại lệ `app/icon.svg`**: favicon được serve standalone nên CSS
   custom property KHÔNG resolve — phải giữ hex literal (`#7A2E3A`), có comment cảnh báo phải
   sync tay.

9. **Bubble chat bất đối xứng 14/4** (rule 5) trên cả 2 platform — web `rounded-[24px]` → `14px`
   với góc phía người gửi `4px`; Flutter `20` → `14` (đã có sẵn góc 4).

10. **`components/ui/` KHÔNG bị sửa** (`.claude/rules/web.md`). Đã verify: 0 file shadcn nào
    tham chiếu brand token — chúng thừa hưởng qua CSS variable nên tự đổi màu.

11. **Param cũ được giữ làm no-op** thay vì xoá: `PonCard.glowColor/glowStrength/blur/bgOpacity/
    borderOpacity` và `PonButton.gradientColors`. Xoá sẽ làm vỡ ~70 call site — ngoài phạm vi L2.
    `gradientColors` nếu được truyền thì honour **màu đầu tiên**, để nút cố ý khác màu vẫn đúng.
    Đánh dấu `TODO(ui-redesign-L3)`.

12. **Giữ nguyên:** motion (`@keyframes pon-*`, `AppMotion`) — chỉ là timing/easing;
    `pon-green`/`onlineGreen` (direction nói success green ngoài phạm vi); màu brand connector
    (Google `#EA4335`/`#FBBC05`…); wallpaper preset.

---

## Verification

- `pnpm --filter @platform/web build` → **PASS** (`✓ Compiled successfully`, không lỗi TS/lint).
- `cd apps/client && flutter analyze` → **No issues found!**
- `cd apps/client && flutter test` → **60/60 PASS**.
- Sweep cuối: 0 ref `ponCyan|ponPeach|ponPink|ponGradient` trong `apps/client/lib`;
  0 ref `pon-cyan|pon-peach|pon-pink|pon-gradient` trong web (ngoài 2 comment giải thích);
  0 hex neon cũ ở cả 2 app (trừ file wallpaper — cố ý).
- Tổng: **210 file, +882 / −952**.

### Chưa verify bằng mắt
Vẫn chưa mở app xem thật (Chrome automation của session trỏ sang máy khác; không có emulator
Flutter) — giống ghi chú cuối L1. Cần owner xác nhận cảm quan.

---

## Sai sót trong lúc thực thi (ghi lại để lần sau tránh)

Lần chạy script đầu tiên sửa **151 file** vì 2 lỗi: (a) không loại trừ `components/ui/`
— vi phạm `.claude/rules/web.md`; (b) có 2 regex "dọn whitespace" gây churn toàn bộ file mà không
đổi gì về nội dung. Đã `git checkout` revert sạch rồi viết lại script surgical (36 file). Bài học:
script refactor diện rộng phải **chỉ transform có chủ đích**, không kèm reformat, và phải
allow-list/deny-list thư mục ngay từ đầu.

Ngoài ra 2 regex xoá shadow để lại rác cú pháp (`dark:` treo lơ lửng trong `MessageBubble`,
`cn('...', active)` mất nhánh ở `MobileTabBar`) — bắt được nhờ đọc lại diff, không phải nhờ build
(cả 2 đều build pass). → Sau script luôn phải review diff, không chỉ tin build.

---

## Còn lại cho Layer 3 (per-screen batch)

Màu và component dùng chung đã đúng. Còn lại là *layout/spacing/radius per-screen*:

- `rounded-2xl`/`rounded-3xl` (24/32px) còn trên card & control ở ~15 file web — rule 4 muốn
  8–10 control / 12 card / 16–20 chỉ cho sheet.
- Flutter còn `boxShadow` glow per-screen (vd `conversation_tile.dart`) và vài gradient 2 stop
  trong avatar/badge.
- Xoá hẳn param no-op ở `PonCard`/`PonButton` + dọn ~70 call site.
- `contentPadding: horizontal 24` của input hơi rộng so với radius 10.
- Batch chia theo `UI-REDESIGN-DIRECTION.md` §3 Layer 3 (auth / chat core / settings / AI /
  admin / remainder), mỗi batch 1 plan, web + Flutter cùng lúc theo `.claude/rules/sync.md`.
