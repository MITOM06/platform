## Web Implementation Report

### 변경된 파일
- `apps/web/lib/api/auth.ts` — `UserProfile`와 `UpdateProfilePayload`에 `showDateOfBirth?`, `showPhoneNumber?`, `showGender?: boolean` 추가. `hideInfo`는 폴백용으로 유지.
- `apps/web/components/profile/ProfileForm.tsx` — `ProfileFormValues`의 `hideInfo` → 3개 boolean(`showDateOfBirth/showPhoneNumber/showGender`)으로 교체. 단일 privacy Switch 제거하고 별도 "Privacy" 섹션에 3개 토글 배치. props `onHideInfoChange` → `onShowFieldChange(field, value)`로 변경. `PrivacyField` 타입 export 추가.
- `apps/web/app/(main)/profile/edit/page.tsx` — zod schema의 `hideInfo` → 3 booleans. defaultValues(기본 true) 및 reset 시드(`me.showDateOfBirth ?? !me.hideInfo` 등 폴백). `onSubmit`에서 3개 플래그 전달, `hideInfo` 제거. texts에 신규 라벨 매핑, `onShowFieldChange` 핸들러 연결.
- `apps/web/components/chat/UserProfileDrawer.tsx` — 우측 `Sheet`(side="right") → 화면 중앙 `Dialog`(@/components/ui/dialog)로 교체. 컴포넌트명/props(`{userId, onClose}`) 유지 → 호출부 무변경. 필드별 게이팅: `showDob = isSelf || (user.showDateOfBirth ?? !user.hideInfo)`, phone/gender 동일. bio는 항상 표시.
- `apps/web/app/(main)/profile/page.tsx` (자기 프로필 보기) — 콘텐츠를 화면 중앙 카드(`max-w-md mx-auto`, rounded border/card/shadow, `flex justify-center`)로 정리. self이므로 모든 필드 표시 유지, edit 진입 버튼 유지.
- `apps/web/messages/{en,vi,zh,ja,ko,es,fr}.json` — profile 네임스페이스에 `showDobLabel`, `showPhoneLabel`, `showGenderLabel`, `privacySectionLabel`, `privacySectionHint` 추가(7개 언어). 미사용이 된 `hideInfoLabel`/`hideInfoHint`는 7개 언어 모두에서 제거.

> 참고: `apps/web/components/ui/dialog.tsx`는 이미 존재하여 `npx shadcn add dialog` 불필요. 직접 편집하지 않음.

### TypeScript 타입 체크 결과
- `pnpm build` (TS strict): ✓ Compiled successfully — errors: 0
- 전체 라우트 빌드 성공.

### i18n 추가 키 (profile 네임스페이스)
- `showDobLabel`: "Show date of birth to others"
- `showPhoneLabel`: "Show phone number to others"
- `showGenderLabel`: "Show gender to others"
- `privacySectionLabel`: "Privacy"
- `privacySectionHint`: "Choose which details other users can see."
- (제거) `hideInfoLabel`, `hideInfoHint` — 7개 언어 모두

### Flutter 미러 파일 동기화 확인
- `UserProfileDrawer.tsx` ↔ `user_profile_dialog.dart`: ✓ (양쪽 모두 중앙 다이얼로그. Web은 Sheet→Dialog로 통일하여 미러 일치)
- `ProfileForm.tsx` (edit) ↔ `edit_profile_screen.dart`/`user_profile_info_section.dart`: 게이팅 규칙 동일(`show* ?? !hideInfo`). Flutter 측 구현은 mobile-dev 담당 — 본 작업 범위는 Web만.
- 게이팅 폴백 규칙(`showDateOfBirth ?? !hideInfo` 등)이 plan의 백엔드/모바일과 동일하게 적용됨.

### 테스트
- `pnpm --filter @platform/web test`: ✓ Test Files 5 passed (5), Tests 48 passed (48)
- 기존 `MessageBubble.test.tsx`, `connector.test.ts` 영향 없음(컴포넌트명/시그니처 유지).

### 주의사항
- `hideInfo`는 타입과 폴백 로직에서 의도적으로 유지(레거시 유저 + 백엔드 하위호환). 제거 대상은 UI 라벨 키와 단일 토글뿐.
- self 응답에만 per-field 플래그가 내려온다는 API 계약 전제. edit 폼은 self(getMe) 응답을 시드로 사용하므로 정상 동작.
- 타 유저 보기 시 서버가 이미 필드를 strip하지만, 클라이언트도 동일 게이팅을 방어적으로 적용함.
- 자기 프로필 "보기"는 기존 풀스크린 라우트(`/profile`)를 유지하되 중앙 카드 레이아웃으로 정리. 멤버/유저 "보기"는 중앙 Dialog. (plan 권장안과 일치)
