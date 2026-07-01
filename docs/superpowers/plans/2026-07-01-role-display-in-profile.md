# Plan: Hiển thị Role trong Profile (Read-only)

> **Ngày:** 2026-07-01  
> **Scope:** Backend (auth-service) + Web (Next.js) + Mobile (Flutter)  
> **Mục tiêu:** Mọi user có thể thấy role của nhau trong profile. Role không thể tự chỉnh — chỉ Owner/Admin mới đổi được qua Admin panel.

---

## Context

- `User` schema đã có `roleId?: Types.ObjectId` (ref → `Role`)
- `Role` schema có `name: string` (Owner/Admin/Manager/Member hoặc custom)
- Khi user không có `roleId` → treat as "Member" (default business logic)
- Hiện tại **không có endpoint nào trả về `roleName`** — backend không populate `roleId`, `toProfile()` và `getMe()` đều bỏ qua field này
- Admin panel (`MembersPanel.tsx`) đã hiển thị role nhưng đó là internal-only

---

## Nơi hiển thị

| Surface | Platform | File |
|---------|----------|------|
| Profile trang của chính mình | Web | `apps/web/app/(main)/profile/page.tsx` |
| Drawer profile người khác | Web | `apps/web/components/chat/UserProfileDrawer.tsx` |
| Profile screen (chính mình hoặc người khác) | Flutter | `apps/client/lib/features/profile/ui/user_profile_screen.dart` |

---

## Task 1 — Backend: Populate role khi fetch user

**File:** `apps/server/auth-service/src/modules/users/users.service.ts`

### 1a. `findById()`
```typescript
// Thêm .populate() trước .exec()
async findById(id: string): Promise<UserDocument | null> {
  try {
    return await this.userModel
      .findById(id)
      .select('-password')
      .populate('roleId', 'name isPreset')  // ← THÊM
      .exec();
  } catch (err: any) {
    if (err?.name === 'CastError') return null;
    throw err;
  }
}
```

### 1b. `findManyByIds()`
Tìm chỗ build query (dùng `$in`), thêm `.populate('roleId', 'name isPreset')` tương tự.

---

## Task 2 — Backend: Expose `roleName` trong các response

**File:** `apps/server/auth-service/src/modules/users/users.controller.ts`

### 2a. `toProfile()` (dùng cho `GET /api/users/:id` và batch `GET /api/users?ids=...`)
Trong method `toProfile()`, thêm `roleName` vào object `profile`:

```typescript
private toProfile(doc: any, callerId: string, friendsCount: number, isBlockedByOwner = false): any {
  // ... existing blocked-by-owner block unchanged ...

  const profile: any = {
    _id: doc._id,
    id: doc._id,
    displayName: doc.displayName,
    avatarUrl: doc.avatarUrl ?? '',
    coverPhoto: doc.coverPhoto ?? '',
    isVerified: doc.isVerified ?? false,
    hideInfo: doc.hideInfo ?? false,
    createdAt: doc.createdAt,
    friendsCount,
    // ← THÊM: role luôn public, không có privacy gate
    roleName: (doc.roleId as any)?.name ?? null,
  };

  // ... rest of method unchanged ...
}
```

Lưu ý: `roleName: null` nghĩa là user chưa được assign role → client hiển thị fallback "Member".

### 2b. `getMe()` (dùng cho `GET /api/users/me`)
`findById()` giờ đã populate `roleId` rồi, nhưng `getMe` lấy user qua `findById` rồi `.toObject()` — cần thêm `roleName` vào response:

```typescript
@Get('me')
async getMe(@Req() req: any) {
  const [user, hasPassword] = await Promise.all([
    this.usersService.findById(req.user.sub),
    this.usersService.getHasPassword(req.user.sub),
  ]);
  if (!user) return null;
  const doc = user.toObject();
  return {
    ...doc,
    hasPassword,
    roleName: (doc.roleId as any)?.name ?? null,  // ← THÊM
  };
}
```

---

## Task 3 — Web: Cập nhật TypeScript type

**File:** `apps/web/lib/api/auth.ts`

Thêm field vào `UserProfile` interface:

```typescript
export interface UserProfile extends AuthUser {
  // ... existing fields ...
  /** Workspace role name (Owner/Admin/Manager/Member or custom). Null = default Member. */
  roleName?: string | null
}
```

---

## Task 4 — Web: Profile trang của chính mình

**File:** `apps/web/app/(main)/profile/page.tsx`

Hiển thị role như một `InfoRow` đặt **ngay trên `Separator`** đầu tiên (trước bio), dưới phần name + email:

```tsx
{/* Name + email + role */}
<div className="text-center mt-4 mb-2">
  <h2 className="text-xl font-bold text-foreground">{user.displayName}</h2>
  <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
  {/* Role badge — read-only, always shown */}
  <div className="mt-2 flex justify-center">
    <span className="inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-medium text-muted-foreground">
      {me?.roleName ?? t('memberDefault')}
    </span>
  </div>
</div>
```

**Lý do dùng badge nhỏ dưới tên thay vì InfoRow:** Consistent với cách Gmail/LinkedIn hiển thị role/title — gắn liền với identity, không phải một field thông tin rời. InfoRow (bio, dob, phone...) vẫn không thay đổi.

---

## Task 5 — Web: Drawer profile người khác

**File:** `apps/web/components/chat/UserProfileDrawer.tsx`

