# Plan: Auth Security Fix + Archived Display + Mobile UX

> **Ngày:** 2026-07-07
> **Scope:** auth-service (NestJS) + apps/web (Next.js)
> **5 issues.**

---

## Issue 1 — [CRITICAL] Unverified account có thể login được

### Root cause

`auth.service.ts` → `login()` không check `isVerified` trước khi tạo session:

```typescript
async login(dto: LoginDto) {
  await this.checkBruteForce(dto.email);
  const user = await this.usersService.findByEmail(dto.email);

  if (!user) { ... }

  const isMatch = await bcrypt.compare(dto.password, user.password);
  if (!isMatch) { ... }

  // ← THIẾU: check user.isVerified ở đây!

  const { sid, refreshToken } = await this.session.createSession(...)
  // → session được tạo dù chưa verify email
}
```

User đăng ký → bị redirect sang OTP page → nhấn "Back to login" → đăng nhập → VÀO ĐƯỢC home dù chưa verify email.

### Fix — `apps/server/auth-service/src/modules/auth/auth.service.ts`

Thêm check `isVerified` ngay sau khi verify password, trước khi tạo session:

```typescript
const isMatch = await bcrypt.compare(dto.password, user.password);
if (!isMatch) {
  await this.handleFailedLogin(dto.email);
  return; // unreachable
}

// ← THÊM VÀO ĐÂY:
if (!user.isVerified) {
  // Resend OTP và báo user cần verify
  const otp = this.generateOtp();
  const expires = new Date(Date.now() + 10 * 60 * 1000);
  await this.usersService.updateOtp(user._id, this.hashOtp(otp), expires);
  await this.mailerService.sendOtpEmail(user.email, otp, 'verify');
  throw new UnauthorizedException({
    code: AuthCode.ACCOUNT_UNVERIFIED_OTP_SENT,
    params: { email: user.email },
  });
}
```

**Lưu ý:** `ACCOUNT_UNVERIFIED_OTP_SENT` đã tồn tại trong `auth-code.enum.ts`. Sau khi throw, frontend nhận error code này → redirect sang `/verify-otp?email=...`.

Kiểm tra `authCodeToI18nKey()` trong `apps/web/lib/auth/auth-error.ts` để đảm bảo `ACCOUNT_UNVERIFIED_OTP_SENT` được map sang i18n key hợp lý (nếu chưa có thì thêm vào).

---

## Issue 2 — OTP page: nút "Back" link sai (login → phải là register)

### Vấn đề

`apps/web/app/(auth)/verify-otp/page.tsx` line 102:
```tsx
<Link href="/login" ...>{t('backToLogin')}</Link>
```

User đến OTP page từ register → back về login là sai. Phải back về register.

### Fix — `apps/web/app/(auth)/verify-otp/page.tsx`

```tsx
// Thay:
<Link href="/login" className="underline underline-offset-4 hover:text-primary">
  {t('backToLogin')}
</Link>

// Thành:
<Link href="/register" className="underline underline-offset-4 hover:text-primary">
  {t('backToRegister')}
</Link>
```

Thêm i18n key `backToRegister` vào tất cả 7 ARB files (`lib/l10n/app_*.arb` — ở Flutter) và `messages/*.json` (web). Với web: tìm file `messages/en.json` (hoặc tương đương), thêm:
```json
"backToRegister": "Back to Register"
```
Và các ngôn ngữ khác tương ứng.

**Lưu ý:** Key `backToLogin` vẫn giữ trong i18n (có thể dùng ở forgot-password page). Chỉ thay key được dùng trong `verify-otp/page.tsx`.

---

## Issue 3 — Archived: hiển thị "Conversation" thay vì tên thật

### Root cause

`ArchivedConversationList.tsx` dùng:
```typescript
const name = conv.name ?? t('defaultName')
```

Với DM conversation, `conv.name` là `null` (server không trả tên người dùng kia). Không có `useUser()` hook nào được gọi → fallback về `t('defaultName')` = "Conversation".

`ConversationItem.tsx` giải quyết bằng cách gọi `useUser(otherUserId)` per-item — archived list cần làm tương tự.

### Fix — `apps/web/components/chat/ArchivedConversationList.tsx`

Tách mỗi row thành component con `ArchivedConversationRow` để có thể gọi hooks:

