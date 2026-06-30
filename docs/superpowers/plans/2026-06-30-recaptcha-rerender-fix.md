# Fix: reCAPTCHA "already been rendered" Error

**File:** `platform/apps/web/components/profile/PhoneField.tsx`

**Root cause:** `handleResend()` clears `recaptchaRef.current = null` nhưng không clear innerHTML của `#recaptcha-container`. Lần `handleSendOtp` tiếp theo tạo `RecaptchaVerifier` mới trên div đã có rendered widget → Firebase throw "reCAPTCHA has already been rendered in this element".

Second scenario: dialog đóng rồi mở lại, DialogContent unmount/remount → div mới nhưng `recaptchaRef.current` vẫn còn trỏ đến verifier cũ → broken state.

---

## Task 1 — Thêm helper `clearRecaptcha()`

Ngay dưới `const recaptchaRef = useRef<RecaptchaVerifier | null>(null)` (line 93), thêm:

```typescript
/** Xoá RecaptchaVerifier và innerHTML container để tránh "already been rendered" error */
const clearRecaptcha = () => {
  recaptchaRef.current?.clear()
  recaptchaRef.current = null
  const el = document.getElementById('recaptcha-container')
  if (el) el.innerHTML = ''
}
```

---

## Task 2 — Dùng `clearRecaptcha()` trong `handleSendOtp`

Thay đoạn catch (lines 137–143):

```typescript
// BEFORE
} catch (err: unknown) {
  console.error('Firebase sendOtp error:', err)
  toast.error(labels.errorSend)
  // Reset reCAPTCHA on failure so user can retry
  recaptchaRef.current?.clear()
  recaptchaRef.current = null
}
```

→

```typescript
// AFTER
} catch (err: unknown) {
  console.error('Firebase sendOtp error:', err)
  toast.error(labels.errorSend)
  clearRecaptcha()
}
```

Và **trước** khi tạo `RecaptchaVerifier` (bên trong `if (!recaptchaRef.current)` block, line 124), thêm clear container phòng trường hợp div vẫn còn widget cũ:

```typescript
if (!recaptchaRef.current) {
  // Đảm bảo container sạch trước khi render widget mới
  const el = document.getElementById('recaptcha-container')
  if (el) el.innerHTML = ''
  recaptchaRef.current = new RecaptchaVerifier(...)
}
```

---

## Task 3 — Clear reCAPTCHA khi Dialog đóng

Thay `<Dialog open={modalOpen} onOpenChange={setModalOpen}>` (line 197) thành:

```typescript
<Dialog
  open={modalOpen}
  onOpenChange={(open) => {
    if (!open) clearRecaptcha()
    setModalOpen(open)
  }}
>
```

Đảm bảo mỗi lần modal mở lại, container sạch hoàn toàn.

---

## Task 4 — Xoá reCAPTCHA trong `handleResend`

Thay (lines 185–194):

```typescript
// BEFORE
const handleResend = () => {
  if (resendTimer > 0) return
  setConfirmationResult(null)
  recaptchaRef.current?.clear()
  recaptchaRef.current = null
  setOtp(Array(OTP_LENGTH).fill(''))
  setOtpError('')
  setStep('phone')
}
```

→

```typescript
// AFTER
const handleResend = () => {
  if (resendTimer > 0) return
  setConfirmationResult(null)
  clearRecaptcha()  // dùng helper thay vì inline
  setOtp(Array(OTP_LENGTH).fill(''))
  setOtpError('')
  setStep('phone')
}
```

---

## Notes

- reCAPTCHA badge hiện ở góc màn hình là **bình thường** — Firebase Phone Auth Web yêu cầu theo Google ToS. Không phải bug, không cần hide.
- Test phone `+84817738889` không nhận SMS thật. OTP luôn là `123456`.
- Để test trên dev environment không cần reCAPTCHA: thêm `firebaseAuth.settings.appVerificationDisabledForTesting = true` vào `lib/firebase.ts` với guard `process.env.NODE_ENV === 'development'`. Optional.
