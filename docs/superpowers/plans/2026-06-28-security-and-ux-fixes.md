# Plan: Security & UX Fixes

**Date:** 2026-06-28  
**Services:** auth-service (NestJS), web (Next.js), Flutter (client)  
**Sync rule:** Web + Flutter ship in same commit.

---

## Issues addressed

| # | Issue | Root cause |
|---|---|---|
| 1 | Block có thể bấm ngẫu nhiên, không có xác nhận | No confirmation dialog |
| 2 | Xóa kết bạn không có xác nhận | No confirmation dialog |
| 3 | Spam OTP email quên mật khẩu | `forgotPassword()` không có per-email rate limit |
| 4 | Sau logout, login page tự điền tài khoản/mật khẩu | `router.push('/login')` không clear autofill |
| 5 | Phone verification UI sai flow | `PhoneField` show input thẳng thay vì notice-first |
| 6 | `PHONE_OTP_RATE_LIMIT` error chưa được handle ở web | Missing error code in catch block |

---

## PART A — Confirmation Dialogs

### Task 1 · Web — Block confirmation dialog

**Files:** `apps/web/components/chat/UserProfileDrawer.tsx`, `apps/web/components/chat/ConversationItem.tsx` (hoặc `ConversationSettingsDrawer.tsx`)

Tất cả nơi gọi `block(userId)` hay `chatService.blockUser(userId)` cần bọc trong `AlertDialog` trước.

Trong `UserProfileDrawer.tsx`, thêm state và wrap `handleBlock()`:

```tsx
const [blockConfirmOpen, setBlockConfirmOpen] = useState(false)

// Thay vì gọi handleBlock() trực tiếp từ button, mở dialog:
// Nút Block → setBlockConfirmOpen(true)

// Dialog:
<AlertDialog open={blockConfirmOpen} onOpenChange={setBlockConfirmOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>{t('blockConfirmTitle', { name: displayName })}</AlertDialogTitle>
      <AlertDialogDescription>{t('blockConfirmDesc')}</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
      <AlertDialogAction
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        onClick={handleBlock}
      >
        {t('blockAction')}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

Áp dụng tương tự ở `ConversationItem.tsx` / `ConversationSettingsDrawer.tsx` nơi có nút Block.

i18n keys:
```json
"blockConfirmTitle": "Chặn {{name}}?",
"blockConfirmDesc":  "{{name}} sẽ không thể nhắn tin hoặc xem hầu hết thông tin hồ sơ của bạn."
```

---

### Task 2 · Web — Unfriend confirmation dialog

**Files:** `apps/web/components/chat/UserProfileDrawer.tsx`, `apps/web/app/(main)/friends/page.tsx`

Trong `UserProfileDrawer.tsx`, chỉ thêm confirmation khi `friendStatus === 'accepted'` (xóa bạn). Các trạng thái khác (sendRequest, acceptRequest) không cần.

```tsx
const [unfriendConfirmOpen, setUnfriendConfirmOpen] = useState(false)

// Trong handleFriendAction():
if (relationship.friendStatus === 'accepted') {
  setUnfriendConfirmOpen(true)   // mở dialog thay vì gọi thẳng
  return
}
// ... rest of logic (sendRequest, acceptRequest) stays direct

// Dialog giống cấu trúc trên, onConfirm → gọi friendsService.removeFriend(userId)
```

Trong `friends/page.tsx`, thay `onClick={() => removeFriend.mutate(...)}` bằng:

```tsx
const [unfriendTarget, setUnfriendTarget] = useState<string | null>(null)

