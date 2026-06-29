# Firebase Phone Auth Migration Plan
Date: 2026-06-29

## Context
Replace Twilio SMS OTP with Firebase Phone Authentication.

**Why possible now:**
- Firebase project `pon-c30fd` already configured (FlutterFire CLI ran, `firebase_options.dart` exists)
- `firebase_core` + `firebase_messaging` already in `pubspec.yaml`
- `FIREBASE_SERVICE_ACCOUNT_BASE64` already in GitHub secrets (chat-service uses it for FCM push)
- Just need: add `firebase_auth` (Flutter), add `firebase` JS SDK (web), add `firebase-admin` (backend)

**Architecture change:**

| | Old (Twilio) | New (Firebase) |
|---|---|---|
| OTP generation | Backend (random 6 digits) | Firebase |
| SMS sending | Twilio API → fails for VN | Firebase → works globally |
| OTP storage | Redis `phone_otp:{userId}` (5 min) | Firebase (managed) |
| Rate limiting | Redis `phone_otp_rate:{userId}` | Firebase (managed) |
| Verification | Backend checks Redis | Firebase SDK client-side → ID token → backend verifies via Firebase Admin |

**New flow:**
1. User enters phone number
2. Client calls Firebase SDK → Firebase sends SMS (not our backend)
3. User enters OTP → Firebase SDK verifies client-side → returns `UserCredential`
4. Client gets Firebase ID token (`userCredential.user.getIdToken()`)
5. Client sends `{ firebaseIdToken }` to `POST /api/users/me/phone/verify`
6. Backend calls `firebase-admin` → `auth().verifyIdToken(token)` → extracts `phone_number`
7. Backend checks duplicate → saves `phoneNumber + phoneVerified=true` → returns updated user

---

## Part A — Backend: Remove Twilio, Add Firebase Admin

### Task 1 — Delete SMS module
**DELETE these files entirely:**
- `apps/server/auth-service/src/modules/sms/sms.service.ts`
- `apps/server/auth-service/src/modules/sms/sms.module.ts`

### Task 2 — Update package.json
**File:** `apps/server/auth-service/package.json`

Remove `"twilio": "^6.0.2"` from dependencies.
Add `"firebase-admin": "^12.0.0"` to dependencies.

### Task 3 — Create Firebase Admin module
**File:** `apps/server/auth-service/src/modules/firebase/firebase.module.ts` (CREATE)

```typescript
import { Module, Global } from '@nestjs/common';
import { FirebaseAdminService } from './firebase-admin.service';

@Global()
@Module({
  providers: [FirebaseAdminService],
  exports: [FirebaseAdminService],
})
export class FirebaseAdminModule {}
```

**File:** `apps/server/auth-service/src/modules/firebase/firebase-admin.service.ts` (CREATE)

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    // Already initialized (e.g. hot reload guard)
    if (admin.apps.length > 0) return;

    const base64 = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_BASE64');
    if (!base64) {
      this.logger.error('FIREBASE_SERVICE_ACCOUNT_BASE64 is not set — phone auth disabled');
      return;
    }

    const serviceAccount = JSON.parse(
      Buffer.from(base64, 'base64').toString('utf8'),
    ) as admin.ServiceAccount;

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    this.logger.log('Firebase Admin SDK initialized');
  }

  /**
   * Verifies a Firebase ID token and returns the decoded claims.
   * Throws if the token is invalid or expired.
   */
  async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    return admin.auth().verifyIdToken(idToken);
  }
}
```

### Task 4 — Rewrite UsersModule: remove SmsModule, add FirebaseAdminModule
**File:** `apps/server/auth-service/src/modules/users/users.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { FriendsModule } from '../friends/friends.module';
import { FirebaseAdminModule } from '../firebase/firebase.module'; // ← new
import { User, UserSchema, UserBlock, UserBlockSchema } from '@platform/database';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserBlock.name, schema: UserBlockSchema },
    ]),
    FriendsModule,
    FirebaseAdminModule, // ← was SmsModule
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

### Task 5 — Rewrite phone methods in UsersService
**File:** `apps/server/auth-service/src/modules/users/users.service.ts`

