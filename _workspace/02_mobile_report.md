## Mobile Implementation Report

### 변경된 파일
- `apps/client/lib/features/auth/domain/auth_state.dart` — `UserModel`에 `bool? showDateOfBirth, showPhoneNumber, showGender` 추가(nullable=미설정). 생성자/`fromJson`/`toJson` 반영. 폴백 게터 `effectiveShowDateOfBirth/PhoneNumber/Gender` (`?? !hideInfo`) 추가.
- `apps/client/lib/features/auth/data/auth_repository.dart` — `updateProfile`에 3개 파라미터 추가 → PATCH body 매핑(`if (... != null)` 가드).
- `apps/client/lib/features/auth/domain/auth_provider.dart` — `updateProfile`에 3개 파라미터 추가 → repository 전달.
- `apps/client/lib/features/profile/ui/widgets/user_profile_info_section.dart` — read-only 모드에서 필드별 게이팅(self는 모두, 타 유저는 `effectiveShow*`; bio는 항상). edit 모드에서 전화/성별/생일 각 필드 아래 "다른 사람에게 보이기" 토글 3개(`_ShowToggle`) 추가. 게이팅 파라미터/콜백 추가.
- `apps/client/lib/features/profile/ui/widgets/user_profile_dialog.dart` — 단일 `hideInfo` `SwitchListTile` 및 `profileInfoHidden` 전체 블록 숨김 제거. per-field show 토글 상태(`_showDob/_showPhone/_showGender`) 도입 — `_initEditFields`에서 `effectiveShow*`로 시드, `_save()`에서 전달. edit 모드 self에 Privacy 섹션 헤더 추가. `onToggleHideInfo` 콜백 제거 → `onToggleShow{Field}` 3개로 교체.
- `apps/client/lib/features/profile/ui/edit_profile_screen.dart` — 풀스크린 edit에 전화번호 필드(`PonTextField`), 성별 드롭다운, per-field show 토글 3개(`_PrivacyToggle`) 추가. state(`_phoneController/_gender/_showDob/_showPhone/_showGender`) 시드 + `_save()`에서 전달.
- `apps/client/lib/features/profile/ui/user_profile_screen.dart` — 풀스크린 타 유저 보기에서 생년월일 표시를 `isSelf || effectiveShowDateOfBirth`로 게이팅(방어적 클라이언트 게이트).
- `apps/client/lib/l10n/app_{en,vi,zh,ja,ko,es,fr}.arb` — 신규 키 4개 7개 언어 모두 추가.
- `apps/client/lib/l10n/app_localizations*.dart` — `flutter gen-l10n` 자동 재생성(직접 편집 없음).

### 핵심 변경 요약
- 단일 `hideInfo` 토글을 생년월일/전화번호/성별 per-field "다른 사람에게 보이기" 토글 3개로 교체. `hideInfo`는 모델/스토리지에 유지(폴백).
- 게이팅 규칙: `showField ?? !hideInfo` (= `effectiveShow*` 게터). self는 항상 전체 표시, bio는 항상 공개.
- 프로필 보기는 기존 중앙 `Dialog`(`user_profile_dialog.dart`) 사용 — 멤버/유저 보기(`message_bubble_parts`, `chat_app_bar`, `conversation_info_sidebar_parts`)는 이미 이 다이얼로그 진입. 풀스크린 edit 진입점(`/edit-profile`)은 유지.
- 토글 변경은 즉시 PATCH가 아니라 edit 저장 시 다른 필드와 함께 커밋(다이얼로그/풀스크린 edit 동일).

### flutter gen-l10n 결과
- 성공 (l10n.yaml 사용, 7개 언어 재생성).

### flutter analyze 결과
- issues: 0 ("No issues found!")

### flutter test 결과
- 47 / 47 통과 ("All tests passed!")

### i18n 추가 키
- `profileShowDateOfBirth`: "Show date of birth to others"
- `profileShowPhone`: "Show phone number to others"
- `profileShowGender`: "Show gender to others"
- `profilePrivacySection`: "Privacy"
(7개 언어 en/vi/zh/ja/ko/es/fr 모두 추가)

### 주의사항
- `profileHideInfo`/`profileInfoHidden` 키는 plan 지침대로 제거하지 않고 미사용 상태로 유지(generated 영향 회피). 향후 정리 가능.
- 서버는 타 유저 응답에서 dob/phone/gender를 이미 strip하지만, 클라이언트도 동일 게이팅을 적용해 방어. 타 유저 응답엔 `show*` 플래그가 없으므로 `effectiveShow*`가 `!hideInfo`로 폴백.
- `user_profile_dialog.dart` 396줄(400줄 제한 근접). 추가 기능 시 위젯 분리 필요.
- 풀스크린 `user_profile_screen.dart`(`/user/:id`)는 친구/멤버 목록 진입점에서 여전히 사용 중 — 보기 UI 통일 요구를 위해 게이팅만 적용(다이얼로그 강제 전환은 다수 호출부 영향으로 미적용; 채팅 컨텍스트 보기는 이미 다이얼로그).
