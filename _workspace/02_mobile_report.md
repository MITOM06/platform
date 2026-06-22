## Mobile Implementation Report — Avatar/Conversation UX Bug Cluster (6 issues)

### 변경된 파일

- `apps/client/lib/features/chat/domain/chat_models.dart` — `ConversationModel`에 `wallpaper` 필드 추가 (생성자/`fromJson`/`copyWith` + `clearWallpaper` 플래그). (이슈 6)
- `apps/client/lib/features/chat/data/chat_repository.dart` — `setWallpaper(convId, wallpaper)` → `PUT /api/conversations/{id}/wallpaper`. (이슈 6)
- `apps/client/lib/features/chat/domain/chat_misc_providers.dart`
  - `ChatWallpaperNotifier` 재설계: shared_preferences → 서버 공유(Conversation 모델). 대화 목록의 `wallpaper`를 추적하는 파생 provider(`_conversationWallpaperProvider`)를 `ref.listen`으로 구독, 낙관적 적용 후 서버 값으로 reconcile. 레거시용 `applyRemote()` 추가. (이슈 6)
  - `userProfileProvider` keepAlive 5분 → 60초로 단축(peer 아바타 갱신). (이슈 1)
- `apps/client/lib/features/chat/ui/widgets/chat_wallpaper_dialog.dart` — `_confirm()`에서 `system.theme.changed:` 전송 제거, `setWallpaper`(서버 PUT)만 호출. (이슈 6)
- `apps/client/lib/features/chat/domain/chat_system_message_parser.dart` — 레거시 `system.theme.changed:` 파싱은 유지하되 `setWallpaper`(PUT 발생) 대신 `applyRemote()`(로컬만) 호출. (이슈 6)
- `apps/client/lib/features/chat/ui/widgets/conversation_info_sidebar.dart` — "Chat Details" ExpansionTile + `_buildChatDetailsContent` 헬퍼 제거, 미사용 `profileAsync` 파라미터 제거. Pinned/Customization/Media/Privacy만 유지. (이슈 2)
- `apps/client/lib/features/chat/ui/widgets/conversation_customisation_dialogs.dart` — 닉네임 인라인 UI를 단일 중앙 모달(`_NicknamesModal` + `_NicknameRow`)로 교체. 본인 우선 정렬, 아바타 + 실제 이름(+"(you)"), 닉네임/placeholder + 연필 토글 인라인 편집. 본인 닉네임 설정 가능, 그룹/1:1 모두 동작. 전송은 기존 `system.nickname.changed:` 유지. (이슈 3)
- `apps/client/lib/core/widgets/pon_widgets.dart` — `PonTextField`에 `autofillHints` 파라미터 추가. (이슈 4)
- `apps/client/lib/features/settings/ui/widgets/change_password_dialog.dart` — 현재 비밀번호 필드에 `autofillHints: const []`로 OS 자동완성 차단. (이슈 4)
- `apps/client/lib/l10n/app_{en,vi,zh,ja,ko,es,fr}.arb` — 신규 키 4개 추가 후 `flutter gen-l10n` 재생성.

### 이슈별 처리 요약

- **이슈 1 (아바타 동기화):** 백엔드 조사 결과 아바타 업로드는 매번 고유 GridFS objectId(`/api/uploads/<id>`)를 반환 → URL 자체가 변경되어 `CachedNetworkImage`/resolver 레벨 cache-busting이 자동. 별도의 volatile `?t=` 부착은 캐싱을 무력화하므로 미적용(계획서 권고와 일치). peer 갱신 지연 원인이던 `userProfileProvider` 5분 캐시를 60초로 단축. 본인 변경은 기존 `auth_provider.updateProfile`의 `userProfileProvider` invalidate + auth state 갱신으로 즉시 반영(확인). `USER_UPDATED` 백엔드 push는 미존재 → 계획서대로 선택 항목이라 미구현.
- **이슈 2 (사이드바):** 상대방 사용자 정보(bio/DOB/멤버수) 아코디언 제거 완료. Pinned Messages 섹션 유지.
- **이슈 3 (닉네임):** 중앙 모달 재설계 완료. Web `NicknamesModal.tsx`와 동일 UX(본인+상대, 아바타+실명, 닉네임/placeholder, 연필 편집). 공유 i18n 키(`nicknameModalTitle`, `nicknameNonePlaceholder`) 이름 일치.
- **이슈 4 (비밀번호):** 모바일 컨트롤러는 이미 빈 칸 시작. 추가로 현재 비밀번호 필드 OS 자동완성 차단(`autofillHints: const []`).
- **이슈 5 (그룹 아바타):** Flutter `ConversationAvatar`가 `_absoluteUrl`로 이미 처리, CONVERSATION_UPDATED가 목록/헤더 갱신 → 고유 URL 덕분에 변경 즉시 반영. 코드 변경 불필요(확인).
- **이슈 6 (wallpaper):** shared_preferences 전용 → 서버 공유로 전환. `PUT /api/conversations/{id}/wallpaper` + `Conversation.wallpaper` + CONVERSATION_UPDATED. 백엔드/웹과 엔드포인트·바디(`{wallpaper}`)·필드명 완전 일치 확인.

### flutter analyze 결과

- issues: **0** (`No issues found!`)
- `flutter gen-l10n` 정상 (l10n.yaml 사용)

### i18n 추가 키 (7개 로케일 전부)

- `editNicknames`: "Edit nicknames"
- `nicknameModalTitle`: "Nicknames"
- `nicknameNonePlaceholder`: "No nickname"
- `nicknameYouSuffix`: "(you)"

### Web과의 동기화 포인트

- **이슈 6 wallpaper:** 모바일/웹/백엔드 모두 `PUT /api/conversations/{id}/wallpaper`, body `{wallpaper}`, 응답 `Conversation.wallpaper`, CONVERSATION_UPDATED 브로드캐스트로 일치. 빈 문자열 = 기본값 리셋(전원 공유). 업로드 이미지 값(`...#fit=&scale=`)은 양 플랫폼 resolver(`absoluteMediaUrl`/`_absoluteUrl`)가 동일 처리.
- **이슈 3 nickname:** 웹 `NicknamesModal.tsx`와 동일 레이아웃/동작. 공유 키 `nicknameModalTitle`, `nicknameNonePlaceholder` 이름 일치. 전송은 양쪽 동일하게 `system.nickname.changed:<userId>:<nickname>` 유지(서버 미저장 client-local).
- **이슈 2:** 사용자 정보 섹션을 양 플랫폼에서 제거, Pinned Messages만 유지.
- **이슈 1/5 avatar:** 양 플랫폼 동일한 상대경로 resolver 사용. 업로드 고유 URL로 cache-busting 자동, peer 캐시 단축으로 갱신.

### 주의사항

- `chatWallpaperProvider`(family, non-autoDispose)가 `_conversationWallpaperProvider`(autoDispose)를 `ref.listen`으로 유지. 대화 목록(`conversationsNotifierProvider`)이 CONVERSATION_UPDATED로 갱신되면 wallpaper가 자동 reconcile됨.
- 레거시 `system.theme.changed:` 메시지는 backward-compat로 계속 파싱하되 서버 재기록 없이 로컬에만 적용(`applyRemote`). 신규 경로(서버)가 authoritative.
- `chat_misc_providers.dart` ↔ `conversations_notifier.dart` 상호 import 발생(Dart 허용). analyze 통과.
- `chatInfoCategory`/`membersCount` ARB 키는 모바일에서 미사용이 되었으나 다른 화면 영향 가능성으로 ARB에서 삭제하지 않음(무해).
