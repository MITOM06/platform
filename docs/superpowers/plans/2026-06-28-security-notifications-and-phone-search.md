# Fix: hasPassword mobile bug + Setup notifications + Phone friend search

## Tóm tắt 4 việc cần làm

1. **Bug mobile**: user đã có password nhưng security screen vẫn hiện banner "chưa có mật khẩu"
   → Flutter không parse `hasPassword` từ API response
2. **Notification khi login**: tạo thông báo nhắc đặt mật khẩu (nếu Google-only) và nhắc
   xác minh số điện thoại (nếu chưa verify) — mỗi loại chỉ tạo 1 lần, không lặp
3. **Tìm bạn qua SĐT**: phải nhập đúng số đầy đủ, kết quả hiện số điện thoại nổi bật
4. **Privacy**: tìm theo tên/email không được để lộ SĐT của người khác

---

## Fix 1 — Flutter: parse `hasPassword` từ `/api/users/me`

**Nguyên nhân bug:** Flutter user model thiếu field `hasPassword`, nên khi API trả về
`hasPassword: true`, Flutter model bỏ qua và giá trị mặc định là `false` → security screen
luôn hiện banner "No password set yet" dù user đã có password.

**Tìm file:** search `displayName` trong Flutter codebase để tìm user model/entity class.
Thường là `apps/client/lib/features/auth/data/models/user_model.dart` hoặc tương tự.

**Thay đổi:** thêm `hasPassword` vào user model:

```dart
// Trong class UserModel (hoặc AuthUser, UserEntity — tuỳ tên trong project):
final bool hasPassword;

// Trong fromJson():
hasPassword: json['hasPassword'] as bool? ?? false,

// Trong toJson():
'hasPassword': hasPassword,

// Trong copyWith():
hasPassword: hasPassword ?? this.hasPassword,
```

**Verify:** Đăng nhập bằng email+password → vào security settings → KHÔNG hiện banner
"No password set yet". Đăng nhập Google account chưa set password → hiện banner đúng.

---

## Fix 2 — auth-service: tạo setup notifications sau khi login

**Goal:** Ngay sau khi user login thành công (cả email+password lẫn OAuth),
kiểm tra và tạo thông báo:
- `PASSWORD_SETUP`: nếu user đăng nhập Google nhưng chưa có password (`!user.password`)
- `PHONE_SETUP`: nếu user chưa verify số điện thoại (`!user.phoneVerified`)

Dùng `updateOne + $setOnInsert + upsert: true` → chỉ tạo 1 lần duy nhất, không bao giờ
duplicate kể cả user đăng nhập 1000 lần.
Ngược lại khi user đã verify phone → mark PHONE_SETUP notification là đã đọc.

### 2a — Thêm `PHONE_SETUP` vào NotificationType

**File:** `apps/server/auth-service/src/modules/notifications/notification.schema.ts`

```ts
export type NotificationType =
  | 'FRIEND_REQUEST'
  | 'FRIEND_ACCEPTED'
  | 'SYSTEM'
  | 'PASSWORD_SETUP'
  | 'PHONE_SETUP'   // ← thêm vào
```

### 2b — Thêm method `createSetupNotificationsIfNeeded` vào NotificationsService

**File:** `apps/server/auth-service/src/modules/notifications/notifications.service.ts`

