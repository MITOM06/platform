## QA Report — SPRINT W-16/W-17 (Bug Fixes, UI/UX, Profile Overhaul, Auth & Media) — 2026-06-16

검증 방식: 존재 확인이 아니라 실제 파일 내용을 직접 읽고 필드/타입/호출 경로를 대조함.
빌드 3종(tsc, pnpm build, flutter analyze) 모두 clean 상태에서 재실행.

### 빌드 상태
| 서비스 | 상태 | 비고 |
|--------|------|------|
| web `npx tsc --noEmit` | ✓ PASS | exit 0, 에러 0 |
| web `pnpm build` | ✓ PASS | exit 0, "Compiled successfully", 22 라우트(`/privacy` 포함) 컴파일 |
| `flutter analyze` (apps/client) | ✓ PASS | "No issues found! (ran in 2.7s)", W-16.4 변경 후 clean. SPM 미지원 경고는 기존 플러그인 안내(이슈 아님) |
| chat-service `mvn compile` | SKIP | 이번 스프린트 백엔드 변경 없음(plan.md 검증: 스키마/API 기존 지원). 검증 불필요 |

### 항목별 판정 (18개)

| # | 항목 | 판정 | 근거 (파일:라인) |
|---|------|------|------------------|
| 1 | W-17.3 middleware `/privacy` | ✓ PASS | `middleware.ts:12` `'/privacy'` (그리고 `'/forgot-password'`:11) PUBLIC_PATHS에 존재 |
| 2 | W-16.3 toast top-center | ✓ PASS | `providers.tsx:21` `<Toaster position="top-center" richColors closeButton />` |
| 3 | W-17.5 nav tap (asChild+Link 제거) | ✓ PASS | `layout.tsx:264-277` Profile/Settings가 `onSelect={() => router.push(...)}` 패턴. asChild+Link 제거됨 |
| 4 | W-17.2 axios refresh edge case | ✓ PASS | `axios.ts:38-96` 인터셉터 존재. 보강 확인: `!accessToken` 가드(:54, 초기로드 무한루프 방지), login/register/verify 401 스킵(:49-51), refresh 자기 자신 제외(:46-47), isRefreshing 큐 직렬화(:59-66), refresh 실패 시 clearAuth+리다이렉트(:83-87). authApi+chatApi 모두 적용(:95-96) |
| 5 | W-16.1 media gallery absoluteMediaUrl + onError | ✓ PASS | `SharedMediaGallery.tsx:8` import, :53/:89 `absoluteMediaUrl()` 적용, :67-72 `onError` 핸들러로 ImageIcon placeholder 폴백, :88 null-guard, :91-95 클릭 가능한 `<a target="_blank" rel="noopener">` |
| 6 | W-17.6 search scope (직접 채팅 상대 이름) | ✓ PASS | `ConversationList.tsx:81-94` `resolveSearchTerms()` — group은 `conv.name`, direct는 peer nickname(`getNickname`) + 캐시된 displayName 매칭. :96-100 필터 적용 |
| 7 | W-16.5 sidebar header + DropdownMenu 통합 | ✓ PASS | `layout.tsx:204-231` 단일 `Plus` DropdownMenu에 "Trò chuyện mới"(`openNewChat('direct')`) + "Tạo nhóm"(`openNewChat('group')`). Compass/Friends는 독립 아이콘 유지(설계대로) |
| 8 | W-16.4 Web 알림 권한 | ✓ PASS | `lib/notifications.ts` 신규 — `typeof Notification` 가드, `permission!=='default'` respect, localStorage `pon_notif_prompted` 플래그. login:58 / register:74 / verify-otp:72 모두 `void maybeRequestNotificationPermission()` 호출. layout.tsx:76-78 무조건 호출 제거 확인 |
| 9 | W-16.4 Mobile FCM 권한 | ✓ PASS | `main.dart`에 `requestPermission` 없음(제거됨), onBackgroundMessage/onMessageOpenedApp/getInitialMessage 유지. `auth_provider.dart:36-40` `_registerFcmToken()`에서 `getToken()`(:41) 호출 **전** requestPermission 추가. 호출 경로 build/login/loginWithCode 모두 인증 상태(:15/:26/:58) |
| 10 | auth.store.ts 타입 확장 | ✓ PASS | `auth.store.ts:7-9` `AuthUser`에 `avatarUrl?`, `bio?`, `coverPhoto?` 추가 |
| 11 | W-17.4 avatar/cover + cropper | ✓ PASS | `ImageCropperModal.tsx` 신규(react-easy-crop, JPEG blob, avatar round/cover rect). `profile/page.tsx:31` import, :350-357 사용. setAuth(:157-166)에 avatarUrl/coverPhoto 병합 포함. 크롭 confirm→스테이징, Save에서만 업로드(:134-176) |
| 12 | W-16.6 profile overhaul | ✓ PASS | bio 시딩 `getMe()` via TanStack Query(:48-52), reset on load(:90-94), bio 항상 전송(빈 문자열 포함, :151). DOB 필드/Calendar import 완전 제거(profile page grep 결과 none). `birthdateLabel` 키 7개 언어 모두에서 제거 확인 |
| 13 | W-16.2 call log | ✓ PASS | `call-manager.ts:119-128` `endCall()`이 `chatService.sendMessage(..., 'system')`로 `system.call.ended:<kind>:<sec>` 또는 `system.call.missed:<kind>` 전송, hang-up 발신자만(중복 방지 주석). `system-messages.ts:26-39` 파싱+mm:ss 포맷. `MessageBubble.tsx:5,121-128` Phone/Video lucide 아이콘 렌더 |
| 14 | tsc --noEmit | ✓ PASS | 에러 0 |
| 15 | pnpm build (clean 재검증) | ✓ PASS | 2회 실행 모두 exit 0, "Compiled successfully" |
| 16 | flutter analyze | ✓ PASS | No issues found |
| 17 | W-17.1 (deferred) | ⚠ DEFERRED | 사이드바 반응 알림. 백엔드 notification queue(`/user/queue/notifications`)가 REACTION 이벤트를 emit하지 않음 → 백엔드 변경 또는 전 대화 토픽 global 구독(비용 큼) 필요. autonomous-mode 결정으로 follow-up 스프린트 연기. 합당한 사유, follow-up 필요 |
| 18 | i18n consistency (7개 언어) | ✓ PASS | en/vi/zh/ja/ko/es/fr 7개 파일 모두 systemVideoCallEnded/systemVoiceCallEnded/systemVideoCallMissed/systemVoiceCallMissed/cropImage/coverPhoto/changeCover 존재. birthdateLabel 7개 모두에서 제거됨 |

