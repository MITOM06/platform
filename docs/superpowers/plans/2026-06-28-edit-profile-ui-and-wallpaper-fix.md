# Plan: Edit Profile UI Polish + Wallpaper Opacity Fix

**Date:** 2026-06-28  
**Scope:** Web only (Next.js). Flutter mirrors noted where needed.  
**Sync rule:** Web + Flutter ship in same commit.

---

## Issues

| # | Issue | Root cause |
|---|---|---|
| 1 | Cover banner quá cao | `h-40` (10rem) — nên `h-32` (8rem) |
| 2 | Form fields quá hẹp | `max-w-md` (28rem) — nên `max-w-2xl` (42rem) |
| 3 | Gender không có icon | SelectItem chỉ có text |
| 4 | Date picker native HTML trông dõm | `<input type="date">` → shadcn Calendar + Popover |
| 5 | Chưa có cảnh báo unsaved changes | Không có `beforeunload` handler + nav dialog |
| 6 | Wallpaper gradient quá mờ trong chat | Gradient color stops dùng `/30` opacity → blend với white |
| 7 | Image wallpaper bị che quá nhiều | Overlay `bg-background/80` = 80% white cover |

---

## PART A — Cover Photo Height

### Task 1 · Web — Giảm chiều cao cover

File: `apps/web/components/profile/ProfileImageHeader.tsx`

```tsx
// Trước:
<div className="relative h-40 w-full overflow-hidden group">

// Sau:
<div className="relative h-32 w-full overflow-hidden group">
```

Avatar overlap `-mt-14` giữ nguyên — với `h-32` banner sẽ trông cân đối hơn (tỉ lệ tương tự Twitter/Facebook profile).

---

## PART B — Form Container Width

### Task 2 · Web — Tăng width của form container

Có **2 nơi** dùng `max-w-md mx-auto px-6`:

**File 1:** `apps/web/components/profile/ProfileImageHeader.tsx`
```tsx
// Trước:
<div className="relative max-w-md mx-auto px-6">

// Sau:
<div className="relative max-w-2xl mx-auto px-6">
```

**File 2:** `apps/web/app/(main)/profile/edit/page.tsx`
```tsx
// Trước:
<div className="relative max-w-md mx-auto px-6">

// Sau:
<div className="relative max-w-2xl mx-auto px-6">
```

`max-w-2xl` = 42rem / ~672px — đủ rộng để hiển thị tốt trên desktop mà không trải quá rộng.

---

## PART C — Gender Icons in Select

### Task 3 · Web — Thêm gender icons vào SelectItem

File: `apps/web/components/profile/ProfileForm.tsx`

Thay đổi 3 `SelectItem`:

```tsx
// Trước:
<SelectItem value="male">{texts.genderMale}</SelectItem>
<SelectItem value="female">{texts.genderFemale}</SelectItem>
<SelectItem value="other">{texts.genderOther}</SelectItem>

// Sau:
<SelectItem value="male">
  <span className="flex items-center gap-2">
    <span className="text-blue-500">♂</span>
    {texts.genderMale}
  </span>
</SelectItem>
<SelectItem value="female">
  <span className="flex items-center gap-2">
    <span className="text-pink-500">♀</span>
    {texts.genderFemale}
  </span>
</SelectItem>
<SelectItem value="other">
  <span className="flex items-center gap-2">
    <span className="text-purple-500">⚧</span>
    {texts.genderOther}
  </span>
</SelectItem>
```

Ký tự Unicode: `♂` (U+2642), `♀` (U+2640), `⚧` (U+26A7 — biểu tượng transgender/non-binary phổ biến).

Cũng update `<SelectValue>` để hiển thị icon khi đã chọn — shadcn `Select` tự render value bằng content của SelectItem đã chọn nên icon tự hiển thị theo.

---

## PART D — Date of Birth Picker

### Task 4 · Web — Thay `<input type="date">` bằng shadcn Calendar Popover

File: `apps/web/components/profile/ProfileForm.tsx`

