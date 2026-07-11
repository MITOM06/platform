# Plan: Video thumbnail (poster + bỏ nút tải rời), Copy/Download vào menu 3 chấm, khung viewer ôm sát ảnh/video

> **Ngày:** 2026-07-10 | **Scope:** Web (`apps/web/`) + Flutter (`apps/client/`) — parity theo `sync.md`.
> Đây là plan nhiều phần độc lập — Claude Code có thể làm tuần tự, verify từng phần trước khi qua phần sau.

---

## 1. Video thumbnail trong bubble — bỏ nút tải rời + hiện ảnh đầu video (không còn nền đen)

### Web — `apps/web/components/chat/ImageContent.tsx` (`VideoContent`)

Hiện thumbnail là `bg-black` phẳng + icon Play + 1 nút Download ở góc dưới-phải (dòng ~230-244). Bỏ
nút Download khỏi thumbnail (download chuyển sang menu 3 chấm — mục 2 bên dưới), và thêm 1 thẻ
`<video>` ẩn controls làm nền để trình duyệt tự hiện frame đầu thay vì `bg-black` trơn:

```tsx
// Tìm:
<button
  type="button"
  onClick={() => setOpen(true)}
  className="group relative flex h-[150px] w-[220px] items-center justify-center overflow-hidden rounded-2xl bg-black"
>
  <div className="rounded-full bg-black/50 p-2.5 transition-colors group-hover:bg-black/70">
    <Play className="size-7 fill-white text-white" />
  </div>
  <a
    href={downloadMediaUrl(content)}
    target="_blank"
    rel="noopener noreferrer"
    onClick={(e) => e.stopPropagation()}
    className="absolute bottom-2 right-2 flex items-center justify-center rounded-full bg-black/50 p-1.5 text-white transition-colors hover:bg-black/70"
  >
    <Download className="size-3.5" />
  </a>
</button>

// Thay thành (bỏ nút download; thêm <video> làm poster tự nhiên):
<button
  type="button"
  onClick={() => setOpen(true)}
  className="group relative flex h-[150px] w-[220px] items-center justify-center overflow-hidden rounded-2xl bg-black"
>
  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
  <video
    src={url}
    preload="metadata"
    muted
    playsInline
    className="absolute inset-0 h-full w-full object-cover"
  />
  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />
  <div className="relative rounded-full bg-black/50 p-2.5 transition-colors group-hover:bg-black/70">
    <Play className="size-7 fill-white text-white" />
  </div>
</button>
```

**Lưu ý:** `preload="metadata"` khiến hầu hết trình duyệt hiện sẵn frame đầu tiên của video làm ảnh
tĩnh mà không cần tải hết file (Chrome/Edge/Safari làm điều này mặc định; Firefox đôi khi cần
`currentTime` được set 1 lần qua JS mới chịu vẽ frame — nếu sau khi test thấy Firefox vẫn đen, thêm 1
`onLoadedMetadata` handler set `videoRef.current.currentTime = 0.01` để ép hiện frame). Import
`Download` icon có thể bỏ nếu không còn dùng nơi khác trong file — kiểm tra trước khi xoá import.

### Flutter — `apps/client/lib/features/chat/ui/widgets/image_content.dart` (`VideoContent`)

Hiện thumbnail dùng `Icon(Icons.movie_creation_outlined)` cố định + nút download góc trên-phải (dòng
~269-296). Bỏ nút download (dời sang `FloatingReactionSheet` — mục 2), và thay icon tĩnh bằng frame
thật của video. Flutter KHÔNG có API dựng sẵn để lấy 1 frame từ URL video như `<video>` của web — cần
thêm package `video_thumbnail: ^0.5.3` (tạo file ảnh JPEG từ frame đầu, cache lại) hoặc dùng
`VideoPlayerController` khởi tạo + seek tới `Duration.zero` + `pause()` rồi hiển thị qua
`VideoPlayer` widget (không cần thêm package mới, TÁI DÙNG package `video_player` đã có sẵn từ plan
trước — **cách này ưu tiên hơn** vì tránh thêm dependency mới):

