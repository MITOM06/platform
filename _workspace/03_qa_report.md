## QA Report — Per-Field Privacy Toggles + Centered Profile Dialog — 2026-06-21

### 빌드 상태
| 서비스 | 상태 | 비고 |
|--------|------|------|
| @platform/database (tsc build) | ✓ | tsc 통과, 에러 0 |
| auth-service (nest build) | ✓ | webpack compiled successfully (2.3s) |
| flutter analyze | ✓ (0 issues) | "No issues found!" |
| web tsc --noEmit | ✓ | EXIT 0, 에러 0 |
| web test (vitest) | ✓ | 5 files / 48 tests passed |

> chat-service: 변경 없음(이번 기능은 auth-service 전용) — 빌드 대상 아님.

### API 계약 정합성 — 직접 비교(존재가 아닌 내용)
- [x] plan.md 계약과 실제 구현 일치
  - `user.schema.ts:74-80` — `showDateOfBirth/showPhoneNumber/showGender` 모두 `@Prop({ default: true })`. `hideInfo`(line 69)는 `default: false` 유지.
  - `users.controller.ts:43-46` — PATCH body에 3개 필드 `?: boolean` 추가.
  - `users.controller.ts:131-147` — GET :id 게이팅: `showDob = doc.showDateOfBirth ?? !doc.hideInfo`(phone/gender 동일), `profile.bio = doc.bio`(무조건), self에만 email + 3 show 플래그, `if (isSelf || showX) profile.X = ...`.
  - `users.service.ts:142-148` — updateProfile에 `!== undefined` 가드로 3필드 매핑.
- [x] Flutter DTO 타입 일치 — `auth_state.dart:19-21` `bool? showDateOfBirth/showPhoneNumber/showGender`, fromJson(55-58)/toJson(74-76) 정확히 동일 키. effectiveShow* 게터(81-83) = `?? !hideInfo`.
- [x] Web TypeScript 타입 일치 — `auth.ts` `UserProfile`(28-30) + `UpdateProfilePayload`(44-46)에 동일 3필드 `?: boolean`. `hideInfo`(25,43) 폴백 유지.

필드명(showDateOfBirth / showPhoneNumber / showGender)이 Backend ↔ Web(TS) ↔ Flutter(Dart) 3자 모두 글자 단위로 일치.

### 크로스 플랫폼 동기화 (sync.md)
- [x] 게이팅 폴백 규칙 동일 (`showX ?? !hideInfo`)
  - Web view `UserProfileDrawer.tsx:144-146`: `showDob = isOwnProfile || (user?.showDateOfBirth ?? !user?.hideInfo)` (phone/gender 동일).
  - Flutter view `user_profile_info_section.dart:69,74,81`: `(isSelf || u.effectiveShowGender)` 등, effectiveShow* = `?? !hideInfo`.
  - Backend `users.controller.ts`도 동일 폴백. 3계층 모두 동일 규칙.
- [x] bio 항상 공개 — 양쪽 동일: Web `UserProfileDrawer.tsx:198` 게이팅 없이 표시, Flutter `user_profile_info_section.dart:62-64` "bio is always visible". Backend `profile.bio = doc.bio`(게이팅 없음). 셋 다 일치.
- [x] self 항상 전체 표시 — Web `isOwnProfile ||`, Flutter `isSelf ||`, Backend `isSelf ||`. 동일.
- [x] 보기 UI = 중앙 다이얼로그 통일 — Web `UserProfileDrawer.tsx:12,154-157` Sheet→`Dialog`로 교체 완료(컴포넌트명/props 유지 → 호출부 무변경). Flutter는 기존 중앙 `Dialog`(user_profile_dialog.dart) 유지.
- [x] edit 폼 시드/저장 동일 — Web edit `page.tsx:111-113` `me.showX ?? !me.hideInfo` 시드, `:178-180` 저장. Flutter dialog `:69-71` effectiveShow* 시드, `:84-86`/`:151-153` 저장. 풀스크린 edit `edit_profile_screen.dart:46-48,115-117` 동일.
- [x] i18n 키 완성 (7개 언어)
  - Flutter ARB: `profileShowDateOfBirth/profileShowPhone/profileShowGender/profilePrivacySection` — en/vi/zh/ja/ko/es/fr 7개 모두 4/4.
  - Web messages(profile ns): `showDobLabel/showPhoneLabel/showGenderLabel/privacySectionLabel/privacySectionHint` — 7개 모두 5/5.
  - 제거 키 `hideInfoLabel/hideInfoHint` — web 7개 언어 모두 0건, 컴포넌트/앱 잔존 참조 0건.

### 회귀
- [x] web 기존 테스트 영향 없음 — `MessageBubble.test.tsx`, `connector.test.ts` 포함 48 tests 전부 통과. UserProfileDrawer 컴포넌트명/시그니처(`{userId, onClose}`) 유지로 목/호출부 무변경.
- [x] flutter analyze 0 issues, (보고서 기준) flutter test 47/47.

### 발견된 이슈
| 심각도 | 파일:라인 | 내용 | 권장 수정 |
|--------|---------|------|----------|
| 정보(차단 아님) | apps/client/lib/features/profile/ui/widgets/user_profile_dialog.dart | 파일 396줄로 clean-code 400줄 제한에 근접 | 향후 위젯 추가 시 분리 |
| 정보(차단 아님) | apps/client/.../user_profile_screen.dart | 풀스크린 타 유저 보기(`/user/:id`)는 다이얼로그 강제 전환 대신 게이팅만 적용 — 채팅 컨텍스트 보기는 이미 다이얼로그라 요구 충족, 다수 호출부 영향 회피 차원 | 의도된 절충, 조치 불요 |
| 정보(설계) | users.controller.ts | bio가 이전 `!hideInfo` 게이팅에서 항상 공개로, email은 타 유저 노출→self 전용으로 변경 | plan(line 11,32) 의도와 일치 — 의도된 동작 변화 |

차단(P1) 이슈 없음. API 계약 불일치 없음. 게이팅 로직 3계층 일치. i18n 7개 언어 완전.

### 결론
**PASS** — Backend/Web/Flutter 3계층의 필드명·타입·게이팅 폴백 규칙(`showX ?? !hideInfo`)이 글자 단위로 일치하고, bio 항상 공개·self 전체 표시 규칙도 동일. 보기 UI는 양쪽 중앙 다이얼로그로 통일됨. i18n 신규 키가 Flutter ARB 7개 + Web messages 7개 모두에 존재하며 제거 키 잔존 참조 없음. 전 서비스 빌드 통과, web 회귀 테스트 48/48 통과, flutter analyze 0 issues.
