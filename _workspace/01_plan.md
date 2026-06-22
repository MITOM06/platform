## Feature: Centered Profile Dialog + Per-Field Privacy Toggles

### Summary
프로필 보기(자기 자신 + 그룹/유저 멤버 모두)를 화면 중앙 다이얼로그/카드 형태로 통일하고, 상대가 공개로 설정한 정보만 노출한다. Edit profile의 단일 `hideInfo` 토글을 생년월일/전화번호/성별 3개 필드별 공개·비공개 토글로 교체한다. bio는 토글 대상이 아니며 항상 공개로 처리한다. 하위호환을 위해 새 per-field boolean 필드(`showDateOfBirth`, `showPhoneNumber`, `showGender`, default `true`)를 도입하고, 값이 없으면 기존 `hideInfo`로 폴백한다.

### Design Decisions
- 새 필드: `showDateOfBirth`, `showPhoneNumber`, `showGender` (boolean, default `true` = 공개). UI에서 토글은 "다른 사람에게 보이기(show)" 의미로 표현.
- 기존 `hideInfo`는 스키마에 유지 (마이그레이션/폴백용). UI에서는 제거.
- 폴백 규칙(백엔드 응답 필터링 + 클라이언트 게이팅 공통): per-field 값이 `undefined`이면 `!hideInfo`로 대체.
  - `showDateOfBirth ?? !hideInfo`, `showPhoneNumber ?? !hideInfo`, `showGender ?? !hideInfo`
- `bio`, `email`은 항상 노출 (현재 동작 유지 — 단, email은 self일 때만 의미 있게 보여줌).
- 보기 UI는 중앙 다이얼로그로 통일. Web은 Sheet(side="right") → `Dialog` 로 교체, Flutter는 이미 중앙 `Dialog`(`user_profile_dialog.dart`)가 존재하므로 자기 프로필 진입도 동일 다이얼로그를 쓰도록 통일.

---

### Backend (NestJS auth-service)

| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `packages/database/src/mongo/user.schema.ts` | 수정 | `User` 클래스에 `@Prop({ default: true }) showDateOfBirth: boolean;`, `showPhoneNumber`, `showGender` 추가. `hideInfo`는 그대로 유지(폴백/마이그레이션). |
| `apps/server/auth-service/src/modules/users/users.controller.ts` | 수정 | (1) `PATCH me` body 타입에 `showDateOfBirth?`, `showPhoneNumber?`, `showGender?: boolean` 추가. (2) `GET :id` 응답 필터링 변경: 필드별 게이팅으로 분리(아래 로직). 공개 응답에 새 3개 플래그도 포함(self가 edit 폼 시드용으로 읽음). |
| `apps/server/auth-service/src/modules/users/users.service.ts` | 수정 | `updateProfile` data 타입 + `updateData` 매핑에 `showDateOfBirth`, `showPhoneNumber`, `showGender` 추가 (`!== undefined` 가드). |

**GET /api/users/:id 새 필터링 로직 (controller findById):**
```
const showDob   = doc.showDateOfBirth ?? !doc.hideInfo;
const showPhone = doc.showPhoneNumber ?? !doc.hideInfo;
const showGen   = doc.showGender      ?? !doc.hideInfo;

// profile에는 항상: bio, hideInfo + 새 3 플래그(self 폼 시드용), createdAt, friendsCount 등
profile.bio = doc.bio;                         // 항상 공개
if (isSelf) { profile.email = doc.email; profile.showDateOfBirth = showDob; ... }
if (isSelf || showDob)   profile.dateOfBirth = doc.dateOfBirth;
if (isSelf || showPhone) profile.phoneNumber = doc.phoneNumber;
if (isSelf || showGen)   profile.gender = doc.gender;
```
- self 응답에는 `showDateOfBirth/showPhoneNumber/showGender` 플래그를 그대로 내려 edit 폼이 토글 상태를 시드할 수 있게 한다. 타 유저 응답에는 플래그를 내리지 않음(불필요).
- 기존 `hideInfo` 필드도 응답에 계속 포함(클라이언트 폴백 안전망).