**Remove:**
- `import { SmsService } from '../sms/sms.service';`
- `private readonly smsService: SmsService` from constructor
- Entire `sendPhoneOtp()` method (lines ~268–303)
- References to `phone_otp:${userId}` and `phone_otp_rate:${userId}` Redis keys

**Add:**
- `import { FirebaseAdminService } from '../firebase/firebase-admin.service';`
- `private readonly firebaseAdmin: FirebaseAdminService` to constructor
- Replace `verifyPhoneOtp(userId: string, otp: string)` with `verifyFirebasePhoneToken(userId: string, idToken: string)`

**New `verifyFirebasePhoneToken` method:**

```typescript
/**
 * Verifies a Firebase Phone Auth ID token.
 * The token is issued by Firebase after the user successfully enters the SMS OTP.
 * Extracts the phone number from the token's claims, checks for conflicts,
 * and persists phoneNumber + phoneVerified=true on the user document.
 */
async verifyFirebasePhoneToken(
  userId: string,
  idToken: string,
): Promise<UserDocument> {
  let decoded: import('firebase-admin').auth.DecodedIdToken;
  try {
    decoded = await this.firebaseAdmin.verifyIdToken(idToken);
  } catch {
    throw new BadRequestException({ code: 'PHONE_TOKEN_INVALID' });
  }

  const phone = decoded.phone_number;
  if (!phone) {
    throw new BadRequestException({ code: 'PHONE_TOKEN_NO_NUMBER' });
  }

  // Check for duplicate phone across other users.
  const conflict = await this.userModel.findOne({
    phoneNumber: phone,
    _id: { $ne: userId },
  });
  if (conflict) throw new BadRequestException({ code: 'PHONE_ALREADY_TAKEN' });

  const user = await this.userModel
    .findByIdAndUpdate(
      userId,
      { $set: { phoneNumber: phone, phoneVerified: true } },
      { new: true },
    )
    .select('-password')
    .exec();
  if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
  return user;
}
```

### Task 6 — Update UsersController: remove send-otp endpoint, update verify endpoint
**File:** `apps/server/auth-service/src/modules/users/users.controller.ts`

**Remove** the entire `@Post('me/phone/send-otp')` handler (was calling `sendPhoneOtp`).

**Modify** `@Post('me/phone/verify')`:
```typescript
// Before: accepts { otp: string }
// After: accepts { firebaseIdToken: string }

@Post('me/phone/verify')
@ApiOperation({ summary: 'Verify Firebase Phone Auth token and save phone number' })
async verifyFirebasePhoneToken(@Req() req: any, @Body('firebaseIdToken') idToken: string) {
  if (!idToken) throw new BadRequestException({ code: 'PHONE_TOKEN_MISSING' });
  const user = await this.usersService.verifyFirebasePhoneToken(req.user.sub, idToken);
  return {
    success: true,
    phoneNumber: user.phoneNumber,
    phoneVerified: user.phoneVerified,
  };
}
```

### Task 7 — Update deploy.yml
**File:** `.github/workflows/deploy.yml`

In the auth-service env_vars section:

**Remove:**
```yaml
TWILIO_ACCOUNT_SID=${{ secrets.TWILIO_ACCOUNT_SID }}
TWILIO_AUTH_TOKEN=${{ secrets.TWILIO_AUTH_TOKEN }}
TWILIO_PHONE_NUMBER=${{ secrets.TWILIO_PHONE_NUMBER }}
```

**Add:**
```yaml
FIREBASE_SERVICE_ACCOUNT_BASE64=${{ secrets.FIREBASE_SERVICE_ACCOUNT_BASE64 }}
```

> Note: `FIREBASE_SERVICE_ACCOUNT_BASE64` is already in GitHub secrets (chat-service uses it). Same secret, same key name — just add it to auth-service's env block.

Also add `FirebaseAdminModule` to the root `AppModule` imports if it isn't already imported via `UsersModule` export chain. Since `@Global()` decorator is on `FirebaseAdminModule`, importing it once in `AppModule` would also work. Choose either approach — via `UsersModule` (Task 4) is sufficient.

