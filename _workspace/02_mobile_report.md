## Mobile Implementation Report — W-16.4 Notification Permission Logic Flow

### 변경된 파일
- `apps/client/lib/main.dart` — `main()`의 Firebase 초기화 블록에서 `FirebaseMessaging.instance.requestPermission(alert/badge/sound)` 호출 제거. 제거 이유를 설명하는 주석으로 대체. background handler(`onBackgroundMessage`), `onMessageOpenedApp`, `getInitialMessage`는 그대로 유지.
- `apps/client/lib/features/auth/domain/auth_provider.dart` — `_registerFcmToken()` 내부에서 `getToken()` 호출 **전에** `requestPermission(alert: true, badge: true, sound: true)`를 추가. 기존 `try/catch`로 감싸져 있어 권한 거부/미지원 시에도 안전(예외 무시). 이 메서드는 이미 `login`, `loginWithCode`, `build()`(복원된 세션)에서 호출되므로 모든 인증 진입점을 커버함.

### 구현 검증 — 호출 경로
`_registerFcmToken()` 호출 지점 3곳 모두 인증 성공 상태에 묶여 있음:
- `build()` — 저장된 사용자 세션 복원 시 (`getStoredUser() != null`)
- `login()` — 이메일/비밀번호 로그인 성공 후
- `loginWithCode()` — OAuth/딥링크 코드 교환 성공 후 (register 화면은 OTP 검증 후 이 인증 경로를 통해 진입)

→ 권한 요청은 이제 인증된 상태에서만 트리거되며, splash/landing/login 등 공개 페이지에서는 절대 트리거되지 않음 (스펙 충족).

### flutter analyze 결과
- issues: **0** ("No issues found! ran in 3.2s")
- (정보성 메시지: flutter_webrtc/flutter_secure_storage/emoji_picker_flutter의 Swift Package Manager 미지원 경고 — 코드 변경과 무관한 기존 플러그인 안내, analyze 이슈 아님)

### i18n 추가 키
- 없음 (권한 요청은 OS 네이티브 다이얼로그로, 앱 내 UI 문자열 추가 없음)

### 주의사항
- `requestPermission()`는 `_registerFcmToken()`의 기존 `try/catch` 안에 위치하여 iOS 권한 거부 시에도 예외 없이 진행됨. 권한 거부 시 `getToken()`이 null/예외를 반환할 수 있으나 `if (token != null)` 가드 + catch로 안전 처리됨.
- 복원된 세션(`build()`)에서도 `requestPermission()`가 호출됨 — iOS/Android 모두 권한이 이미 부여된 경우 시스템이 다이얼로그를 다시 띄우지 않으므로 사용자 방해 없음. 권한이 `notDetermined`인 복원 세션에서는 첫 진입 시 한 번 요청됨 (인증된 상태이므로 스펙 위반 아님).
- 백엔드 변경 없음. W-16.4 외 11개 태스크는 Web 전용이라 Mobile 무관.
