# Plan: Real Connector Logos + New Skills (Web Search & Weather)

> **Ngày:** 2026-07-08
> **Scope:** Web (`apps/web/`) + Flutter (`apps/client/`) + AI service (`apps/server/ai-service/`)
> **2 feature groups.**

---

## Feature 1 — Real logos cho Connector cards (thay text "notion", "gmail"…)

### Root cause

`ConnectorCard.tsx` (web) và `connector_card.dart` (Flutter) đều render `entry.icon` dưới dạng
`<span>{entry.icon}</span>` / `Text(icon)`. Field `icon` từ catalog là string slug (`'notion'`,
`'gmail'`, `'calendar'`, `'drive'`) — không phải emoji hay SVG — nên chỉ hiện raw text.

### Fix 1a — Web: `apps/web/components/integrations/ConnectorCard.tsx`

Thêm function `ConnectorLogo` render inline SVG brand icon theo provider id. Thay `<span>{entry.icon}</span>` bằng `<ConnectorLogo id={entry.icon} />`.

```tsx
// Thêm TRƯỚC component ConnectorCard, sau các imports:

/** Inline SVG brand logos theo catalog provider id. */
function ConnectorLogo({ id, size = 26 }: { id: string; size?: number }) {
  const dim = size
  switch (id) {
    case 'notion':
      return (
        <svg width={dim} height={dim} viewBox="0 0 24 24" fill="currentColor" aria-label="Notion">
          <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.373.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
        </svg>
      )
    case 'gmail':
      return (
        <svg width={dim} height={dim} viewBox="0 0 24 24" aria-label="Gmail">
          <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.147C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335"/>
        </svg>
      )
    case 'calendar':
      return (
        <svg width={dim} height={dim} viewBox="0 0 24 24" aria-label="Google Calendar">
          <rect width="24" height="24" rx="3" fill="#fff"/>
          <rect x="2" y="2" width="20" height="20" rx="2" fill="white" stroke="#E0E0E0" strokeWidth="0.5"/>
          <rect x="2" y="2" width="20" height="6" rx="2" fill="#1a73e8"/>
          <rect x="2" y="6" width="20" height="2" fill="#1a73e8"/>
          <text x="12" y="18.5" textAnchor="middle" fill="#1a73e8" fontSize="8" fontWeight="bold" fontFamily="sans-serif">CAL</text>
          <line x1="8" y1="2" x2="8" y2="6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="16" y1="2" x2="16" y2="6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      )
    case 'drive':
      return (
        <svg width={dim} height={dim} viewBox="0 0 24 24" aria-label="Google Drive">
          <path d="M1.004 16.428l2 3.464A2 2 0 0 0 4.732 21h14.536a2 2 0 0 0 1.728-1l2-3.464.004-.008L16.27 7H7.73L1 16.42l.004.008z" fill="#0066DA"/>
          <path d="M7.73 7L4 13.5 1 16.42 7.73 7z" fill="#00AC47"/>
          <path d="M16.27 7L23 16.42 20 13.5 16.27 7z" fill="#FFBA00"/>
          <path d="M7.73 7h8.54l2.73 4.5H5L7.73 7z" fill="#00832D"/>
          <path d="M1 16.42L4 13.5h16l3 2.92-1 1.58a2 2 0 0 1-1.732 1H4.732A2 2 0 0 1 3 18L1 16.42z" fill="#2684FC"/>
        </svg>
      )
    default:
      // Fallback: hiển thị ký tự đầu của tên provider trong circle
      return (
        <span className="text-sm font-bold text-muted-foreground uppercase">
          {id.charAt(0)}
        </span>
      )
  }
}
```

Tìm dòng hiện render icon trong `ConnectorCard`:
```tsx
// Tìm:
<div className="size-[42px] rounded-[11px] grid place-items-center text-xl bg-background border mb-[13px]">
  <span aria-hidden>{entry.icon}</span>
</div>

// Thay thành:
<div className="size-[42px] rounded-[11px] grid place-items-center bg-background border mb-[13px] overflow-hidden">
  <ConnectorLogo id={entry.icon} size={26} />
</div>
```