---

## Part B — Web: Add Firebase SDK, Rewrite PhoneField

### Task 8 — Add Firebase to web
**File:** `apps/web/package.json`

Add `"firebase": "^10.x.x"` to dependencies.

### Task 9 — Create Firebase web initialization
**File:** `apps/web/lib/firebase.ts` (CREATE)

```typescript
import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
}

// Guard against hot-reload double-init
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)

export const firebaseAuth = getAuth(app)
```

**Add to Vercel environment (or `.env.local` for dev):**
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyC8q9vgMzZYEPqEYcT1nRPb2JrWmd3XXwI
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=pon-c30fd.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=pon-c30fd
NEXT_PUBLIC_FIREBASE_APP_ID=1:246431845875:web:246c24ecc32054f798d686
```

> These are the **web** values from `apps/client/lib/firebase_options.dart`. They are public (safe to expose in `NEXT_PUBLIC_*`).

**Also:** Add the Vercel production domain to Firebase console → Authentication → Settings → Authorized domains. Current domain: `platform-web-omega-amber.vercel.app`.

### Task 10 — Update auth API client
**File:** `apps/web/lib/api/auth.ts`

**Remove:**
```typescript
sendPhoneOtp: (phone: string) =>
  authApi.post('/api/users/me/phone/send-otp', { phone }).then((r) => r.data),

verifyPhoneOtp: (otp: string) =>
  authApi.post<{ success: boolean; phoneNumber: string; phoneVerified: boolean }>(
    '/api/users/me/phone/verify',
    { otp },
  ).then((r) => r.data),
```

**Add:**
```typescript
verifyFirebasePhoneToken: (firebaseIdToken: string) =>
  authApi.post<{ success: boolean; phoneNumber: string; phoneVerified: boolean }>(
    '/api/users/me/phone/verify',
    { firebaseIdToken },
  ).then((r) => r.data),
```

### Task 11 — Rewrite PhoneField.tsx
**File:** `apps/web/components/profile/PhoneField.tsx`

The component structure (notice-first UI: 3 states + modal) stays the same. Only the OTP send/verify logic changes.

**New imports (add):**
```typescript
import {
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult,
} from 'firebase/auth'
import { firebaseAuth } from '@/lib/firebase'
```

**Remove from imports:**
- `authService` (for sendPhoneOtp/verifyPhoneOtp calls)

**Add to imports:**
- `authService` stays (for `verifyFirebasePhoneToken`)

**New state in component:**
```typescript
const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)
const recaptchaRef = useRef<RecaptchaVerifier | null>(null)
```

**Replace `handleSendOtp`:**
```typescript
const handleSendOtp = async () => {
  if (!draft || !isValidPhoneNumber(draft)) {
    toast.error(labels.errorInvalid)
    return
  }
  setSending(true)
  try {
    // Create invisible reCAPTCHA verifier once
    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(
        firebaseAuth,
        'recaptcha-container',   // <-- invisible div rendered in the modal
        { size: 'invisible' },
      )
    }
    const result = await signInWithPhoneNumber(firebaseAuth, draft, recaptchaRef.current)
    setConfirmationResult(result)
    setOtp(Array(OTP_LENGTH).fill(''))
    setOtpError('')
    setStep('otp')
    startTimer()
  } catch (err: unknown) {
    console.error('Firebase sendOtp error:', err)
    toast.error(labels.errorSend)
    // Reset reCAPTCHA on failure so user can retry
    recaptchaRef.current?.clear()
    recaptchaRef.current = null
  } finally {
    setSending(false)
  }
}
```

**Replace `handleVerify`:**
```typescript
const handleVerify = async () => {
  const code = otp.join('')
  if (code.length < OTP_LENGTH) {
    setOtpError(labels.otpIncomplete)
    return
  }
  if (!confirmationResult) {
    setOtpError(labels.errorSend)
    return
  }
  setVerifying(true)
  setOtpError('')
  try {
    // Firebase verifies OTP client-side
    const credential = await confirmationResult.confirm(code)
    // Get Firebase ID token with phone_number claim
    const idToken = await credential.user.getIdToken()
    // Backend saves phone to our DB and marks verified
    await authService.verifyFirebasePhoneToken(idToken)
    // Sign out from Firebase Auth (we use our own auth system)
    await firebaseAuth.signOut()
    toast.success(labels.successToast)
    setModalOpen(false)
    onChange(draft, true)
  } catch (err: unknown) {
    const code = errorCode(err)
    if (code === 'PHONE_ALREADY_TAKEN') {
      setOtpError(labels.errorTaken)
    } else {
      // Firebase OTP wrong/expired → show generic invalid message
      setOtpError(labels.errorVerify)
    }
  } finally {
    setVerifying(false)
  }
}
```

**Replace `handleResend`:**
```typescript
const handleResend = () => {
  if (resendTimer > 0) return
  // Clear Firebase confirmation state and reCAPTCHA, go back to phone step
  setConfirmationResult(null)
  recaptchaRef.current?.clear()
  recaptchaRef.current = null
  setOtp(Array(OTP_LENGTH).fill(''))
  setOtpError('')
  setStep('phone')
}
```

**Add invisible reCAPTCHA container to modal JSX** (inside `<Dialog>`):
```tsx
{/* Invisible reCAPTCHA anchor — Firebase attaches the widget here */}
<div id="recaptcha-container" />
```

**Remove** `labels.errorRateLimit` handling from error catch (Firebase handles rate limiting internally — user gets Firebase's own error if they hit the limit, which we show as `labels.errorSend`).

---

## Part C — Flutter: Add firebase_auth, Rewrite Phone Verification

### Task 12 — Add firebase_auth to pubspec.yaml
**File:** `apps/client/pubspec.yaml`

```yaml
dependencies:
  firebase_core: ^3.1.1
  firebase_messaging: ^15.0.1
  firebase_auth: ^5.0.0   # ← ADD (compatible with firebase_core ^3.x)
