# Plan: Upload Preview Strip + Multi-select Messages

> **Ngày:** 2026-07-09
> **Scope:** Web (`apps/web/`) chủ yếu; Flutter note cuối.
> **2 features độc lập.**
> **✅ WEB DONE (2026-07-09)** — cả 2 feature đã implement, `pnpm build` PASS, `pnpm lint` 0 errors.
> Logic tách thành hook để giữ file ≤400 dòng: `useStagedAttachments` (Feature 1) + `useMultiSelect` (Feature 2).
> i18n đủ 7 ngôn ngữ. Flutter (sync note cuối) vẫn để cho sprint riêng theo đúng plan.

---

## Feature 1 — Upload preview trước khi gửi (như Messenger)

### Yêu cầu
- User chọn ảnh/file → **không upload ngay**
- Preview strip xuất hiện PHÍA TRÊN text input
- User có thể: thêm ảnh, xóa từng item, toggle HD, sau đó mới nhấn Send
- Nhấn Send → upload → gửi → xóa preview

### Kiến trúc

#### 1a. Thêm state vào `MessageInput.tsx`

```tsx
interface PendingAttachment {
  id: string              // nanoid() để làm key
  file: File
  previewUrl: string      // URL.createObjectURL(file)
  type: 'image' | 'video' | 'file'
  isHD: boolean           // mặc định true
}

// Thêm vào trong component:
const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([])
```

#### 1b. Sửa `useFileAttachments` hook

Hiện tại hook nhận `onSend` và upload trực tiếp. Cần tách thành 2 mode:
- **Stage mode** (mới): chỉ stage files vào state, không upload
- **Send mode** (dùng khi không có UI preview, như voice → vẫn giữ nguyên)

**Giải pháp:** Thay vì sửa hook, bỏ hook đó ra khỏi `MessageInput` và inline logic mới.

Thay hàm trong `onChange` của `imageInputRef`:
```tsx
// CŨ: onChange={handleImagePick} → upload ngay
// MỚI: onChange={handleStageImages}

const handleStageImages = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files ?? [])
  e.target.value = ''
  if (files.length === 0) return

  const newItems: PendingAttachment[] = files.map((file) => ({
    id: Math.random().toString(36).slice(2),
    file,
    previewUrl: URL.createObjectURL(file),
    type: file.type.startsWith('video/') ? 'video' : 'image',
    isHD: true,
  }))
  setPendingAttachments((prev) => [...prev, ...newItems])
}

const handleStageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return

  // Files không cần preview URL thật, dùng empty string
  setPendingAttachments([{
    id: Math.random().toString(36).slice(2),
    file,
    previewUrl: '',
    type: 'file',
    isHD: false,
  }])
  // Chỉ 1 file tại một thời điểm (như Zalo/Messenger) — nếu đang có pending, replace
}
```

**Cleanup object URLs** khi unmount hoặc sau khi gửi:
```tsx
useEffect(() => {
  return () => {
    pendingAttachments.forEach((a) => {
      if (a.previewUrl) URL.revokeObjectURL(a.previewUrl)
    })
  }
}, [pendingAttachments])
```

#### 1c. Tạo component `MediaPreviewStrip.tsx`

Tạo file mới: `apps/web/components/chat/MediaPreviewStrip.tsx`