### Fix 1b — Flutter: `apps/client/lib/features/integrations/ui/widgets/connector_card.dart`

Thay `_IconBadge` từ `Text(icon)` → widget render logo theo id.

Thêm `_ConnectorLogo` widget, thay `_IconBadge` body:

```dart
class _IconBadge extends StatelessWidget {
  final String icon;
  const _IconBadge({required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44,
      height: 44,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppTheme.darkBackground,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.darkBorder),
      ),
      child: _ConnectorLogo(id: icon),
    );
  }
}

/// Render brand logo theo provider id. Dùng Image.network từ official favicon CDN.
/// Fallback về initials nếu URL fail.
class _ConnectorLogo extends StatelessWidget {
  final String id;
  const _ConnectorLogo({required this.id});

  static const _logos = {
    'notion': 'https://www.notion.so/front-static/favicon.ico',
    'gmail':
        'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico',
    'calendar':
        'https://calendar.google.com/googlecalendar/images/favicon_v2018_256.png',
    'drive':
        'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png',
  };

  @override
  Widget build(BuildContext context) {
    final url = _logos[id];
    if (url == null) {
      // Fallback: initials
      return Text(
        id.isNotEmpty ? id[0].toUpperCase() : '?',
        style: const TextStyle(
          color: Colors.white54,
          fontSize: 18,
          fontWeight: FontWeight.bold,
        ),
      );
    }
    return Image.network(
      url,
      width: 26,
      height: 26,
      fit: BoxFit.contain,
      errorBuilder: (_, __, ___) => Text(
        id[0].toUpperCase(),
        style: const TextStyle(
          color: Colors.white54,
          fontSize: 18,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
```

**Lưu ý cho Flutter:** `Image.network` cần kết nối internet — luôn có sẵn trong context real app. `errorBuilder` handle trường hợp offline.

---

## Feature 2 — Thêm 2 skills mới: Web Search + Weather Forecast

### 2 skills mới

| id | Tên hiển thị | Mô tả | Requires |
|---|---|---|---|
| `webSearch` | Web Searcher | Tìm kiếm và tổng hợp thông tin từ web, trích dẫn nguồn. | [] |
| `weatherForecast` | Weather Forecast | Tra cứu thời tiết cho bất kỳ địa điểm nào. | [] |

**Lưu ý về giới hạn:** Skills là behavioral prompt injection — không phải tool grant. `webSearch` dạy Claude cách tìm kiếm và trích dẫn tốt hơn; Claude sẽ thừa nhận khi thông tin có thể outdated. `weatherForecast` giúp Claude proactively hỏi location và cung cấp thông tin thời tiết từ training data với cảnh báo rõ về real-time limitations.

---

### Fix 2a — AI service: `apps/server/ai-service/src/skills/skill-catalog.ts`

Thêm 2 entries vào `SKILL_CATALOG` array (thêm sau `translator`):

```typescript
{
  id: 'webSearch',
  instruction:
    'Web search assistant: when the user asks about current events, recent data, prices, ' +
    'technical documentation, or any time-sensitive information, proactively search for ' +
    'answers and cite your sources. Always mention the date your information is from and ' +
    'flag when data may be outdated. Structure answers as: answer → sources → caveats.',
},
{
  id: 'weatherForecast',
  instruction:
    'Weather assistant: when the user asks about weather, temperature, rain, humidity, wind, ' +
    'forecast, or climate for any location, provide useful weather context. If no location ' +
    'is specified, ask for it first. Provide current conditions (from knowledge), typical ' +
    'seasonal patterns, and always recommend checking a real-time weather service for ' +
    'live forecasts (e.g. weather.com, accuweather, windy.com).',
},
```

---

### Fix 2b — Web: `apps/web/lib/skills.ts`

Thêm 2 entries vào `SKILLS` array:

```typescript
{ id: 'webSearch', icon: '🔍', requires: [] },
{ id: 'weatherForecast', icon: '🌤️', requires: [] },
```

