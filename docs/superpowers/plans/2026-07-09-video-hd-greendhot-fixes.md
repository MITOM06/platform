# Plan: Video Inline Player + HD Global Toggle + Own Avatar Green Dot

> **Ngày:** 2026-07-09
> **Scope:** Web + Flutter. 3 fixes độc lập.
> **Status:** ✅ DONE (2026-07-09). Web `pnpm build` PASS, Flutter `flutter analyze` PASS (no issues).

---

## Fix 1 — Own avatar không được hiện green dot

### Web — `apps/web/app/(main)/settings/page.tsx`

Tìm và xóa dòng hardcoded green dot (đã xác định từ plan `2026-07-08-ui-polish-5-issues.md` Issue 3):
```tsx
<div className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-online-green border-2 border-background" />
```
→ **Xóa dòng này.**

### Flutter — `apps/client/lib/features/chat/ui/widgets/active_friends_row.dart`

Root cause: Nếu own user xuất hiện trong danh sách online friends, `online: status?.online ?? true` default `true` → green dot.

**Cách 1 (nếu own user đang lọt vào friend list):** Lọc ra khi build list. Đọc `authNotifierProvider` để lấy `currentUserId`, sau đó filter:

Tìm đoạn trong `ActiveFriendsRow.build()` nơi render online friends:
```dart
final online = ref.watch(onlineFriendsNotifierProvider).valueOrNull ?? [];
```

Thêm filter own user:
```dart
final authState = ref.watch(authNotifierProvider).valueOrNull;
final ownId = authState is AuthAuthenticated ? authState.user.id : null;
final online = (ref.watch(onlineFriendsNotifierProvider).valueOrNull ?? [])
    .where((f) => f.id != ownId)   // exclude own user
    .toList();
```

**Cách 2 (nếu issue ở ConversationAvatar với online param):** Kiểm tra mọi nơi `ConversationAvatar` được gọi với `online: true` mà `userId == currentUser.id` và thay thành `online: false`.

**Cách 3 (nếu issue ở SettingsAvatarSection hoặc profile tile nào đó):** Search `onlineGreen` + `Positioned` trong toàn bộ `lib/features/settings/` và `lib/features/chat/` — nếu thấy green dot Container trên own-user avatar, xóa đi.

Claude Code: chạy cả 3 check trên, xử lý bất kỳ case nào thấy green dot trên own user.

---

## Fix 2 — HD toggle: 1 nút global cho tất cả ảnh

### Web — `apps/web/components/chat/MediaPreviewStrip.tsx`

**Vấn đề hiện tại:** Mỗi ảnh có nút HD riêng (button trong `_StagedTile` / thumbnail div).

**Fix:**
1. Xóa `isHD` field khỏi `PendingAttachment` interface.
2. Thêm prop `isAllHD: boolean` và `onToggleAllHD: () => void` vào `MediaPreviewStrip` Props.
3. Xóa nút HD button bên trong từng thumbnail.
4. Thêm 1 nút HD global ở góc trên-phải của strip header.

**Thay đổi `PendingAttachment` interface:**
```tsx
// Xóa:
// isHD: boolean

// Interface sau khi sửa:
export interface PendingAttachment {
  id: string
  file: File
  previewUrl: string
  type: 'image' | 'video' | 'file'
  // isHD đã chuyển thành global flag, không còn per-attachment
}
```

**Thay đổi `MediaPreviewStrip` Props:**
```tsx
interface Props {
  attachments: PendingAttachment[]
  isAllHD: boolean
  onRemove: (id: string) => void
  onToggleAllHD: () => void
  onAddMore: () => void
}
```

