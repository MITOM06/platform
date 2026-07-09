# Plan: Settings Mobile Fixes — Legal Bug + Profile Flow + Token Date Range

> **Ngày:** 2026-07-09
> **Scope:** Flutter client + Spring Boot chat-service (token date range)

---

## Fix 1 — Privacy & Terms crash (redirect về home khi đã đăng nhập)

### Root Cause

`app_router.dart` có `/legal` trong `_publicRoutes`. Redirect logic:
```dart
if (isAuth) {
  if (onPublic) return '/';   // ← ĐÂY: redirect authenticated user ra khỏi /legal → '/'
}
```

Kết quả: user đăng nhập, tap "Quyền riêng tư & Điều khoản" → navigate `/legal` → ngay lập tức bị redirect về `/`.

### Fix — `apps/client/lib/core/router/app_router.dart`

Tách `_publicRoutes` thành 2 sets:

```dart
/// Routes chỉ dành cho guest (redirect về / nếu đã đăng nhập)
final _guestOnlyRoutes = {
  '/login',
  '/register',
  '/verify-otp',
  '/forgot-password',
  '/new-password',
};

/// Routes mở cho tất cả — cả guest lẫn authenticated user đều vào được
final _publicRoutes = {
  ..._guestOnlyRoutes,
  '/legal',  // visible to everyone
};
```

Sửa redirect logic:
```dart
if (!isAuth && !onPublic) return '/login';

if (isAuth) {
  if (!onboardingCompleted && state.uri.path != '/theme-onboarding') {
    return '/theme-onboarding';
  }
  if (onboardingCompleted && state.uri.path == '/theme-onboarding') {
    return '/';
  }
  // Chỉ redirect guest-only routes, KHÔNG redirect /legal hay các "always public" routes
  if (_guestOnlyRoutes.contains(state.uri.path)) return '/';
}
return null;
```

---

## Fix 2 — Profile flow: Settings → View Profile trước, edit sau

### Vấn đề hiện tại

`settings_screen.dart` line 161: `context.push('/edit-profile')` → bật thẳng edit form.

### Yêu cầu mới

- Tap "Chỉnh sửa trang cá nhân" → mở `UserProfileScreen` với dữ liệu của **chính mình** (xem profile như người khác nhìn vào)
- Ở cuối `UserProfileScreen` (khi là own profile), thêm nút **"Chỉnh sửa hồ sơ"** → navigate `/edit-profile`

### Bước 1 — Thêm route `/profile/me` hoặc truyền userId qua existing `/profile/:userId`

Kiểm tra router xem `/profile/:userId` đã có chưa. Nếu có:
```dart
// settings_screen.dart — thay dòng:
context.push('/edit-profile');
// Thành:
final user = ref.read(authNotifierProvider).valueOrNull;
final ownId = user is AuthAuthenticated ? user.user.id : null;
if (ownId != null) context.push('/profile/$ownId');
```

Nếu `UserProfileScreen` nhận `userId` param, nó sẽ load và hiện profile của chính mình.

### Bước 2 — Thêm "Edit Profile" button vào `UserProfileScreen` khi là own profile

Trong `user_profile_screen.dart` hoặc `user_profile_actions.dart`, detect nếu `userId == currentUserId`:

```dart
final isOwnProfile = userId == ref.read(authNotifierProvider).valueOrNull
    is AuthAuthenticated ? (ref.read(authNotifierProvider).valueOrNull as AuthAuthenticated).user.id : null;

if (isOwnProfile)
  Padding(
    padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
    child: SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: () => context.push('/edit-profile'),
        icon: const Icon(Icons.edit_outlined, size: 18),
        label: Text(context.l10n.editProfileButton),
        style: ElevatedButton.styleFrom(
          backgroundColor: AppTheme.ponCyan,
          foregroundColor: Colors.black,
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
    ),
  ),
```

**Thêm i18n key** `editProfileButton` vào tất cả 7 ARB files:
- en: `"Edit profile"`
- vi: `"Chỉnh sửa hồ sơ"`
- zh/ja/ko/fr/es: các bản dịch tương ứng

---

## Fix 3 — Cover photo: Thêm preview/crop trước khi lưu

### Vấn đề

`EditProfileScreen._pickCoverPhoto()` hiện tại:
- User chọn ảnh từ gallery
- Gọi thẳng upload API → lưu luôn, không có preview/confirm