```dart
// VideoContent chuyển thành StatefulWidget, khởi tạo VideoPlayerController trong initState,
// initialize() xong thì setState (không autoPlay, không play — chỉ hiện frame đầu):
class VideoContent extends StatefulWidget {
  final String url;
  const VideoContent({super.key, required this.url});
  @override
  State<VideoContent> createState() => _VideoContentState();
}

class _VideoContentState extends State<VideoContent> {
  VideoPlayerController? _controller;

  @override
  void initState() {
    super.initState();
    final controller = VideoPlayerController.networkUrl(Uri.parse(absoluteMediaUrl(widget.url)));
    _controller = controller;
    controller.initialize().then((_) {
      if (mounted) setState(() {});
    }).catchError((_) {});
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    final ready = controller != null && controller.value.isInitialized;
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: GestureDetector(
        onTap: () => showVideoPlayer(context, widget.url),
        child: Container(
          width: 220,
          height: 150,
          color: Colors.black,
          child: Stack(
            alignment: Alignment.center,
            children: [
              if (ready)
                FittedBox(
                  fit: BoxFit.cover,
                  child: SizedBox(
                    width: controller.value.size.width,
                    height: controller.value.size.height,
                    child: VideoPlayer(controller),
                  ),
                )
              else
                const Icon(Icons.movie_creation_outlined, color: Colors.white24, size: 48),
              Container(
                decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
                padding: const EdgeInsets.all(10),
                child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 34),
              ),
              // Nút download đã bỏ — dùng menu 3 chấm (FloatingReactionSheet) thay thế.
            ],
          ),
        ),
      ),
    );
  }
}
```

**Trade-off cần biết:** cách này khởi tạo 1 `VideoPlayerController` cho MỖI thumbnail video trong danh
sách tin nhắn (kể cả khi không phát) — tốn tài nguyên hơn nếu 1 conversation có rất nhiều video cùng
lúc hiện trên màn hình. Nếu sau này thấy giật/lag khi scroll nhiều video, cân nhắc chuyển qua
`video_thumbnail` package (tạo file ảnh tĩnh 1 lần, cache, nhẹ hơn nhiều) — không làm trong plan này,
chỉ ghi chú lại.

---

## 2. Thêm Copy (ảnh) + Download (ảnh/video) vào menu 3 chấm — bỏ hẳn nút rời

### Web — `apps/web/components/chat/MessageActions.tsx`

```tsx
// Tìm:
const canCopy = message.type === 'text' || message.type === 'ai'

// Thay thành — copy giờ áp dụng thêm cho ảnh ĐƠN (không áp dụng multi-image, tránh mơ hồ "copy ảnh nào"):
const isSingleImage = message.type === 'image' && !message.content.trim().startsWith('[')
const canCopy = message.type === 'text' || message.type === 'ai' || isSingleImage
const canDownload = message.type === 'image' || message.type === 'video'
```

```tsx
// handleCopy hiện chỉ copy text — thêm nhánh copy ảnh thật (Clipboard API ghi blob):
const handleCopy = async () => {
  try {
    if (isSingleImage) {
      const res = await fetch(absoluteMediaUrl(message.content))
      const blob = await res.blob()
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
    } else {
      await navigator.clipboard.writeText(message.content)
    }
    toast.success(t('copySuccess'))
  } catch {
    toast.error(t('copyError'))
  }
}

// Thêm handler download:
const handleDownload = () => {
  const url = message.type === 'video'
    ? message.content
    : JSON.parse(message.content.trim().startsWith('[') ? message.content : `["${message.content}"]`)[0]
  window.open(downloadMediaUrl(url), '_blank', 'noopener,noreferrer')
}
```

```tsx
// Trong JSX menu, thêm ngay sau item Copy hiện có:
{canDownload && !message.recalled && (
  <DropdownMenuItem onClick={handleDownload}>
    <Download className="size-4" />
    {t('downloadAction')}
  </DropdownMenuItem>
)}
```

Import thêm `Download` từ `lucide-react`, và `absoluteMediaUrl`/`downloadMediaUrl` từ `@/lib/media`
nếu chưa có trong file. Thêm i18n key `downloadAction` (7 locale `messages/*.json`, namespace `chat`):
`"Download"` / `"Tải xuống"` (+ zh/ja/ko/fr/es).

