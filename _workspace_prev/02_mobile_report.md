## Mobile Implementation Report — SPRINT M-15

### 변경된 파일
- `apps/client/lib/l10n/app_en.arb` — 9개 신규 키 추가 (template, 정식 영어).
- `apps/client/lib/l10n/app_vi.arb` — 9개 신규 키 추가 (정식 베트남어 번역).
- `apps/client/lib/l10n/app_{zh,ja,ko,es,fr}.arb` — 9개 신규 키 추가 (영어 stub, 기존 컨벤션 준수).
- `apps/client/lib/features/chat/ui/widgets/conversation_tile.dart` — (M-15.1) `_subtitleWithPrefix` 추가: 1-on-1 채팅에서 현재 유저가 마지막 메시지를 보냈을 때 `youColon` prefix 적용 (그룹은 prefix 없음). `_subtitleText`의 하드코딩 VI/EN ternary를 `context.l10n.*` 키로 교체. 제네릭 `system.*` 분기를 group/member 코드(`system.group.created` 등) 매핑으로 확장 — `message_bubble_parts._systemText`와 동일한 l10n 사용 (tile/bubble 동기화).
- `apps/client/lib/features/chat/ui/chat_screen.dart` — (M-15.2 핵심 버그 수정) wallpaper 렌더 분기를 `startsWith('http')` 게이트에서 "non-preset, non-empty = image"로 broaden, `absoluteMediaUrl()`로 relative URL 해석 (404 수정), 저장된 scale을 `Transform.scale`로 재현. `splitWallpaperLayout` + `image_content.dart` import.
- `apps/client/lib/features/chat/ui/widgets/chat_wallpaper_dialog.dart` — (M-15.2) `splitWallpaperLayout(raw)` 신규 (backward-compat `splitWallpaperFit` 유지, `&scale=` 파싱). `_isImage` 게이트 수정 (relative URL 포함). `_scale` state + Slider 추가. `_confirm`이 `#fit=<fit>&scale=<scale>` 인코딩. `_uploadImage` catch에서 `SnackBar`로 에러 표시 (silent swallow 제거). `_buildPreview`가 이미지일 때 `WallpaperMockPreview` 렌더. **(P1 fix 2026-06-16)** `&scale=` 단위를 web percentage 기준으로 정렬 — 아래 "P1 수정" 섹션 참조.
- `apps/client/lib/features/chat/ui/widgets/chat_wallpaper_preview.dart` — **신규**. `WallpaperMockPreview` (배경 위 dummy bubble 2개를 `InteractiveViewer`로 pan/zoom, `Transform.scale` 적용, full opacity). **(P1 fix)** `scale` 파라미터를 `scalePercent`(int)로 변경, 렌더 시 `/100` 변환.

### P1 수정 — `&scale=` 단위 cross-platform 정렬 (2026-06-16)

QA P1 (03_qa_report.md): Flutter가 scale을 multiplier(1.0–3.0)로 저장하던 반면 web(`WallpaperPickerModal.tsx`, 프로덕션 배포됨, source of truth)은 정수 percentage(50–200, default 100)로 저장 → cross-platform round-trip 파손. Web 단위에 Flutter를 정렬:

- **저장 포맷**: `scale=<정수 percentage>` (예: `scale=150`). default(100)는 인코딩 안 함. 인코딩 조건 `_fit != 'cover' || _scale != 100` — web의 `fit !== 'cover' || scale !== 100`과 byte-for-byte 동일.
- **파싱** (`splitWallpaperLayout`): 반환 타입 `scale`를 `double`→`int`(percentage)로 변경, default 100. `_parseScalePercent` 헬퍼가 robust 파싱 — 정수 percentage(`150`)는 그대로, 레거시 multiplier 값(`< 5`, 예 `1.5`)은 `×100`로 정규화, `clamp(50, 200)`. → 구버전 Flutter가 저장한 multiplier 데이터도 runaway zoom 없이 안전.
- **Slider UI** (`chat_wallpaper_dialog.dart`): `min=50, max=200, step=5`(divisions=30) — web `<Slider min={50} max={200} step={5}>`와 동일. 표시 `$_scale%`(기존 `x` 배수 표기 제거). `fit == 'fill'`일 때 슬라이더 숨김 (web과 동일).
- **렌더 시 변환**: `Transform.scale`에는 항상 `percentage / 100.0` multiplier 적용 — `chat_wallpaper_preview.dart`, `chat_screen.dart:441` 두 사이트 모두. 저장/파싱은 percentage 유지.
- 상수화: `kWallpaperDefaultScale=100`, `kWallpaperMinScale=50`, `kWallpaperMaxScale=200`, `kWallpaperScaleStep=5`.

### flutter analyze 결과
- `No issues found!` (전체 프로젝트, 0 issues)
- `flutter test` — All tests passed (widget_test).
- `flutter gen-l10n` — 정상 생성 (zh/ja/ko/es/fr 각 4 untranslated 경고는 기존 stub 컨벤션과 동일, informational).

### i18n 추가 키 (en)
- `youColon`: "You:"
- `systemNicknameChanged`: "Nickname was changed"
- `systemThemeChanged`: "Chat theme changed"
- `systemQuickReactionChanged`: "Quick reaction changed"
- `wallpaperUploadError`: "Failed to upload image"
- `wallpaperScale`: "Scale"
- `wallpaperPreviewHint`: "Pinch or drag to adjust"
- `wallpaperPreviewIncoming`: "Hi! How does this look?"
- `wallpaperPreviewOutgoing`: "Looks great 🎉"

### 포맷 파리티 (변경 없음)
- `system.theme.changed:<value>`, `system.nickname.changed:<id>:<nick>`, `system.quick_reaction.changed:<emoji>` byte-for-byte 유지.
- wallpaper 값의 `&scale=` suffix는 web과 동일한 정수 percentage 단위. backward-compat: 기존 `#fit=contain` 및 bare URL/preset 모두 정상 파싱 (default scale 100), 레거시 multiplier 데이터는 `_parseScalePercent`가 percentage로 정규화.

### 파일 크기 (clean-code ≤400줄)
- chat_wallpaper_dialog.dart: 382 / preview: 117 / conversation_tile.dart: 325 — 모두 통과.

### 주의사항 / 남은 이슈
- 5개 stub 로케일(zh/ja/ko/es/fr)은 영어 값으로 추가됨 (기존 파일이 동일 패턴). 정식 번역 필요 시 후속 작업.
- 실기기 round-trip(업로드→preview→save→재진입) 수동 QA 권장 — 코드 경로상 relative URL이 양쪽 렌더 사이트에서 `absoluteMediaUrl`로 해석됨을 확인.

---

## Post-QA Refactor — clean-code 400줄 제한 준수

### 변경된 파일
- `apps/client/lib/features/chat/ui/widgets/chat_wallpaper_fit_scale_selector.dart` (신규) — fit selector + scale slider를 `WallpaperFitScaleSelector` 위젯으로 추출. 순수 stateless, `fit`/`scale`/`isVi` 값 + `onFitChanged`/`onScaleChanged` 콜백으로 동작.
- `apps/client/lib/features/chat/ui/widgets/chat_wallpaper_dialog.dart` — 인라인 fit/scale UI 및 `_buildFitSelector()` 제거, 새 위젯 호출로 교체. 422 → 350줄.

### 결과
- `wc -l` chat_wallpaper_dialog.dart: 350줄 (400 이하 통과), 신규 selector: 115줄.
- `flutter analyze` (두 파일): No issues found.
- 순수 리팩토링 — 동작/스타일 변경 없음, 네이밍은 `chat_wallpaper_preview.dart`와 일관.