```ts
/**
 * Gọi sau mỗi lần login thành công.
 * - Tạo PASSWORD_SETUP notification nếu user chưa có password (Google-only)
 * - Tạo PHONE_SETUP notification nếu user chưa verify SĐT
 * - Tự động đọc PHONE_SETUP nếu user đã verify rồi
 * Dùng upsert { $setOnInsert } để đảm bảo mỗi loại chỉ tạo 1 lần duy nhất.
 */
async createSetupNotificationsIfNeeded(userId: string, user: {
  hasPassword: boolean
  phoneVerified: boolean
}): Promise<void> {
  const ops: Promise<any>[] = []

  if (!user.hasPassword) {
    // Tạo PASSWORD_SETUP notification nếu chưa có
    ops.push(
      this.notificationModel.updateOne(
        { recipientId: userId, type: 'PASSWORD_SETUP' },
        {
          $setOnInsert: {
            recipientId: userId,
            type: 'PASSWORD_SETUP',
            title: 'Bảo vệ tài khoản của bạn',
            body: 'Tài khoản của bạn chưa có mật khẩu. Hãy thiết lập mật khẩu để tăng tính bảo mật.',
            readAt: null,
            createdAt: new Date(),
          },
        },
        { upsert: true },
      ),
    )
  }

  if (!user.phoneVerified) {
    // Tạo PHONE_SETUP notification nếu chưa có
    ops.push(
      this.notificationModel.updateOne(
        { recipientId: userId, type: 'PHONE_SETUP' },
        {
          $setOnInsert: {
            recipientId: userId,
            type: 'PHONE_SETUP',
            title: 'Xác minh số điện thoại',
            body: 'Thêm và xác minh số điện thoại để bạn bè có thể tìm thấy bạn và tăng tính bảo mật tài khoản.',
            readAt: null,
            createdAt: new Date(),
          },
        },
        { upsert: true },
      ),
    )
  } else {
    // User đã verify phone → mark PHONE_SETUP notification là đã đọc (nếu còn tồn tại)
    ops.push(
      this.notificationModel.updateMany(
        { recipientId: userId, type: 'PHONE_SETUP', readAt: null },
        { $set: { readAt: new Date() } },
      ),
    )
  }

  await Promise.all(ops)
}
```

### 2c — Inject NotificationsModule vào AuthModule

**File:** `apps/server/auth-service/src/modules/auth/auth.module.ts`

```ts
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [
    // existing imports...
    NotificationsModule,  // ← thêm
  ],
  ...
})
export class AuthModule {}
```

### 2d — Inject NotificationsService vào AuthService

**File:** `apps/server/auth-service/src/modules/auth/auth.service.ts`

```ts
constructor(
  // existing dependencies...
  private readonly notificationsService: NotificationsService,
) {}
```

### 2e — Gọi `createSetupNotificationsIfNeeded` sau login thành công

Tìm trong `auth.service.ts` phương thức `login()` (email+password login).
Sau khi tạo session và `accessToken` thành công, thêm:

```ts
// Sau khi login thành công — trigger setup notifications bất đồng bộ
// Không await vì không ảnh hưởng đến login response time
const hasPassword = await this.usersService.getHasPassword(user._id.toString())
this.notificationsService.createSetupNotificationsIfNeeded(user._id.toString(), {
  hasPassword,
  phoneVerified: user.phoneVerified ?? false,
}).catch(() => {/* silent — không fail login nếu notification lỗi */})
```

Tìm phương thức `exchangeLoginCode()` (dùng sau OAuth redirect). Sau khi `findById` user thành công:

```ts
// Trigger setup notifications sau OAuth login
if (user) {
  const hasPassword = await this.usersService.getHasPassword(userId)
  this.notificationsService.createSetupNotificationsIfNeeded(userId, {
    hasPassword,
    phoneVerified: user.phoneVerified ?? false,
  }).catch(() => {})
}
```

### 2f — Web: hiển thị PHONE_SETUP notification trong NotificationBell

**File:** `apps/web/components/layout/NotificationBell.tsx`

Trong hàm render notification item, thêm case cho `PHONE_SETUP`:
- Icon: `ShieldAlert` màu amber (đã có trong switch `NotifIcon`)
- Nội dung: hiển thị title + body bình thường
- Khi click: navigate đến `/profile/edit` (nơi user thêm SĐT)