**Imports thêm:**

```tsx
import { format, parse, isValid } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
```

**Thay thế đoạn date of birth:**

```tsx
{/* Date of birth */}
<div className="space-y-2">
  <Label htmlFor="dateOfBirth" className="text-sm font-medium flex items-center gap-2">
    {/* icon giữ nguyên */}
    {texts.dobLabel}
  </Label>

  {/* Popover Calendar thay cho native input */}
  <Controller
    control={control}
    name="dateOfBirth"
    render={({ field }) => {
      // Chuyển đổi string "YYYY-MM-DD" ↔ Date object
      const selectedDate = field.value ? parse(field.value, 'yyyy-MM-dd', new Date()) : undefined
      const isValidDate = selectedDate && isValid(selectedDate)

      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal h-10',
                !isValidDate && 'text-muted-foreground',
              )}
            >
              <CalendarIcon className="mr-2 size-4 text-muted-foreground" />
              {isValidDate ? format(selectedDate, 'dd/MM/yyyy') : texts.dobPlaceholder}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={isValidDate ? selectedDate : undefined}
              onSelect={(date) =>
                field.onChange(date ? format(date, 'yyyy-MM-dd') : '')
              }
              // Cho phép chọn từ năm 1900 đến hôm nay
              fromYear={1900}
              toYear={new Date().getFullYear()}
              captionLayout="dropdown"   // dropdown chọn tháng/năm, dễ navigate
              defaultMonth={isValidDate ? selectedDate : new Date(2000, 0)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      )
    }}
  />

  {errors.dateOfBirth && (
    <p className="text-sm text-destructive">{errors.dateOfBirth.message}</p>
  )}
</div>
```

Cần import `Controller` từ `react-hook-form`:
```tsx
import { Controller } from 'react-hook-form'
```

Cần thêm `control` vào `ProfileFormProps`:
```tsx
// Trong ProfileFormProps interface, thêm:
control: Control<ProfileFormValues>
```

Truyền `control` từ `edit/page.tsx`:
```tsx
<ProfileForm
  control={control}   // <— thêm prop này
  register={register}
  // ... rest
/>
```

Thêm i18n key:
```json
"dobPlaceholder": "Chọn ngày sinh"
```

**Note:** `date-fns` và shadcn `Calendar` (`react-day-picker`) phần lớn đã có sẵn trong dự án (shadcn Calendar component). Nếu chưa có, chạy:
```bash
pnpm dlx shadcn@latest add calendar popover
```

---

## PART E — Unsaved Changes Warning

### Task 5 · Web — Cảnh báo khi rời trang với unsaved changes

File: `apps/web/app/(main)/profile/edit/page.tsx`

**5a. Browser close/refresh — `beforeunload`:**

```tsx
// Thêm vào sau các useState/useForm declarations:
const isDirty = formState.isDirty
const hasUnsavedChanges = isDirty || hasPendingImageEdits

useEffect(() => {
  const handler = (e: BeforeUnloadEvent) => {
    if (!hasUnsavedChanges) return
    e.preventDefault()
    e.returnValue = '' // required for Chrome to show dialog
  }
  window.addEventListener('beforeunload', handler)
  return () => window.removeEventListener('beforeunload', handler)
}, [hasUnsavedChanges])
```

**5b. In-app navigation (Back button):**

Đổi `<Link href="/profile">` ở header thành một button gọi `handleBack()`:

```tsx
// Thêm state:
const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)

// Thêm handler:
const handleBack = () => {
  if (hasUnsavedChanges) {
    setLeaveConfirmOpen(true)
  } else {
    router.push('/profile')
  }
}
```

Trong JSX header, đổi:
```tsx
// Trước:
<Link href="/profile" className="text-muted-foreground hover:text-foreground transition-colors">
  <ArrowLeft className="size-5" />
</Link>

// Sau:
<button
  type="button"
  onClick={handleBack}
  className="text-muted-foreground hover:text-foreground transition-colors"
>
  <ArrowLeft className="size-5" />
</button>
```

