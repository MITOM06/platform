## QA Report — SPRINT M-15 (Mobile Chat UI/UX Refinement) — 2026-06-16 (Re-verification)

> Scope: Flutter only (`apps/client/`). Re-run after mobile-dev fix for P1 `&scale=` unit mismatch.

### 빌드 상태
| 서비스 | 상태 | 비고 |
|--------|------|------|
| flutter analyze | ✓ (0 issues) | `No issues found! (ran in 2.6s)` — 직접 재실행 확인 |
| chat-service / web | N/A | 이 스프린트 범위 외 (의도됨) |

### P1 재검증 — `&scale=` 단위 정합성 (직접 코드 확인)
이전 FAIL 사유(Flutter multiplier vs Web percentage)가 완전히 해소됨:

- [x] **저장 단위 = percentage(int)**. `splitWallpaperLayout` 이 `int scale` 반환, default `kWallpaperDefaultScale=100` (dialog:42-60). 상태 `_scale`도 int percentage (dialog:132).
- [x] **legacy multiplier 정규화 + clamp**. `_parseScalePercent` (dialog:65-72): `parsed < 5`이면 `*100` 변환(1.5→150), 그 외 그대로, 최종 `clamp(50, 200)`. 구버전 `scale=1.5` 데이터 폭주 방지.
- [x] **인코딩 byte-for-byte 일치**. Flutter `'$_selected#fit=$_fit&scale=$_scale'` (dialog:159) == Web `` `${selected}#fit=${fit}&scale=${scale}` `` (modal:95). 둘 다 `scale`이 정수 percentage.
- [x] **인코딩 조건 동일**. Flutter `_isImage && (_fit != 'cover' || _scale != 100)` (dialog:158) == Web `isImage && (fit !== 'cover' || scale !== 100)` (modal:94). default(cover+100)는 양쪽 모두 인코딩 안 함.
- [x] **렌더 변환 = percentage/100**. preview `scalePercent/100.0` → `Transform.scale` (preview:27,45). chat_screen `parsed.scale / 100.0` → `Transform.scale` (chat_screen:444). 저장은 percentage, 렌더 시에만 multiplier 변환.
- [x] **slider 범위 일치**. Flutter `min=50, max=200, step=5` (`kWallpaperMinScale/MaxScale/ScaleStep`, dialog:16-18; Slider divisions=(200-50)/5=30, dialog:303-313) == Web `<Slider min={50} max={200} step={5}>` (modal:244-251). `fit==fill`일 때 slider 숨김도 양쪽 동일.

### 기존 통과 항목 회귀 확인 (불변)
- [x] system message 3개 포맷 불변: `system.theme.changed:<value>` 송신부(dialog:166) 변경 없음. nickname/quick_reaction 포맷 미변경.
- [x] absoluteMediaUrl + http 게이트 제거(404 수정) 유지 (chat_screen:437-447, preview:48).
- [x] i18n 7개 ARB 모두 wallpaper 신규 키 5개씩 존재 (en~fr 각 5).

### clean-code 400줄 제한
| 파일 | 줄수 | 판정 |
|------|------|------|
| chat_wallpaper_dialog.dart | **422** | ✗ 위반 (이전 382 → +40, scale slider 추가로 신규 초과) |
| chat_wallpaper_preview.dart | 122 | ✓ |
| conversation_tile.dart | 325 | ✓ |
| chat_screen.dart | 726 | ✗ (pre-existing, M-15 비도입) |

### 발견된 이슈
| 심각도 | 파일:라인 | 내용 | 권장 수정 |
|--------|---------|------|----------|
| Minor | chat_wallpaper_dialog.dart:422 | scale slider 추가로 400줄 한도 22줄 초과 (이번 수정으로 신규 발생). | `splitWallpaperLayout`/파싱 헬퍼를 별도 파일로 추출 권장. 차단 아님. |
| Minor | chat_screen.dart:726 | 400줄 초과 (pre-existing, M-15 비도입). | 후속 리팩토링. |
| Info | app_{zh,ja,ko,es,fr}.arb | 신규 키 영어 stub (기존 컨벤션). | 정식 번역 후속. |

### 결론
**PASS** — 이전 P1(`&scale=` 단위 불일치) 완전 해소. scale이 percentage(int)로 저장/파싱/렌더 변환되고, 인코딩 문자열·조건·slider(50/200/5)가 web과 byte-for-byte/설정 일치, legacy multiplier도 정규화+clamp로 안전 처리됨. flutter analyze clean, system message 포맷·404 수정·i18n 회귀 없음. 잔여 이슈는 400줄 한도 초과 2건(1건 신규/1건 pre-existing) — 비차단 Minor, 후속 리팩토링 권장.