```tsx
// Trong phần render notification item, sau khi hiển thị title/body:
{n.type === 'PHONE_SETUP' && (
  <Link
    href="/profile/edit"
    className="mt-1.5 text-xs text-pon-cyan hover:underline inline-block"
    onClick={() => markRead.mutate(n._id)}
  >
    Thêm số điện thoại →
  </Link>
)}
{n.type === 'PASSWORD_SETUP' && (
  <Link
    href="/settings/security"
    className="mt-1.5 text-xs text-pon-cyan hover:underline inline-block"
    onClick={() => markRead.mutate(n._id)}
  >
    Đặt mật khẩu ngay →
  </Link>
)}
```

### 2g — Flutter: hiển thị setup notifications trong notification panel

Trong `_OtpDialog` hoặc notification list widget của Flutter, thêm action cho
`PHONE_SETUP` → navigate đến profile edit screen, và `PASSWORD_SETUP` → navigate đến
security settings screen.

---

## Fix 3 — auth-service: tìm bạn theo SĐT phải nhập đúng số đầy đủ

### 3a — Modify `findBySearchQuery` trong UsersService

**File:** `apps/server/auth-service/src/modules/users/users.service.ts`

Thay toàn bộ method `findBySearchQuery`:

```ts
/**
 * Tìm kiếm user theo tên/email (partial) hoặc số điện thoại (exact only).
 *
 * Logic:
 * - Nếu query trông như SĐT (chỉ gồm +, chữ số, dấu cách — và ≥ 7 ký tự số):
 *   → Exact match trên phoneNumber (chuẩn E.164 sau normalize)
 *   → Chỉ trả về nếu user đó có phoneVerified: true VÀ showPhoneNumber: true
 *   → Kết quả được đánh dấu matchedBy: 'phone' để FE hiển thị SĐT nổi bật
 * - Nếu query là tên/email:
 *   → Partial match (regex case-insensitive) trên displayName và email
 *   → KHÔNG bao giờ include phoneNumber trong kết quả
 *
 * Không trả về kết quả nếu query rỗng (tránh leak toàn bộ user list).
 */
async findBySearchQuery(
  query: string,
): Promise<{ users: UserDocument[]; matchedBy: 'phone' | 'name_email' }> {
  const trimmed = (query ?? '').trim()
  if (!trimmed) return { users: [], matchedBy: 'name_email' }

  // Detect phone: chuỗi chỉ gồm +, chữ số, dấu cách — phần số phải ≥ 7 ký tự
  const digitsOnly = trimmed.replace(/[\s\-().]/g, '')
  const isPhone = /^\+?\d{7,15}$/.test(digitsOnly)

  if (isPhone) {
    // Normalize về E.164: nếu bắt đầu bằng 0 (VN local) → đổi thành +84
    let e164 = digitsOnly
    if (e164.startsWith('0')) e164 = '+84' + e164.slice(1)
    else if (!e164.startsWith('+')) e164 = '+' + e164

    const user = await this.userModel
      .findOne({
        phoneNumber: e164,
        phoneVerified: true,
        showPhoneNumber: true,
        status: 'active',
      })
      .select('-password -otpCode -otpExpires -fcmTokens -trustedDevices -socialLinks -blockedUsers')
      .exec()

    return {
      users: user ? [user] : [],
      matchedBy: 'phone',
    }
  }

  // Name / email search (partial match, case-insensitive)
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(escaped, 'i')
  const users = await this.userModel
    .find({
      $or: [{ email: pattern }, { displayName: pattern }],
      status: 'active',
    })
    .limit(10)
    .select('-password -otpCode -otpExpires -fcmTokens -trustedDevices -socialLinks -blockedUsers -phoneNumber')
    // phoneNumber bị exclude khỏi name/email search để tránh leak
    .exec()

  return { users, matchedBy: 'name_email' }
}
```

### 3b — Cập nhật search endpoint để trả về `matchedBy`

**File:** `apps/server/auth-service/src/modules/users/users.controller.ts`