---

### Fix 2c — Web i18n: `apps/web/messages/*.json`

Thêm vào namespace `"skills"` trong tất cả 7 language files:

```json
// messages/en.json (trong object "skills"):
"webSearchName": "Web Searcher",
"webSearchDesc": "Finds current information on the web and cites sources.",
"weatherForecastName": "Weather Forecast",
"weatherForecastDesc": "Looks up weather and forecast for any location."

// messages/vi.json:
"webSearchName": "Tìm kiếm Web",
"webSearchDesc": "Tìm thông tin mới nhất trên web và trích dẫn nguồn.",
"weatherForecastName": "Dự báo thời tiết",
"weatherForecastDesc": "Tra cứu thời tiết và dự báo cho bất kỳ địa điểm nào."

// messages/zh.json:
"webSearchName": "网络搜索",
"webSearchDesc": "在网络上查找最新信息并引用来源。",
"weatherForecastName": "天气预报",
"weatherForecastDesc": "查询任何地点的天气和预报。"

// messages/ja.json:
"webSearchName": "ウェブ検索",
"webSearchDesc": "最新情報をウェブで検索し、出典を引用します。",
"weatherForecastName": "天気予報",
"weatherForecastDesc": "あらゆる場所の天気と予報を調べます。"

// messages/ko.json:
"webSearchName": "웹 검색",
"webSearchDesc": "웹에서 최신 정보를 찾고 출처를 인용합니다.",
"weatherForecastName": "날씨 예보",
"weatherForecastDesc": "모든 위치의 날씨와 예보를 조회합니다."

// messages/fr.json:
"webSearchName": "Recherche web",
"webSearchDesc": "Trouve des informations récentes sur le web et cite les sources.",
"weatherForecastName": "Météo",
"weatherForecastDesc": "Consulte la météo et les prévisions pour tout lieu."

// messages/es.json:
"webSearchName": "Búsqueda web",
"webSearchDesc": "Encuentra información reciente en la web y cita fuentes.",
"weatherForecastName": "Pronóstico del tiempo",
"weatherForecastDesc": "Consulta el tiempo y el pronóstico para cualquier lugar."
```

---

### Fix 2d — Flutter: `apps/client/lib/features/skills/data/skill_defs.dart`

Thêm 2 entries vào `kSkillDefs` list (sau `translator`):

```dart
const SkillDef(
  id: 'webSearch',
  icon: '🔍',
),
const SkillDef(
  id: 'weatherForecast',
  icon: '🌤️',
),
```

---

### Fix 2e — Flutter i18n ARB: `apps/client/lib/l10n/app_*.arb`

Thêm vào tất cả 7 ARB files (app_en.arb, app_vi.arb, v.v.):

```arb
// app_en.arb:
"skillWebSearchName": "Web Searcher",
"skillWebSearchDesc": "Finds current information on the web and cites sources.",
"skillWeatherForecastName": "Weather Forecast",
"skillWeatherForecastDesc": "Looks up weather and forecast for any location."

// app_vi.arb:
"skillWebSearchName": "Tìm kiếm Web",
"skillWebSearchDesc": "Tìm thông tin mới nhất trên web và trích dẫn nguồn.",
"skillWeatherForecastName": "Dự báo thời tiết",
"skillWeatherForecastDesc": "Tra cứu thời tiết và dự báo cho bất kỳ địa điểm nào."

// app_zh.arb:
"skillWebSearchName": "网络搜索",
"skillWebSearchDesc": "在网络上查找最新信息并引用来源。",
"skillWeatherForecastName": "天气预报",
"skillWeatherForecastDesc": "查询任何地点的天气和预报。"

// app_ja.arb:
"skillWebSearchName": "ウェブ検索",
"skillWebSearchDesc": "最新情報をウェブで検索し、出典を引用します。",
"skillWeatherForecastName": "天気予報",
"skillWeatherForecastDesc": "あらゆる場所の天気と予報を調べます。"

// app_ko.arb:
"skillWebSearchName": "웹 검색",
"skillWebSearchDesc": "웹에서 최신 정보를 찾고 출처를 인용합니다.",
"skillWeatherForecastName": "날씨 예보",
"skillWeatherForecastDesc": "모든 위치의 날씨와 예보를 조회합니다."

// app_fr.arb:
"skillWebSearchName": "Recherche web",
"skillWebSearchDesc": "Trouve des informations récentes sur le web et cite les sources.",
"skillWeatherForecastName": "Météo",
"skillWeatherForecastDesc": "Consulte la météo et les prévisions pour tout lieu."

// app_es.arb:
"skillWebSearchName": "Búsqueda web",
"skillWebSearchDesc": "Encuentra información reciente en la web y cita fuentes.",
"skillWeatherForecastName": "Pronóstico del tiempo",
"skillWeatherForecastDesc": "Consulta el tiempo y el pronóstico para cualquier lugar."
```

