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
    return '$count명';
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
  String get actionEdit => '편집';

  @override
  String get messageEdited => '(편집됨)';

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
  String get attachFile => '파일';

  @override
  String get uploading => '업로드 중…';

  @override
  String get downloadMedia => '다운로드';

  @override
  String get attachmentLabel => '📎 첨부파일';

  @override
  String get callIncoming => '수신 전화';

  @override
  String callIncomingBody(String name) {
    return '$name님이 전화하고 있습니다';
  }

  @override
  String callCalling(String name) {
    return '$name님에게 전화 거는 중…';
  }

  @override
  String get callConnecting => '연결 중…';

  @override
  String get callMediaError => '카메라/마이크에 접근할 수 없습니다 (HTTPS 또는 localhost 필요)';

  @override
  String get callUnknownCaller => '누군가';

  @override
  String get profileTitle => '프로필';

  @override
  String get editProfile => '프로필 편집';

  @override
  String get bio => '소개';

  @override
  String friendsCountLabel(int count) {
    return '친구 $count명';
  }

  @override
  String get messageAction => '메시지';

  @override
  String get activeFriends => '온라인 친구';

  @override
  String get noFriendsOnline => '온라인 친구가 없습니다';

  @override
  String get strangerBannerTitle => '메시지 요청';

  @override
  String get strangerBannerBody => '이 사람은 연락처에 없습니다. 답장하려면 수락하세요.';

  @override
  String get acceptRequest => '수락';

  @override
  String get rejectRequest => '거절';

  @override
  String get friends => '친구';

  @override
  String get contacts => '연락처';

  @override
  String get friendRequests => '친구 요청';

  @override
  String get addFriend => '친구 추가';

  @override
  String get friendRequestSent => '친구 요청을 보냈습니다';

  @override
  String get acceptFriend => '수락';

  @override
  String get noFriends => '아직 친구가 없습니다';

  @override
  String get noFriendRequests => '대기 중인 요청이 없습니다';

  @override
  String get friendRequestPending => '대기 중';

  @override
  String get unfriend => '친구 삭제';

  @override
  String get unfriendConfirm => '이 친구를 삭제할까요?';

  @override
  String get blockUser => '차단';

  @override
  String get unblockUser => '차단 해제';

  @override
  String get blockUserConfirm => '이 사용자를 차단할까요? 서로 메시지를 보낼 수 없습니다.';

  @override
  String get blockedComposerNotice => '이 대화에는 메시지를 보낼 수 없습니다';

  @override
  String get userBlocked => '사용자를 차단했습니다';

  @override
  String get userUnblocked => '차단을 해제했습니다';

  @override
  String get mentionNotificationTitle => '회원님을 언급함';

  @override
  String mentionNotificationBody(String name) {
    return '$name님이 회원님을 언급했습니다';
  }

  @override
  String get searchMessages => '메시지 검색';

  @override
  String get searchHint => '대화에서 검색';

  @override
  String get searchNoResults => '메시지를 찾을 수 없습니다';

  @override
  String get exploreChannels => '채널 탐색';

  @override
  String get searchChannelsHint => '채널 검색…';

  @override
  String get noPublicChannels => '공개 채널을 찾을 수 없습니다';

  @override
  String get joinChannel => '참여';

  @override
  String get pinMessage => '고정';

  @override
  String get forwardMessage => '전달';

  @override
  String get messageForwarded => '메시지가 전달되었습니다';

  @override
  String get forwardFailed => '메시지 전달 실패';

  @override
  String get noConversationsToForward => '전달할 대화가 없습니다';

  @override
  String get rateLimitError => '메시지를 너무 많이 보내고 있습니다. 잠시 후 다시 시도하세요.';

  @override
  String get sharedMediaTitle => '공유 미디어 및 파일';

  @override
  String get tabMedia => '미디어';

  @override
  String get tabFiles => '파일';

  @override
  String get tabLinks => '링크';

  @override
  String get noMediaFound => '미디어를 찾을 수 없습니다';

  @override
  String get noFilesFound => '파일을 찾을 수 없습니다';

  @override
  String get noLinksFound => '링크를 찾을 수 없습니다';

  @override
  String get reactionsDetail => '리액션';

  @override
  String get changePasswordTitle => '비밀번호 변경';

  @override
  String get currentPassword => '현재 비밀번호';

  @override
  String get newPassword => '새 비밀번호';

  @override
  String get confirmPassword => '새 비밀번호 확인';

  @override
  String get dateOfBirth => '생년월일';

  @override
  String get notSet => '설정되지 않음';

  @override
  String get passwordChangedSuccess => '비밀번호가 성공적으로 변경되었습니다';

  @override
  String get errCurrentPasswordIncorrect => '현재 비밀번호가 올바르지 않습니다';

  @override
  String get changeCoverPhoto => '배경 사진 변경';

  @override
  String get markAsRead => '읽음으로 표시';

  @override
  String get markAsUnread => '읽지 않음으로 표시';

  @override
  String get muteNotifications => '알림 음소거';

  @override
  String get unmuteNotifications => '알림 음소거 해제';

  @override
  String get viewProfile => '프로필 보기';

  @override
  String get voiceCall => '음성 통화';

  @override
  String get videoCall => '영상 통화';

  @override
  String get archiveChat => '채팅 보관';

  @override
  String get unarchiveChat => '채팅 보관 해제';

  @override
  String get mutedLabel => '음소거됨';

  @override
  String get newNotificationTitle => '새 메시지';

  @override
  String newNotificationBody(String name) {
    return '$name님이 메시지를 보냈습니다';
  }

  @override
  String get archivedChats => '보관된 채팅';

  @override
  String get archivedChatsSubtitle => '보관된 대화 보기';

  @override
  String get emptyArchivedChats => '보관된 채팅이 없습니다';

  @override
  String get webNoChatSelected => '대화를 선택하여 채팅을 시작하세요';

  @override
  String get endToEndEncrypted => '종단 간 암호화';

  @override
  String get chatInfoCategory => '채팅 세부 정보';

  @override
  String get customizeChatCategory => '채팅 사용자 지정';

  @override
  String get filesAndMediaCategory => '미디어, 파일 및 링크';

  @override
  String get privacyAndSupportCategory => '개인 정보 보호 및 지원';

  @override
  String get callSelectMember => '통화할 멤버를 선택하세요';

  @override
  String get profileHideInfo => '개인 정보 숨기기';

  @override
  String get profileInfoHidden => '개인 정보가 숨겨져 있습니다';

  @override
  String get profileGender => '성별';

  @override
  String get profilePhone => '전화번호';

  @override
  String get profileBio => '소개';

  @override
  String get profileDateOfBirth => '생년월일';

  @override
  String get profileEditMode => '프로필 편집';

  @override
  String get profileSave => '저장';

  @override
  String get actionMessage => '메시지';

  @override
  String get actionAddFriend => '친구 추가';

  @override
  String get actionBlock => '차단';

  @override
  String get readDetails => '읽음 상세';

  @override
  String get seenStatus => '읽음';

  @override
  String get noReadsYet => '아직 아무도 읽지 않았습니다';

  @override
  String get voiceMicTooltip => '음성 메시지';

  @override
  String get recording => '녹음 중...';

  @override
  String get stickerLabel => '스티커';

  @override
  String get emojiTab => '이모지';

  @override
  String get aiAssistant => 'AI 어시스턴트';

  @override
  String get startChatWithAI => 'PON AI와 채팅';

  @override
  String get aiThinking => 'AI가 생각 중...';

  @override
  String get aiError => 'AI를 일시적으로 사용할 수 없습니다. 다시 시도해주세요.';

  @override
  String get aiErrorRetry => '다시 시도';

  @override
  String get aiMessageDeleted => '메시지가 삭제되었습니다';

  @override
  String get aiMemoryTitle => 'AI 메모리';

  @override
  String get aiMemoryEmptyState => '아직 메모리가 없습니다. PON AI와 채팅하여 메모리를 만들어 보세요.';

  @override
  String get aiMemoryDeleteConfirm =>
      '이 메모리를 삭제하시겠습니까? AI는 더 이상 이 대화의 컨텍스트를 기억하지 않습니다.';

  @override
  String get aiMemoryDeleted => '메모리가 삭제되었습니다';

  @override
  String aiMemoryUpdated(String date) {
    return '$date에 업데이트됨';
  }

  @override
  String get aiMemoryFacts => '주요 사실:';

  @override
  String get viewAiMemory => '메모리 보기';

  @override
  String get kbTitle => '지식 베이스';

  @override
  String get kbEmptyState =>
      '문서가 없습니다.\n업로드 버튼을 눌러 PDF, DOCX 또는 TXT 파일을 추가하세요.';

  @override
  String get kbUploadButton => '문서 업로드';

  @override
  String get kbDeleteConfirm => '이 문서를 삭제하시겠습니까?';

  @override
  String get kbProcessing => '처리 중';

  @override
  String get kbReady => '준비됨';

  @override
  String get kbError => '오류';

  @override
  String get kbManage => '지식 베이스';

  @override
  String get kbSources => '출처';

  @override
  String get kbChunks => '청크';

  @override
  String aiToolCalling(String toolName) {
    return '도구 사용 중: $toolName';
  }

  @override
  String get aiToolTrace => '도구 로그';

  @override
  String get toolSearchMessages => '메시지 검색 중...';

  @override
  String get toolGetUserInfo => '사용자 정보 조회 중...';

  @override
  String get toolSearchKnowledgeBase => '지식 베이스 검색 중...';

  @override
  String get toolSummarizeConversation => '대화 요약 중...';

  @override
  String get toolCreateReminder => '알림 생성 중...';

  @override
  String get reminders => '알림';

  @override
  String get remindersEmpty => '대기 중인 알림이 없습니다.\nPON AI에게 알림을 설정해 달라고 해보세요.';

  @override
  String get reminderDone => '완료로 표시';
}