```ts
@Get('search')
@ApiOperation({ summary: 'Search users by display name, email, or exact phone' })
@ApiQuery({ name: 'q', required: false })
async search(@Req() req: any, @Query('q') query: string) {
  const { users, matchedBy } = await this.usersService.findBySearchQuery(query ?? '')

  // Mapping giống toProfile() nhưng conditionally include phoneNumber
  const mapped = users.map((user) => {
    const doc = user.toObject()
    const result: any = {
      _id: doc._id,
      id: doc._id,
      displayName: doc.displayName,
      avatarUrl: doc.avatarUrl ?? '',
      bio: doc.bio ?? '',
      isVerified: doc.isVerified ?? false,
      friendsCount: 0,   // search results không cần friendsCount
    }

    // Chỉ include phoneNumber khi tìm theo SĐT — để FE highlight
    if (matchedBy === 'phone') {
      result.phoneNumber = doc.phoneNumber
      result.matchedBy = 'phone'
    }

    return result
  })

  return { results: mapped, matchedBy }
}
```

**Lưu ý:** endpoint hiện trả về `UserDocument[]` trực tiếp, đổi thành object `{ results, matchedBy }`.
Cần cập nhật FE để đọc format mới.

---

## Fix 4 — Web: cập nhật friends page để dùng format search mới + highlight SĐT

### 4a — Cập nhật `authService.searchUsers` trong `apps/web/lib/api/auth.ts`

```ts
// Kiểu dữ liệu kết quả search mới
export interface UserSearchResult {
  id: string
  _id: string
  displayName: string
  avatarUrl: string
  bio?: string
  isVerified: boolean
  phoneNumber?: string      // chỉ có khi matchedBy === 'phone'
  matchedBy?: 'phone' | 'name_email'
}

export interface SearchResponse {
  results: UserSearchResult[]
  matchedBy: 'phone' | 'name_email'
}

// Cập nhật method searchUsers:
searchUsers: (query: string): Promise<SearchResponse> =>
  authApi.get<SearchResponse>(`/api/users/search?q=${encodeURIComponent(query)}`)
    .then((r) => r.data),
```

### 4b — Cập nhật friends page để dùng response mới

**File:** `apps/web/app/(main)/friends/page.tsx`

```ts
// Cập nhật state
const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
const [matchedBy, setMatchedBy] = useState<'phone' | 'name_email'>('name_email')

// Cập nhật doSearch():
const doSearch = async () => {
  setSearching(true)
  try {
    const { results, matchedBy: mb } = await authService.searchUsers(debouncedSearch)
    setSearchResults(results)
    setMatchedBy(mb)
  } catch {
    setSearchResults([])
  } finally {
    setSearching(false)
  }
}
```

### 4c — Hiển thị SĐT nổi bật khi search theo phone

Trong `renderUserList` hoặc trực tiếp ở search results section, thêm badge SĐT:

```tsx
// Thêm vào card của mỗi user trong search results:
{user.matchedBy === 'phone' && user.phoneNumber && (
  <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full
                  bg-pon-cyan/15 border border-pon-cyan/30 text-xs text-pon-cyan font-mono">
    <Phone className="size-3" />
    {user.phoneNumber}
  </div>
)}
```

### 4d — Placeholder khi input chưa đủ dài (phone detection hint)

Trong search input, thêm hint text để user biết nhập đầy đủ SĐT:

```tsx
<Input
  placeholder={t('searchPlaceholder')}  // "Tìm theo tên, email hoặc số điện thoại đầy đủ..."
  ...
/>
// Nếu query trông như đang nhập SĐT nhưng chưa đủ (< 7 chữ số):
{/^\+?\d{1,6}$/.test(searchQuery.replace(/\s/g, '')) && (
  <p className="text-xs text-muted-foreground mt-1 px-1">
    {t('phoneSearchHint')}  {/* "Nhập đầy đủ số điện thoại để tìm kiếm" */}
  </p>
)}
```