```tsx
'use client'

import { X, Zap } from 'lucide-react'

export interface PendingAttachment {
  id: string
  file: File
  previewUrl: string
  type: 'image' | 'video' | 'file'
  isHD: boolean
}

interface Props {
  attachments: PendingAttachment[]
  onRemove: (id: string) => void
  onToggleHD: (id: string) => void
  onAddMore: () => void   // click → mở imageInputRef lại
}

export function MediaPreviewStrip({ attachments, onRemove, onToggleHD, onAddMore }: Props) {
  if (attachments.length === 0) return null

  return (
    <div className="border-t bg-background/95 px-3 pt-3 pb-1">
      <div className="flex items-start gap-2 overflow-x-auto no-scrollbar">
        {attachments.map((att) => (
          <div key={att.id} className="relative shrink-0 group">
            {/* Thumbnail hoặc file icon */}
            {att.type === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={att.previewUrl}
                alt=""
                className="size-20 object-cover rounded-xl border border-border"
              />
            ) : att.type === 'video' ? (
              <div className="size-20 rounded-xl border border-border bg-muted flex items-center justify-center text-xs text-muted-foreground overflow-hidden">
                <video src={att.previewUrl} className="size-full object-cover" muted />
              </div>
            ) : (
              <div className="w-28 h-20 rounded-xl border border-border bg-muted flex flex-col items-center justify-center gap-1 px-2">
                <span className="text-2xl">📄</span>
                <span className="text-[10px] text-muted-foreground text-center line-clamp-2 leading-tight">
                  {att.file.name}
                </span>
              </div>
            )}

            {/* Remove button */}
            <button
              onClick={() => onRemove(att.id)}
              className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-foreground text-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
              aria-label="Remove"
            >
              <X className="size-3" />
            </button>

            {/* HD toggle — only for images */}
            {att.type === 'image' && (
              <button
                onClick={() => onToggleHD(att.id)}
                className={`absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors ${
                  att.isHD
                    ? 'bg-pon-cyan/90 text-black'
                    : 'bg-black/50 text-white/70'
                }`}
                title={att.isHD ? 'HD — ảnh chất lượng cao' : 'SD — ảnh nén'}
              >
                <Zap className="size-2.5" />
                HD
              </button>
            )}
          </div>
        ))}

        {/* Add more button — only for images (not file) */}
        {attachments[0]?.type !== 'file' && (
          <button
            onClick={onAddMore}
            className="size-20 shrink-0 rounded-xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-pon-cyan hover:text-pon-cyan transition-colors"
          >
            <span className="text-2xl leading-none">+</span>
          </button>
        )}
      </div>
    </div>
  )
}
```

#### 1d. Sửa `MessageInput.tsx` — tích hợp preview strip + upload khi Send

**Thêm vào JSX** ngay trước `<div className="flex items-end gap-1 p-2 md:p-3">`:
```tsx
{/* Preview strip */}
<MediaPreviewStrip
  attachments={pendingAttachments}
  onRemove={(id) => {
    setPendingAttachments((prev) => {
      const removed = prev.find((a) => a.id === id)
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl)
      return prev.filter((a) => a.id !== id)
    })
  }}
  onToggleHD={(id) => {
    setPendingAttachments((prev) =>
      prev.map((a) => a.id === id ? { ...a, isHD: !a.isHD } : a)
    )
  }}
  onAddMore={() => imageInputRef.current?.click()}
/>
```

**Sửa `handleSend`** để xử lý pending attachments:
```tsx
const handleSend = async () => {
  // Priority: nếu có pending attachments, gửi chúng trước
  if (pendingAttachments.length > 0) {
    setSending(true)
    try {
      const images: string[] = []
      for (const att of pendingAttachments) {
        if (att.type === 'file') {
          const { url, filename, size } = await chatService.uploadFile(att.file)
          await onSend(
            JSON.stringify({ url, name: filename || att.file.name, size: Number(size) || 0 }),
            'file',
          )
        } else if (att.type === 'video') {
          const { url } = await chatService.uploadFile(att.file)
          await onSend(url, 'video')
        } else {
          // image — HD mode: upload as-is; SD mode: compress first
          let fileToUpload = att.file
          if (!att.isHD) {
            fileToUpload = await compressImage(att.file, 0.7)  // helper bên dưới
          }
          const { url } = await chatService.uploadFile(fileToUpload)
          images.push(url)
        }
      }
      if (images.length === 1) await onSend(images[0], 'image')
      else if (images.length > 1) await onSend(JSON.stringify(images), 'image')
      // Cleanup
      pendingAttachments.forEach((a) => { if (a.previewUrl) URL.revokeObjectURL(a.previewUrl) })
      setPendingAttachments([])
    } catch {
      toast.error(t('uploadError'))
    } finally {
      setSending(false)
    }
    return  // không gửi text đồng thời
  }

  // Không có attachment: gửi text bình thường
  const content = value.trim()
  if (!content || sending) return
  setSending(true)
  // ... (giữ nguyên code cũ)
}
```

**Thêm helper `compressImage`** (module scope, ngoài component):
```tsx
async function compressImage(file: File, quality = 0.7): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(file); return }
      ctx.drawImage(img, 0, 0)
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return }
          resolve(new File([blob], file.name, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => resolve(file)
    img.src = URL.createObjectURL(file)
  })
}
```

**Send button**: khi `pendingAttachments.length > 0`, nút Send luôn hiển thị (ngay cả khi text input trống):
```tsx
{value.trim() || editingMessage || pendingAttachments.length > 0 ? (
  <Button
    size="icon"
    onClick={handleSend}
    disabled={(pendingAttachments.length === 0 && !value.trim()) || busy}
    ...
  >
    ...
  </Button>
) : (
  // mic + quick reaction (giữ nguyên)
)}
```