Thêm role badge ngay sau `<p className="font-semibold text-base">{displayName}</p>`:

```tsx
{/* Role badge */}
{!blockedByOwner && user?.roleName && (
  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
    {user.roleName}
  </span>
)}
{!blockedByOwner && !user?.roleName && (
  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
    {t('memberDefault')}
  </span>
)}
```

Hoặc gọn hơn:
```tsx
{!blockedByOwner && (
  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
    {user?.roleName ?? t('memberDefault')}
  </span>
)}
```

`t` ở đây là `useTranslations('chat')`, nên key `memberDefault` cần ở namespace `chat`.

---

## Task 6 — Web: i18n (7 ngôn ngữ)

Thêm vào namespace `"profile"` trong mỗi file:

### `messages/en.json`
```json
"roleLabel": "Role",
"memberDefault": "Member"
```

### `messages/vi.json`
```json
"roleLabel": "Vai trò",
"memberDefault": "Thành viên"
```

### `messages/zh.json`
```json
"roleLabel": "角色",
"memberDefault": "成员"
```

### `messages/ja.json`
```json
"roleLabel": "ロール",
"memberDefault": "メンバー"
```

### `messages/ko.json`
```json
"roleLabel": "역할",
"memberDefault": "멤버"
```

### `messages/es.json`
```json
"roleLabel": "Rol",
"memberDefault": "Miembro"
```

### `messages/fr.json`
```json
"roleLabel": "Rôle",
"memberDefault": "Membre"
```

Thêm key `memberDefault` vào namespace `"chat"` trong mỗi file (vì `UserProfileDrawer` dùng `useTranslations('chat')`):

| Locale | `chat.memberDefault` |
|--------|----------------------|
| en | `"Member"` |
| vi | `"Thành viên"` |
| zh | `"成员"` |
| ja | `"メンバー"` |
| ko | `"멤버"` |
| es | `"Miembro"` |
| fr | `"Membre"` |

---

## Task 7 — Flutter: i18n (7 ngôn ngữ)

Thêm vào `app_en.arb` và 6 file còn lại:

### `app_en.arb`
```json
"profileRoleLabel": "Role",
"@profileRoleLabel": {},
"profileRoleMemberDefault": "Member",
"@profileRoleMemberDefault": {}
```

### `app_vi.arb`
```json
"profileRoleLabel": "Vai trò",
"profileRoleMemberDefault": "Thành viên"
```

### `app_zh.arb`
```json
"profileRoleLabel": "角色",
"profileRoleMemberDefault": "成员"
```

### `app_ja.arb`
```json
"profileRoleLabel": "ロール",
"profileRoleMemberDefault": "メンバー"
```

### `app_ko.arb`
```json
"profileRoleLabel": "역할",
"profileRoleMemberDefault": "멤버"
```

### `app_es.arb`
```json
"profileRoleLabel": "Rol",
"profileRoleMemberDefault": "Miembro"
```

### `app_fr.arb`
```json
"profileRoleLabel": "Rôle",
"profileRoleMemberDefault": "Membre"
```

Sau khi edit ARB: chạy `flutter gen-l10n`.

---

## Task 8 — Flutter: `user_profile_screen.dart`

**File:** `apps/client/lib/features/profile/ui/user_profile_screen.dart`

### 8a. Cập nhật `UserModel` (hoặc model/DTO hiện tại)
Tìm class/model đang parse response từ `GET /api/users/:id`. Thêm field:
```dart
final String? roleName;
```
Và parse trong `fromJson`:
```dart
roleName: json['roleName'] as String?,
```

### 8b. Thêm role chip dưới displayName
Tìm chỗ render `displayName` (thường là `Text(user.displayName, style: ...)`) trong `UserProfileScreen`, thêm ngay bên dưới:

```dart
// Role chip — read-only, luôn hiển thị
Padding(
  padding: const EdgeInsets.only(top: 4),
  child: Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
    decoration: BoxDecoration(
      border: Border.all(color: Theme.of(context).colorScheme.outline),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Text(
      user.roleName ?? context.l10n.profileRoleMemberDefault,
      style: Theme.of(context).textTheme.labelSmall?.copyWith(
        color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6),
      ),
    ),
  ),
),
```

---

## Verification

1. **Tạo/login user có role Admin** → xem profile của chính mình → thấy badge "Admin" trên cả web và mobile.
2. **User khác view profile đó** → `UserProfileDrawer` (web) và `UserProfileScreen` (mobile) đều thấy "Admin".
3. **User không có role** → thấy "Member" (fallback) thay vì trống/null.
4. **User bị block viewer** → role vẫn không hiển thị (vì block state → minimal profile, `blockedByOwner = true`). ✅ Đã đúng với logic hiện tại.
5. **Build pass**: `pnpm build` (web) + `flutter build apk` (mobile) không lỗi.

---

## Lưu ý quan trọng

- **Role là public information** — không có privacy toggle. Không cần thêm `showRole` flag.
- **Không được thêm edit control nào** cho role trong profile — chỉ Admin panel mới có quyền đó.
- `blockedByOwner = true` → toProfile() trả minimal info (không có roleName) — đây là behavior đúng, không cần special-case thêm.
- Khi `roleName` là `null` trên blocked profile → client vẫn không hiển thị (vì `blockedByOwner` gate đã chặn).