**Lưu ý trình duyệt:** `navigator.clipboard.write` với `ClipboardItem` cần HTTPS (secure context) và
không hoạt động trên Firefox cũ/Safari < 13.1 — nếu `ClipboardItem` không tồn tại (`typeof
ClipboardItem === 'undefined'`), fallback: ẩn item Copy cho ảnh thay vì crash (feature-detect trước
khi hiện `canCopy` cho ảnh).

### Flutter — `apps/client/lib/features/chat/ui/widgets/floating_reaction_sheet.dart`

Hiện "Copy" (dòng 137-148) áp dụng cho MỌI loại tin nhắn, copy `message.fileUrl` hoặc `message.content`
dưới dạng TEXT (URL) — không phải copy ảnh thật. Sửa thành: với ảnh đơn → copy ảnh thật vào clipboard
hệ điều hành; giữ nguyên copy-text cho các loại khác. Thêm action Download riêng cho ảnh/video.

**Copy ảnh thật trên Flutter cần thêm package** — Flutter SDK chuẩn (`Clipboard.setData`) CHỈ hỗ trợ
text, không hỗ trợ ảnh. Cần `super_clipboard: ^0.8.x` (hỗ trợ ghi ảnh vào system clipboard trên cả
iOS/Android/desktop) — đây là dependency mới, khác với các gợi ý trước (video_player/chewie) vốn đã
add sẵn. **Quyết định thêm package mới nằm trong phạm vi "chi tiết implementation nhỏ" theo
CLAUDE.md (không phải kiến trúc), Claude Code tự thêm, không cần hỏi lại** — nhưng ghi rõ ở đây để
review khi duyệt `pubspec.yaml` diff.

```dart
// Thêm 2 ListTile mới, thay thế logic Copy hiện tại:
ListTile(
  leading: const Icon(Icons.copy_rounded, color: Colors.white70),
  title: Text(l10n.actionCopy, style: const TextStyle(color: Colors.white)),
  onTap: () async {
    context.pop();
    if (message.isImage && !message.isMultiImage) {
      await _copyImageToClipboard(message.content); // dùng super_clipboard, xem helper mới
    } else {
      final text = message.isFile ? message.fileUrl : message.content;
      await Clipboard.setData(ClipboardData(text: text));
    }
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.copiedToClipboard)),
      );
    }
  },
),
if (message.isImage || message.isVideo)
  ListTile(
    leading: const Icon(Icons.download_rounded, color: Colors.white70),
    title: Text(l10n.downloadAction, style: const TextStyle(color: Colors.white)),
    onTap: () {
      context.pop();
      downloadMedia(message.isVideo ? message.content : firstImageUrl(message.content));
    },
  ),
```

Kiểm tra `MessageModel` có sẵn getter `isImage`/`isVideo`/`isMultiImage` chưa — nếu chưa, thêm vào
`message_models.dart` (parse tương tự cách `_parseUrls` bên web làm với JSON array). Viết helper
`_copyImageToClipboard` trong file này hoặc `media_actions.dart` — tải ảnh về bytes (đã có sẵn
`_bytesForImage`-kiểu logic ở `staged_attachments_provider.dart`, có thể tham khảo cách tải bytes từ
URL) rồi ghi qua `SystemClipboard.instance` của `super_clipboard`.

Bỏ nút download rời trong `image_content.dart` VideoContent (đã làm ở mục 1) và trong
`video_player_dialog.dart` (dòng 114-131, nút Download góc trên) — **giữ lại** nút download trong
`video_player_dialog.dart` KHÔNG bị yêu cầu bỏ (user chỉ nói bỏ nút ở "gốc" của thumbnail trong bubble,
không nhắc tới dialog fullscreen) — Claude Code KHÔNG xoá nút này, chỉ xoá nút trên thumbnail bubble.

Thêm key l10n `downloadAction` vào 7 file `app_*.arb` nếu Flutter chưa có key tương đương (kiểm tra
trước, có thể đã tồn tại dưới tên khác).

---

## 3. Khung viewer (ảnh/video fullscreen) — bỏ khung đen to, ôm sát theo tỉ lệ media thật