---

### Mobile (Flutter)

| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/client/lib/features/auth/domain/auth_state.dart` | 수정 | `UserModel`에 `bool? showDateOfBirth; showPhoneNumber; showGender;` 추가(nullable = 미설정시 폴백). `fromJson`/`toJson`/생성자 반영. |
| `apps/client/lib/features/auth/data/auth_repository.dart` | 수정 | `updateProfile`에 `bool? showDateOfBirth, showPhoneNumber, showGender` 파라미터 + PATCH body 매핑 추가. |
| `apps/client/lib/features/auth/domain/auth_provider.dart` | 수정 | `updateProfile`(line 81~)에 새 3개 파라미터 추가 → repository 전달. |
| `apps/client/lib/features/profile/ui/widgets/user_profile_dialog.dart` | 수정 | (1) 단일 `hideInfo` SwitchListTile(line 332-343) 제거. (2) self 편집 모드에서만 3개 per-field show 토글 노출. (3) 타 유저 보기 시 필드별 게이팅(`showDob = u.showDateOfBirth ?? !u.hideInfo` …)으로 표시 여부 결정. `onToggleHideInfo` → `onToggleShow{Field}` 콜백으로 교체. |
| `apps/client/lib/features/profile/ui/widgets/user_profile_info_section.dart` | 수정 | read-only 모드에서 필드별 show 플래그로 게이팅(bio는 항상). 편집 모드 각 필드(전화/성별/생일) 옆에 show 토글 추가하거나, 토글은 dialog 레벨에서 처리하고 여기선 게이팅만 받도록 파라미터 추가. |
| `apps/client/lib/features/profile/ui/user_profile_screen.dart` | 수정(검토) | 자기 프로필 진입을 중앙 다이얼로그로 통일하려면 이 풀스크린 대신 `showUserProfileDialog` 사용으로 라우팅 조정. (현 풀스크린 유지 옵션도 가능 — 단 요구사항은 "중앙 다이얼로그"이므로 다이얼로그 통일 권장.) |
| `apps/client/lib/features/profile/ui/edit_profile_screen.dart` | 수정 | 풀스크린 edit에 per-field show 토글 3개 추가(전화번호 필드 자체가 현재 없다면 추가 검토). `_save()`에서 새 플래그 전달. 단일 hideInfo 없음 확인됨. |
| `apps/client/lib/l10n/app_en.arb` | 수정 | 신규 키 추가(아래). `profileHideInfo`/`profileInfoHidden`은 deprecated이나 제거 시 generated 영향 → 유지하되 미사용 가능. |
| `apps/client/lib/l10n/app_{vi,zh,ja,ko,es,fr}.arb` | 수정 | 동일 신규 키 6개 언어 추가. |
| (generated) `lib/l10n/app_localizations*.dart` | 자동 | `flutter gen-l10n`으로 재생성. 직접 편집 금지. |

**신규 Flutter i18n 키 (app_en.arb, 7개 언어 모두):**
```
"profileShowDateOfBirth": "Show date of birth to others",
"profileShowPhone": "Show phone number to others",
"profileShowGender": "Show gender to others",
"profilePrivacySection": "Privacy"
```

---

### Web (Next.js)

| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/web/lib/api/auth.ts` | 수정 | `UserProfile`에 `showDateOfBirth?`, `showPhoneNumber?`, `showGender?: boolean` 추가. `UpdateProfilePayload`에 동일 3개 추가. `hideInfo`는 유지. |
| `apps/web/components/chat/UserProfileDrawer.tsx` | 수정(대체) | `Sheet`(side="right") → 중앙 `Dialog`(`@/components/ui/dialog`)로 교체. 파일명은 유지 가능(import 경로 안정). 필드별 게이팅: `showDob = isSelf || (user.showDateOfBirth ?? !user.hideInfo)` 식으로 dob/phone/gender 각각 분리. bio는 항상 표시. 컴포넌트명/시그니처(`{userId, onClose}`)는 유지하여 호출부 무변경. |
| `apps/web/components/profile/ProfileForm.tsx` | 수정 | `ProfileFormValues`에서 `hideInfo` → `showDateOfBirth/showPhoneNumber/showGender: boolean` 3개로 교체. 단일 privacy Switch(line 169-182) → 각 필드(생일/전화/성별) 행에 인라인 Switch 추가 또는 별도 Privacy 섹션 3토글. props `onHideInfoChange` → `onShowFieldChange(field, value)`. `texts`에 신규 라벨 추가. |
| `apps/web/app/(main)/profile/edit/page.tsx` | 수정 | zod schema `hideInfo` → 3 booleans. defaultValues/reset 시드(`me.showDateOfBirth ?? !me.hideInfo` 등). `onSubmit`에서 새 3 플래그 전달, `hideInfo` 제거. `texts`에 신규 라벨 매핑. |
| `apps/web/app/(main)/profile/page.tsx` | 수정 | 자기 프로필 보기를 중앙 다이얼로그로 통일하려면 이 풀스크린 대신 `UserProfileDrawer`(다이얼로그화된) 재사용 고려. 최소 변경안: 현 페이지 유지하되 self는 모든 필드 표시(현재도 그러함)이므로 게이팅 영향 없음. 요구사항상 "중앙 다이얼로그" 통일이면 라우트→다이얼로그 트리거로 전환. **(권장: 멤버/유저 보기는 다이얼로그, 자기 프로필 풀스크린 편집 진입점은 유지. 단 "보기"는 다이얼로그로.)** |
| `apps/web/components/ui/dialog.tsx` | 확인 | shadcn dialog 존재 여부 확인. 없으면 `npx shadcn add dialog`. (직접 편집 금지) |
| `apps/web/messages/en.json` | 수정 | `profile` + `chat` 네임스페이스에 신규 키 추가(아래). |
| `apps/web/messages/{vi,zh,ja,ko,es,fr}.json` | 수정 | 동일 신규 키 6개 언어 추가. |

