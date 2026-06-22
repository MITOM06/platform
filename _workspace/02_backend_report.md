## Backend Implementation Report

Feature: Per-Field Privacy Toggles (showDateOfBirth / showPhoneNumber / showGender)

### 변경된 파일
- `packages/database/src/mongo/user.schema.ts` — `User` 클래스에 per-field privacy boolean 3개 추가: `showDateOfBirth`, `showPhoneNumber`, `showGender`, 각각 `@Prop({ default: true })`. `hideInfo`는 그대로 유지(폴백/하위호환).
- `apps/server/auth-service/src/modules/users/users.controller.ts` — (1) `PATCH /api/users/me` body 타입에 `showDateOfBirth?`, `showPhoneNumber?`, `showGender?: boolean` 추가. (2) `GET /api/users/:id` 응답을 필드별 게이팅으로 변경(아래 diff 요약).
- `apps/server/auth-service/src/modules/users/users.service.ts` — `updateProfile` data 타입 + `updateData` 매핑에 3개 필드 추가 (`!== undefined` 가드). `phoneNumber '' → null` 기존 로직 유지.

### 핵심 diff 요약

**user.schema.ts** (hideInfo 바로 아래에 추가):
```ts
@Prop({ default: true }) showDateOfBirth: boolean;
@Prop({ default: true }) showPhoneNumber: boolean;
@Prop({ default: true }) showGender: boolean;
```

**users.controller.ts GET :id — 새 필드별 게이팅 로직:**
```ts
hideInfo: doc.hideInfo ?? false,   // 폴백 안전망 (계속 포함)
...
const showDob   = doc.showDateOfBirth ?? !doc.hideInfo;
const showPhone = doc.showPhoneNumber ?? !doc.hideInfo;
const showGen   = doc.showGender      ?? !doc.hideInfo;

profile.bio = doc.bio;            // 항상 공개 (게이팅 없음)

if (isSelf) {                     // self 응답에만 플래그 + email 포함
  profile.email = doc.email;
  profile.showDateOfBirth = showDob;
  profile.showPhoneNumber = showPhone;
  profile.showGender      = showGen;
}

if (isSelf || showDob)   profile.dateOfBirth = doc.dateOfBirth;
if (isSelf || showPhone) profile.phoneNumber = doc.phoneNumber;
if (isSelf || showGen)   profile.gender      = doc.gender;
```
- 이전 동작 대비 변화: bio가 더 이상 hideInfo에 묶이지 않고 항상 공개. email은 self에만 노출(이전엔 `!hideInfo`인 타 유저에게도 노출되던 것을 self 전용으로 강화). dob/phone/gender는 각각 독립 게이팅.
- 타 유저 응답에는 show 플래그 미포함(불필요).

**users.service.ts updateProfile 매핑 추가:**
```ts
if (data.showDateOfBirth !== undefined) updateData.showDateOfBirth = data.showDateOfBirth;
if (data.showPhoneNumber !== undefined) updateData.showPhoneNumber = data.showPhoneNumber;
if (data.showGender      !== undefined) updateData.showGender      = data.showGender;
```

### 빌드 결과
- `pnpm --filter @platform/database build`: ✓ (tsc 통과)
- auth-service (`cd apps/server/auth-service && pnpm build`): ✓ (nest build / webpack compiled successfully)
- chat-service: 변경 없음 (이번 기능은 auth-service 전용)
- 테스트: users 관련 `*.spec.ts` 파일 없음 → 실행 대상 없음

### API 엔드포인트 구현 확인
- `PATCH /api/users/me` — ✓ body에 `showDateOfBirth?`, `showPhoneNumber?`, `showGender?: boolean` 수락. 응답은 self이므로 모든 필드 + 3 show 플래그 포함.
- `GET /api/users/:id` — ✓ 필드별 게이팅 적용.

### 확정된 API 응답 shape

**GET /api/users/:id (self):**
```
{ _id, id, displayName, avatarUrl, coverPhoto, isVerified, createdAt, friendsCount,
  bio, email, dateOfBirth, phoneNumber, gender,
  hideInfo, showDateOfBirth, showPhoneNumber, showGender }
```

**GET /api/users/:id (타 유저):**
```
{ _id, id, displayName, avatarUrl, coverPhoto, isVerified, createdAt, friendsCount,
  bio,                                   // 항상
  hideInfo,                              // 폴백 안전망
  dateOfBirth?,   // (showDateOfBirth ?? !hideInfo) == true 일 때만
  phoneNumber?,   // (showPhoneNumber ?? !hideInfo) == true 일 때만
  gender?         // (showGender      ?? !hideInfo) == true 일 때만 }
```
(show 플래그 / email 은 타 유저 응답에 미포함)

**PATCH /api/users/me 요청 (추가 필드):**
```
{ showDateOfBirth?: boolean, showPhoneNumber?: boolean, showGender?: boolean,
  // 기존: displayName?, avatarUrl?, bio?, coverPhoto?, dateOfBirth?, phoneNumber?, gender?, hideInfo? }
```

### 주의사항
- 마이그레이션 스크립트 작성하지 않음(요구사항대로). 레거시 문서는 새 필드가 없으며 `?? !hideInfo` 코드 폴백으로 기존 동작 유지.
- `bio`가 이전에는 `!hideInfo` 게이팅에 묶여 있었으나, plan에 따라 이제 항상 공개로 변경됨. 클라이언트가 bio를 항상 표시해도 안전.
- `email`은 이전 동작(`!hideInfo`인 타 유저에게도 노출)에서 self 전용으로 좁혀짐 — plan(line 11, 32) 의도와 일치.