```

Run `flutter pub get` after updating.

### Task 13 — Update auth_repository.dart
**File:** `apps/client/lib/features/auth/data/auth_repository.dart`

**Remove** `sendPhoneOtp()` method (lines ~207-211).

**Replace** `verifyPhoneOtp()` (lines ~213-220) with:
```dart
/// Verifies a Firebase Phone Auth ID token on the server.
/// The token is obtained after Firebase verifies the SMS OTP client-side.
/// On success, the server persists the phone number and sets phoneVerified=true.
Future<String?> verifyFirebasePhoneToken(String idToken) async {
  final response = await _dio.post(
    '/api/users/me/phone/verify',
    data: {'firebaseIdToken': idToken},
  );
  return response.data['phoneNumber'] as String?;
}
```

### Task 14 — Delete dead code: phone_otp_dialog.dart
**File:** `apps/client/lib/features/profile/ui/widgets/phone_otp_dialog.dart`

**DELETE** this file. It is not imported anywhere and duplicates the flow handled by `phone_verification_bottom_sheet.dart`.

### Task 15 — Rewrite phone_verification_bottom_sheet.dart
**File:** `apps/client/lib/features/profile/ui/widgets/phone_verification_bottom_sheet.dart`

Complete rewrite. Keep the same UI structure (bottom sheet, 2-step flow, same labels) but replace backend API calls with Firebase SDK.

**New imports:**
```dart
import 'package:firebase_auth/firebase_auth.dart';
// Remove: import '../../../../core/utils/app_error.dart' (error codes change)
// Keep all other imports
```

**New state variables (replace old ones):**
```dart
_VerifyStep _step = _VerifyStep.phone;
PhoneNumber? _phone;           // keeps intl_phone_number_input usage
String _e164Sent = '';
String _verificationId = '';   // ← NEW: Firebase verification ID
int? _resendToken;             // ← NEW: Firebase resend token

