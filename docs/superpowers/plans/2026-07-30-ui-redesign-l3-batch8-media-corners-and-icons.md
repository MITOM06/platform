# Plan: UI Redesign — L3 batch 8: bo góc media trong bubble + icon "cheap Android" → rounded

> **Ngày:** 2026-07-30 | **Scope:** Flutter (`apps/client`) ONLY — bug này không tồn tại bên web (web
> dùng `lucide-react`, icon đã tròn/mềm sẵn, và ảnh/video trong bubble web đã có `rounded-*` riêng).
> Đọc `docs/superpowers/UI-REDESIGN-DIRECTION.md` trước. Chạy **cùng session** với
> `plans/2026-07-30-ui-redesign-l3-batch7-hairline-regression.md` (chưa thực thi) — cả 2 đều là phần
> owner phản hồi "UI xấu, góc vuông, icon như app Android rẻ tiền" từ cùng 1 lượt review.

---

## Bối cảnh

Owner gửi 2 ảnh chụp app thật (dark mode) và nói rõ: không phải chỉ là đường viền đen (đã có plan
batch 7 xử lý riêng) — vấn đề rộng hơn: **các góc bo quá vuông** ở khung media trong tin nhắn, và
**icon trông như app Android rẻ tiền**. Đối chiếu ảnh với code, đã xác định được 2 bug cụ thể, có
bằng chứng rõ ràng (không phải cảm tính):

### Bug A — Ảnh đơn gửi trong chat hoàn toàn KHÔNG bo góc
`image_content.dart` → `_SingleImageTile` (nhánh 1 ảnh, trường hợp phổ biến nhất khi gửi ảnh) chỉ bọc
`CachedNetworkImage` trong `ConstrainedBox` — **không có `ClipRRect`/`borderRadius` nào cả**. Bubble
cha (`message_bubble.dart`) có bo góc 14px nhưng **không set `clipBehavior`**, nên theo hành vi mặc
định của Flutter, `Container.decoration.borderRadius` không tự clip children — ảnh vẫn tràn ra với
góc vuông 90°, ngay trong 1 bubble có góc bo mềm. Đây gần như chắc chắn là chính xác thứ owner đang
thấy "góc quá vuông" trong ảnh 2 owner gửi (khung video đen, góc sắc).

So sánh: `_MultiImageGrid` (2+ ảnh) LÀM ĐÚNG — có `ClipRRect(borderRadius: BorderRadius.circular(14))`
bọc ngoài. Chỉ riêng nhánh 1-ảnh bị thiếu.

### Bug B — Video bo góc lệch token so với bubble
`VideoContent` dùng `ClipRRect(borderRadius: BorderRadius.circular(AppTheme.radiusCard))` =
**12px**, trong khi bubble tin nhắn (`message_bubble.dart` dòng ~244) và multi-image grid đều dùng
**14px** (đúng theo rule radius bubble ở `UI-REDESIGN-DIRECTION.md`). Lệch 2px không lớn nhưng đứng
cạnh nhau (video trong bubble 14px) sẽ nhìn "cứng" hơn phần còn lại — góp phần vào cảm giác "quá
vuông".

### Bug C — Icon "như app Android rẻ tiền"
Toàn app Flutter đang trộn lẫn 3 kiểu icon Material: **`_rounded`** (132 lần dùng, kiểu mềm/hiện đại,
ĐÚNG hướng thiết kế), **`_outlined`** (171 tên icon khác nhau) và **không hậu tố / filled** (140 tên
icon khác nhau) — 2 nhóm sau là bộ glyph mặc định "stock Material" mà nhiều người nhận ra ngay là
"trông như app Android generic" (viền mảnh, góc/đầu nét sắc, không đồng bộ với phần còn lại của app
đã theo hướng bo tròn — `UI-REDESIGN-DIRECTION.md` §2). Web đã nhất quán dùng `lucide-react` (icon
tròn, nét đều) nên KHÔNG có bug này — chỉ Flutter bị.

Icon chrome ở đúng 2 ảnh owner gửi, ví dụ: `Icons.explore_outlined`, `Icons.people_alt_outlined`
(`conversation_list_screen.dart`), `Icons.forum_outlined` (`responsive_home_layout.dart`),
`Icons.movie_creation_outlined` (fallback video chưa tải xong, `image_content.dart`) — đều thuộc
nhóm cần đổi.

---

## Task 1 — Bo góc ảnh đơn trong bubble (Bug A)

File: `apps/client/lib/features/chat/ui/widgets/image_content.dart`, class `_SingleImageTile`.

Bọc `image` (biến đã build ở dòng ~69-95) bằng `ClipRRect(borderRadius: BorderRadius.circular(14))`
**trước khi** trả về từ `build()` — áp dụng cho CẢ 2 nhánh (standalone 1-ảnh và khi dùng làm ô trong
`_MultiImageGrid`, vì hiện tại chỉ nhánh grid có clip từ bên ngoài; clip thêm ở trong không hại gì,
chỉ cần đảm bảo bo góc không nhân đôi/lệch — dùng `Radius.circular(14)` thống nhất, chấp nhận multi
tile trong grid có thể bo nhẹ ở góc trong, không đáng kể).