```tsx
import { useUser } from '@/lib/hooks/use-user'

interface RowProps {
  conv: Conversation  // type import từ '@/lib/api/types'
  onUnarchive: (id: string) => void
  isUnarchiving: boolean
}

function ArchivedConversationRow({ conv, onUnarchive, isUnarchiving }: RowProps) {
  const t = useTranslations('archived')
  const tChat = useTranslations('chat')
  const router = useRouter()
  const currentUser = useAuthStore((s) => s.user)

  const isGroup = conv.type === 'group'
  const otherUserId = !isGroup
    ? conv.participants?.find((uid: string) => uid !== currentUser?.id)
    : undefined

  // Resolve tên người dùng kia (giống ConversationItem)
  const { data: otherUser } = useUser(otherUserId)

  const name = conv.name ?? (isGroup ? t('groupFallback') : (otherUser?.displayName ?? t('defaultName')))
  const avatar = conv.avatarUrl ? absoluteMediaUrl(conv.avatarUrl) : null

  let previewText = tChat('noMessagesYet')
  if (conv.lastMessage?.content) {
    previewText = humanizeSystemMessage(conv.lastMessage.content, tChat, { short: true })
  }

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group cursor-pointer"
      onClick={() => router.push(`/conversations/${conv.id}`)}
    >
      <Avatar className="size-10 shrink-0">
        {avatar ? (
          <AvatarImage src={avatar} alt={name} className="object-cover" />
        ) : (
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
            {name.charAt(0).toUpperCase()}
          </AvatarFallback>
        )}
      </Avatar>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-sm truncate">{name}</h3>
        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
          {isGroup ? <MessageSquare className="size-3 shrink-0" /> : null}
          {previewText}
        </p>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        disabled={isUnarchiving}
        onClick={(e) => {
          e.stopPropagation()
          onUnarchive(conv.id)
        }}
        title={t('unarchive')}
      >
        {isUnarchiving ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ArchiveRestore className="size-4" />
        )}
      </Button>
    </div>
  )
}
```

Thêm import `useAuthStore` và `useRouter` vào `ArchivedConversationRow`.

Thay phần `filtered.map(...)` trong `ArchivedConversationList` thành:
```tsx
{filtered.map((conv) => (
  <ArchivedConversationRow
    key={conv.id}
    conv={conv}
    onUnarchive={(id) => unarchiveMutation.mutate(id)}
    isUnarchiving={unarchiveMutation.isPending && unarchiveMutation.variables === conv.id}
  />
))}
```

Thêm i18n key `groupFallback` vào `messages/archived.json` (hoặc namespace tương ứng) nếu chưa có.

---

## Issue 4 — Mobile: khung nhắn tin quá to

### Vấn đề

Trên mobile (web), `MessageInput` wrapper có `p-3` padding ở tất cả phía. Nhìn vào screenshot, khung input chiếm ~40% màn hình. Nguyên nhân: textarea `min-h-10` + padding `p-3` + placeholder text dài "Type a message... (Enter to send, Shift+Enter for new line)".

### Fix 1 — `apps/web/components/chat/MessageInput.tsx`

Giảm padding container trên mobile:
```tsx
// Tìm dòng:
<div className="flex items-end gap-1 p-3">

// Thay thành:
<div className="flex items-end gap-1 p-2 md:p-3">
```

Và recording state cũng:
```tsx
// Tìm dòng:
<div className="flex items-center gap-3 p-3">

// Thay thành:
<div className="flex items-center gap-3 p-2 md:p-3">
```

### Fix 2 — Placeholder text ngắn hơn trên mobile

Placeholder "Type a message... (Enter to send, Shift+Enter for new line)" quá dài. Placeholder không ảnh hưởng đến kích thước (textarea `rows={1}` + `min-h-10`), nhưng cần tách placeholder cho mobile:

```tsx
// Tìm prop placeholder trong Textarea:
placeholder={
  editingMessage
    ? t('editPlaceholder')
    : t('inputPlaceholder')
}

// Không cần thay — placeholder không ảnh hưởng size
```

Vấn đề thực sự là `min-h-10` (~40px) + `p-3` (12px top + 12px bottom) = ~64px chiều cao tối thiểu. Trên mobile giảm padding là đủ.