### Fix — Thêm preview modal + confirm/cancel trước khi upload

**Option A (đơn giản, không cần thêm package):** Sau khi pick file, show `showModalBottomSheet` với:
- Preview ảnh full-width (BoxFit.cover trong container 200px height)
- 2 nút: "Hủy" và "Lưu ảnh bìa"
- Chỉ upload khi user tap "Lưu"

```dart
Future<void> _pickCoverPhoto() async {
  final picker = ImagePicker();
  final picked = await picker.pickImage(source: ImageSource.gallery, imageQuality: 90);
  if (picked == null || !mounted) return;

  // Show preview before uploading
  final confirmed = await _showCoverPreviewSheet(File(picked.path));
  if (!confirmed || !mounted) return;

  // Upload only after confirm
  setState(() => _isLoading = true);
  try {
    await _repo.uploadCoverPhoto(File(picked.path));
    // refresh user
  } catch (e) {
    if (mounted) _showError(e);
  } finally {
    if (mounted) setState(() => _isLoading = false);
  }
}

Future<bool> _showCoverPreviewSheet(File imageFile) async {
  return await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => Container(
      decoration: const BoxDecoration(
        color: Color(0xFF1A1A2E),
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 12),
          Container(
            width: 36, height: 4,
            decoration: BoxDecoration(
              color: Colors.white24,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              context.l10n.coverPhotoPreviewTitle,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 16,
              ),
            ),
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 16),
              height: 180,
              width: double.infinity,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                image: DecorationImage(
                  image: FileImage(imageFile),
                  fit: BoxFit.cover,
                ),
              ),
            ),
          ),
          const SizedBox(height: 20),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(ctx).pop(false),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white70,
                      side: const BorderSide(color: Colors.white24),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    child: Text(context.l10n.cancel),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => Navigator.of(ctx).pop(true),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.ponCyan,
                      foregroundColor: Colors.black,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    child: Text(context.l10n.saveCoverPhoto),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    ),
  ) ?? false;
}
```

**Thêm i18n keys:**
- `coverPhotoPreviewTitle`: en `"Preview cover photo"`, vi `"Xem trước ảnh bìa"`
- `saveCoverPhoto`: en `"Set as cover"`, vi `"Đặt làm ảnh bìa"`

---

## Fix 4 — Edit Profile: redesign nút Save

### Vấn đề

Nút "LƯU" hiện tại là gradient rounded button full-width ở cuối màn hình — trông nặng nề và không match với design tổng thể.

### Fix

Thay bottomSheet-style button bằng **AppBar action button** (nhẹ hơn, phổ biến hơn trong mobile UX):

```dart
// Thêm actions vào AppBar của EditProfileScreen:
appBar: AppBar(
  title: Text(context.l10n.editProfileTitle),
  leading: IconButton(
    icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
    onPressed: () async {
      if (await _confirmLeave()) context.pop();
    },
  ),
  actions: [
    if (_isLoading)
      const Padding(
        padding: EdgeInsets.all(16),
        child: SizedBox(
          width: 20, height: 20,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      )
    else
      TextButton(
        onPressed: _hasUnsavedChanges ? _save : null,
        child: Text(
          context.l10n.save,
          style: TextStyle(
            color: _hasUnsavedChanges ? AppTheme.ponCyan : Colors.white30,
            fontWeight: FontWeight.bold,
            fontSize: 15,
          ),
        ),
      ),
  ],
),
```

Xóa nút "LƯU" cũ ở cuối scrollable content. Content bây giờ có thể scroll thoải mái đến đáy mà không bị nút chặn.

---

## Fix 5 — Token Usage: Custom date range picker

### Backend — `UsageController.java`

Thêm support `startDate` + `endDate` params (bên cạnh `days` vẫn giữ để backward compat):

