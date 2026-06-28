# Phone Number with Country Code Picker + SMS Verification (Twilio)

**Goal:** Replace the plain phone text input in profile edit with a professional phone field:
country code dropdown (flag + dial code), phone input, and a "Send OTP" → "Enter OTP" verification
flow powered by Twilio SMS. A green verified badge shows when the number is confirmed.

**Architecture decisions:**
- Phone number is stored in E.164 format (e.g. `+84901234567`).
- Phone is persisted to the DB **only after SMS verification** — not via the regular `PATCH /api/users/me`.
  The `PATCH` endpoint keeps `phoneNumber` in its body for backward compat BUT resets
  `phoneVerified = false` when phone changes via patch (so verification is always required for new numbers).
- OTP for phone is stored in Redis under key `phone_otp:{userId}` (separate from email OTP).
- `phoneVerified` defaults to `false`. Field is added to User schema.
- Web + Flutter ship in the same commit (sync.md rule).

**Prerequisite — Twilio account:**
1. Sign up at https://twilio.com (free trial gives ~$15 credit).
2. Get: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` (the sender number).
3. Add these 3 env vars to `apps/server/auth-service/.env` and to your deployment environment.

---

## Task 1 — auth-service: add `phoneVerified` to User schema

**File:** `packages/database/src/mongo/user.schema.ts`

Add after `phoneNumber`:
```ts
@Prop({ default: false })
phoneVerified: boolean;
```

---

## Task 2 — auth-service: install Twilio + create SmsService

### 2a — Install package

```bash
cd apps/server/auth-service
npm install twilio
npm install --save-dev @types/twilio
```

### 2b — Environment variables

Add to `apps/server/auth-service/src/config/configuration.ts` (or wherever config is loaded):
```ts
twilio: {
  accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
  authToken:  process.env.TWILIO_AUTH_TOKEN ?? '',
  from:       process.env.TWILIO_PHONE_NUMBER ?? '',
},
```

### 2c — Create `apps/server/auth-service/src/modules/sms/sms.service.ts`

```ts
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as Twilio from 'twilio'

@Injectable()
export class SmsService {
  private readonly client: Twilio.Twilio
  private readonly from: string
  private readonly logger = new Logger(SmsService.name)

  constructor(private readonly config: ConfigService) {
    const sid   = this.config.get<string>('twilio.accountSid') ?? ''
    const token = this.config.get<string>('twilio.authToken') ?? ''
    this.from   = this.config.get<string>('twilio.from') ?? ''
    this.client = Twilio(sid, token)
  }

  async sendSms(to: string, body: string): Promise<void> {
    try {
      await this.client.messages.create({ from: this.from, to, body })
    } catch (err) {
      this.logger.error(`Failed to send SMS to ${to}: ${String(err)}`)
      throw err
    }
  }
}
```

### 2d — Create `apps/server/auth-service/src/modules/sms/sms.module.ts`

```ts
import { Module } from '@nestjs/common'
import { SmsService } from './sms.service'

@Module({
  providers: [SmsService],
  exports:   [SmsService],
})
export class SmsModule {}
```

### 2e — Import `SmsModule` in `UsersModule`

In `apps/server/auth-service/src/modules/users/users.module.ts`, add `SmsModule` to `imports`
and ensure `SmsService` is available for injection in `UsersService`.

---

## Task 3 — auth-service: phone OTP endpoints

### 3a — Inject SmsService in UsersService

In `apps/server/auth-service/src/modules/users/users.service.ts`:

```ts
// Add to constructor
constructor(
  @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  @Inject(REDIS_CLIENT) private readonly redis: Redis,
  private readonly smsService: SmsService,
) {}
```

Add these two methods:

```ts
/**
 * Generates a 6-digit OTP, stores it in Redis for 5 min,
 * and sends it via SMS to the given phone number.
 * Rate-limited: max 3 sends per user per 10 minutes (Redis counter).
 */
