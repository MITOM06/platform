// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Korean (`ko`).
class AppLocalizationsKo extends AppLocalizations {
  AppLocalizationsKo([String locale = 'ko']) : super(locale);

  @override
  String get appName => 'PON';

  @override
  String get languageName => '한국어';

  @override
  String get actionCancel => '취소';

  @override
  String get actionConfirm => '확인';

  @override
  String get actionRetry => '다시 시도';

  @override
  String get actionSave => '저장';

  @override
  String get actionLogout => '로그아웃';

  @override
  String get actionDelete => '삭제';

  @override
  String get actionLeave => '나가기';

  @override
  String get loadingDots => '...';

  @override
  String errorWithMsg(String error) {
    return '오류: $error';
  }

  @override
  String get loginTitle => '로그인';

  @override
  String get fieldEmail => '이메일';

  @override
  String get fieldPassword => '비밀번호';

  @override
  String get forgotPasswordLink => '비밀번호를 잊으셨나요?';

  @override
  String get loginButton => '로그인';

  @override
  String get noAccountYet => '계정이 없으신가요? ';

  @override
  String get registerNow => '지금 가입';

  @override
  String get valEmailRequired => '이메일을 입력하세요';

  @override
  String get valEmailInvalid => '유효하지 않은 이메일';

  @override
  String get valPasswordRequired => '비밀번호를 입력하세요';

  @override
  String get valPasswordMin6 => '비밀번호는 6자 이상이어야 합니다';

  @override
  String get errInvalidCredentials => '이메일 또는 비밀번호가 올바르지 않습니다';

  @override
  String get errNetwork => '서버에 연결할 수 없습니다. 네트워크를 확인하세요';

  @override
  String get errLoginFailed => '로그인에 실패했습니다. 다시 시도하세요';

  @override
  String get registerTitle => '계정 만들기';

  @override
  String get welcomeToApp => 'PON에 오신 것을 환영합니다';

  @override
  String get fieldDisplayName => '표시 이름';

  @override
  String get fieldConfirmPassword => '비밀번호 확인';

  @override
  String get registerButton => '가입';

  @override
  String get haveAccount => '이미 계정이 있으신가요? ';

  @override
  String get loginLink => '로그인';

  @override
  String get valNameRequired => '이름을 입력하세요';

  @override
  String get valNameMin2 => '이름은 2자 이상이어야 합니다';

  @override
  String get valPasswordMismatch => '비밀번호가 일치하지 않습니다';

  @override
  String get errEmailExists => '이미 등록된 이메일입니다';

  @override
  String get errRegisterFailed => '가입에 실패했습니다. 다시 시도하세요';

  @override
  String get verifyOtpTitle => 'OTP 인증';

  @override
  String get verifyAccountHeading => '계정 인증';

  @override
  String otpSentTo(String email) {
    return '6자리 OTP를 전송했습니다\n$email';
  }

  @override
  String get fieldOtp => 'OTP 코드';

  @override
  String get confirmButton => '확인';

  @override
  String resendIn(int seconds) {
    return '$seconds초 후 재전송';
  }

  @override
  String get resendOtp => 'OTP 다시 보내기';

  @override
  String get otpResent => '새 OTP 코드를 이메일로 전송했습니다';

  @override
  String get errResendFailed => '재전송 실패, 나중에 다시 시도하세요';

  @override
  String get valOtp6 => 'OTP 6자리를 모두 입력하세요';

  @override
  String get verifySuccess => '인증 성공! 지금 로그인하세요';

  @override
  String get errVerifyFailed => '인증에 실패했습니다. 다시 시도하세요';

  @override
  String get forgotTitle => '비밀번호 재설정';

  @override
  String get forgotHeading => '비밀번호를 잊으셨나요?';

  @override
  String get forgotSubtitle => 'OTP를 받고 새 비밀번호를 설정하려면 이메일을 입력하세요';

  @override
  String get sendOtpButton => 'OTP 코드 보내기';

  @override
  String get errEmailNotRegistered => '등록되지 않은 이메일입니다';

  @override
  String get errSendRequestFailed => '요청에 실패했습니다. 다시 시도하세요';

  @override
  String get newPasswordTitle => '새 비밀번호';

  @override
  String get newPasswordHeading => '새 비밀번호 만들기';

  @override
  String newPasswordSubtitle(String email) {
    return '$email로 전송된 OTP와\n새 비밀번호를 입력하세요';
  }

  @override
  String get fieldNewPassword => '새 비밀번호';

  @override
  String get valNewPasswordRequired => '새 비밀번호를 입력하세요';

  @override
  String get resetPasswordSuccess => '비밀번호를 재설정했습니다!';

  @override
  String get errOtpInvalidExpired => 'OTP가 올바르지 않거나 만료되었습니다';

  @override
  String get errResetFailed => '비밀번호 재설정에 실패했습니다. 다시 시도하세요';

  @override
  String get settingsTitle => '설정';

  @override
  String get valNameEmpty => '이름은 비워둘 수 없습니다';

  @override
  String get nameUpdated => '표시 이름이 업데이트되었습니다';

  @override
  String get personalInfo => '개인 정보';

  @override
  String get appearance => '테마';

  @override
  String get chooseThemeTitle => '테마 선택';

  @override
  String get themeLight => '라이트 테마';

  @override
  String get themeDark => '다크 테마';

  @override
  String get themeSystem => '시스템';

  @override
  String get language => '언어';

  @override
  String get chooseLanguageTitle => '언어 선택';

  @override
  String get logoutConfirmBody => '정말 로그아웃하시겠습니까?';

  @override
  String get onboardingChooseTheme => '테마 선택';

  @override
  String get onboardingChooseSubtitle => '가장 잘 맞는 인터페이스 스타일을 선택하세요.';

