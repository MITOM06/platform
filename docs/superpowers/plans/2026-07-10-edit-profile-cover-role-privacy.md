# Plan: Edit Profile — tỉ lệ cover cân đối hơn, thêm field Role (read-only), dời Privacy xuống cuối

> **Ngày:** 2026-07-10 | **Scope:** Web (`apps/web/`) + Flutter (`apps/client/`) — parity bắt buộc theo `sync.md`.

---

## 1. Cover photo — tỉ lệ đang quá dẹt (dài x rộng lệch nhiều)

**Root cause:** web `ProfileImageHeader.tsx` cover box là `h-32` (128px) cố định trong container
`max-w-2xl` (672px) → tỉ lệ hiển thị ~5.25:1, rất dẹt. Trong khi `ImageCropperModal` lại crop ảnh
theo tỉ lệ `aspect={16/6}` (≈2.67:1) — 2 tỉ lệ KHÔNG khớp nhau, ảnh crop xong bị `object-cover` (web)
/ `BoxFit.cover` (Flutter) cắt/giãn lệch so với ý người dùng crop. Flutter (`edit_profile_header.dart`)
cũng `height: 128` cố định, đỡ dẹt hơn vì màn hình hẹp hơn nhưng cùng vấn đề gốc — không neo theo tỉ
lệ ảnh crop.

**Fix — dùng ĐÚNG 1 tỉ lệ xuyên suốt (16:6, tỉ lệ đã có sẵn ở cropper) thay vì height cố định, đồng
thời nới container rộng hơn 1 chút theo đúng yêu cầu:**

`apps/web/components/profile/ProfileImageHeader.tsx`:
```tsx
// Tìm:
<div className="max-w-2xl mx-auto px-6 pt-6">
  <div className="relative h-32 rounded-xl overflow-hidden group">

// Thay thành (container rộng hơn: max-w-2xl → max-w-3xl; cover dùng aspect-ratio thay vì h cố định,
// khớp đúng tỉ lệ cropper 16/6):
<div className="max-w-3xl mx-auto px-6 pt-6">
  <div className="relative aspect-[16/6] rounded-xl overflow-hidden group">
```
(`Image fill` bên trong vẫn hoạt động bình thường với parent có `position: relative` + kích thước xác
định qua aspect-ratio.)

`apps/web/app/(main)/profile/edit/page.tsx` — container bọc `ProfileForm` cũng đang `max-w-2xl`, đổi
đồng bộ:
```tsx
// Tìm: <div className="relative max-w-2xl mx-auto px-6">
// Thay: <div className="relative max-w-3xl mx-auto px-6">
```

`apps/client/lib/features/profile/ui/widgets/edit_profile_header.dart` — đổi `height: 128` (2 chỗ:
Container cao 128 + CachedNetworkImage height 128) sang dùng `AspectRatio(aspectRatio: 16/6, ...)` bọc
Container, để cùng tỉ lệ với web thay vì số cố định:
```dart
// Tìm (trong Positioned top/left/right của cover):
child: Container(
  height: 128,
  decoration: BoxDecoration(...),
  child: Stack(...),
),

// Thay thành: bọc bằng AspectRatio, bỏ height cố định trên Container VÀ trên
// CachedNetworkImage bên trong (đổi height: 128 → double.infinity ở đó luôn):
child: AspectRatio(
  aspectRatio: 16 / 6,
  child: Container(
    decoration: BoxDecoration(...),
    child: Stack(...), // CachedNetworkImage bên trong: height: double.infinity
  ),
),
```
Điều chỉnh lại `SizedBox(height: 200)` bọc ngoài cùng (avatar overlap) cho đủ chỗ — tính lại dựa trên
chiều cao thực tế của `AspectRatio(16/6)` ở độ rộng màn hình trung bình (~360-430dp) + phần avatar
tràn xuống dưới (radius 48 + border) để tránh cắt avatar, hoặc đổi `SizedBox(height: 200)` thành
`LayoutBuilder` tính động — Claude Code tự chọn cách đơn giản nhất miễn không bị cắt avatar.

**Lý do chọn 16:6 thay vì số bất kỳ:** đây là tỉ lệ ĐÃ tồn tại sẵn trong `ImageCropperModal`
(`aspect={cropTarget === 'cover' ? 16/6 : 1}`) — dùng lại đúng số này cho khung hiển thị đảm bảo ảnh
sau khi user crop hiển thị ĐÚNG như họ thấy lúc crop, không bị co kéo lệch thêm 1 lần nữa ở màn hình
hiển thị. Đây là fix nhất quán, không phải chọn số tùy ý.

---

## 2. Thêm field "Role" (read-only, giống Email)

Dữ liệu role đã có sẵn — đã dùng ở trang xem profile (`me?.roleName` web, `user.roleName` Flutter, từ
plan `2026-07-01-role-display-in-profile.md`, đã DONE). Việc cần làm chỉ là thêm 1 field read-only
TƯƠNG TỰ Email vào FORM chỉnh sửa (hiện form edit chưa có field này).

`apps/web/components/profile/ProfileForm.tsx` — thêm prop `roleName: string` vào `ProfileFormProps`,
thêm field Role NGAY TRÊN field Email (cùng style — input `disabled`, không có bút chì edit):