// Nút xóa → setUnfriendTarget(user.id)
// Dialog:
<AlertDialog open={!!unfriendTarget} onOpenChange={(o) => !o && setUnfriendTarget(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>{t('unfriendConfirmTitle')}</AlertDialogTitle>
      <AlertDialogDescription>{t('unfriendConfirmDesc')}</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
      <AlertDialogAction onClick={() => { removeFriend.mutate(unfriendTarget!); setUnfriendTarget(null) }}>
        {t('removeFriend')}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

i18n keys:
```json
"unfriendConfirmTitle": "Xóa kết bạn?",
"unfriendConfirmDesc":  "Bạn và người này sẽ không còn là bạn bè. Bạn vẫn có thể gửi yêu cầu kết bạn lại sau."
```

---

### Task 3 · Flutter — Block + Unfriend confirmations

**Files:** `apps/client/lib/features/chat/ui/widgets/conversation_tile_menu.dart` và profile screen / friends screen (tìm theo `blockUser`, `removeFriend`).

Trước mỗi action, thêm `showDialog` với `AlertDialog`:

```dart
// Block confirmation
Future<void> _confirmBlock(BuildContext context) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (_) => AlertDialog(
      title: Text(l10n.blockConfirmTitle(userName)),
      content: Text(l10n.blockConfirmDesc),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: Text(l10n.cancel)),
        TextButton(
          onPressed: () => Navigator.pop(context, true),
          style: TextButton.styleFrom(foregroundColor: Colors.red),
          child: Text(l10n.blockAction),
        ),
      ],
    ),
  );
  if (confirmed == true) await _doBlock();
}

// Unfriend confirmation — same pattern
```

---

## PART B — OTP Anti-Spam (Forgot Password)

### Task 4 · auth-service — Per-email rate limit for `forgotPassword()`

**File:** `apps/server/auth-service/src/modules/auth/auth.service.ts`

Hiện tại `forgotPassword()` chỉ phụ thuộc vào global IP throttler (5 req/min). Không có per-email limit → user có thể spam OTP email từ nhiều IP.

Thêm Redis rate limit **trước** khi send email:

```ts
async forgotPassword(email: string, locale: string = 'en') {
  // ── Per-email rate limit: max 3 OTP sends per 10 minutes ──
  const rateKey = `forgot_otp_rate:${email.toLowerCase()}`;
  const sends = await this.redis.incr(rateKey);
  if (sends === 1) await this.redis.expire(rateKey, 600); // 10 min window
  if (sends > 3) {
    throw new BadRequestException({ code: AuthCode.TOO_MANY_OTP_REQUESTS });
  }
  // ──────────────────────────────────────────────────────────

  const user = await this.usersService.findByEmail(email);
  if (!user) throw new NotFoundException({ code: AuthCode.EMAIL_NOT_FOUND });

  // ... rest unchanged
}
```

Thêm `TOO_MANY_OTP_REQUESTS` vào `AuthCode` enum nếu chưa có:

**File:** `apps/server/auth-service/src/modules/auth/auth.constants.ts` (hoặc nơi define `AuthCode`)

```ts
TOO_MANY_OTP_REQUESTS = 'TOO_MANY_OTP_REQUESTS',
```

**Tương tự cho `resendOtp()`** — kiểm tra xem `resendOtp` có per-email limit chưa. Nếu chưa, thêm cùng pattern:

```ts
async resendOtp(email: string, locale: string = 'en') {
  const rateKey = `forgot_otp_rate:${email.toLowerCase()}`;
  const sends = await this.redis.incr(rateKey);
  if (sends === 1) await this.redis.expire(rateKey, 600);
  if (sends > 3) {
    throw new BadRequestException({ code: AuthCode.TOO_MANY_OTP_REQUESTS });
  }
  // ... rest unchanged
}
```

Note: dùng **cùng key** `forgot_otp_rate:{email}` cho cả `forgotPassword` và `resendOtp` để tổng số lần gửi (dù từ endpoint nào) đều bị tính vào cùng window.

---

### Task 5 · Web — Handle `TOO_MANY_OTP_REQUESTS` in forgot-password page

**File:** `apps/web/app/(auth)/forgot-password/page.tsx`

Trong error handler của step `'request'`, thêm case:

```ts
const { code } = parseAuthError(err)
if (code === 'TOO_MANY_OTP_REQUESTS') {
  setError(t('tooManyOtpRequests'))
} else if (code === 'EMAIL_NOT_FOUND') {
  setError(t('emailNotFound'))
} else {
  setError(t('genericError'))
}
```

i18n key:
```json
"tooManyOtpRequests": "Bạn đã yêu cầu quá nhiều mã OTP. Vui lòng thử lại sau 10 phút."
```

---

### Task 6 · Web — Resend cooldown timer on forgot-password page (if missing)

**File:** `apps/web/app/(auth)/forgot-password/page.tsx`

Kiểm tra: page đã có `resendTimer` state ở step `'otp'`. Nếu chưa có cooldown khi bấm "Gửi lại", thêm:

```ts
const RESEND_COOLDOWN = 60

// Sau khi gọi forgotPassword() thành công (chuyển từ step 'request' → 'otp'):
setStep('otp')
startResendTimer()  // bắt đầu đếm ngược 60s

// Nút resend bị disable khi resendTimer > 0
```

Verify: khi step là `'otp'`, nút "Gửi lại" đã disabled trong `resendTimer > 0` seconds. Nếu chưa, implement theo pattern của `verify-otp/page.tsx` (file đó đã có sẵn `resendTimer`).

---

## PART C — Login Autofill Clear After Logout

### Task 7 · Web — Redirect with `?cleared=1` after logout

Logout xảy ra ở 2 nơi. Cả hai cần thay đổi redirect:

**File 1:** `apps/web/components/layout/SidebarProfileBar.tsx`

```ts
// Trước:
router.push('/login')
// Sau:
router.push('/login?cleared=1')
```

**File 2:** `apps/web/app/(main)/settings/page.tsx`

Tìm logic logout (gọi `clearAuth()` rồi redirect) và đổi tương tự:
```ts
router.push('/login?cleared=1')
```

---

### Task 8 · Web — Clear autofilled form on login page

**File:** `apps/web/app/(auth)/login/page.tsx`

Thêm sau khi khai báo `useForm`:

```ts
const searchParams = useSearchParams()
const { setValue } = form   // nếu dùng react-hook-form, destructure setValue

useEffect(() => {
  if (searchParams?.get('cleared') !== '1') return
  // Browser fills form AFTER React renders → delay 150ms để override
  const timer = setTimeout(() => {
    setValue('email', '')
    setValue('password', '')
  }, 150)
  return () => clearTimeout(timer)
}, [searchParams, setValue])
```

Import `useSearchParams` từ `next/navigation` nếu chưa có.

Note: `autoComplete="email"` và `autoComplete="current-password"` đang có trên các input — GIỮ NGUYÊN (đây là standard, browsers legitimate autofill). Đoạn `useEffect` chỉ clear khi user VỪA logout (`?cleared=1`).

---

## PART D — Phone Verification UI Redesign

### Task 9 · Web — Rewrite `PhoneField.tsx` với notice-first flow

**File:** `apps/web/components/profile/PhoneField.tsx`

Hiện tại component show thẳng `<PhoneInput>` trong form. User muốn flow:

1. **Chưa có số điện thoại** → show notice banner + nút "Xác minh"
2. **Có số, chưa xác minh** → show số + badge "Chưa xác minh" + nút "Xác minh"
3. **Có số, đã xác minh** → show số + badge "Đã xác minh" + nút "Đổi số"

Bấm "Xác minh" hoặc "Đổi số" → mở modal 2 bước:
- Bước 1: `<PhoneInput>` với country picker + nút "Gửi mã OTP"
- Bước 2: OTP input + nút "Xác minh"

**Rewrite toàn bộ component:**

```tsx
'use client'

import { useState } from 'react'
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import { CheckCircle2, ShieldAlert, Loader2, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { OtpInput } from '@/components/auth/OtpInput'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { authService } from '@/lib/api/auth'
import { cn } from '@/lib/utils'

// ... (giữ nguyên PhoneFieldLabels type, errorCode helper, hằng số)

const OTP_LENGTH = 6
const RESEND_COOLDOWN = 60

export function PhoneField({ value, verified, onChange, disabled, labels }: PhoneFieldProps) {
  const [modalOpen, setModalOpen]       = useState(false)
  const [step, setStep]                 = useState<'phone' | 'otp'>('phone')
  const [draft, setDraft]               = useState('')
  const [otp, setOtp]                   = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [sending, setSending]           = useState(false)
  const [verifying, setVerifying]       = useState(false)
  const [resendTimer, setResendTimer]   = useState(0)
  const [otpError, setOtpError]         = useState('')

  const startTimer = () => {
    setResendTimer(RESEND_COOLDOWN)
    const id = setInterval(() => {
      setResendTimer((s) => { if (s <= 1) { clearInterval(id); return 0 } return s - 1 })
    }, 1000)
  }

  const openModal = () => {
    setDraft(value ?? '')   // pre-fill nếu đang đổi số
    setStep('phone')
    setOtp(Array(OTP_LENGTH).fill(''))
    setOtpError('')
    setModalOpen(true)
  }

  const handleSendOtp = async () => {
    if (!draft || !isValidPhoneNumber(draft)) {
      toast.error(labels.errorInvalid)
      return
    }
    setSending(true)
    try {
      await authService.sendPhoneOtp(draft)
      setStep('otp')
      startTimer()
    } catch (err) {
      const code = errorCode(err)
      if (code === 'PHONE_OTP_RATE_LIMIT') {
        toast.error(labels.errorRateLimit)   // "Vui lòng chờ trước khi gửi lại mã"
      } else if (code === 'PHONE_ALREADY_TAKEN') {
        toast.error(labels.errorTaken)
      } else {
        toast.error(labels.errorSend)
      }
    } finally {
      setSending(false)
    }
  }

  const handleVerify = async () => {
    const code = otp.join('')
    if (code.length < OTP_LENGTH) { setOtpError(labels.otpIncomplete); return }
    setVerifying(true)
    setOtpError('')
    try {
      await authService.verifyPhoneOtp(code)
      toast.success(labels.successToast)
      setModalOpen(false)
      onChange(draft, true)
    } catch (err) {
      const errCode = errorCode(err)
      setOtpError(errCode === 'PHONE_OTP_EXPIRED' ? labels.errorExpired : labels.errorVerify)
    } finally {
      setVerifying(false)
    }
  }

  const handleResend = async () => {
    if (resendTimer > 0) return
    setStep('phone')   // quay lại bước nhập số để xác nhận trước khi gửi lại
  }

  // ── Render: Notice-first UI (outside modal) ──────────────────────────────

  // State 3: đã có số và đã xác minh
  if (value && verified) {
    return (
      <div className="space-y-1">
        <label className="text-sm font-medium">{labels.label}</label>
        <div className="flex items-center gap-2 rounded-md border border-input bg-muted/40 px-3 py-2">
          <Phone className="size-4 text-muted-foreground shrink-0" />
          <span className="flex-1 text-sm font-mono">{value}</span>
          <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
            <CheckCircle2 className="size-3.5" />
            {labels.verified}
          </span>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs shrink-0"
            onClick={openModal} disabled={disabled}>
            {labels.change}
          </Button>
        </div>
        <VerifyModal ... />
      </div>
    )
  }

  // State 2: có số nhưng chưa xác minh
  if (value && !verified) {
    return (
      <div className="space-y-1">
        <label className="text-sm font-medium">{labels.label}</label>
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-3 py-2">
          <Phone className="size-4 text-amber-600 shrink-0" />
          <span className="flex-1 text-sm font-mono text-muted-foreground">{value}</span>
          <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
            <ShieldAlert className="size-3.5" />
            {labels.unverified}
          </span>
          <Button type="button" size="sm" className="h-7 text-xs shrink-0"
            onClick={openModal} disabled={disabled}>
            {labels.sendOtp}
          </Button>
        </div>
        <VerifyModal ... />
      </div>
    )
  }

  // State 1: chưa có số điện thoại (primary state)
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{labels.label}</label>
      <div className="flex items-center gap-3 rounded-md border border-dashed border-border bg-muted/20 px-3 py-3">
        <ShieldAlert className="size-4 text-muted-foreground shrink-0" />
        <p className="flex-1 text-sm text-muted-foreground">{labels.noticeText}</p>
        <Button type="button" size="sm" className="shrink-0" onClick={openModal} disabled={disabled}>
          {labels.verifyAction}
        </Button>
      </div>
      <VerifyModal ... />
    </div>
  )
}
```

**Modal** (extract thành `<VerifyModal>` sub-component hoặc inline):

```tsx
// Step 'phone': nhập số điện thoại
// Step 'otp': nhập mã OTP

<Dialog open={modalOpen} onOpenChange={setModalOpen}>
  <DialogContent className="max-w-sm">
    <DialogHeader>
      <DialogTitle>
        {step === 'phone' ? labels.modalPhoneTitle : labels.otpTitle}
      </DialogTitle>
      <DialogDescription>
        {step === 'phone' ? labels.modalPhoneSubtitle : `${labels.otpSubtitle} ${draft}`}
      </DialogDescription>
    </DialogHeader>

    {step === 'phone' ? (
      <div className="space-y-4 pt-2">
        <PhoneInput
          international defaultCountry="VN"
          value={draft} onChange={(v) => setDraft(v ?? '')}
          className={cn('phone-input-container border border-input rounded-md px-3 py-2 text-sm bg-background')}
        />
        <Button onClick={handleSendOtp} disabled={sending || !draft || !isValidPhoneNumber(draft)} className="w-full">
          {sending ? <><Loader2 className="size-4 animate-spin mr-2" />{labels.sending}</> : labels.sendOtp}
        </Button>
      </div>
    ) : (
      <div className="space-y-5 pt-2">
        <OtpInput value={otp} onChange={setOtp} length={OTP_LENGTH} />
        {otpError && <p className="text-sm text-destructive text-center">{otpError}</p>}
        <Button onClick={handleVerify} disabled={verifying} className="w-full">
          {verifying ? <><Loader2 className="size-4 animate-spin mr-2" />{labels.verifying}</> : labels.otpConfirm}
        </Button>
        <div className="text-center text-sm text-muted-foreground">
          {resendTimer > 0
            ? <span>{labels.resendCountdown.replace('{seconds}', String(resendTimer))}</span>
            : <button type="button" onClick={handleResend} className="underline">{labels.resend}</button>
          }
        </div>
      </div>
    )}
  </DialogContent>
</Dialog>
```

**New i18n labels needed** (add to `PhoneFieldLabels` type + all locale files):
```ts
noticeText: string        // "Thêm số điện thoại để tăng tính bảo mật cho tài khoản"
verifyAction: string      // "Xác minh"  
modalPhoneTitle: string   // "Xác minh số điện thoại"
modalPhoneSubtitle: string // "Nhập số điện thoại để nhận mã xác minh"
errorRateLimit: string    // "Vui lòng chờ trước khi gửi lại mã xác minh"
```

---

### Task 10 · Flutter — Mirror phone verification UI redesign

**File:** nơi render `PhoneVerificationSection` trong profile screen (tham chiếu plan `2026-06-28-phone-number-with-sms-verification.md` Task 10).

Cùng logic 3 trạng thái:
- **Chưa có số:** `ListTile` với icon + text "Chưa có số điện thoại" + `TextButton("Xác minh")` → mở `PhoneVerificationBottomSheet`
- **Có số, chưa xác minh:** `ListTile` + amber badge + `TextButton("Xác minh")`
- **Có số, đã xác minh:** `ListTile` + green check + `TextButton("Đổi số")`

`PhoneVerificationBottomSheet` — `StatefulWidget` với 2 step (phone input → OTP):

```dart
enum _VerifyStep { phone, otp }

class PhoneVerificationBottomSheet extends StatefulWidget { ... }

class _State extends State<...> {
  _VerifyStep _step = _VerifyStep.phone;
  String _phone = '';
  int _resendTimer = 0;
  Timer? _timer;

  void _startTimer() {
    setState(() => _resendTimer = 60);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_resendTimer <= 0) { t.cancel(); return; }
      setState(() => _resendTimer--);
    });
  }

  Future<void> _sendOtp() async {
    try {
      await chatService.sendPhoneOtp(_phone);
      setState(() => _step = _VerifyStep.otp);
      _startTimer();
    } catch (e) {
      // handle PHONE_OTP_RATE_LIMIT, PHONE_ALREADY_TAKEN
    }
  }

  // ... handleVerify, build with step-based UI
}
```

Resend button disabled khi `_resendTimer > 0`, hiển thị countdown.

---

## PART E — Phone OTP Error Handling

### Task 11 · Web — Handle `PHONE_OTP_RATE_LIMIT` in PhoneField

Đã bao gồm trong Task 9 rewrite. Verify rằng `catch` block trong `handleSendOtp()` xử lý:
- `PHONE_OTP_RATE_LIMIT` → toast error với `labels.errorRateLimit`
- `PHONE_ALREADY_TAKEN` → toast error với `labels.errorTaken`
- Fallback → `labels.errorSend`

Và trong `handleVerify()`:
- `PHONE_OTP_EXPIRED` → `labels.errorExpired`
- Fallback → `labels.errorVerify`

---

## Verify Checklist (Task 12)

**Block/Unfriend confirmations:**
- [ ] Bấm "Chặn" trong profile drawer → confirmation dialog hiện ra → Cancel không làm gì → Confirm mới block
- [ ] Bấm "Xóa bạn" trong profile drawer → confirmation dialog
- [ ] Bấm "Xóa bạn" trong trang Bạn bè → confirmation dialog
- [ ] Flutter: cả hai action đều có confirm dialog

**OTP anti-spam:**
- [ ] Gửi forgot-password OTP lần 4 trong 10 phút → nhận lỗi "Quá nhiều yêu cầu" thay vì email được gửi
- [ ] `resendOtp` cùng window 10 phút bị tính chung với `forgotPassword`
- [ ] Nút "Gửi lại" trên web bị disabled 60s sau khi gửi

**Login autofill:**
- [ ] Đăng xuất → chuyển đến `/login?cleared=1`
- [ ] Trên trang login, email và password trống (không bị autofill từ browser)
- [ ] Autofill vẫn hoạt động bình thường khi navigate thẳng đến `/login` (không qua logout)

**Phone verification UI:**
- [ ] Profile chưa có SĐT → hiện banner notice + nút "Xác minh"
- [ ] Bấm "Xác minh" → mở modal bước 1 (nhập SĐT)
- [ ] Nhập SĐT hợp lệ → bấm "Gửi mã OTP" → chuyển sang bước 2 (nhập OTP)
- [ ] Nhập đúng OTP → xác minh thành công → modal đóng → profile hiện SĐT + badge xanh
- [ ] Gửi OTP lần 4 trong 10 phút → lỗi rate limit (không gửi SMS)
- [ ] Nút "Gửi lại" trong OTP step bị disabled 60s
- [ ] Flutter: cùng flow 3-state + 2-step modal