### 4e — i18n keys

Thêm vào `en.json` và `vi.json`:
```json
// vi.json — trong namespace "friends":
"searchPlaceholder": "Tìm theo tên, email hoặc số điện thoại đầy đủ...",
"phoneSearchHint": "Nhập đầy đủ số điện thoại để tìm kiếm"

// notifications namespace:
"phoneSetupTitle": "Xác minh số điện thoại",
"phoneSetupAction": "Thêm số điện thoại →",
"passwordSetupAction": "Đặt mật khẩu ngay →"
```

---

## Fix 5 — Flutter: cập nhật friend search theo format mới

### 5a — Cập nhật model search result

```dart
class UserSearchResult {
  // existing fields...
  final String? phoneNumber;    // chỉ có khi matchedBy == 'phone'
  final String? matchedBy;     // 'phone' | 'name_email'

  // fromJson():
  phoneNumber: json['phoneNumber'] as String?,
  matchedBy: json['matchedBy'] as String?,
}
```

### 5b — Cập nhật search API response parsing

Trong friend search repository/service:
```dart
// Cũ: returns List<UserSearchResult>
// Mới: returns Map với results và matchedBy
final data = response.data as Map<String, dynamic>;
final results = (data['results'] as List)
    .map((e) => UserSearchResult.fromJson(e as Map<String, dynamic>))
    .toList();
final matchedBy = data['matchedBy'] as String? ?? 'name_email';
```

### 5c — Hiển thị SĐT nổi bật trong search result card Flutter

```dart
// Trong search result ListTile hoặc card widget:
if (user.matchedBy == 'phone' && user.phoneNumber != null) ...[
  const SizedBox(height: 4),
  Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
    decoration: BoxDecoration(
      color: AppTheme.ponCyan.withOpacity(0.12),
      border: Border.all(color: AppTheme.ponCyan.withOpacity(0.3)),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.phone, size: 12, color: AppTheme.ponCyan),
        const SizedBox(width: 4),
        Text(user.phoneNumber!,
            style: const TextStyle(
                color: AppTheme.ponCyan,
                fontSize: 11,
                fontFamily: 'monospace')),
      ],
    ),
  ),
],
```

### 5d — Phone input hint khi đang nhập SĐT chưa đủ

Trong search TextField, thêm hint:
```dart
// Nếu query là số nhưng chưa đủ dài:
final digitsOnly = query.replaceAll(RegExp(r'[^\d]'), '');
if (digitsOnly.length > 0 && digitsOnly.length < 7) ...[
  const SizedBox(height: 4),
  const Text(
    'Nhập đầy đủ số điện thoại để tìm kiếm',
    style: TextStyle(color: Colors.amber, fontSize: 12),
  ),
],
```

---

## Verify checklist

1. **hasPassword mobile:**
   - Login email+password → security settings → NOT hiện banner "No password set"
   - Login Google (chưa set password) → hiện banner đúng

2. **Setup notifications:**
   - Login Google account → bell có thông báo "Bảo vệ tài khoản" + "Xác minh số điện thoại"
   - Login email+password account → chỉ có "Xác minh số điện thoại" (nếu chưa verify)
   - Login lần 2 → không tạo thêm notification duplicate
   - Verify phone → PHONE_SETUP notification tự đọc

3. **Friend search phone:**
   - Nhập `+84817` (chưa đủ) → hiện hint "Nhập đầy đủ số điện thoại"
   - Nhập `+84817738889` (đầy đủ) → ra đúng 1 người (nếu tồn tại + verified + showPhoneNumber)
   - Kết quả hiện badge SĐT màu cyan để xác nhận trùng khớp
   - Tìm theo tên "Khang" → KHÔNG thấy SĐT của bất kỳ ai trong kết quả

4. **`pnpm build` và `flutter analyze` pass.**