**Chỉ áp dụng cho WEB.** Lý do: dialog fullscreen của Flutter (`VideoPlayerDialog`,
`image_gallery_viewer.dart`) đã dùng `insetPadding: EdgeInsets.zero` + `AspectRatio` căn giữa — đây là
pattern viewer toàn màn hình chuẩn trên mobile (nền đen full-bleed là bình thường/kỳ vọng trên mobile
fullscreen viewer), khác với popup/dialog trên web nơi nền đen to đùng bao quanh 1 video dọc nhỏ trông
như lỗi UI. Không đổi Flutter trong plan này.

### Web — `apps/web/components/chat/ImageContent.tsx`

Cả `ImageViewer` (ảnh, dòng ~140-215) và `VideoContent`'s dialog (video, dòng ~246-...) đều dùng
`DialogContent` với kích thước CỐ ĐỊNH (`max-w-[95vw]`, `h-[85vh] w-full` cho ảnh / không giới hạn
height cho video) fill `bg-black/95` toàn bộ box đó — bất kể media thật có tỉ lệ dọc hẹp, khung đen
vẫn to đúng bằng max-w/h cố định, gây khoảng đen thừa 2 bên (đúng như ảnh 3 user gửi).

**Fix:** đổi từ "khung cố định, media co giãn bên trong" → "khung co theo kích thước THẬT của media,
chỉ chừa 1 lớp đệm nhỏ làm viền":

```tsx
// ImageViewer — tìm:
<DialogContent
  className="flex max-w-[95vw] items-center justify-center border-none bg-black/95 p-0 sm:max-w-[90vw]"
  showCloseButton={false}
>
  ...
  <div className="relative flex h-[85vh] w-full items-center justify-center">
    <img src={...} className="max-h-full max-w-full object-contain" />

// Thay thành (bỏ h-85vh/w-full cố định; DialogContent tự co theo content, giới hạn max, thêm padding nhỏ làm "khung"):
<DialogContent
  className="flex w-fit h-fit max-w-[95vw] max-h-[92vh] items-center justify-center border-none bg-black/85 p-2 sm:p-3"
  showCloseButton={false}
>
  ...
  <div className="relative flex items-center justify-center">
    <img src={...} className="block max-h-[88vh] max-w-[93vw] object-contain rounded-sm" />
```

Tương tự cho `VideoContent`'s Dialog (`<video>` thay `<img>`, `max-h-[80vh]` giữ nguyên như hiện tại
hoặc đổi `max-h-[85vh]` cho nhất quán với ImageViewer — Claude Code tự chọn 1 số áp dụng đồng nhất cho
cả 2 viewer). Các nút overlay (Download/HD/Close/prev/next) VẪN giữ `absolute` như cũ — vì
`DialogContent` giờ co theo content, các nút `absolute right-3 top-3...` sẽ neo theo đúng cạnh media
thật (ảnh dọc → nút nằm sát viền phải ảnh dọc, không còn trôi giữa khoảng đen thừa).

**Kiểm tra chắc chắn:** ảnh/video NẰM NGANG (landscape) vẫn phải hiện to, rõ, không bị giới hạn quá
nhỏ — test cả 2 trường hợp orientation trước khi coi là xong.

---

## Verification

1. `pnpm build` (web), `flutter analyze` + `flutter pub get` (mobile, sau khi thêm `super_clipboard`).
2. Video bubble: hiện đúng frame đầu (không đen trơn), không còn nút download ở góc.
3. 3-dot menu (web) / long-press sheet (Flutter): tin nhắn text → Copy text; ảnh đơn → Copy ảnh thật
   (dán thử vào 1 chỗ khác — Notes/Paint — ra đúng ảnh) + Download; video → Download (không Copy, vì
   video không phải type được yêu cầu copy); ảnh multi (collage) → không có Copy (tránh mơ hồ), có
   Download (tải ảnh đầu tiên hoặc mở viewer — Claude Code tự quyết định hành vi hợp lý).
4. Mở fullscreen viewer (web) với 1 video/ảnh DỌC → khung đen chỉ viền sát quanh media, không còn dải
   đen 2 bên chiếm phần lớn dialog. Test thêm với ảnh/video NGANG → vẫn hiển thị to rõ bình thường.
5. Flutter fullscreen viewer giữ nguyên như cũ (không có thay đổi cần verify thêm ở mục 3).