**신규 Web i18n 키 (`profile` 네임스페이스):**
```
"showDobLabel": "Show date of birth to others",
"showPhoneLabel": "Show phone number to others",
"showGenderLabel": "Show gender to others",
"privacySectionLabel": "Privacy",
"privacySectionHint": "Choose which details other users can see."
```
- `hideInfoLabel`/`hideInfoHint`는 제거 또는 미사용으로 유지. (제거 시 모든 7개 json + ProfileForm texts 정리)

---

### API Contract

**Endpoint:** `PATCH /api/users/me`
- Request (추가 필드):
  ```
  {
    showDateOfBirth?: boolean,
    showPhoneNumber?: boolean,
    showGender?: boolean
    // 기존: displayName?, avatarUrl?, bio?, coverPhoto?, dateOfBirth?, phoneNumber?, gender?, hideInfo?
  }
  ```
- Response: 업데이트된 UserProfile (아래 GET shape와 동일, self이므로 모든 필드 + show 플래그 포함)

**Endpoint:** `GET /api/users/:id`
- Response (self):
  ```
  {
    _id, id, displayName, avatarUrl, coverPhoto, isVerified, createdAt, friendsCount,
    bio, email, dateOfBirth, phoneNumber, gender,
    hideInfo, showDateOfBirth, showPhoneNumber, showGender
  }
  ```
- Response (타 유저): 공개 필드 + 필드별 게이팅 결과만:
  ```
  {
    _id, id, displayName, avatarUrl, coverPhoto, isVerified, createdAt, friendsCount,
    bio,                                  // 항상
    hideInfo,                             // 폴백 안전망
    dateOfBirth?,  // showDateOfBirth ?? !hideInfo == true 일 때만
    phoneNumber?,  // showPhoneNumber ?? !hideInfo == true 일 때만
    gender?        // showGender ?? !hideInfo == true 일 때만
  }
  ```