```tsx
// Thêm vào ProfileFormProps: roleName: string
// Thêm vào ProfileFormTexts: roleLabel: string

// Trong JSX, ngay TRƯỚC block "{/* Email (read-only) */}":
{/* Role (read-only) */}
<div className="space-y-2">
  <Label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
    <Users className="size-4" />
    {texts.roleLabel}
  </Label>
  <Input value={roleName} disabled className="text-muted-foreground bg-muted/50" />
</div>
```

`apps/web/app/(main)/profile/edit/page.tsx` — truyền `roleName={me?.roleName ?? t('memberDefault')}`
xuống `<ProfileForm>` (dùng đúng key `memberDefault` đã có sẵn từ trang view-profile).

`apps/client/lib/features/profile/ui/edit_profile_screen.dart` — thêm 1 `ListTile` read-only (không
`onTap`) ngay sau field Bio, TRƯỚC Phone section, style giống các `ListTile` read-only khác trong file
(dùng icon `Icons.work_outline` để khớp `ProfileCenteredInfoRow` ở trang view):

```dart
// Thêm ngay sau block PonTextField bio, trước PhoneVerificationSection:
const SizedBox(height: 16),
ListTile(
  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
  tileColor: Theme.of(context).colorScheme.surface,
  leading: const Icon(Icons.work_outline, color: AppTheme.ponCyan),
  title: Text(context.l10n.roleLabel, style: const TextStyle(color: Colors.white70, fontSize: 12)),
  subtitle: Text(
    user?.roleName ?? context.l10n.profileRoleMemberDefault,
    style: const TextStyle(color: Colors.white),
  ),
),
```

i18n: thêm key `roleLabel` (web `messages/*.json` 7 locale, namespace `profile`; Flutter `app_*.arb` 7
file) — `"Role"` / `"Vai trò"` (+ zh/ja/ko/fr/es tương tự các key khác đã có trong namespace này).

---

## 3. Dời khung "Privacy" xuống cuối form

**Web** (`ProfileForm.tsx`) — di chuyển NGUYÊN block `{/* Privacy section... */}` (dòng ~302-344, cả
`<div className="rounded-lg border p-3 space-y-3">...</div>`) xuống ngay TRƯỚC `<Separator />` +
Save button, tức là SAU field Email (Role + Email + Privacy + Separator + Save). Thứ tự mới:
Display name → Bio → DOB → Phone → Gender → Role → Email → **Privacy** → Save.

**Flutter** (`edit_profile_screen.dart`) — hiện 3 toggle `EditProfilePrivacyToggle` đang nằm XEN KẼ
ngay dưới field chủ (showPhone dưới Phone, showGender dưới Gender, showDob dưới DOB tile). Để khớp
tinh thần "gom khung Privacy xuống cuối" như web, tách 3 toggle này ra khỏi vị trí xen kẽ, gom lại
thành 1 khối ở cuối `ListView` (ngay trước `SizedBox(height: 24)` cuối cùng), bọc trong 1 `Container`
bo góc + border giống các card khác trong file (dùng style `tileColor`/`BorderRadius.circular(10)`
nhất quán) với 1 tiêu đề nhỏ phía trên (dùng `context.l10n.privacySectionLabel` — key này có thể cần
thêm mới nếu Flutter ARB chưa có, kiểm tra trước khi thêm):

```dart
// Xoá 3 chỗ EditProfilePrivacyToggle rải rác hiện tại (dưới Phone/Gender/DOB).
// Thêm khối gộp ở cuối, trước SizedBox(height: 24) cuối ListView children:
Container(
  padding: const EdgeInsets.all(14),
  decoration: BoxDecoration(
    borderRadius: BorderRadius.circular(12),
    border: Border.all(color: Colors.white12),
  ),
  child: Column(
    children: [
      Row(children: [
        const Icon(Icons.lock_outline, color: AppTheme.ponCyan, size: 18),
        const SizedBox(width: 8),
        Text(context.l10n.privacySectionLabel,
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
      ]),
      const SizedBox(height: 10),
      EditProfilePrivacyToggle(
        label: context.l10n.profileShowDateOfBirth,
        value: _showDob,
        onChanged: _isLoading ? null : (v) => setState(() => _showDob = v),
      ),
      EditProfilePrivacyToggle(
        label: context.l10n.profileShowPhone,
        value: _showPhone,
        onChanged: _isLoading ? null : (v) => setState(() => _showPhone = v),
      ),
      EditProfilePrivacyToggle(
        label: context.l10n.profileShowGender,
        value: _showGender,
        onChanged: _isLoading ? null : (v) => setState(() => _showGender = v),
      ),
    ],
  ),
),
```

Kiểm tra `EditProfilePrivacyToggle` widget có tự thêm padding/divider riêng gây lệch khi đặt liên tiếp
trong `Column` hay không — chỉnh nhẹ nếu cần cho đều nhau.

---

## Verification

1. `pnpm build` (web), `flutter analyze` + `flutter gen-l10n` (mobile).
2. Cover photo hiển thị đúng tỉ lệ 16:6 trên cả 2 platform, không còn dẹt quá mức; ảnh crop xong hiện
   đúng như preview lúc crop (web) / preview sheet lúc chọn (Flutter).
3. Field "Role" hiện đúng dưới dạng read-only (không click sửa được), giá trị khớp với role thật hiện
   ở trang view-profile.
4. Khung Privacy nằm cuối cùng (web: sau Email, trước Save; Flutter: cuối ListView, trước padding kết
   thúc) trên cả 2 platform.