**Thêm header row với HD toggle:**
```tsx
export function MediaPreviewStrip({ attachments, isAllHD, onRemove, onToggleAllHD, onAddMore }: Props) {
  if (attachments.length === 0) return null
  const hasImages = attachments.some((a) => a.type === 'image')

  return (
    <div className="border-t bg-background/95 px-3 pt-2 pb-1">
      {/* Header: count + HD toggle */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">
          {attachments.length} {attachments[0]?.type === 'file' ? 'file' : 'ảnh/video'}
        </span>
        {hasImages && (
          <button
            onClick={onToggleAllHD}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
              isAllHD
                ? 'bg-pon-cyan/20 text-pon-cyan border border-pon-cyan/40'
                : 'bg-muted/60 text-muted-foreground border border-border'
            }`}
            title={isAllHD ? 'HD — gửi chất lượng gốc' : 'SD — gửi ảnh nén'}
          >
            <Zap className="size-3" />
            HD {isAllHD ? 'BẬT' : 'TẮT'}
          </button>
        )}
      </div>

      {/* Thumbnails — không còn HD button per-thumbnail */}
      <div className="flex items-start gap-2 overflow-x-auto no-scrollbar">
        {/* ... thumbnails without individual HD button ... */}
      </div>
    </div>
  )
}
```

**Cập nhật `MessageInput.tsx`:**

Đổi state từ `pendingAttachments` có `isHD` per-item thành thêm 1 state global:
```tsx
const [isAllHD, setIsAllHD] = useState(true)
```

Cập nhật `handleSend` để dùng `isAllHD` thay vì `att.isHD`:
```tsx
// Thay vì: if (!att.isHD) fileToUpload = await compressImage(att.file, 0.7)
// Thành:
if (!isAllHD) fileToUpload = await compressImage(att.file, 0.7)
```

Cập nhật usage của `MediaPreviewStrip`:
```tsx
<MediaPreviewStrip
  attachments={pendingAttachments}
  isAllHD={isAllHD}
  onRemove={...}
  onToggleAllHD={() => setIsAllHD((v) => !v)}
  onAddMore={...}
/>
```

Reset `isAllHD` về `true` sau khi gửi xong.

### Flutter — `apps/client/lib/features/chat/ui/widgets/media_preview_strip.dart`

**Vấn đề hiện tại:** `_StagedTile` có nút HD riêng, `StagedAttachmentsNotifier` có `toggleHD(id)` per-item.

**Fix:**

**1. Thêm global HD state vào `StagedAttachmentsNotifier`** (`staged_attachments_provider.dart`):

```dart
// Thêm field:
bool _isAllHD = true;
bool get isAllHD => _isAllHD;