---

### Data Model Changes
- `User` 스키마에 3개 boolean 필드 추가: `showDateOfBirth`, `showPhoneNumber`, `showGender` (default `true`).
- 기존 문서는 해당 필드가 없음 → 코드 폴백(`?? !hideInfo`)으로 처리하므로 **별도 마이그레이션 스크립트 불필요**. (선택: 일관성 위해 `hideInfo=true`인 기존 유저에 3 플래그 false 백필 가능하나 필수 아님.)
- `hideInfo`는 삭제하지 않음(하위호환).

---

### Implementation Order
1. **Backend**: 스키마 3필드 추가 → controller PATCH body + GET 필터링 → service updateProfile 매핑. `pnpm --filter @platform/database build` 후 auth-service 빌드.
2. **API 계약 고정**: 위 GET/PATCH shape 확정.
3. **Mobile + Web (병렬 가능)**:
   - Web: auth.ts 타입 → ProfileForm → edit/page → UserProfileDrawer(Dialog화) → messages 7개.
   - Mobile: UserModel → repository/provider → user_profile_dialog/info_section/edit_profile → arb 7개 → `flutter gen-l10n`.
4. **Sync 검증**: dob/phone/gender 게이팅 로직이 Web·Mobile 동일한지, 토글 라벨/키가 양쪽 7개 언어에 모두 존재하는지 확인(`sync-check`).

---

### Verification (build/test)
- Backend:
  - `pnpm --filter @platform/database build`
  - `pnpm --filter auth-service build` (또는 `cd apps/server/auth-service && pnpm build`)
  - `pnpm --filter auth-service test` (users 관련 테스트가 있다면)
- Web:
  - `cd apps/web && pnpm build` (TypeScript strict 검증)
  - `pnpm --filter @platform/web test` (기존 `MessageBubble.test.tsx`, `connector.test.ts` 영향 없는지)
- Mobile:
  - `cd apps/client && flutter gen-l10n`
  - `flutter analyze`
  - `flutter test`
- 수동 E2E:
  - self edit에서 각 토글 off → 다른 계정으로 해당 유저 프로필 다이얼로그 열기 → 해당 필드만 숨겨지는지 확인(Web+Mobile 동일).
  - 그룹 멤버 탭/아바타 탭 → 중앙 다이얼로그로 뜨는지 확인.

---

### Edge Cases
- **레거시 유저(새 플래그 없음)**: `?? !hideInfo` 폴백으로 기존 동작 유지. `hideInfo=true`였던 유저는 3필드 모두 비공개로 보임(기존 의도 유지).
- **self 보기**: 모든 필드 항상 표시(토글 상태와 무관). 토글은 "타인에게 보이기" 제어용.
- **bio/email**: 토글 대상 아님. bio 항상 공개, email은 self 응답에만 포함.
- **부분 공개**: dob만 공개, phone/gender 비공개 등 조합 정상 동작해야 함(필드별 독립 게이팅).
- **phoneNumber 빈 문자열**: PATCH 시 `'' → null` 매핑(sparse unique index) 기존 로직 유지.
- **클라이언트 폴백 방어**: 서버가 이미 필드를 strip하지만, 클라이언트도 동일 게이팅을 적용해 서버가 실수로 내려도 노출하지 않음(현 Web 패턴 유지).
- **다이얼로그 전환 회귀**: Web `UserProfileDrawer`를 Sheet→Dialog로 바꿔도 호출부(`ConversationHeader.tsx:226`, `MessageBubble.tsx:364`)의 props(`userId`,`onClose`)가 동일하므로 무변경. 테스트 목(`MessageBubble.test.tsx:32`)도 컴포넌트명 유지로 영향 없음.
- **i18n 누락**: 신규 키가 7개 파일 모두에 없으면 빌드는 되나(영문 폴백) 규칙 위반 → 반드시 7개 동기화.