async sendPhoneOtp(userId: string, phone: string): Promise<void> {
  // Rate limit: max 3 OTP sends per 10 min per user
  const rateKey = `phone_otp_rate:${userId}`
  const sends = await this.redis.incr(rateKey)
  if (sends === 1) await this.redis.expire(rateKey, 600)  // 10 min window
  if (sends > 3) {
    throw new BadRequestException({ code: 'PHONE_OTP_RATE_LIMIT' })
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000))
  const payload = JSON.stringify({ phone, otp })
  // Store for 5 min
  await this.redis.set(`phone_otp:${userId}`, payload, 'EX', 300)

  await this.smsService.sendSms(
    phone,
    `Your PON verification code is: ${otp}. Valid for 5 minutes.`,
  )
}

/**
 * Verifies the OTP for phone number. On success:
 * - saves phoneNumber and phoneVerified=true to the user doc
 * - clears the Redis OTP entry
 */
async verifyPhoneOtp(userId: string, otp: string): Promise<UserDocument> {
  const raw = await this.redis.get(`phone_otp:${userId}`)
  if (!raw) throw new BadRequestException({ code: 'PHONE_OTP_EXPIRED' })

  const { phone, otp: stored } = JSON.parse(raw) as { phone: string; otp: string }
  if (otp !== stored) throw new BadRequestException({ code: 'PHONE_OTP_INVALID' })

  await this.redis.del(`phone_otp:${userId}`)

  // Check for duplicate phone across users
  const conflict = await this.userModel.findOne({
    phoneNumber: phone,
    _id: { $ne: userId },
  })
  if (conflict) throw new BadRequestException({ code: 'PHONE_ALREADY_TAKEN' })

  const user = await this.userModel.findByIdAndUpdate(
    userId,
    { $set: { phoneNumber: phone, phoneVerified: true } },
    { new: true },
  )
  if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' })
  return user
}
```

### 3b — Add endpoints to `UsersController`

In `apps/server/auth-service/src/modules/users/users.controller.ts`:

```ts
@Post('me/phone/send-otp')
@ApiOperation({ summary: 'Send SMS OTP to the given phone number' })
async sendPhoneOtp(
  @Req() req: any,
  @Body('phone') phone: string,
) {
  if (!phone || !phone.startsWith('+')) {
    throw new BadRequestException({ code: 'PHONE_INVALID_FORMAT' })
  }
  await this.usersService.sendPhoneOtp(req.user.sub, phone)
  return { success: true }
}

@Post('me/phone/verify')
@ApiOperation({ summary: 'Verify SMS OTP and save phone number' })
async verifyPhoneOtp(
  @Req() req: any,
  @Body('otp') otp: string,
) {
  const user = await this.usersService.verifyPhoneOtp(req.user.sub, otp)
  return { success: true, phoneNumber: user.phoneNumber, phoneVerified: user.phoneVerified }
}
```

### 3c — Reset `phoneVerified` when phone changes via PATCH

In the existing `updateMe` handler (or `UsersService.updateProfile`), when `body.phoneNumber`
is provided and differs from the stored value, also set `phoneVerified: false`:

In `users.service.ts`, find `updateProfile(userId, body)` and add:
```ts
// If phone number is being changed via patch (unverified path), clear verification.
if (body.phoneNumber !== undefined) {
  updatePayload.phoneVerified = false
}
```

### 3d — Include `phoneVerified` in `GET /api/users/me` response

In `getMe()`, the user doc already spreads via `toObject()`. Since `phoneVerified` is now a
real field, it will be included automatically. No change needed.

For `toProfile()` (public endpoint), add to the self-only section:
```ts
if (isSelf) {
  // existing fields...
  profile.phoneVerified = doc.phoneVerified ?? false
}
```

---

## Task 4 — Web: install `react-phone-number-input`

```bash
cd apps/web
npm install react-phone-number-input
npm install --save-dev @types/react-phone-number-input
```

This library bundles all country metadata (flags as emoji, dial codes, names) — no external CDN needed.

---

## Task 5 — Web: new `PhoneField` component

Create `apps/web/components/profile/PhoneField.tsx`:

```tsx
'use client'

import { useState } from 'react'
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { OtpInput } from '@/components/auth/OtpInput'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { authService } from '@/lib/api/auth'
import { cn } from '@/lib/utils'