void setAllHD(bool value) {
  _isAllHD = value;
  // Không cần notify (widget sẽ watch provider khác hoặc dùng callback)
}
```

Hoặc đơn giản hơn: tạo provider riêng:
```dart
final isAllHDProvider = StateProvider.family<bool, String>(
  (ref, conversationId) => true,  // default HD ON
);
```

**2. Xóa nút HD trong `_StagedTile`** — xóa phần `GestureDetector` với `onToggleHD` và HD badge.

**3. Thêm global HD toggle button** vào `MediaPreviewStrip.build()`, trong phần header (trước `SizedBox(height: 84)`):

```dart
Row(
  mainAxisAlignment: MainAxisAlignment.spaceBetween,
  children: [
    Text(
      '${attachments.length} ${isMedia ? context.l10n.media : context.l10n.file}',
      style: TextStyle(fontSize: 12, color: Colors.white54),
    ),
    if (isMedia)
      GestureDetector(
        onTap: () {
          final current = ref.read(isAllHDProvider(conversationId));
          ref.read(isAllHDProvider(conversationId).notifier).state = !current;
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: isAllHD
                ? AppTheme.ponCyan.withValues(alpha: 0.15)
                : Colors.white.withValues(alpha: 0.08),
            border: Border.all(
              color: isAllHD
                  ? AppTheme.ponCyan.withValues(alpha: 0.5)
                  : Colors.white24,
            ),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.bolt, size: 12,
                  color: isAllHD ? AppTheme.ponCyan : Colors.white38),
              const SizedBox(width: 3),
              Text(
                'HD ${isAllHD ? "BẬT" : "TẮT"}',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: isAllHD ? AppTheme.ponCyan : Colors.white38,
                ),
              ),
            ],
          ),
        ),
      ),
  ],
),
const SizedBox(height: 8),
```

**4. Cập nhật `flush()` trong `StagedAttachmentsNotifier`** để dùng `ref.read(isAllHDProvider(conversationId))` thay vì `att.isHD`.

---

## Fix 3 — Video phát inline thay vì download

### Root cause

**Web (`ImageContent.tsx`):**
```tsx
// Hiện tại: mở new tab → browser quyết định (thường là download)
export function VideoContent({ content }: { content: string }) {
  return (
    <a href={absoluteMediaUrl(content)} target="_blank" rel="noopener noreferrer" ...>
      <Play ... />
    </a>
  )
}
```

**Flutter (`image_content.dart`):**
```dart
// Hiện tại: mở external app (browser) → browser download
onTap: () => openExternally(url),
```

### Fix Web — Video Lightbox Dialog

Sửa `VideoContent` trong `apps/web/components/chat/ImageContent.tsx`:

```tsx
export function VideoContent({ content }: { content: string }) {
  const [open, setOpen] = useState(false)
  const t = useTranslations('chat')
  const url = absoluteMediaUrl(content)

  return (
    <>
      {/* Thumbnail button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative flex h-[150px] w-[220px] items-center justify-center overflow-hidden rounded-2xl bg-black group"
      >
        <div className="rounded-full bg-black/50 p-2.5 group-hover:bg-black/70 transition-colors">
          <Play className="size-7 fill-white text-white" />
        </div>
        <div className="absolute bottom-2 right-2">
          <a
            href={downloadMediaUrl(content)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="rounded-full bg-black/50 p-1.5 flex items-center justify-center hover:bg-black/70 transition-colors"
          >
            <Download className="size-3.5 text-white" />
          </a>
        </div>
      </button>

      {/* Inline video dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="flex max-w-[95vw] items-center justify-center border-none bg-black/95 p-0 sm:max-w-[85vw]"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">{t('videoViewer')}</DialogTitle>
          <DialogA11yDescription />
          <div className="relative flex flex-col items-center justify-center w-full">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={url}
              controls
              autoPlay
              className="max-h-[80vh] max-w-full rounded-lg"
              style={{ outline: 'none' }}
            />
            <div className="absolute top-3 right-3 flex gap-2">
              <a
                href={downloadMediaUrl(content)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
              >
                <Download className="size-4" />
              </a>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

**Import thêm** vào `ImageContent.tsx`:
```tsx
import { useState } from 'react'   // đã có
import { Download, X, Play } from 'lucide-react'  // thêm Download nếu chưa có
// Dialog, DialogContent, DialogTitle đã được import
```

**Thêm i18n key** `"videoViewer"` vào tất cả 7 `messages/*.json`:
```json
// en.json:
"videoViewer": "Video viewer"
// vi.json:
"videoViewer": "Xem video"
// (zh/ja/ko/fr/es tương tự)
```

### Fix Flutter — Inline Video Player

Thêm package `video_player` và `chewie` vào `apps/client/pubspec.yaml`:
```yaml
dependencies:
  # ... existing deps ...
  video_player: ^2.9.5
  chewie: ^1.11.0
```

Tạo file mới: `apps/client/lib/features/chat/ui/widgets/video_player_dialog.dart`

```dart
import 'package:chewie/chewie.dart';
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/media_url.dart';
import 'media_actions.dart';

/// Full-screen inline video player dialog — shown when the user taps a video
/// bubble instead of opening an external browser (which would trigger a download).
class VideoPlayerDialog extends StatefulWidget {
  final String rawUrl;
  const VideoPlayerDialog({super.key, required this.rawUrl});

  @override
  State<VideoPlayerDialog> createState() => _VideoPlayerDialogState();
}

class _VideoPlayerDialogState extends State<VideoPlayerDialog> {
  late VideoPlayerController _controller;
  ChewieController? _chewieController;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final url = absoluteMediaUrl(widget.rawUrl);
    _controller = VideoPlayerController.networkUrl(Uri.parse(url));
    try {
      await _controller.initialize();
      _chewieController = ChewieController(
        videoPlayerController: _controller,
        autoPlay: true,
        looping: false,
        aspectRatio: _controller.value.aspectRatio,
        materialProgressColors: ChewieProgressColors(
          playedColor: AppTheme.ponCyan,
          bufferedColor: AppTheme.ponCyan.withValues(alpha: 0.3),
          handleColor: AppTheme.ponCyan,
          backgroundColor: Colors.white24,
        ),
      );
      if (mounted) setState(() {});
    } catch (_) {
      if (mounted) setState(() => _error = true);
    }
  }

  @override
  void dispose() {
    _chewieController?.dispose();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.black,
      insetPadding: EdgeInsets.zero,
      child: Stack(
        children: [
          if (_error)
            const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.error_outline, color: Colors.white54, size: 48),
                  SizedBox(height: 12),
                  Text('Không thể phát video',
                      style: TextStyle(color: Colors.white54)),
                ],
              ),
            )
          else if (_chewieController != null)
            Center(
              child: AspectRatio(
                aspectRatio: _controller.value.aspectRatio,
                child: Chewie(controller: _chewieController!),
              ),
            )
          else
            const Center(
              child: CircularProgressIndicator(color: AppTheme.ponCyan),
            ),

          // Close button
          Positioned(
            top: 12,
            right: 12,
            child: Material(
              color: Colors.black54,
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: () => Navigator.of(context).pop(),
                child: const Padding(
                  padding: EdgeInsets.all(8),
                  child: Icon(Icons.close, color: Colors.white, size: 20),
                ),
              ),
            ),
          ),

          // Download button
          Positioned(
            top: 12,
            right: 56,
            child: Material(
              color: Colors.black54,
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: () => downloadMedia(widget.rawUrl),
                child: const Padding(
                  padding: EdgeInsets.all(8),
                  child: Icon(Icons.download_rounded,
                      color: Colors.white, size: 20),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Convenience function — show the video player dialog.
Future<void> showVideoPlayer(BuildContext context, String rawUrl) {
  return showDialog(
    context: context,
    barrierColor: Colors.black87,
    builder: (_) => VideoPlayerDialog(rawUrl: rawUrl),
  );
}
```

**Sửa `VideoContent` trong `apps/client/lib/features/chat/ui/widgets/image_content.dart`:**

```dart
// Tìm:
onTap: () => openExternally(url),

// Thay thành:
onTap: () => showVideoPlayer(context, url),
```

Thêm import:
```dart
import 'video_player_dialog.dart';
```

**Chạy sau khi thêm packages:**
```bash
cd apps/client && flutter pub get
```

---

## Verification

### Fix 1 (Green dot):
- Mở web → Settings → own avatar KHÔNG có green dot
- Mở Flutter → conversation list → own avatar (top-right AppBar) KHÔNG có green dot
- Mở Flutter → active friends row → own user không xuất hiện trong list

### Fix 2 (HD toggle):
- Upload 3 ảnh → preview strip hiện 1 nút "HD BẬT" ở góc trên-phải
- Click nút → đổi thành "HD TẮT", tất cả ảnh sẽ được compress khi gửi
- Click lại → "HD BẬT" trở lại

### Fix 3 (Video):
- User A gửi video
- User B click vào video bubble → video player dialog mở trong app, video tự động phát
- Không có download popup
- Nút download ở góc trên để tải về tùy ý

---

## Lưu ý cho Claude Code

### Fix 1
- Web: xóa **đúng 1 dòng** ở `settings/page.tsx` (đã identify trước đó)
- Flutter: chạy search `grep -rn "onlineGreen\|online: true" lib/` để xác nhận location, rồi mới sửa

### Fix 2
- Web: `PendingAttachment.isHD` field bị remove → các chỗ reference `att.isHD` trong `MessageInput.tsx` phải đổi sang `isAllHD` state
- Flutter: `stagedAttachmentsProvider` `toggleHD(id)` method có thể giữ lại (không dùng) hoặc xóa; thêm `isAllHDProvider` family provider mới
- Reset `isAllHD` về `true` (web) / reset `isAllHDProvider` (Flutter) sau khi flush/send thành công

### Fix 3
- Web: `VideoContent` đã dùng `useState` import từ React — đã có sẵn trong file. Kiểm tra `Download` có trong lucide import hay chưa.
- Web: `<video>` element cần `controls autoPlay` — không cần custom controls
- Flutter: `chewie` package cần `video_player` as peer dep — thêm cả 2 vào pubspec.yaml
- Flutter: `VideoPlayerController.networkUrl()` là API mới (thay thế `VideoPlayerController.network()` deprecated từ video_player 2.x)
- Flutter: Sau khi `flutter pub get`, iOS cần thêm camera/microphone usage description trong Info.plist nếu chưa có (nhưng video playback không cần, chỉ recording mới cần)
- Sau khi xong: `pnpm build` (web) + `flutter build apk --debug` (Flutter) để verify