**Imports cần thêm** vào `MessageInput.tsx`:
```tsx
import { MediaPreviewStrip, type PendingAttachment } from '@/components/chat/MediaPreviewStrip'
import { chatService } from '@/lib/api/chat'
import { toast } from 'sonner'
```

---

## Feature 2 — Chọn nhiều tin nhắn (multi-select)

### Yêu cầu
- Trigger: click dấu ··· → "Chọn tin nhắn"
- Enter multi-select mode: các bubble hiện checkbox
- Tap bubble để chọn/bỏ chọn
- Bottom bar: số lượng đã chọn + các action (Chuyển tiếp, Xóa, Thu hồi)
- **Type constraint**: chỉ chọn cùng loại (text, image, file). Mix type → toast warning
- Tin nhắn của người khác: chỉ cho Xóa/Forward — KHÔNG cho Thu hồi
- Tap tin nhắn đang được chọn → bỏ chọn

### State — thêm vào `page.tsx`

```tsx
const [multiSelectMode, setMultiSelectMode] = useState(false)
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
// Loại của lần chọn đầu tiên — enforce sau đó
const [selectedBaseType, setSelectedBaseType] = useState<'text' | 'image' | 'file' | null>(null)

const exitMultiSelect = useCallback(() => {
  setMultiSelectMode(false)
  setSelectedIds(new Set())
  setSelectedBaseType(null)
}, [])

// Classify message type thành 3 nhóm
function classifyType(msgType: MessageType): 'text' | 'image' | 'file' {
  if (msgType === 'image' || msgType === 'video') return 'image'
  if (msgType === 'file') return 'file'
  return 'text'   // text, ai, sticker, call_log, system đều là text group
}

const handleSelectMessage = useCallback((message: Message) => {
  const mType = classifyType(message.type)

  if (selectedIds.has(message.id)) {
    // Bỏ chọn
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(message.id)
      if (next.size === 0) setSelectedBaseType(null)
      return next
    })
    return
  }

  // Kiểm tra type constraint
  if (selectedBaseType !== null && mType !== selectedBaseType) {
    const typeNames: Record<string, string> = {
      text: 'văn bản',
      image: 'ảnh/video',
      file: 'file',
    }
    toast.warning(
      `Bạn đang chọn ${typeNames[selectedBaseType]}. Chỉ được chọn cùng một loại.`,
      { duration: 2500 }
    )
    return
  }

  setSelectedIds((prev) => new Set([...prev, message.id]))
  if (selectedBaseType === null) setSelectedBaseType(mType)
}, [selectedIds, selectedBaseType])
```

### Actions cho multi-select

Thêm vào `page.tsx`:

```tsx
const handleMultiDelete = useCallback(async () => {
  try {
    await Promise.all([...selectedIds].map((id) => chatService.deleteForMe(id)))
    exitMultiSelect()
    // TanStack Query cache sẽ được cập nhật bởi STOMP events
    toast.success(`Đã xóa ${selectedIds.size} tin nhắn`)
  } catch {
    toast.error(t('deleteError'))
  }
}, [selectedIds, exitMultiSelect])

const handleMultiRecall = useCallback(async () => {
  // Chỉ recall tin nhắn của chính mình
  const ownMessages = messages.filter(
    (m) => selectedIds.has(m.id) && m.senderId === currentUser?.id && !m.recalled
  )
  try {
    await Promise.all(ownMessages.map((m) => chatService.recallMessage(m.id)))
    exitMultiSelect()
    toast.success(`Đã thu hồi ${ownMessages.length} tin nhắn`)
  } catch {
    toast.error(t('recallError'))
  }
}, [selectedIds, messages, currentUser?.id, exitMultiSelect])

const handleMultiForward = useCallback(() => {
  // Mở ForwardMessageModal nhưng pass array (cần extend ForwardMessageModal)
  // Nếu chưa support multi-forward, forward lần lượt — hoặc disable khi >1
  const selected = messages.filter((m) => selectedIds.has(m.id))
  if (selected.length === 1) {
    setForwardMessage(selected[0])
    exitMultiSelect()
  } else {
    toast.info('Chuyển tiếp nhiều tin nhắn — chọn 1 tin nhắn để chuyển tiếp')
  }
}, [selectedIds, messages, exitMultiSelect])
```

### Truyền props xuống `MessageViewport` và `MessageBubble`