### 발견된 이슈
| 심각도 | 파일:라인 | 내용 | 권장 수정 |
|--------|---------|------|----------|
| P1 (sync) | `apps/client/lib/features/chat/ui/widgets/message_bubble.dart` | Flutter가 `system.call.ended:` / `system.call.missed:` 미처리. Web만 렌더 → sync.md상 "한쪽만 렌더 = P1 버그". grep으로 Flutter에 해당 핸들링 없음 확인 | Flutter `_systemText`에 동일 매핑 + Phone/Video 아이콘 추가 (별도 모바일 태스크) |
| P2 (defer) | sidebar reaction (W-17.1) | 미구현. 백엔드 REACTION 알림 채널 부재 | 백엔드에서 `/user/queue/notifications`에 REACTION 이벤트 추가 후 사이드바 override map 구현 |
| Info | `auth_provider.dart:48-50` | `_registerFcmToken` catch가 예외를 완전 무시(주석만). 의도된 동작(권한 거부/미지원 안전 처리)이나 로깅 없음 | 디버그 로깅 추가 권장(비차단) |

### 크로스 플랫폼 동기화 요약
- W-16.4(알림 권한): Web + Mobile 양쪽 모두 post-auth로 이동 완료 — **동기화됨** ✓
- W-16.2(call log): Web 완료, **Flutter 미러 누락** — P1 follow-up 필요 ✗
- 나머지 10개 태스크: Web 전용 UI/state 변경, STOMP/메시지 타입 계약 변경 없음 → Flutter 미러 불필요 ✓
- API 계약: 신규/변경 엔드포인트 없음. `PATCH /api/users/me`, `GET /api/users/me` 기존 스펙 재사용(plan.md 검증). client emit `system.call.ended:`만 신규 메시지 컨벤션(기존 system.* 패턴 동일)

### 결론
**PARTIAL PASS** — 18개 항목 중 16개 PASS, 1개 DEFERRED(W-17.1, 사유 합당), 1개 차단성 아님.
이번 스프린트 범위(12 태스크)의 구현·빌드·타입·i18n·인증 경로는 전부 검증 통과. 빌드 차단 이슈 없음.

**잔여 이슈 (follow-up 필요):**
1. **[P1] Flutter W-16.2 미러** — `system.call.ended:`/`system.call.missed:` Flutter 렌더링. sync.md 기준 P1. 다음 모바일 스프린트 최우선.
2. **[P2] W-17.1** — 사이드바 반응 알림. 백엔드 REACTION 알림 채널 선행 필요.
3. **[Info]** auth_provider FCM catch 로깅 부재(비차단).

릴리스 가능 여부: Web 단독 릴리스는 가능(전부 PASS). 단 call-log 기능은 Flutter 미러 완료 전까지 크로스 플랫폼 미완 상태로 표시.