Cách an toàn nhất: bọc trực tiếp biến `image` bằng `ClipRRect(borderRadius: BorderRadius.circular(14), child: image)`
ngay tại dòng gán, trước khối `if (allUrls.length == 1) { ... }`.

## Task 2 — Đồng bộ radius video về đúng token bubble (Bug B)

File: `apps/client/lib/features/chat/ui/widgets/video_player_dialog.dart`? — **không**, sửa tại
`image_content.dart`, class `VideoContent`, dòng ~291:
```dart
borderRadius: BorderRadius.circular(AppTheme.radiusCard),
```
đổi thành:
```dart
borderRadius: BorderRadius.circular(14),
```
(khớp đúng hằng số bubble dùng — không thêm token mới, dùng literal `14` giống cách
`message_bubble.dart`/`_MultiImageGrid` đang làm, để 3 chỗ nhất quán).

## Task 3 — Icon: sweep `_outlined` / filled mặc định → `_rounded`

**Quy tắc chung (mechanical, áp dụng toàn app Flutter):** với mọi `Icons.<name>_outlined` hoặc
`Icons.<name>` (không hậu tố, dùng như filled icon trong UI — bỏ qua icon vốn không có biến thể,
ví dụ tên riêng biệt không theo quy ước 4-style), kiểm tra Flutter SDK có tồn tại
`Icons.<name>_rounded` không — nếu có, đổi sang. Cách làm an toàn:

1. Với từng file, đổi thử `Icons.xxx_outlined` → `Icons.xxx_rounded` và `Icons.xxx` (filled trần) →
   `Icons.xxx_rounded`.
2. Chạy `flutter analyze` ngay sau mỗi batch nhỏ (theo từng thư mục `features/<name>/`) — icon nào
   không tồn tại biến thể `_rounded` sẽ báo lỗi "isn't defined" ngay lập tức, lúc đó **giữ nguyên
   bản gốc cho riêng icon đó** (rollback đúng 1 dòng) rồi tiếp tục.
3. **Không đổi** icon mang nghĩa trạng thái đặc thù nếu bản `_rounded` đổi luôn cả ý nghĩa hình dạng
   (hiếm, nhưng kiểm tra riêng: `Icons.circle`/`Icons.circle_outlined` dùng làm bullet/dot — giữ
   nguyên vì không có khái niệm "rounded" cho hình tròn).
4. Ưu tiên làm trước các file xuất hiện trực tiếp trong 2 ảnh owner gửi (để verify nhanh bằng mắt):
   - `lib/features/chat/ui/conversation_list_screen.dart` (bell/compass/people/plus ở header)
   - `lib/features/home/ui/responsive_home_layout.dart`
   - `lib/features/chat/ui/widgets/image_content.dart` (`movie_creation_outlined`,
     `broken_image_outlined`)
   - `lib/features/chat/ui/chat_screen.dart` / `chat_app_bar.dart` (nút gọi thoại/video, nút info)
   - `lib/features/chat/ui/widgets/conversation_bottom_bar.dart` (thanh nhập liệu: emoji, đính kèm,
     mic)
   Sau đó quét tiếp toàn bộ `lib/` theo cùng quy tắc.

**Lệnh đếm tiến độ (chạy trước/sau để biết còn bao nhiêu):**
```bash
cd apps/client/lib
grep -ro "Icons\.[a-zA-Z0-9_]*" . | wc -l                                   # tổng số lần dùng
grep -ro "Icons\.[a-zA-Z0-9_]*_rounded" . | wc -l                           # đã rounded (mục tiêu: tăng dần)
grep -roE "Icons\.[a-zA-Z0-9_]*" . | sort -u | grep -vE "_rounded$" | wc -l # số TÊN icon còn cần xét
```
Baseline lúc viết plan: 453 lượt dùng, 132 đã `_rounded`, 140 tên filled-trần + 171 tên `_outlined`
còn lại cần xét (một số ít sẽ không có biến thể `_rounded` — chấp nhận giữ nguyên, không phải lỗi).

---

## Verification

```bash
cd apps/client
flutter analyze          # phải "No issues found!"
flutter test              # nếu có test liên quan tới các widget đã sửa, chạy để chắc không vỡ golden/UI test
```
Sau đó chụp lại đúng 2 màn hình owner gửi (conversation list + chat có ảnh/video) ở light **và**
dark mode, so trước/sau: ảnh/video trong bubble phải bo góc mềm khớp bubble, icon ở header/thanh
nhập liệu phải là kiểu tròn (rounded), không còn kiểu "outline sắc cạnh" mặc định.

---

## Ghi log sau khi xong

Thêm mục **8** vào `docs/superpowers/UI-REDESIGN-DIRECTION.md` §3, theo đúng format các mục 1-7,
mô tả ngắn: bug thiếu `ClipRRect` ở ảnh đơn, lệch radius video, và số lượng icon đã sweep sang
`_rounded`.