interface PhoneFieldProps {
  /** E.164 phone number already stored on the user profile (may be empty). */
  value: string
  verified: boolean
  onChange: (phone: string, verified: boolean) => void
  disabled?: boolean
  labels: {
    label: string
    placeholder: string
    sendOtp: string
    sending: string
    verified: string
    change: string
    otpTitle: string
    otpSubtitle: string
    otpConfirm: string
    verifying: string
    resend: string
    resendCountdown: string
    successToast: string
    errorInvalid: string
    errorSend: string
    errorVerify: string
    errorTaken: string
  }
}

const OTP_LENGTH = 6
const RESEND_COOLDOWN = 60

export function PhoneField({ value, verified, onChange, disabled, labels }: PhoneFieldProps) {
  // local draft (what's currently in the input, may differ from saved value)
  const [draft, setDraft] = useState<string>(value ?? '')
  const [showOtpDialog, setShowOtpDialog] = useState(false)
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [otpError, setOtpError] = useState('')

  // Has the user changed the input from the saved verified number?
  const isDirty = draft !== value

  const startTimer = () => {
    setResendTimer(RESEND_COOLDOWN)
    const id = setInterval(() => {
      setResendTimer((s) => {
        if (s <= 1) { clearInterval(id); return 0 }
        return s - 1
      })
    }, 1000)
  }

  const handleSendOtp = async () => {
    if (!draft || !isValidPhoneNumber(draft)) {
      toast.error(labels.errorInvalid)
      return
    }
    setSending(true)
    try {
      await authService.sendPhoneOtp(draft)
      setOtp(Array(OTP_LENGTH).fill(''))
      setOtpError('')
      setShowOtpDialog(true)
      startTimer()
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.code
      toast.error(msg === 'PHONE_ALREADY_TAKEN' ? labels.errorTaken : labels.errorSend)
    } finally {
      setSending(false)
    }
  }

  const handleVerify = async () => {
    const code = otp.join('')
    if (code.length < OTP_LENGTH) { setOtpError('Enter all 6 digits'); return }
    setVerifying(true)
    setOtpError('')
    try {
      await authService.verifyPhoneOtp(code)
      toast.success(labels.successToast)
      setShowOtpDialog(false)
      onChange(draft, true)
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.code
      if (msg === 'PHONE_OTP_EXPIRED') setOtpError('Code expired — resend a new one')
      else setOtpError(labels.errorVerify)
    } finally {
      setVerifying(false)
    }
  }

  const handleResend = async () => {
    if (resendTimer > 0) return
    await handleSendOtp()
  }

  return (
    <>
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-1.5">
          {labels.label}
          {verified && !isDirty && (
            <span className="inline-flex items-center gap-1 text-xs text-green-500 font-medium">
              <CheckCircle2 className="size-3.5" />
              {labels.verified}
            </span>
          )}
        </label>

        <div className="flex gap-2">
          {/* react-phone-number-input renders country selector + number input */}
          <PhoneInput
            international
            defaultCountry="VN"
            value={draft}
            onChange={(v) => {
              setDraft(v ?? '')
              // If user clears or changes the number, revoke local verified state
              // (the DB still has the old value until they verify the new one)
              if (v !== value) onChange(value, false)
            }}
            disabled={disabled}
            className={cn(
              'flex-1 phone-input-container',
              'border border-input rounded-md px-3 py-2 text-sm bg-background',
              'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0',
            )}
            placeholder={labels.placeholder}
          />

          {/* Show "Send OTP" when there's a valid dirty number, or "Change" when verified */}
          {draft && (isDirty || !verified) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={handleSendOtp}
              disabled={disabled || sending || !isValidPhoneNumber(draft ?? '')}
            >
              {sending ? (
                <><Loader2 className="size-3.5 animate-spin mr-1" />{labels.sending}</>
              ) : (
                labels.sendOtp
              )}
            </Button>
          )}

          {verified && !isDirty && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 text-muted-foreground"
              onClick={() => setDraft('')}
              disabled={disabled}
            >
              {labels.change}
            </Button>
          )}
        </div>

        {/* Hint text */}
        {!draft && (
          <p className="text-xs text-muted-foreground">
            {labels.placeholder}
          </p>
        )}
        {draft && isValidPhoneNumber(draft) && !verified && (
          <p className="text-xs text-amber-500 flex items-center gap-1">
            <ShieldCheck className="size-3.5" />
            Chưa được xác minh
          </p>
        )}
      </div>

      {/* OTP verification dialog */}
      <Dialog open={showOtpDialog} onOpenChange={setShowOtpDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{labels.otpTitle}</DialogTitle>
            <DialogDescription>
              {labels.otpSubtitle} <span className="font-medium text-foreground">{draft}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            <OtpInput value={otp} onChange={setOtp} length={OTP_LENGTH} />
            {otpError && (
              <p className="text-sm text-destructive text-center">{otpError}</p>
            )}

            <Button
              onClick={handleVerify}
              disabled={verifying}
              className="w-full"
            >
              {verifying
                ? <><Loader2 className="size-4 animate-spin mr-2" />{labels.verifying}</>
                : labels.otpConfirm}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              {resendTimer > 0 ? (
                <span>{labels.resendCountdown.replace('{seconds}', String(resendTimer))}</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  className="underline underline-offset-4 hover:text-primary"
                >
                  {labels.resend}
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

Add global CSS override for `react-phone-number-input` to match the app's theme.
In `apps/web/app/globals.css` (or wherever global styles live), append:

```css
/* react-phone-number-input theme integration */
.phone-input-container .PhoneInputInput {
  background: transparent;
  border: none;
  outline: none;
  font-size: 0.875rem;
  color: inherit;
  width: 100%;
}
.phone-input-container .PhoneInputCountry {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
.phone-input-container .PhoneInputCountrySelectArrow {
  opacity: 0.5;
}
```

---

## Task 6 — Web: update `ProfileForm.tsx` to use `PhoneField`

### 6a — Update `ProfileFormValues` type

Replace `phoneNumber?: string` with:
```ts
phoneNumber?: string        // E.164 value
phoneVerified?: boolean     // local verification state
```

### 6b — Add `phoneVerified` to `ProfileFormProps`

Add to `ProfileFormProps`:
```ts
phoneVerified?: boolean
onPhoneChange: (phone: string, verified: boolean) => void
```

### 6c — Replace the phone `<Input>` with `<PhoneField>`

In `ProfileForm.tsx`, import `PhoneField` and replace the existing phone input block:

```tsx
import { PhoneField } from '@/components/profile/PhoneField'

// Inside the form JSX, find the phone number section and replace it:
<PhoneField
  value={phoneNumber ?? ''}
  verified={phoneVerified ?? false}
  onChange={onPhoneChange}
  disabled={saving}
  labels={{
    label: texts.phoneLabel,
    placeholder: texts.phonePlaceholder,
    sendOtp: texts.phoneSendOtp,
    sending: texts.phoneSending,
    verified: texts.phoneVerified,
    change: texts.phoneChange,
    otpTitle: texts.phoneOtpTitle,
    otpSubtitle: texts.phoneOtpSubtitle,
    otpConfirm: texts.phoneOtpConfirm,
    verifying: texts.phoneVerifying,
    resend: texts.phoneResend,
    resendCountdown: texts.phoneResendCountdown,
    successToast: texts.phoneSuccess,
    errorInvalid: texts.phoneErrorInvalid,
    errorSend: texts.phoneErrorSend,
    errorVerify: texts.phoneErrorVerify,
    errorTaken: texts.phoneErrorTaken,
  }}
/>
```

Add these keys to `ProfileFormTexts`:
```ts
phoneSendOtp: string
phoneSending: string
phoneVerified: string
phoneChange: string
phoneOtpTitle: string
phoneOtpSubtitle: string
phoneOtpConfirm: string
phoneVerifying: string
phoneResend: string
phoneResendCountdown: string
phoneSuccess: string
phoneErrorInvalid: string
phoneErrorSend: string
phoneErrorVerify: string
phoneErrorTaken: string
```

---

## Task 7 — Web: update `EditProfilePage` to wire `PhoneField`

**File:** `apps/web/app/(main)/profile/edit/page.tsx`

### 7a — Add local state for phone

```ts
const [localPhone, setLocalPhone] = useState('')
const [localPhoneVerified, setLocalPhoneVerified] = useState(false)
```

### 7b — Seed from `me` in the `useEffect`

```ts
useEffect(() => {
  if (me) {
    // existing reset() call...
    setLocalPhone(me.phoneNumber ?? '')
    setLocalPhoneVerified(me.phoneVerified ?? false)
  }
}, [me, reset])
```

### 7c — Handle phone change

```ts
const handlePhoneChange = (phone: string, verified: boolean) => {
  setLocalPhone(phone)
  setLocalPhoneVerified(verified)
  // Mark form dirty so "Save Changes" enables
  setValue('phoneNumber', phone, { shouldDirty: true })
}
```

### 7d — Pass to `ProfileForm`

```tsx
<ProfileForm
  // ... existing props
  phoneVerified={localPhoneVerified}
  onPhoneChange={handlePhoneChange}
  texts={{
    // ... existing texts
    phoneSendOtp: t('phoneSendOtp'),
    phoneSending: t('phoneSending'),
    phoneVerified: t('phoneVerified'),
    phoneChange: t('phoneChange'),
    phoneOtpTitle: t('phoneOtpTitle'),
    phoneOtpSubtitle: t('phoneOtpSubtitle'),
    phoneOtpConfirm: t('phoneOtpConfirm'),
    phoneVerifying: t('phoneVerifying'),
    phoneResend: t('phoneResend'),
    phoneResendCountdown: t('phoneResendCountdown'),
    phoneSuccess: t('phoneSuccess'),
    phoneErrorInvalid: t('phoneErrorInvalid'),
    phoneErrorSend: t('phoneErrorSend'),
    phoneErrorVerify: t('phoneErrorVerify'),
    phoneErrorTaken: t('phoneErrorTaken'),
  }}
/>
```

### 7e — Exclude phone from `updateProfile` body

The `onSubmit` handler currently passes `phoneNumber: values.phoneNumber`. Remove it:
Phone is now set exclusively through the OTP verification endpoint, not `PATCH /api/users/me`.

```ts
const updated = await authService.updateProfile({
  displayName: values.displayName,
  bio: values.bio ?? '',
  dateOfBirth: values.dateOfBirth || undefined,
  // phoneNumber intentionally omitted — set only via phone OTP verification
  gender: values.gender || undefined,
  showDateOfBirth: values.showDateOfBirth,
  showPhoneNumber: values.showPhoneNumber,
  showGender: values.showGender,
  ...(avatarUrl ? { avatarUrl } : {}),
  ...(coverPhoto ? { coverPhoto } : {}),
})
```

---

## Task 8 — Web: update `authService` API client

**File:** `apps/web/lib/api/auth.ts`

Add `phoneVerified?: boolean` to `UserProfile`:
```ts
export interface UserProfile extends AuthUser {
  // existing fields...
  phoneVerified?: boolean
}
```

Add two new methods to `authService`:
```ts
sendPhoneOtp: (phone: string) =>
  authApi.post('/api/users/me/phone/send-otp', { phone }).then((r) => r.data),

verifyPhoneOtp: (otp: string) =>
  authApi.post('/api/users/me/phone/verify', { otp }).then((r) => r.data),
```

---

## Task 9 — Web: i18n keys

Add to `apps/web/messages/vi.json` (inside `"profile"` namespace):
```json
"phoneSendOtp": "Xác minh",
"phoneSending": "Đang gửi...",
"phoneVerified": "Đã xác minh",
"phoneChange": "Thay đổi",
"phoneOtpTitle": "Xác minh số điện thoại",
"phoneOtpSubtitle": "Nhập mã 6 chữ số đã gửi đến",
"phoneOtpConfirm": "Xác nhận",
"phoneVerifying": "Đang xác minh...",
"phoneResend": "Gửi lại mã",
"phoneResendCountdown": "Gửi lại sau {seconds}s",
"phoneSuccess": "Số điện thoại đã được xác minh!",
"phoneErrorInvalid": "Số điện thoại không hợp lệ",
"phoneErrorSend": "Không thể gửi OTP. Thử lại sau.",
"phoneErrorVerify": "Mã OTP sai hoặc đã hết hạn",
"phoneErrorTaken": "Số điện thoại này đã được sử dụng"
```

Add English equivalents to `apps/web/messages/en.json` and best-effort to remaining language files.

---

## Task 10 — Flutter: phone number picker + SMS verification

### 10a — Install package

In `apps/client/pubspec.yaml`, add:
```yaml
dependencies:
  intl_phone_number_input: ^0.7.4   # country picker + phone formatting
```

Run `flutter pub get`.

### 10b — Update profile edit screen

Find the profile edit screen (`apps/client/lib/features/profile/ui/...` — search for
`phoneNumber` to locate the file).

Replace the plain `TextFormField` for phone with a widget that:
1. Uses `InternationalPhoneNumberInput` from `intl_phone_number_input` to render:
   - Country flag picker (dropdown)
   - Phone number text field
2. When a valid phone is entered (and it differs from the stored verified number):
   - Show a "Verify" button below the input
3. When "Verify" is tapped:
   - Call `POST /api/users/me/phone/send-otp` with the phone
   - Open a bottom sheet / dialog with `OtpInput` widget (6 digits)
   - On OTP submit: call `POST /api/users/me/phone/verify`
   - On success: close dialog, show green badge, refresh user profile
4. When `phoneVerified == true` and number hasn't changed:
   - Show phone + green `Icon(Icons.verified, color: Colors.green)` badge
   - Show "Change" button to enter a new number

Create `apps/client/lib/features/profile/ui/phone_verification_section.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:intl_phone_number_input/intl_phone_number_input.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/profile_repository.dart';
import '../../../auth/ui/widgets/otp_input_widget.dart';
import '../../../../core/ui/app_theme.dart';

class PhoneVerificationSection extends ConsumerStatefulWidget {
  final String initialPhone;
  final bool initialVerified;
  final void Function(String phone, bool verified) onChanged;

  const PhoneVerificationSection({
    super.key,
    required this.initialPhone,
    required this.initialVerified,
    required this.onChanged,
  });

  @override
  ConsumerState<PhoneVerificationSection> createState() =>
      _PhoneVerificationSectionState();
}

class _PhoneVerificationSectionState
    extends ConsumerState<PhoneVerificationSection> {
  late PhoneNumber _phone;
  late bool _verified;
  bool _isDirty = false;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _phone = PhoneNumber(isoCode: 'VN', phoneNumber: widget.initialPhone);
    _verified = widget.initialVerified;
  }

  Future<void> _sendOtp() async {
    final e164 = _phone.phoneNumber ?? '';
    if (e164.isEmpty) return;
    setState(() => _sending = true);
    try {
      await ref.read(profileRepositoryProvider).sendPhoneOtp(e164);
      if (!mounted) return;
      _showOtpDialog(e164);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Không thể gửi OTP. Thử lại sau.')),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _showOtpDialog(String e164) {
    showDialog(
      context: context,
      builder: (_) => _OtpDialog(
        phone: e164,
        onVerified: () {
          setState(() { _verified = true; _isDirty = false; });
          widget.onChanged(e164, true);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text('Số điện thoại',
                style: Theme.of(context).textTheme.labelMedium),
            if (_verified && !_isDirty) ...[
              const SizedBox(width: 6),
              const Icon(Icons.verified, color: Colors.green, size: 14),
              const Text(' Đã xác minh',
                  style: TextStyle(color: Colors.green, fontSize: 12)),
            ],
          ],
        ),
        const SizedBox(height: 6),
        InternationalPhoneNumberInput(
          onInputChanged: (PhoneNumber value) {
            setState(() {
              _phone = value;
              _isDirty = value.phoneNumber != widget.initialPhone;
              if (_isDirty) _verified = false;
            });
          },
          initialValue: _phone,
          selectorConfig: const SelectorConfig(
            selectorType: PhoneInputSelectorType.BOTTOM_SHEET,
            showFlags: true,
          ),
          inputDecoration: InputDecoration(
            hintText: '901 234 567',
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          ),
          formatInput: true,
          keyboardType: const TextInputType.numberWithOptions(signed: true, decimal: true),
        ),
        if (_isDirty && !_verified) ...[
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: AppTheme.ponCyan,
                foregroundColor: Colors.black,
              ),
              onPressed: _sending ? null : _sendOtp,
              child: _sending
                  ? const SizedBox(
                      height: 18, width: 18,
                      child: CircularProgressIndicator(strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation(Colors.black)))
                  : const Text('Gửi mã xác minh'),
            ),
          ),
        ],
        if (_verified && !_isDirty)
          TextButton(
            onPressed: () => setState(() {
              _isDirty = true;
              _verified = false;
            }),
            child: const Text('Thay đổi số'),
          ),
      ],
    );
  }
}

/// OTP dialog used after sending SMS
class _OtpDialog extends ConsumerStatefulWidget {
  final String phone;
  final VoidCallback onVerified;
  const _OtpDialog({required this.phone, required this.onVerified});

  @override
  ConsumerState<_OtpDialog> createState() => _OtpDialogState();
}

class _OtpDialogState extends ConsumerState<_OtpDialog> {
  final List<String> _otp = List.filled(6, '');
  bool _verifying = false;
  String _error = '';

  Future<void> _verify() async {
    final code = _otp.join();
    if (code.length < 6) { setState(() => _error = 'Nhập đủ 6 chữ số'); return; }
    setState(() { _verifying = true; _error = ''; });
    try {
      await ref.read(profileRepositoryProvider).verifyPhoneOtp(code);
      if (!mounted) return;
      Navigator.pop(context);
      widget.onVerified();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Số điện thoại đã được xác minh!')),
      );
    } catch (_) {
      if (mounted) setState(() => _error = 'Mã OTP sai hoặc hết hạn');
    } finally {
      if (mounted) setState(() => _verifying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Xác minh số điện thoại'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('Nhập mã 6 chữ số đã gửi đến ${widget.phone}'),
          const SizedBox(height: 16),
          // Use the existing OtpInputWidget from the auth feature.
          OtpInputWidget(length: 6, onChanged: (v) => _otp.setRange(0, 6, v)),
          if (_error.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(_error, style: const TextStyle(color: Colors.red, fontSize: 12)),
          ],
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Hủy')),
        FilledButton(
          onPressed: _verifying ? null : _verify,
          child: _verifying
              ? const SizedBox(height: 16, width: 16,
                  child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Xác nhận'),
        ),
      ],
    );
  }
}
```

**Note:** Adapt widget names (`OtpInputWidget`, `AppTheme`, `profileRepositoryProvider`) to match
whatever already exists in the Flutter codebase — search for OTP and profile-related files.

### 10c — Add methods to Flutter `ProfileRepository`

In whatever repository/service handles profile API calls, add:
```dart
Future<void> sendPhoneOtp(String phone) async {
  await dio.post('/api/users/me/phone/send-otp', data: {'phone': phone});
}

Future<void> verifyPhoneOtp(String otp) async {
  await dio.post('/api/users/me/phone/verify', data: {'otp': otp});
}
```

### 10d — Wire `PhoneVerificationSection` into the profile edit screen

Find the phone `TextFormField` in the profile edit screen and replace it with:
```dart
PhoneVerificationSection(
  initialPhone: profileState.phoneNumber ?? '',
  initialVerified: profileState.phoneVerified ?? false,
  onChanged: (phone, verified) {
    // Update local state — phone is saved to DB on verify, not on form submit
    ref.read(profileEditProvider.notifier).setPhone(phone, verified);
  },
),
```

---

## Task 11 — Verify and test

1. **Auth-service starts:** `npm run start:dev` — no errors. Twilio env vars loaded.
2. **Send OTP (Twilio trial):** On trial accounts, you can only send to verified numbers
   (verify your own number at twilio.com → Phone Numbers → Verified Caller IDs).
3. **Web flow:**
   - Open `/profile/edit`.
   - Phone field shows country flag selector (+84 VN default) + number input.
   - Enter a valid phone → "Xác minh" button appears.
   - Click → toast "Code sent" → OTP dialog opens.
   - Enter OTP → "Xác nhận" → green "Đã xác minh" badge.
   - Save profile → phone saved (via verify endpoint, not patch).
   - Reload page → phone + verified badge persist.
4. **Flutter:** Same flow works on mobile.
5. **Duplicate phone:** Enter a number already used by another account → error toast
   "Số điện thoại này đã được sử dụng".
6. **Rate limit:** Send OTP more than 3 times in 10 min → rejected.
7. **`pnpm build` passes. `flutter analyze` passes.**

---

## Notes on Twilio trial limitations

- Trial accounts can only send SMS to numbers you have manually verified at twilio.com.
- Messages will be prefixed with "Sent from your Twilio trial account".
- To remove these limits: upgrade to a paid account (no monthly fee, pay per SMS only).
- Cost estimate: 1000 verifications/month ≈ $8.