```java
@GetMapping("/tokens")
public List<TokenUsageDayResponse> getTokenUsage(
    @RequestParam(defaultValue = "30") int days,
    @RequestParam(required = false) String startDate,
    @RequestParam(required = false) String endDate) {

  final String userId = currentUserId();
  final DateTimeFormatter fmt = DateTimeFormatter.ISO_LOCAL_DATE;
  final LocalDate today = LocalDate.now();

  LocalDate toDate;
  LocalDate fromDate;

  if (startDate != null && endDate != null) {
    fromDate = LocalDate.parse(startDate, fmt);
    toDate = LocalDate.parse(endDate, fmt);
    // Validation
    if (toDate.isAfter(today)) toDate = today;
    if (fromDate.isAfter(toDate)) fromDate = toDate.minusDays(6);
  } else {
    toDate = today;
    fromDate = today.minusDays(days - 1L);
  }

  List<TokenUsage> rows =
      tokenUsageRepository.findByUserIdAndDateBetweenOrderByDateAsc(
          userId, fromDate.format(fmt), toDate.format(fmt));

  Map<String, TokenUsage> byDate =
      rows.stream().collect(Collectors.toMap(TokenUsage::getDate, u -> u));

  return fromDate
      .datesUntil(toDate.plusDays(1))
      .map(d -> {
        String date = d.format(fmt);
        TokenUsage u = byDate.get(date);
        int input = u == null ? 0 : u.getInputTokens();
        int output = u == null ? 0 : u.getOutputTokens();
        int count = u == null ? 0 : u.getRequestCount();
        return new TokenUsageDayResponse(date, input, output, count, input + output);
      })
      .collect(Collectors.toList());
}
```

### Flutter — `token_usage_screen.dart`

Chuyển `TokenUsageScreen` thành `ConsumerStatefulWidget`. Thêm state cho date range:

```dart
class TokenUsageScreen extends ConsumerStatefulWidget {
  const TokenUsageScreen({super.key});
  @override
  ConsumerState<TokenUsageScreen> createState() => _TokenUsageScreenState();
}

class _TokenUsageScreenState extends ConsumerState<TokenUsageScreen> {
  // null = dùng mặc định 30 ngày
  DateTimeRange? _customRange;
  
  // Preset shortcuts
  static const _presets = [7, 30, 90];
  int? _activeDays = 30;  // null khi đang dùng custom range

  @override
  Widget build(BuildContext context) {
    // Build query params
    final queryDays = _customRange == null ? (_activeDays ?? 30) : null;
    final startDate = _customRange != null
        ? DateFormat('yyyy-MM-dd').format(_customRange!.start)
        : null;
    final endDate = _customRange != null
        ? DateFormat('yyyy-MM-dd').format(_customRange!.end)
        : null;

    final usageAsync = ref.watch(
      tokenUsageProvider((days: queryDays, startDate: startDate, endDate: endDate)),
    );
    
    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.tokenUsageTitle),
        actions: [
          IconButton(
            icon: const Icon(Icons.calendar_month_outlined),
            onPressed: _pickDateRange,
            tooltip: context.l10n.tokenUsageSelectRange,
          ),
        ],
      ),
      body: Column(
        children: [
          // Preset chips + current range indicator
          _RangeSelector(
            activeDays: _activeDays,
            customRange: _customRange,
            presets: _presets,
            onPreset: (days) => setState(() {
              _activeDays = days;
              _customRange = null;
            }),
          ),
          Expanded(
            child: usageAsync.when(
              data: (days) => _Body(days: days, isDark: isDark),
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text(friendlyError(e))),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _pickDateRange() async {
    final today = DateTime.now();
    final range = await showDateRangePicker(
      context: context,
      firstDate: DateTime(today.year - 1),
      lastDate: today,  // không cho chọn ngày tương lai
      initialDateRange: _customRange ?? DateTimeRange(
        start: today.subtract(const Duration(days: 29)),
        end: today,
      ),
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: ColorScheme.dark(
            primary: AppTheme.ponCyan,
            onPrimary: Colors.black,
          ),
        ),
        child: child!,
      ),
    );
    
    if (range == null || !mounted) return;
    
    // Validation
    final start = range.start;
    final end = range.end.isAfter(today) ? today : range.end;
    
    if (start.isAfter(end)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.tokenUsageDateRangeError)),
      );
      return;
    }
    
    setState(() {
      _customRange = DateTimeRange(start: start, end: end);
      _activeDays = null;
    });
  }
}
```

**Cập nhật provider** để nhận named params:

```dart
// Đổi từ FutureProvider.family<List<TokenUsageDay>, int>
// Thành:
final tokenUsageProvider = FutureProvider.autoDispose.family<
    List<TokenUsageDay>,
    ({int? days, String? startDate, String? endDate})>((ref, params) async {
  final dio = ref.read(_chatDioProvider);
  final queryParams = <String, dynamic>{};
  if (params.days != null) queryParams['days'] = params.days;
  if (params.startDate != null) queryParams['startDate'] = params.startDate;
  if (params.endDate != null) queryParams['endDate'] = params.endDate;
  
  final response = await dio.get<List<dynamic>>(
    '/api/usage/tokens',
    queryParameters: queryParams,
  );
  return (response.data ?? [])
      .map((e) => TokenUsageDay.fromJson(e as Map<String, dynamic>))
      .toList();
});
```

**`_RangeSelector` widget** (thêm vào cuối file hoặc file riêng):

```dart
class _RangeSelector extends StatelessWidget {
  final int? activeDays;
  final DateTimeRange? customRange;
  final List<int> presets;
  final void Function(int) onPreset;

  const _RangeSelector({
    required this.activeDays,
    required this.customRange,
    required this.presets,
    required this.onPreset,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Row(
        children: [
          ...presets.map((days) => Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: Text('${days}d'),
              selected: activeDays == days && customRange == null,
              onSelected: (_) => onPreset(days),
              selectedColor: AppTheme.ponCyan.withValues(alpha: 0.2),
              labelStyle: TextStyle(
                color: activeDays == days && customRange == null
                    ? AppTheme.ponCyan
                    : Colors.white60,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          )),
          if (customRange != null) ...[
            const SizedBox(width: 4),
            Chip(
              avatar: const Icon(Icons.calendar_today, size: 14, color: AppTheme.ponCyan),
              label: Text(
                '${DateFormat('dd/MM').format(customRange!.start)} – ${DateFormat('dd/MM').format(customRange!.end)}',
                style: const TextStyle(fontSize: 11, color: AppTheme.ponCyan),
              ),
              backgroundColor: AppTheme.ponCyan.withValues(alpha: 0.1),
            ),
          ],
        ],
      ),
    );
  }
}
```

**Thêm i18n keys** vào tất cả 7 ARB files:
- `tokenUsageSelectRange`: en `"Select date range"`, vi `"Chọn khoảng thời gian"`
- `tokenUsageDateRangeError`: en `"Start date must be before end date"`, vi `"Ngày bắt đầu phải trước ngày kết thúc"`
- `editProfileTitle`: en `"Edit profile"`, vi `"Chỉnh sửa hồ sơ"` (nếu chưa có)

---

## Verification

**Fix 1 (Legal):** Đăng nhập → Settings → "Quyền riêng tư & Điều khoản" → màn hình legal hiện ra, không bị redirect về home.

**Fix 2 (Profile flow):** Settings → "Chỉnh sửa trang cá nhân" → hiện profile view của chính mình → ở cuối có nút "Chỉnh sửa hồ sơ" → tap → edit form mở ra.

**Fix 3 (Cover photo preview):** Tap đổi ảnh bìa → chọn ảnh từ gallery → bottom sheet preview hiện ra → user tap "Đặt làm ảnh bìa" thì mới upload, tap "Hủy" thì không lưu gì cả.

**Fix 4 (Save button):** Nút LƯU cũ ở cuối bị xóa. Thay bằng "Lưu" text button ở top-right AppBar, chỉ active khi có `_hasUnsavedChanges`.

**Fix 5 (Token date range):**
- Màn hình token usage có preset chips 7d / 30d / 90d
- Nút lịch ở AppBar → date picker → không cho chọn ngày tương lai
- Start date sau end date → snackbar báo lỗi
- Custom range hiện dưới dạng chip `"09/06 – 09/07"`

## Lưu ý cho Claude Code

- **Fix 1:** Chỉ sửa `app_router.dart` — đổi tên set `_publicRoutes` thành `_guestOnlyRoutes` trong redirect logic, giữ nguyên check `!isAuth && !_publicRoutes.contains(...)` để redirect guest về login.
- **Fix 2:** Kiểm tra router xem `/profile/:userId` có nhận param userId không. Nếu `UserProfileScreen` đang nhận `userId` qua constructor, truyền `ownId` vào là xong.
- **Fix 5:** Backend cần build + restart: `cd apps/server/chat-service && mvn spring-boot:run`. Flutter cần `flutter pub get` nếu thêm `intl` (thường đã có sẵn).