**5c. Confirmation dialog:**

Thêm vào cuối JSX của component (trước `</div>` closing):

```tsx
<AlertDialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>{t('unsavedChangesTitle')}</AlertDialogTitle>
      <AlertDialogDescription>{t('unsavedChangesDesc')}</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      {/* Tiếp tục chỉnh sửa */}
      <AlertDialogCancel>{t('keepEditing')}</AlertDialogCancel>
      {/* Lưu rồi thoát */}
      <AlertDialogAction
        onClick={async () => {
          await handleSave()  // gọi hàm save hiện tại
          router.push('/profile')
        }}
      >
        {t('saveAndLeave')}
      </AlertDialogAction>
      {/* Thoát không lưu */}
      <Button
        variant="ghost"
        className="text-destructive hover:text-destructive"
        onClick={() => {
          setLeaveConfirmOpen(false)
          router.push('/profile')
        }}
      >
        {t('leaveWithoutSaving')}
      </Button>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

Thêm import:
```tsx
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
```

i18n keys:
```json
"unsavedChangesTitle": "Bạn có thay đổi chưa lưu",
"unsavedChangesDesc":  "Nếu rời trang, các thay đổi của bạn sẽ bị mất.",
"keepEditing":         "Tiếp tục chỉnh sửa",
"saveAndLeave":        "Lưu và thoát",
"leaveWithoutSaving":  "Thoát không lưu"
```

Note: `handleSave` là hàm submit form hiện tại — nếu cần, extract logic save thành hàm riêng (`const handleSave = handleSubmit(onSubmit)`) để có thể gọi programmatically.

---

## PART F — Wallpaper Opacity Fix

### Task 6 · Web — Tăng opacity của gradient wallpapers

File: `apps/web/lib/hooks/use-wallpaper.ts`

Root cause: các gradient class dùng opacity thấp (e.g. `/30`, `/20`) → gradient blend với `bg-background` (white) → mờ. Fix: tăng tất cả opacity lên đáng kể trong `WALLPAPER_CLASSES`.

**Thay toàn bộ `WALLPAPER_CLASSES`:**

```ts
const WALLPAPER_CLASSES: Record<string, string> = {
  // ── default ──
  default: 'bg-background',

  // ── original 5 ──
  sunset:
    'bg-gradient-to-br from-orange-400/85 via-pink-500/75 to-purple-600/85 dark:from-orange-800/90 dark:via-pink-900/85 dark:to-purple-900/90',
  midnight:
    'bg-gradient-to-br from-indigo-900/90 via-slate-800/92 to-purple-900/90 dark:from-indigo-950/95 dark:via-slate-950/97 dark:to-purple-950/95',
  sweet_pink:
    'bg-gradient-to-br from-pink-300/80 via-rose-400/75 to-red-400/80 dark:from-pink-900/88 dark:via-rose-950/85 dark:to-red-950/88',
  neon_teal:
    'bg-gradient-to-br from-teal-800/88 via-cyan-800/90 to-emerald-800/88 dark:from-teal-950/93 dark:via-cyan-950/95 dark:to-emerald-950/93',
  dark_shadow:
    'bg-gradient-to-br from-black/90 via-zinc-900/93 to-zinc-950/92 dark:from-black/97 dark:via-zinc-950/98 dark:to-zinc-950/98',

  // ── màu sắc đơn giản ──
  ocean_blue:
    'bg-gradient-to-br from-blue-800/85 via-sky-800/80 to-blue-800/88 dark:from-blue-950/92 dark:via-sky-950/90 dark:to-blue-950/95',
  forest_green:
    'bg-gradient-to-br from-green-800/85 via-emerald-800/80 to-green-800/88 dark:from-green-950/92 dark:via-emerald-950/90 dark:to-green-950/95',
  purple_haze:
    'bg-gradient-to-br from-purple-800/85 via-violet-800/80 to-fuchsia-800/85 dark:from-purple-950/92 dark:via-violet-950/88 dark:to-fuchsia-950/92',
  warm_amber:
    'bg-gradient-to-br from-amber-700/82 via-yellow-700/78 to-orange-700/82 dark:from-amber-900/90 dark:via-yellow-950/88 dark:to-orange-900/90',
  rose_gold:
    'bg-gradient-to-br from-rose-700/82 via-pink-700/78 to-amber-700/80 dark:from-rose-900/90 dark:via-pink-950/88 dark:to-amber-900/88',
  storm:
    'bg-gradient-to-br from-slate-700/88 via-blue-900/85 to-slate-700/90 dark:from-slate-950/95 dark:via-blue-950/93 dark:to-slate-950/97',
  cherry_blossom:
    'bg-gradient-to-br from-pink-300/78 via-pink-400/72 to-rose-300/78 dark:from-pink-900/88 dark:via-rose-950/85 dark:to-pink-900/88',
  midnight_purple:
    'bg-gradient-to-br from-purple-900/92 via-indigo-900/95 to-slate-900/95 dark:from-purple-950/97 dark:via-indigo-950/98 dark:to-slate-950/99',
  coral_reef:
    'bg-gradient-to-br from-red-700/85 via-orange-700/80 to-rose-800/85 dark:from-red-900/92 dark:via-orange-950/90 dark:to-rose-950/92',
  arctic_ice:
    'bg-gradient-to-br from-sky-300/75 via-blue-200/70 to-cyan-300/72 dark:from-sky-900/88 dark:via-blue-950/85 dark:to-cyan-950/88',

  // ── gradient sống động ──
  aurora:
    'bg-gradient-to-br from-teal-700/88 via-emerald-800/82 to-purple-700/88 dark:from-teal-950/95 dark:via-emerald-950/90 dark:to-purple-950/95',
  galaxy:
    'bg-gradient-to-br from-indigo-900/95 via-purple-900/92 to-slate-900/97 dark:from-indigo-950/98 dark:via-purple-950/96 dark:to-slate-950/99',
  fire_ice:
    'bg-gradient-to-br from-red-700/88 via-slate-800/85 to-blue-700/88 dark:from-red-900/93 dark:via-slate-950/95 dark:to-blue-900/93',
  tropical:
    'bg-gradient-to-br from-green-700/82 via-cyan-700/78 to-yellow-700/78 dark:from-green-900/90 dark:via-cyan-950/88 dark:to-yellow-900/88',
  candy:
    'bg-gradient-to-br from-pink-400/80 via-violet-400/75 to-cyan-400/78 dark:from-pink-900/90 dark:via-violet-950/88 dark:to-cyan-950/90',

  // ── tối giản ──
  pure_dark: 'bg-[#050507] dark:bg-[#030303]',
  soft_gray:
    'bg-gradient-to-br from-zinc-600/85 via-zinc-700/88 to-zinc-600/85 dark:from-zinc-800/93 dark:via-zinc-900/95 dark:to-zinc-800/93',
  warm_night:
    'bg-gradient-to-br from-zinc-900/92 via-purple-900/78 to-zinc-900/95 dark:from-zinc-950/97 dark:via-purple-950/85 dark:to-zinc-950/98',
}
```

---

### Task 7 · Web — Giảm opacity overlay cho image wallpapers

File: `apps/web/app/(main)/conversations/[id]/page.tsx`

```tsx
{/* Custom Wallpaper Darken Overlay */}
{wp.isImage && (
  // Trước: bg-background/80 dark:bg-background/90  (80% che — quá nhiều!)
  // Sau:   bg-background/20 dark:bg-background/30  (20% nhẹ nhàng)
  <div className="absolute inset-0 bg-background/20 dark:bg-background/30 z-0 pointer-events-none" />
)}
```

---

### Task 8 · Web — Ẩn glow spheres khi có wallpaper

File: `apps/web/app/(main)/conversations/[id]/page.tsx`

Hiện tại glow spheres (teal + peach animated blobs) luôn hiện kể cả khi có wallpaper, làm màu wallpaper bị trộn lẫn với màu glow.

```tsx
{/* Glow Spheres — chỉ hiện khi không có wallpaper */}
{(!wallpaper || wallpaper === 'default' || wallpaper === '') && (
  <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-40 dark:opacity-20">
    <div className="absolute -top-40 -left-40 size-96 rounded-full bg-pon-cyan blur-[128px] animate-pulse duration-[6000ms]" />
    <div className="absolute -bottom-40 -right-40 size-96 rounded-full bg-pon-peach blur-[128px] animate-pulse duration-[8000ms]" />
  </div>
)}
```

`wallpaper` ở đây là conversation's wallpaper value — cần prop/state này ở level của container. Kiểm tra xem `wp` có field để check (e.g. `wp.className !== 'bg-background'` hoặc `wp.isImage`).

Nếu không có sẵn: dùng `const hasWallpaper = !!conversation?.wallpaper && conversation.wallpaper !== 'default'`.

---

## PART G — Flutter Mirror

### Task 9 · Flutter — Edit Profile UI mirror

File: Profile edit screen (tìm file có cover image + form fields).

- **Cover height**: tìm `SizedBox(height: ...)` hoặc `Container(height: ...)` trong cover widget → giảm xuống tương đương `h-32` (khoảng 128px)
- **Form width**: nếu dùng `Padding(padding: EdgeInsets.symmetric(horizontal: ...))`, giữ nguyên vì mobile thường full-width
- **Gender icons**: thêm icon vào `DropdownMenuItem` hoặc `RadioListTile`:
  - Male: `Icon(Icons.male, color: Colors.blue)`
  - Female: `Icon(Icons.female, color: Colors.pink)`  
  - Other: `Icon(Icons.transgender, color: Colors.purple)`
- **Date picker**: Flutter `showDatePicker()` đã đẹp hơn native web — kiểm tra nếu đang dùng `TextFormField` với date thì switch sang `showDatePicker()`
- **Unsaved changes**: dùng `WillPopScope` (Flutter < 3.x) hoặc `PopScope(canPop: false, onPopInvoked: ...)` (Flutter 3.x+):
  ```dart
  PopScope(
    canPop: !_hasUnsavedChanges,
    onPopInvoked: (didPop) async {
      if (didPop) return;
      final leave = await showDialog<bool>(context: context, builder: (_) => _UnsavedDialog());
      if (leave == true && context.mounted) Navigator.of(context).pop();
    },
    child: Scaffold(...),
  )
  ```

---

## Verify Checklist (Task 10)

**Edit Profile UI:**
- [ ] Cover banner trông proportional, không quá cao
- [ ] Form fields rộng hơn — chiếm khoảng 2/3 màn hình desktop
- [ ] Gender select: ♂ xanh / ♀ hồng / ⚧ tím hiển thị cả trong dropdown lẫn khi đã chọn
- [ ] Date of birth: click → mở Calendar Popover với dropdown tháng/năm, chọn ngày → hiển thị `dd/MM/yyyy`
- [ ] Thay đổi bất kỳ field → bấm nút Back → dialog "Bạn có thay đổi chưa lưu" hiện ra
- [ ] Dialog có 3 option: Tiếp tục chỉnh sửa / Lưu và thoát / Thoát không lưu
- [ ] Reload browser tab khi có thay đổi chưa lưu → browser hiện native confirm dialog
- [ ] Lưu thành công → dirty flag reset → Back bình thường không có dialog

**Wallpaper:**
- [ ] Chọn gradient wallpaper (e.g. Sunset, Aurora) → trong chat thấy màu rõ ràng, không bị màu trắng che
- [ ] Chọn image wallpaper (Unsplash photo) → ảnh hiện rõ, text/messages vẫn đọc được
- [ ] Default (không có wallpaper) → glow spheres vẫn hiện như cũ
- [ ] Có wallpaper → glow spheres ẩn, không tranh màu với wallpaper
- [ ] Dark mode: wallpaper vẫn hiển thị tốt