bool _sending = false;
bool _verifying = false;
String? _phoneError;
String? _otpError;
int _resendTimer = 0;
Timer? _timer;
final TextEditingController _otpController = TextEditingController();
```

**Replace `_sendOtp()`:**
```dart
Future<void> _sendOtp() async {
  if (!_hasValidNumber || _sending) return;
  final e164 = _e164;
  setState(() { _sending = true; _phoneError = null; });

  await FirebaseAuth.instance.verifyPhoneNumber(
    phoneNumber: e164,
    forceResendingToken: _resendToken,
    verificationCompleted: (PhoneAuthCredential credential) async {
      // Android auto-verification (SMS auto-read) — complete immediately
      await _signInWithCredential(credential);
    },
    verificationFailed: (FirebaseAuthException e) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _phoneError = _mapFirebaseError(e);
      });
    },
    codeSent: (String verificationId, int? resendToken) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _verificationId = verificationId;
        _resendToken = resendToken;
        _e164Sent = e164;
        _step = _VerifyStep.otp;
        _otpController.clear();
        _otpError = null;
      });
      _startTimer();
    },
    codeAutoRetrievalTimeout: (String verificationId) {
      if (mounted) setState(() => _verificationId = verificationId);
    },
    timeout: const Duration(seconds: 60),
  );
}
```

**Replace `_resend()`:**
```dart
Future<void> _resend() async {
  if (_resendTimer > 0 || _sending) return;
  setState(() { _otpController.clear(); _otpError = null; });
  // Re-trigger with resend token (bypasses 10s cooldown, uses forceResendingToken)
  await _sendOtp();
}
```

**Replace `_verify()`:**
```dart
Future<void> _verify() async {
  final code = _otpController.text.trim();
  if (code.length < 6) {
    setState(() => _otpError = context.l10n.phoneOtpIncomplete);
    return;
  }
  setState(() { _verifying = true; _otpError = null; });

  try {
    final credential = PhoneAuthProvider.credential(
      verificationId: _verificationId,
      smsCode: code,
    );
    await _signInWithCredential(credential);
  } on FirebaseAuthException catch (e) {
    if (!mounted) return;
    setState(() {
      _verifying = false;
      _otpError = e.code == 'invalid-verification-code'
          ? context.l10n.phoneOtpInvalid
          : context.l10n.phoneOtpExpired;
    });
  } catch (e) {
    if (!mounted) return;
    setState(() {
      _verifying = false;
      _otpError = context.l10n.phoneOtpInvalid;
    });
  }
}
```

**Add new helper `_signInWithCredential()`:**
```dart
/// Signs in to Firebase with the phone credential, gets an ID token,
/// sends it to our backend, then signs out of Firebase.
Future<void> _signInWithCredential(PhoneAuthCredential credential) async {
  final userCredential =
      await FirebaseAuth.instance.signInWithCredential(credential);

  final idToken = await userCredential.user?.getIdToken();
  if (idToken == null) throw Exception('No ID token');

  final serverPhone =
      await ref.read(authRepositoryProvider).verifyFirebasePhoneToken(idToken);

  // We use our own auth system — sign out of Firebase after getting the token.
  await FirebaseAuth.instance.signOut();

  // Refresh cached PON user so phoneVerified/phoneNumber stay in sync.
  await ref.read(authNotifierProvider.notifier).refreshUser();

  if (!mounted) return;
  Navigator.of(context).pop();
  widget.onVerified(serverPhone ?? _e164Sent);
}
```

**Add error mapper:**
```dart
String _mapFirebaseError(FirebaseAuthException e) {
  switch (e.code) {
    case 'invalid-phone-number':
      return context.l10n.phoneInvalidNumber;
    case 'too-many-requests':
      return context.l10n.phoneRateLimit;
    default:
      return context.l10n.phoneSendOtpError;
  }
}
```

**Keep `_buildPhoneStep()` and `_buildOtpStep()` UI unchanged** — same widgets, same labels, same layout. Only the logic methods change.

---

## Part D — Prerequisite: Enable Phone Auth in Firebase Console

> These are manual steps the developer does in Firebase console — NOT code changes.

1. Go to **Firebase Console → pon-c30fd → Authentication → Sign-in method**
2. Enable **Phone** as a sign-in provider
3. Go to **Authentication → Settings → Authorized domains**
4. Add `platform-web-omega-amber.vercel.app` (for web production)
5. Add `localhost` (for local dev, probably already there)
6. For Android: SHA-1 fingerprint must be in Firebase project settings (usually already added for FCM)
7. For iOS: APNs key must be configured (usually already configured for FCM push)

---

## Summary of files changed

| Action | File |
|---|---|
| DELETE | `apps/server/auth-service/src/modules/sms/sms.service.ts` |
| DELETE | `apps/server/auth-service/src/modules/sms/sms.module.ts` |
| DELETE | `apps/client/lib/features/profile/ui/widgets/phone_otp_dialog.dart` |
| CREATE | `apps/server/auth-service/src/modules/firebase/firebase.module.ts` |
| CREATE | `apps/server/auth-service/src/modules/firebase/firebase-admin.service.ts` |
| CREATE | `apps/web/lib/firebase.ts` |
| UPDATE | `apps/server/auth-service/package.json` (remove twilio, add firebase-admin) |
| UPDATE | `apps/server/auth-service/src/modules/users/users.module.ts` |
| UPDATE | `apps/server/auth-service/src/modules/users/users.service.ts` |
| UPDATE | `apps/server/auth-service/src/modules/users/users.controller.ts` |
| UPDATE | `.github/workflows/deploy.yml` (remove TWILIO_*, add FIREBASE_SERVICE_ACCOUNT_BASE64 to auth-service) |
| UPDATE | `apps/web/package.json` (add firebase) |
| UPDATE | `apps/web/lib/api/auth.ts` |
| UPDATE | `apps/web/components/profile/PhoneField.tsx` |
| UPDATE | `apps/client/pubspec.yaml` (add firebase_auth) |
| UPDATE | `apps/client/lib/features/auth/data/auth_repository.dart` |
| UPDATE | `apps/client/lib/features/profile/ui/widgets/phone_verification_bottom_sheet.dart` |

---

## Checklist for Claude Code

- [ ] Task 1: Delete `sms.service.ts` + `sms.module.ts`
- [ ] Task 2: `package.json` — remove twilio, add firebase-admin ^12
- [ ] Task 3: Create `firebase/firebase.module.ts` + `firebase/firebase-admin.service.ts`
- [ ] Task 4: `users.module.ts` — swap SmsModule → FirebaseAdminModule
- [ ] Task 5: `users.service.ts` — remove SmsService + sendPhoneOtp(), add verifyFirebasePhoneToken()
- [ ] Task 6: `users.controller.ts` — remove POST /me/phone/send-otp, update POST /me/phone/verify body
- [ ] Task 7: `deploy.yml` — remove TWILIO_* from auth-service, add FIREBASE_SERVICE_ACCOUNT_BASE64
- [ ] Task 8: `apps/web/package.json` — add firebase ^10
- [ ] Task 9: Create `apps/web/lib/firebase.ts`
- [ ] Task 10: `apps/web/lib/api/auth.ts` — remove sendPhoneOtp, add verifyFirebasePhoneToken
- [ ] Task 11: `apps/web/components/profile/PhoneField.tsx` — rewrite with Firebase signInWithPhoneNumber + RecaptchaVerifier
- [ ] Task 12: `apps/client/pubspec.yaml` — add firebase_auth ^5
- [ ] Task 13: `apps/client/lib/features/auth/data/auth_repository.dart` — remove sendPhoneOtp, add verifyFirebasePhoneToken
- [ ] Task 14: Delete `phone_otp_dialog.dart`
- [ ] Task 15: Rewrite `phone_verification_bottom_sheet.dart` — use FirebaseAuth.instance.verifyPhoneNumber()

### Developer manual steps (NOT code — do in Firebase Console):
- [ ] Enable Phone sign-in provider in Firebase Console
- [ ] Add production domain to Authorized domains
- [ ] Verify Android SHA-1 fingerprint + iOS APNs are configured (usually done for FCM)
- [ ] Add NEXT_PUBLIC_FIREBASE_* env vars to Vercel project settings (values from firebase_options.dart web block)