**Thêm:** border-t để phân tách rõ hơn với message list trên mobile:
```tsx
// Wrapper của MessageInput trong page.tsx — kiểm tra xem đã có border-t chưa
// Nếu chưa, wrapper của MessageInput đã có className nào chưa — xem page.tsx
```

Nhìn vào `conversations/[id]/page.tsx`: `MessageInput` không có wrapper thêm, nó tự có `border-t` trong component. Giảm padding là đủ.

---

## Issue 5 — Mobile: thiếu nút thoát khỏi conversation

### Vấn đề

Trên mobile, khi vào conversation, sidebar bị ẩn (layout.tsx: `isConversationOpen ? 'hidden md:flex' : 'flex'`). Không có cách thoát ra về danh sách conversation ngoại trừ browser back button.

### Fix — `apps/web/components/chat/ConversationHeader.tsx`

Thêm nút back (ArrowLeft) **chỉ hiển thị trên mobile** (`md:hidden`), đặt trước avatar:

```tsx
// Import thêm:
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

// Trong component body, thêm:
const router = useRouter()

// Trong JSX header, TRƯỚC button avatar (line ~114):
{/* Mobile back button — đưa user về conversation list */}
<Button
  variant="ghost"
  size="icon"
  className="md:hidden h-8 w-8 shrink-0 -ml-1"
  onClick={() => router.push('/')}
  title={t('backToList')}
>
  <ArrowLeft className="size-5" />
</Button>
```

**Lưu ý route:** `router.push('/')` đưa về home page — layout sẽ tự detect không có conversation open → hiện sidebar. Nếu route home không hiện conversation list thì dùng `router.back()` thay thế. Kiểm tra layout behavior: khi `pathname === '/'`, `isConversationOpen = false` → sidebar hiện trên mobile → đây là behavior đúng.

Thêm i18n key `backToList`:
- `messages/en.json` (hoặc namespace `chat`): `"backToList": "Back"`
- Các ngôn ngữ khác tương ứng

**Desktop**: Nút này ẩn hoàn toàn (`md:hidden`) → không ảnh hưởng UX desktop.

---

## Verification

1. **Security**: Đăng ký account mới → nhận OTP email → KHÔNG nhập OTP → nhấn back → đăng nhập bằng credentials mới → phải nhận lỗi "Account not verified, OTP resent" → được redirect về `/verify-otp?email=...`. Không thể vào home.
2. **Back button OTP**: Trên trang `/verify-otp`, nút bottom link text là "Back to Register", click → về `/register`.
3. **Archived name**: Vào Archived tab → conversation 1-1 hiển thị đúng tên người dùng kia (không phải "Conversation"). Group conversation hiển thị group name hoặc group fallback.
4. **Mobile input**: Trên màn hình mobile (≤768px), khung nhắn tin gọn hơn — padding 8px thay vì 12px.
5. **Mobile back**: Trên mobile, vào conversation → header có mũi tên ArrowLeft ở góc trái → click → về danh sách conversation. Trên desktop, không có mũi tên đó.

---

## Lưu ý cho Claude Code

- **Issue 1**: Kiểm tra `mailerService.sendOtpEmail()` signature — tham số thứ 3 có thể là `'verify' | 'reset'`. Nếu không có `'verify'` thì bỏ param đó hoặc dùng param đúng.
- **Issue 1**: `hashOtp()` là method private trong `AuthService` (thêm ở plan `2026-07-03-security-hardening-2.md`). Nếu chưa execute plan đó thì phải inline: `createHash('sha256').update(otp).digest('hex')`.
- **Issue 2**: Web dùng `next-intl`, không phải Flutter ARB. Tìm đúng file messages (thường là `messages/en.json`, `messages/vi.json`, v.v.).
- **Issue 3**: `useAuthStore` import từ `@/lib/store/auth.store`. `useRouter` import từ `next/navigation`. Cả hai phải có trong `ArchivedConversationRow`.
- **Issue 3**: `Conversation` type import từ `@/lib/api/types` — kiểm tra tên chính xác của type (có thể là `ConversationSummary` hay tương tự).
- **Issue 5**: Nếu `router.push('/')` không hiển thị conversation list trên mobile (trang home có thể là landing/redirect khác), thay bằng `router.back()` — tự nhiên hơn và đúng với browser history.
- Chạy `pnpm build` trong `apps/web` sau khi thay đổi để verify TypeScript + Next.js không có lỗi.