**`MessageViewport.tsx`** — thêm props mới:
```tsx
interface Props {
  // ... các props hiện tại ...
  multiSelectMode?: boolean
  selectedIds?: Set<string>
  onSelectMessage?: (message: Message) => void
  onEnterMultiSelect?: () => void   // trigger từ MessageActions "Chọn tin nhắn"
}
```

Truyền qua xuống từng `MessageBubble`.

**`MessageBubble.tsx`** — khi `multiSelectMode === true`:
- Toàn bộ row là clickable → gọi `onSelectMessage(message)`
- Hiển thị checkbox bên trái (tin nhắn của mình) hoặc bên phải (tin nhắn người khác) — thực ra cố định bên trái cả hai cho nhất quán
- `MessageActions` bị ẩn khi `multiSelectMode === true`
- Row có highlight khi selected: `bg-pon-cyan/10 rounded-xl`

```tsx
// Trong MessageBubble render, bọc ngoài cùng:
<div
  className={cn(
    'relative transition-colors',
    multiSelectMode && 'cursor-pointer select-none',
    multiSelectMode && isSelected && 'bg-pon-cyan/10 rounded-xl',
  )}
  onClick={multiSelectMode ? () => onSelectMessage?.(message) : undefined}
>
  {/* Checkbox */}
  {multiSelectMode && (
    <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
      <div className={cn(
        'size-5 rounded-full border-2 flex items-center justify-center transition-colors',
        isSelected
          ? 'bg-pon-cyan border-pon-cyan'
          : 'border-muted-foreground/50 bg-background/80',
      )}>
        {isSelected && <Check className="size-3 text-black" strokeWidth={3} />}
      </div>
    </div>
  )}

  {/* Toàn bộ nội dung bubble cũ — không thay đổi */}
  {/* Thêm padding-left khi multiSelectMode để tránh overlap checkbox */}
  <div className={cn(multiSelectMode && 'pl-8')}>
    {/* ... nội dung cũ ... */}
  </div>
</div>
```

### Thêm "Chọn tin nhắn" vào `MessageActions.tsx`

Thêm prop `onEnterMultiSelect?: () => void` vào interface `Props`.

Thêm menu item đầu tiên trong `DropdownMenuContent`:
```tsx
{onEnterMultiSelect && (
  <>
    <DropdownMenuItem onClick={onEnterMultiSelect}>
      <CheckSquare className="size-4" />
      {t('selectMessages')}
    </DropdownMenuItem>
    <DropdownMenuSeparator />
  </>
)}
```

Import thêm: `CheckSquare, Check` từ `lucide-react`.

### Tạo `MultiSelectBar.tsx`

Tạo file mới: `apps/web/components/chat/MultiSelectBar.tsx`

```tsx
'use client'

import { useTranslations } from 'next-intl'
import { X, Share2, Trash, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  selectedCount: number
  canRecall: boolean   // true nếu tất cả selected là của mình và chưa recalled
  onCancel: () => void
  onForward: () => void
  onDelete: () => void
  onRecall: () => void
}

export function MultiSelectBar({ selectedCount, canRecall, onCancel, onForward, onDelete, onRecall }: Props) {
  const t = useTranslations('chat')

  return (
    <div className="border-t bg-background/95 backdrop-blur-md pb-safe">
      {/* Count row */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="text-sm font-semibold text-foreground">
          {selectedCount > 0
            ? `${selectedCount} tin nhắn đã chọn`
            : 'Chưa chọn tin nhắn nào'
          }
        </span>
        <Button variant="ghost" size="sm" onClick={onCancel} className="h-7 px-2 text-xs gap-1">
          <X className="size-3.5" />
          Hủy
        </Button>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 px-4 pb-3">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5"
          disabled={selectedCount === 0}
          onClick={onForward}
        >
          <Share2 className="size-3.5" />
          {t('forwardAction')}
        </Button>

        {canRecall && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5 border-orange-500/40 text-orange-400 hover:bg-orange-500/10"
            disabled={selectedCount === 0}
            onClick={onRecall}
          >
            <Trash2 className="size-3.5" />
            {t('recallAction')}
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
          disabled={selectedCount === 0}
          onClick={onDelete}
        >
          <Trash className="size-3.5" />
          {t('deleteForMeAction')}
        </Button>
      </div>
    </div>
  )
}
```

### Wiring trong `page.tsx`

Thay thế đoạn `MessageInput` / `BlockedComposerNotice` render:

```tsx
{/* Bottom: input OR multi-select bar */}
{multiSelectMode ? (
  <MultiSelectBar
    selectedCount={selectedIds.size}
    canRecall={
      [...selectedIds].every((id) => {
        const m = messages.find((msg) => msg.id === id)
        return m && m.senderId === currentUser?.id && !m.recalled
      })
    }
    onCancel={exitMultiSelect}
    onForward={handleMultiForward}
    onDelete={handleMultiDelete}
    onRecall={handleMultiRecall}
  />
) : isBlocked ? (
  <BlockedComposerNotice ... />
) : (
  <MessageInput ... />
)}
```

Truyền thêm vào `MessageViewport`:
```tsx
<MessageViewport
  ...
  multiSelectMode={multiSelectMode}
  selectedIds={selectedIds}
  onSelectMessage={handleSelectMessage}
  onEnterMultiSelect={() => setMultiSelectMode(true)}
/>
```

### i18n keys cần thêm (tất cả 7 ngôn ngữ, namespace `"chat"`)

```json
// en.json
"selectMessages": "Select messages",
"multiSelectCancel": "Cancel",
"multiSelectCount": "{count} selected",

// vi.json
"selectMessages": "Chọn tin nhắn",
"multiSelectCancel": "Hủy",
"multiSelectCount": "{count} đã chọn",
```

(Thêm tương tự cho zh, ja, ko, fr, es)

---

## Files cần tạo mới

| File | Mô tả |
|------|-------|
| `apps/web/components/chat/MediaPreviewStrip.tsx` | Preview strip cho upload |
| `apps/web/components/chat/MultiSelectBar.tsx` | Bottom action bar cho multi-select |

## Files cần sửa

| File | Thay đổi |
|------|---------|
| `apps/web/components/chat/MessageInput.tsx` | Stage attachments → preview strip → send on confirm |
| `apps/web/components/chat/MessageActions.tsx` | Thêm "Chọn tin nhắn" menu item |
| `apps/web/components/chat/MessageBubble.tsx` | Checkbox + selected highlight khi multiSelectMode |
| `apps/web/components/chat/MessageViewport.tsx` | Nhận + forward multiSelect props xuống bubbles |
| `apps/web/app/(main)/conversations/[id]/page.tsx` | Multi-select state + handlers + wiring |
| `apps/web/messages/*.json` (7 files) | i18n keys mới |

---

## Lưu ý cho Claude Code

### Feature 1 (Upload Preview)
- `compressImage()` là async helper function khai báo ở MODULE SCOPE (ngoài component).
- `URL.createObjectURL()` phải được revoke khi attachment bị xóa và khi component unmount.
- `handleStageFile()` chỉ cho phép 1 file tại một thời điểm (replace toàn bộ `pendingAttachments`).
- `handleStageImages()` cho phép append nhiều ảnh cộng dồn.
- Khi `pendingAttachments.length > 0`: input text vẫn hoạt động bình thường nhưng Send sẽ ưu tiên gửi attachments trước.
- Import `MediaPreviewStrip` và `PendingAttachment` type từ cùng 1 file.

### Feature 2 (Multi-select)
- `classifyType()` là pure function khai báo ở module scope trong `page.tsx`.
- `selectedBaseType` reset về `null` khi set trống (`selectedIds.size === 0`).
- `canRecall` trong `MultiSelectBar` props: tính toán trực tiếp từ `selectedIds` + `messages` array (không dùng useMemo cho đơn giản).
- `MessageBubble` cần import thêm `Check` từ `lucide-react`.
- Khi `multiSelectMode === true`, click vào bubble KHÔNG mở context menu, KHÔNG trigger reply/forward/react — chỉ toggle selection.
- `MessageActions` bị ẩn hoàn toàn khi `multiSelectMode === true` (conditional render, không chỉ opacity).
- Thu hồi nhiều tin nhắn: `Promise.all()` — nếu 1 fail thì `catch` tổng, không fail-fast.
- Forward nhiều tin nhắn: phase 1 chỉ support forward 1 tin nhắn, disabled khi >1 với toast thông báo.

### Chạy sau khi sửa
```bash
cd apps/web && pnpm build
```

---

## Flutter (sync note)

Theo `.claude/rules/sync.md`, Flutter cần được sync sau:
- `apps/client/lib/features/chat/ui/widgets/chat_input_bar.dart` — preview strip
- `apps/client/lib/features/chat/ui/chat_screen.dart` — multi-select state
- `apps/client/lib/features/chat/ui/widgets/message_bubble.dart` — checkbox

Flutter implementation phức tạp hơn (bottom sheet, GestureDetector onLongPress để enter multi-select). **Implement web trước, Flutter sau trong sprint riêng.**