  @override
  String get themeLightSubtitle => '밝고 선명하며 읽기 쉬움';

  @override
  String get themeDarkSubtitle => '현대적이고 신비로우며 눈이 편안함';

  @override
  String get themeSystemSubtitle => '기기에 자동으로 맞춤';

  @override
  String get startExperience => '체험 시작';

  @override
  String get tooltipSettings => '설정';

  @override
  String get tooltipNewConversation => '새 대화';

  @override
  String get listLoadFailed => '목록을 불러올 수 없습니다';

  @override
  String get listCheckNetwork => '네트워크 연결을 확인하고 다시 시도하세요.';

  @override
  String get listGenericError => '문제가 발생했습니다. 나중에 다시 시도하세요.';

  @override
  String get emptyConversations => '아직 대화가 없습니다';

  @override
  String get emptyTapPlus => '아래 \"+\" 버튼을 눌러 시작하세요!';

  @override
  String get offlineBanner => '네트워크 연결 없음';

  @override
  String get conversationDefault => '대화';

  @override
  String get newConversationTitle => '새 대화';

  @override
  String get startConversationHeading => '대화 시작';

  @override
  String get fieldRecipient => '상대방 이메일 또는 사용자 ID';

  @override
  String get valRecipientRequired => '이메일 또는 사용자 ID를 입력하세요';

  @override
  String get errUserNotFoundEmail => '이 이메일의 사용자를 찾을 수 없습니다.';

  @override
  String get errUserNotFoundOrConn => '사용자를 찾을 수 없거나 연결 오류입니다.';

  @override
  String get startConversationButton => '채팅 시작';

  @override
  String get chatDefaultTitle => '채팅';

  @override
  String get statusOnline => '활동 중';

  @override
  String get statusOffline => '오프라인';

  @override
  String get typingLabel => '입력 중';

  @override
  String get messageHint => '메시지를 입력하세요…';

  @override
  String get tabChats => '채팅';

  @override
  String get newGroup => '새 그룹';

  @override
  String get newDirect => '새 채팅';

  @override
  String get createGroup => '그룹 만들기';

  @override
  String get groupName => '그룹 이름';

  @override
  String get valGroupNameRequired => '그룹 이름을 입력하세요';

  @override
  String get selectMembers => '멤버 선택';

  @override
  String get valSelectMembers => '멤버를 2명 이상 선택하세요';

  @override
  String get searchUsers => '이름 또는 이메일로 검색';

  @override
  String get groupInfo => '그룹 정보';

  @override
  String get members => '멤버';

  @override
  String membersCount(int count) {
    return '멤버 $count명';
  }

  @override
  String get addMembers => '멤버 추가';

  @override
  String get removeMember => '그룹에서 제거';

  @override
  String get leaveGroup => '그룹 나가기';

  @override
  String get leaveGroupConfirm => '정말 이 그룹을 나가시겠습니까?';

  @override
  String get renameGroup => '그룹 이름 변경';

  @override
  String get admin => '관리자';

  @override
  String get you => '나';

  @override
  String systemAddedMember(String actor, String target) {
    return '$actor님이 $target님을 추가했습니다';
  }

  @override
  String systemRemovedMember(String actor, String target) {
    return '$actor님이 $target님을 제거했습니다';
  }

  @override
  String systemLeftGroup(String actor) {
    return '$actor님이 그룹을 나갔습니다';
  }

  @override
  String systemRenamedGroup(String actor, String name) {
    return '$actor님이 그룹 이름을 $name(으)로 변경했습니다';
  }

  @override
  String systemCreatedGroup(String actor) {
    return '$actor님이 그룹을 만들었습니다';
  }

  @override
  String get actionReply => '답장';

  @override
  String get actionRecall => '회수';

  @override
  String get actionDeleteForMe => '나에게서 삭제';

  @override
  String get actionCopy => '복사';

  @override
  String get actionReact => '반응';

  @override
  String get messageRecalled => '메시지가 회수되었습니다';

  @override
  String replyingTo(String name) {
    return '$name님에게 답장 중';
  }

  @override
  String get copiedToClipboard => '클립보드에 복사되었습니다';

  @override
  String get recallConfirm => '모두에게서 이 메시지를 회수하시겠습니까?';

  @override
  String get deleteConversation => '대화 삭제';

  @override
  String get deleteConversationConfirm => '이 대화를 삭제하시겠습니까? 목록에서 숨겨집니다.';

  @override
  String get clearHistory => '대화 기록 지우기';

  @override
  String get clearHistoryConfirm => '이 대화의 모든 메시지를 나에게서 지우시겠습니까?';

  @override
  String get disappearingMessages => '사라지는 메시지';

  @override
  String get disappearingOff => '끄기';

  @override
  String get disappearing24h => '24시간';

  @override
  String get disappearing7d => '7일';

  @override
  String get changeAvatar => '아바타 변경';

  @override
  String get uploadFailed => '업로드 실패, 다시 시도하세요';

  @override
  String get lastSeenJustNow => '방금 활동';

  @override
  String lastSeenMinutes(int minutes) {
    return '$minutes분 전 활동';
  }

  @override
  String lastSeenHours(int hours) {
    return '$hours시간 전 활동';
  }

  @override
  String lastSeenDays(int days) {
    return '$days일 전 활동';
  }

  @override
  String get dateToday => '오늘';

  @override
  String get dateYesterday => '어제';

  @override
  String get attachPhoto => '사진';

  @override
  String get attachVideo => '동영상';

  @override
  String get uploading => '업로드 중…';

  @override
  String get downloadMedia => '다운로드';

  @override
  String get attachmentLabel => '📎 첨부파일';
}