Sau khi chỉnh ARB: chạy `flutter gen-l10n` để regenerate.

---

### Fix 2f — Flutter skills screen: check `skillWebSearchName` key

Kiểm tra `apps/client/lib/features/skills/ui/skills_screen.dart` — nếu nó dùng key pattern `skill${capitalize(id)}Name` / `skill${capitalize(id)}Desc` thì đã match. Nếu dùng pattern khác (ví dụ `skillId_name`), thì dùng pattern đó cho ARB keys ở bước trên.

---

## Verification

### Feature 1 (Logos)
1. **Web**: Mở `/integrations` → cards hiển thị: Notion logo (N đen), Gmail logo (phong bì đỏ), Google Calendar logo (lịch xanh), Google Drive logo (tam giác 3 màu).
2. **Flutter**: Mở Integrations screen → cards hiển thị logo PNG từ CDN. Nếu offline → hiện initial letter (fallback).

### Feature 2 (Skills)
1. **Web**: Mở `/skills` → thấy 2 skills mới: "Web Searcher" (🔍) và "Weather Forecast" (🌤️).
2. **Flutter**: Mở Skills screen → thấy 2 skills mới với icon và localized text.
3. **AI behavior**: Bật skill "Web Searcher" → chat với AI → hỏi "giá iPhone 16 bây giờ là bao nhiêu" → AI trả lời có mention nguồn và note rằng thông tin có thể outdated.
4. **AI behavior**: Bật skill "Weather Forecast" → hỏi "thời tiết ở Hà Nội hôm nay" → AI hỏi hoặc confirm location, cung cấp thông tin thời tiết điển hình + recommend real-time source.

---

## Lưu ý cho Claude Code

### Feature 1
- **Web SVG**: `ConnectorLogo` là function component thuần, không cần import gì thêm. SVG paths là standard SVG, không cần lib nào.
- **Flutter CDN**: `Image.network` không cần package thêm. Các URL là official favicon URLs của Google/Notion — stable và reliable.
- **Calendar SVG (web)**: Dùng composite SVG đơn giản nhận diện được ngay. Nếu muốn chính xác hơn có thể dùng `https://calendar.google.com/googlecalendar/images/favicon_v2018_256.png` qua `<img>` tag thay vì inline SVG.

### Feature 2
- **ai-service**: Chỉ cần thêm 2 entries vào `SKILL_CATALOG` array trong `skill-catalog.ts`. `buildSkillInstructions()` và `SKILL_IDS` sẽ tự pick up.
- **web skills.ts**: Chỉ thêm 2 dòng. Keys i18n trong messages/*.json phải khớp với pattern mà `skills/page.tsx` dùng để render — kiểm tra page đó trước để đảm bảo key format đúng.
- **Flutter ARB**: Chạy `flutter gen-l10n` sau khi sửa để regenerate. Không edit file `.dart` được generate tự động.
- Build verification: `pnpm build` trong `apps/web/`, `mvn compile` không cần (ai-service là NestJS — `pnpm build` trong `apps/server/ai-service/`), `flutter pub get && flutter gen-l10n` trong `apps/client/`.
