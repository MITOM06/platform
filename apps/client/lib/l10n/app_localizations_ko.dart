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
  String get notificationsTitle => '알림';

  @override
  String get notificationsSectionUnread => '읽지 않음';

  @override
  String get notificationsSectionRead => '읽음';

  @override
  String get notificationsEmpty => '아직 알림이 없습니다';

  @override
  String get notificationsMarkAllRead => '모두 읽음으로 표시';

  @override
  String get notificationAccept => '수락';

  @override
  String get notificationDecline => '거절';

  @override
  String notificationFriendRequestTitle(String name) {
    return '$name님이 친구 요청을 보냈습니다';
  }

  @override
  String notificationFriendAcceptedTitle(String name) {
    return '$name님이 친구 요청을 수락했습니다';
  }

  @override
  String get notificationPhoneSetupTitle => '전화번호 인증';

  @override
  String get notificationPhoneSetupBody =>
      '친구가 회원님을 찾을 수 있고 계정 보안을 강화하도록 전화번호를 추가하고 인증하세요.';

  @override
  String get notificationPasswordSetupTitle => '계정 보호';

  @override
  String get notificationPasswordSetupBody =>
      '계정에 아직 비밀번호가 없습니다. 보안을 강화하려면 비밀번호를 설정하세요.';

  @override
  String get securityTitle => '비밀번호 및 보안';

  @override
  String get securitySubtitle => '비밀번호 변경';

  @override
  String get securityNoPasswordCardSubtitle => '비밀번호 미설정';

  @override
  String get securityNoPasswordTitle => '아직 비밀번호가 설정되지 않았습니다';

  @override
  String get securityNoPasswordSubtitle =>
      '계정을 보호하고 이메일 기반 복구를 사용하려면 비밀번호를 설정하세요.';

  @override
  String get securityChangePasswordTitle => '비밀번호 변경';

  @override
  String get securityChangePasswordSubtitle => '현재 비밀번호를 업데이트합니다.';

  @override
  String get securitySetPasswordTitle => '비밀번호 설정';

  @override
  String get securitySetPasswordSubtitle => '보안 강화를 위해 계정에 비밀번호를 추가하세요.';

  @override
  String get securitySetButton => '비밀번호 설정';

  @override
  String get securityChangeButton => '비밀번호 변경';

  @override
  String get securitySetSuccess => '비밀번호가 설정되었습니다';

  @override
  String get securityTwoFaTitle => '2단계 인증';

  @override
  String get securityTwoFaSubtitle => '계정에 추가 보안 계층을 더합니다.';

  @override
  String get securityTwoFaComingSoon => '2단계 인증은 곧 제공될 예정입니다.';

  @override
  String get securityComingSoon => '곧 제공';

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
  String get errSlow => '연결이 너무 느립니다. 다시 시도하세요';

  @override
  String get errSessionExpired => '로그인 세션이 만료되었습니다';

  @override
  String get errForbidden => '이 작업을 수행할 권한이 없습니다';

  @override
  String get errNotFound => '데이터를 찾을 수 없습니다';

  @override
  String get errConflict => '이미 존재하는 데이터입니다';

  @override
  String get errInvalidData => '유효하지 않은 데이터입니다';

  @override
  String get errServer => '서버 오류입니다. 잠시 후 다시 시도하세요';

  @override
  String errRequestFailed(String code) {
    return '요청에 실패했습니다 ($code)';
  }

  @override
  String get errCancelled => '요청이 취소되었습니다';

  @override
  String get errConnection => '연결 오류입니다. 다시 시도하세요';

  @override
  String get errGeneric => '오류가 발생했습니다. 다시 시도하세요';

  @override
  String get detailsTitle => '정보';

  @override
  String get themeMenuItem => '테마';

  @override
  String get quickReactionTitle => '빠른 반응';

  @override
  String get wallpaperDefaultName => '기본';

  @override
  String get wallpaperCategoryColors => '심플 색상';

  @override
  String get wallpaperCategoryVibrant => '선명한 그라데이션';

  @override
  String get wallpaperCategoryMinimal => '미니멀';

  @override
  String get wallpaperShowMore => '더 보기';

  @override
  String get wallpaperShowLess => '접기';

  @override
  String get wallpaperCategoryThemes => '테마';

  @override
  String get wallpaperThemeForest => '숲';

  @override
  String get wallpaperThemeOcean => '바다';

  @override
  String get wallpaperThemeMountain => '설산';

  @override
  String get wallpaperThemeCherryBlossom => '벚꽃';

  @override
  String get wallpaperThemeSpace => '우주';

  @override
  String get wallpaperThemeAurora => '오로라';

  @override
  String get wallpaperThemeCityNight => '도시의 밤';

  @override
  String get wallpaperThemeDesert => '사막';

  @override
  String get wallpaperPresetMidnightGlow => '한밤의 빛';

  @override
  String get wallpaperPresetNeonTeal => '네온 틸';

  @override
  String get wallpaperPresetSunset => '노을';

  @override
  String get wallpaperPresetSweetPink => '스위트 핑크';

  @override
  String get wallpaperPresetDarkShadow => '다크 섀도우';

  @override
  String get wallpaperPresetOceanBlue => '오션 블루';

  @override
  String get wallpaperPresetForestGreen => '포레스트 그린';

  @override
  String get wallpaperPresetPurpleHaze => '퍼플 헤이즈';

  @override
  String get wallpaperPresetWarmAmber => '웜 앰버';

  @override
  String get wallpaperPresetRoseGold => '로즈 골드';

  @override
  String get wallpaperPresetStorm => '폭풍';

  @override
  String get wallpaperPresetCherryBlossom => '벚꽃';

  @override
  String get wallpaperPresetMidnightPurple => '미드나잇 퍼플';

  @override
  String get wallpaperPresetCoralReef => '산호초';

  @override
  String get wallpaperPresetArcticIce => '북극 얼음';

  @override
  String get wallpaperPresetAurora => '오로라';

  @override
  String get wallpaperPresetGalaxy => '갤럭시';

  @override
  String get wallpaperPresetFireIce => '불과 얼음';

  @override
  String get wallpaperPresetTropical => '트로피컬';

  @override
  String get wallpaperPresetCandy => '캔디';

  @override
  String get wallpaperPresetPureDark => '퓨어 다크';

  @override
  String get wallpaperPresetSoftGray => '소프트 그레이';

  @override
  String get wallpaperPresetWarmNight => '따뜻한 밤';

  @override
  String get changeChatThemeTitle => '채팅 테마 변경';

  @override
  String get uploadImageButton => '이미지 업로드';

  @override
  String get imageFitLabel => '이미지 맞춤';

  @override
  String get fitCoverLabel => '채우기';

  @override
  String get fitContainLabel => '맞춤';

  @override
  String get fitFillLabel => '늘이기';

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
  String get searchConversationsHint => '대화 검색...';

  @override
  String get noConversationsFound => '대화를 찾을 수 없습니다';

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
  String get tabArchived => '보관됨';

  @override
  String get tabRequests => '요청';

  @override
  String get noRequests => '대기 중인 요청이 없습니다';

  @override
  String get declineRequest => '거절';

  @override
  String get dmRequestSubtitle => '메시지를 보내려고 합니다';

  @override
  String get groupInviteSubtitle => '그룹에 초대했습니다';

  @override
  String get blockedChatsTitle => '차단된 채팅';

  @override
  String get newGroup => '새 그룹';

  @override
  String get newDirect => '새 채팅';

  @override
  String get createGroup => '그룹 만들기';

  @override
  String get groupName => '그룹 이름';

  @override
  String get groupDefaultName => '그룹';

  @override
  String get valGroupNameRequired => '그룹 이름을 입력하세요';

  @override
  String get selectMembers => '멤버 선택';

  @override
  String get valSelectMembers => '멤버를 2명 이상 선택하세요';

  @override
  String get searchUsers => '이름, 이메일 또는 전화번호로 검색';

  @override
  String get phoneSearchHint => '검색하려면 전체 전화번호를 입력하세요';

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
  String get someone => '누군가';

  @override
  String get aiHubTitle => 'AI 허브';

  @override
  String get aiHubSubtitle => 'AI 어시스턴트에 관한 모든 것';

  @override
  String get aiHubStartChat => 'PON AI와 채팅 시작';

  @override
  String get aiHubMemory => '메모리';

  @override
  String get aiHubIntegrations => '커넥터';

  @override
  String get aiHubSkills => '스킬';

  @override
  String get aiHubTokenUsage => '사용량';

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
  String get downloadAction => '다운로드';

  @override
  String get actionReact => '반응';

  @override
  String get messageRecalled => '메시지가 회수되었습니다';

  @override
  String get messageSendFailedRetry => '전송 실패. 눌러서 다시 시도하세요.';

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
  String get attachVoice => '음성 메시지';

  @override
  String get attachSticker => '스티커';

  @override
  String get pinnedMessageTitle => '고정된 메시지';

  @override
  String get pinnedSystemMessage => '시스템 메시지';

  @override
  String get uploading => '업로드 중…';

  @override
  String get downloadMedia => '다운로드';

  @override
  String get imageDownloadHd => 'HD로 보기';

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
  String get callToggleMic => '마이크 전환';

  @override
  String get callToggleCam => '카메라 전환';

  @override
  String get callLeave => '나가기';

  @override
  String get callJoin => '참여';

  @override
  String get callAccept => '수락';

  @override
  String get callDecline => '거절';

  @override
  String get groupCallTitle => '그룹 통화';

  @override
  String groupCallParticipants(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '참여자 $count명',
      one: '참여자 1명',
    );
    return '$_temp0';
  }

  @override
  String get groupCallNotetakerActive => 'AI가 메모하고 있습니다';

  @override
  String get groupCallStartTitle => '그룹 통화 시작';

  @override
  String get groupCallAudio => '음성';

  @override
  String get groupCallVideo => '영상';

  @override
  String get groupCallNotetakerToggle => 'AI 노트테이커';

  @override
  String get groupCallNotetakerHint => 'AI가 대화를 듣고 통화 후 회의 요약을 게시합니다.';

  @override
  String get groupCallStartAction => '통화 시작';

  @override
  String activeCallBanner(int count) {
    return '그룹 통화 · $count명 참여';
  }

  @override
  String get incomingGroupCallTitle => '수신 그룹 통화';

  @override
  String incomingGroupCallBody(String name) {
    return '$name님이 그룹 통화를 시작했습니다';
  }

  @override
  String get meetingSummaryTitle => '회의 요약';

  @override
  String meetingSummaryDuration(String duration) {
    return '통화 시간 $duration';
  }

  @override
  String meetingSummaryAttendees(String names) {
    return '참석자: $names';
  }

  @override
  String get meetingSummaryOverview => '개요';

  @override
  String get meetingSummaryKeyPoints => '핵심 내용';

  @override
  String get meetingSummaryActionItems => '할 일';

  @override
  String get profileTitle => '프로필';

  @override
  String get profileRoleLabel => '역할';

  @override
  String get profileRoleMemberDefault => '멤버';

  @override
  String get roleLabel => '역할';

  @override
  String get privacySectionLabel => '개인정보';

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
  String get friendsTabSearch => '검색';

  @override
  String get declineFriend => '거절';

  @override
  String get searchUsersPrompt => '친구로 추가할 사람 검색';

  @override
  String get noSearchResults => '사용자를 찾을 수 없습니다';

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
  String get unpinMessage => '고정 해제';

  @override
  String get pinnedMessagesTitle => '고정된 메시지';

  @override
  String get pinLimitReached => '메시지는 최대 2개까지 고정할 수 있습니다';

  @override
  String get cannotPinCall => '통화는 고정할 수 없습니다';

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
  String get aiPersonality => '성격';

  @override
  String get aiMemory => '메모리';

  @override
  String get aiSkills => '스킬';

  @override
  String get adminOwnerOnly => '관리자 또는 소유자만 가능';

  @override
  String get aiConnectedApps => '연결된 앱';

  @override
  String get aiUsage => '사용량';

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
  String get profileShowDateOfBirth => '다른 사람에게 생년월일 표시';

  @override
  String get profileShowPhone => '다른 사람에게 전화번호 표시';

  @override
  String get profileShowGender => '다른 사람에게 성별 표시';

  @override
  String get phoneVerifiedBadge => '인증됨';

  @override
  String get phoneSendOtp => '인증 코드 보내기';

  @override
  String get phoneSending => '보내는 중...';

  @override
  String get phoneChangeNumber => '번호 변경';

  @override
  String get phoneNotVerified => '인증되지 않음';

  @override
  String get phoneSendOtpError => '코드를 보낼 수 없습니다. 나중에 다시 시도하세요.';

  @override
  String get phoneVerifyTitle => '전화번호 인증';

  @override
  String phoneOtpSubtitle(String phone) {
    return '$phone(으)로 전송된 6자리 코드를 입력하세요';
  }

  @override
  String get phoneOtpIncomplete => '6자리를 모두 입력하세요';

  @override
  String get phoneOtpInvalid => '코드가 잘못되었거나 만료되었습니다';

  @override
  String get phoneVerifiedSuccess => '전화번호가 인증되었습니다!';

  @override
  String get phoneVerifying => '인증 중...';

  @override
  String get phoneConfirm => '확인';

  @override
  String get phoneHint => '901 234 567';

  @override
  String get phoneNoNumber => '전화번호 없음';

  @override
  String get phoneNoticeText => '계정 보안을 강화하려면 전화번호를 추가하세요.';

  @override
  String get phoneVerifyAction => '인증';

  @override
  String get phoneUnverifiedBadge => '미인증';

  @override
  String get phoneModalPhoneSubtitle => '인증 코드를 받을 전화번호를 입력하세요.';

  @override
  String get phoneRateLimit => '새 코드를 요청하기 전에 잠시 기다려 주세요.';

  @override
  String get phoneAlreadyTaken => '이미 사용 중인 전화번호입니다.';

  @override
  String get phoneInvalidNumber => '유효하지 않은 전화번호입니다.';

  @override
  String get phoneOtpExpired => '코드가 만료되었습니다. 새 코드를 요청하세요.';

  @override
  String get phoneResend => '코드 재전송';

  @override
  String phoneResendCountdown(int seconds) {
    return '$seconds초 후 재전송';
  }

  @override
  String get profilePrivacySection => '개인정보 보호';

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
  String get aiErrStreamInterrupted => 'AI 스트림이 중단되었습니다. 다시 시도해 주세요.';

  @override
  String get aiErrUnavailable => 'AI를 일시적으로 사용할 수 없습니다.';

  @override
  String get aiErrRateLimited => 'AI 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';

  @override
  String get feedbackHelpful => '도움이 됨';

  @override
  String get feedbackNotHelpful => '도움이 안 됨';

  @override
  String get feedbackCommentHint => '무엇이 잘못되었는지 알려주세요 (선택)';

  @override
  String get feedbackThanks => '피드백 감사합니다';

  @override
  String get feedbackSend => '보내기';

  @override
  String get feedbackError => '피드백을 제출할 수 없습니다. 다시 시도해 주세요.';

  @override
  String get aiSensitiveAction => '민감한 작업';

  @override
  String get sourcesLabel => '출처';

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

  @override
  String get tokenUsage => '토큰 사용량';

  @override
  String get tokenUsageTitle => '토큰 사용량 대시보드';

  @override
  String get tokenUsageSelectRange => '기간 선택';

  @override
  String get tokenUsageDateRangeError => '시작일은 종료일보다 이전이어야 합니다';

  @override
  String get coverPhotoPreviewTitle => '커버 사진 미리보기';

  @override
  String get saveCoverPhoto => '커버로 설정';

  @override
  String get tokenUsageThisMonth => '이번 달 총 토큰';

  @override
  String get tokenUsageRequests => 'AI 요청 수';

  @override
  String get tokenUsageEstCost => '예상 비용 (USD)';

  @override
  String get tokenUsageDailyChart => '일별 토큰 사용량 (최근 30일)';

  @override
  String get aiTraceTitle => 'AI 추적';

  @override
  String get aiTraceThinking => '사고 과정';

  @override
  String get aiTraceTools => '도구 호출';

  @override
  String get aiTraceStats => '통계';

  @override
  String get aiPersonaTitle => 'AI 페르소나';

  @override
  String get avatarUploadLabel => '아바타 변경';

  @override
  String get aiPersonaNameHint => '봇 이름 (예: DevBot)';

  @override
  String get aiPersonaInstructionsHint => '맞춤 지시사항 (예: 항상 목록 형식으로 답변)';

  @override
  String get aiPersonaAdminOnly => '그룹 관리자만 AI 페르소나를 설정할 수 있습니다.';

  @override
  String get configureAiPersona => 'AI 페르소나 설정';

  @override
  String get aiPersonaToneFriendly => '친근함';

  @override
  String get aiPersonaToneProfessional => '전문적';

  @override
  String get aiPersonaToneConcise => '간결함';

  @override
  String get aiPersonaToneCreative => '창의적';

  @override
  String get aiQuotaExceeded => '월간 AI 사용 할당량을 초과했습니다. 관리자에게 문의하세요.';

  @override
  String get viewUsage => '사용량 보기';

  @override
  String get tokenUsageQuota => '월간 할당량';

  @override
  String get errEmailDomainInvalid => '이 이메일 주소는 존재하지 않습니다';

  @override
  String get valPasswordMin8 => '비밀번호는 8자 이상이어야 합니다';

  @override
  String get valPasswordUppercase => '대문자(A-Z)를 포함해야 합니다';

  @override
  String get valPasswordLowercase => '소문자(a-z)를 포함해야 합니다';

  @override
  String get valPasswordDigit => '숫자(0-9)를 포함해야 합니다';

  @override
  String get valPasswordSpecial => '특수문자(!@#\$%^&*)를 포함해야 합니다';

  @override
  String get pwStrengthWeak => '약함';

  @override
  String get pwStrengthMedium => '보통';

  @override
  String get pwStrengthStrong => '강함';

  @override
  String get pwStrengthVeryStrong => '매우 강함';

  @override
  String get pwReqLength => '8자 이상';

  @override
  String get pwReqUppercase => '대문자 (A-Z)';

  @override
  String get pwReqLowercase => '소문자 (a-z)';

  @override
  String get pwReqDigit => '숫자 (0-9)';

  @override
  String get pwReqSpecial => '특수문자 (!@#\$...)';

  @override
  String get loginWithGoogle => 'Google로 로그인';

  @override
  String get registerWithGoogle => 'Google로 가입';

  @override
  String get orContinueWith => '또는 다음으로 계속하기';

  @override
  String agreeToTerms(String privacyPolicy, String termsOfService) {
    return '$privacyPolicy 및 $termsOfService에 동의합니다';
  }

  @override
  String get privacyPolicy => '개인정보 처리방침';

  @override
  String get termsOfService => '서비스 약관';

  @override
  String get valMustAgreeTerms => '가입하려면 서비스 약관에 동의해야 합니다';

  @override
  String get youColon => '나:';

  @override
  String get systemNicknameChanged => '별명이 변경되었습니다';

  @override
  String get systemThemeChanged => '채팅 테마가 변경되었습니다';

  @override
  String get systemQuickReactionChanged => '빠른 반응이 변경되었습니다';

  @override
  String get wallpaperUploadError => '이미지 업로드에 실패했습니다';

  @override
  String get wallpaperScale => '크기';

  @override
  String get wallpaperPreviewHint => '손가락으로 확대하거나 드래그하여 조정하세요';

  @override
  String get wallpaperPreviewIncoming => '안녕하세요! 이렇게 보이는 거 어떤가요?';

  @override
  String get wallpaperPreviewOutgoing => '아주 좋아요 🎉';

  @override
  String get errCannotOpenLink => '링크를 열 수 없습니다';

  @override
  String sysNicknameClearedSelf(String actorName) {
    return '$actorName님이 자신의 별명을 삭제했습니다';
  }

  @override
  String sysNicknameClearedOther(String actorName, String targetName) {
    return '$actorName님이 $targetName님의 별명을 삭제했습니다';
  }

  @override
  String sysNicknameSetSelf(String actorName, String nickname) {
    return '$actorName님이 자신의 별명을 $nickname(으)로 설정했습니다';
  }

  @override
  String sysNicknameSetOther(
      String actorName, String targetName, String nickname) {
    return '$actorName님이 $targetName님의 별명을 $nickname(으)로 설정했습니다';
  }

  @override
  String sysThemeChanged(String actorName) {
    return '$actorName님이 채팅 테마를 변경했습니다';
  }

  @override
  String sysQuickReactionChanged(String actorName, String emoji) {
    return '$actorName님이 빠른 반응을 $emoji(으)로 변경했습니다';
  }

  @override
  String sysGroupCreated(String actorName) {
    return '$actorName님이 그룹을 만들었습니다';
  }

  @override
  String sysMembersAdded(String actorName) {
    return '$actorName님이 새 멤버를 추가했습니다';
  }

  @override
  String sysMemberLeft(String actorName) {
    return '$actorName님이 그룹을 나갔습니다';
  }

  @override
  String sysMemberRemoved(String actorName) {
    return '$actorName님이 멤버를 내보냈습니다';
  }

  @override
  String sysMemberJoined(String actorName) {
    return '$actorName님이 그룹에 참여했습니다';
  }

  @override
  String sysPinnedMessage(String actorName) {
    return '$actorName님이 메시지를 고정했습니다';
  }

  @override
  String sysUnpinnedMessage(String actorName) {
    return '$actorName님이 메시지 고정을 해제했습니다';
  }

  @override
  String systemVideoCallEnded(String duration) {
    return '영상 통화 종료 · $duration';
  }

  @override
  String systemVoiceCallEnded(String duration) {
    return '음성 통화 종료 · $duration';
  }

  @override
  String get systemVideoCallMissed => '부재중 영상 통화';

  @override
  String get systemVoiceCallMissed => '부재중 음성 통화';

  @override
  String get errActionFailed => '문제가 발생했습니다. 다시 시도해 주세요.';

  @override
  String get kbDeleteFailed => '삭제에 실패했습니다. 다시 시도해 주세요';

  @override
  String get exploreJoinFailed => '채널 참여에 실패했습니다';

  @override
  String get unnamedChannel => '이름 없음';

  @override
  String get actionOk => '확인';

  @override
  String get reminderDeleteConfirm => '이 알림을 삭제할까요?';

  @override
  String get profileNameLabel => '이름';

  @override
  String get genderMale => '남성';

  @override
  String get genderFemale => '여성';

  @override
  String get genderOther => '기타';

  @override
  String get aiPersonaSaved => '저장됨';

  @override
  String get aiPersonaResetTitle => 'AI 페르소나 초기화';

  @override
  String get aiPersonaResetConfirm => 'AI 페르소나를 기본 설정으로 초기화할까요?';

  @override
  String get aiPersonaToneLabel => '말투';

  @override
  String get aiPersonaResetToDefault => '기본값으로 초기화';

  @override
  String tokenUsagePercentUsed(String percent) {
    return '이번 달 $percent% 사용';
  }

  @override
  String tokenUsageCostUsd(String amount) {
    return '$amount 달러';
  }

  @override
  String get notifications => '알림';

  @override
  String get notificationsEnabled => '알림이 켜져 있습니다';

  @override
  String get notificationsDisabled => '알림이 꺼져 있습니다';

  @override
  String get legalScreenTitle => '개인정보 및 약관';

  @override
  String get legalLastUpdated => '최종 업데이트: 2026년 6월 15일';

  @override
  String get legalDataCollectionTitle => '1. 데이터 수집';

  @override
  String get legalDataCollectionContent =>
      '당사는 계정 생성 또는 수정, 서비스 이용, 당사와의 커뮤니케이션 시 귀하가 직접 제공하는 정보(이름, 이메일 주소, 프로필 사진, 전송한 메시지 등)를 수집합니다.';

  @override
  String get legalDataUsageTitle => '2. 데이터 사용 방법';

  @override
  String get legalDataUsageContent =>
      '귀하의 데이터는 사용자 간 통신 촉진, 보안 확보, 맞춤형 경험 제공을 포함하여 서비스를 제공, 유지 및 개선하는 데 사용됩니다.';

  @override
  String get legalSecurityTitle => '3. 보안';

  @override
  String get legalSecurityContent =>
      '당사는 귀하의 개인정보와 메시지를 보호하기 위해 업계 표준 보안 조치를 시행합니다. 데이터 접근은 엄격히 통제되며, 민감한 정보 보호를 위해 암호화를 사용합니다.';

  @override
  String get legalUserRightsTitle => '4. 귀하의 권리';

  @override
  String get legalUserRightsContent =>
      '귀하는 개인 데이터에 대한 접근, 수정 또는 삭제 권리를 갖습니다. 언제든지 애플리케이션 설정을 통해 계정을 삭제할 수 있습니다.';

  @override
  String get legalTermsTitle => '5. 서비스 이용약관';

  @override
  String get legalTermsContent =>
      '당사 플랫폼을 사용함으로써 귀하는 학대, 괴롭힘 또는 불법 활동에 참여하지 않을 것에 동의합니다. 당사는 이러한 약관을 위반하는 계정을 정지하거나 종료할 권리를 보유합니다.';

  @override
  String get authMsgLoginSuccess => '로그인에 성공했습니다.';

  @override
  String get authMsgLogoutSuccess => '로그아웃되었습니다.';

  @override
  String get authMsgOtpSent => 'OTP가 이메일로 전송되었습니다.';

  @override
  String get authMsgOtpValid => 'OTP 인증에 성공했습니다.';

  @override
  String get authMsgOtpResent => '새 OTP가 전송되었습니다.';

  @override
  String get authMsgPasswordUpdated => '비밀번호가 성공적으로 업데이트되었습니다. 다시 로그인하세요.';

  @override
  String get authMsgRegisterSuccess => '등록이 완료되었습니다. OTP가 이메일로 전송되었습니다.';

  @override
  String get authMsgAccountUnverifiedOtpSent =>
      '계정이 아직 인증되지 않았습니다. 새 OTP가 이메일로 전송되었습니다.';

  @override
  String get authErrOtpInvalid => 'OTP 코드가 유효하지 않습니다.';

  @override
  String get authErrOtpExpired => 'OTP가 만료되었습니다.';

  @override
  String get authErrOtpAttemptsExceeded => '시도 횟수를 초과했습니다. 새 OTP를 요청하세요.';

  @override
  String authErrOtpWrongWithRemaining(int remaining) {
    return 'OTP가 틀렸습니다. 남은 시도 횟수: $remaining회.';
  }

  @override
  String authErrOtpResendCooldown(int ttl) {
    return '새 OTP를 요청하기 전에 $ttl초 기다려 주세요.';
  }

  @override
  String get authErrEmailDomainInvalid => '이메일 도메인이 존재하지 않거나 MX 레코드가 없습니다.';

  @override
  String get authErrEmailNotFound => '시스템에 해당 이메일이 존재하지 않습니다.';

  @override
  String get authErrEmailInUse => '이 이메일은 이미 사용 중입니다.';

  @override
  String get authErrValEmailInvalid => '이메일 형식이 올바르지 않습니다.';

  @override
  String get authErrValEmailRequired => '이메일은 필수 항목입니다.';

  @override
  String get authErrValDisplaynameRequired => '표시 이름은 필수 항목입니다.';

  @override
  String get authErrValDisplaynameTooShort => '표시 이름이 너무 짧습니다 (최소 2자).';

  @override
  String get authErrValPasswordTooShort => '비밀번호는 최소 8자 이상이어야 합니다.';

  @override
  String authErrAccountLocked(int minutes) {
    return '로그인 실패 횟수가 너무 많아 계정이 $minutes분 동안 잠겼습니다.';
  }

  @override
  String authErrLoginFailedWithRemaining(int remaining) {
    return '이메일 또는 비밀번호가 올바르지 않습니다. 남은 시도 횟수: $remaining회.';
  }

  @override
  String authErrLoginFailedLocked(int minutes) {
    return '로그인 실패 횟수가 너무 많습니다. 계정이 $minutes분 동안 잠겼습니다.';
  }

  @override
  String get authErrTokenInvalid => '토큰이 유효하지 않습니다.';

  @override
  String get authErrSessionNotFound => '세션을 찾을 수 없거나 만료되었습니다.';

  @override
  String get authErrSessionInvalid => '세션이 존재하지 않거나 만료되었습니다.';

  @override
  String get authErrSessionRevoked => '세션이 취소되었습니다.';

  @override
  String get authErrRefreshTokenReuse =>
      '보안 경고: 리프레시 토큰 재사용이 감지되었습니다. 모든 세션이 취소되었습니다.';

  @override
  String get authErrRefreshTokenInvalid => '리프레시 토큰이 유효하지 않습니다.';

  @override
  String get authErrRefreshTokenRotated => '리프레시 토큰이 이미 교체되었습니다.';

  @override
  String get authErrTokenSessionMismatch => '토큰이 세션과 일치하지 않습니다.';

  @override
  String get authErrSocialEmailUnavailable => '소셜 계정에서 이메일을 가져올 수 없습니다.';

  @override
  String get authErrLoginCodeInvalid => '로그인 코드가 유효하지 않거나 만료되었습니다.';

  @override
  String get authErrUserNotFound => '사용자를 찾을 수 없습니다.';

  @override
  String get integrationsTitle => '연동';

  @override
  String get integrationsSubtitle =>
      '계정을 한 번만 연결하세요. 이후에는 어시스턴트에게 메시지만 보내면 됩니다 — 부여한 권한 내에서만 대신 처리합니다.';

  @override
  String get integrationsSettingsSubtitle => '어시스턴트가 사용할 도구 연결';

  @override
  String get connectorStatusConnected => '연결됨';

  @override
  String get connectorStatusAvailable => '사용 가능';

  @override
  String get connectorStatusComingSoon => '출시 예정';

  @override
  String get connectorConnect => '연결';

  @override
  String get connectorManage => '관리';

  @override
  String get connectorDisconnect => '연결 해제';

  @override
  String get connectorDisconnectConfirm =>
      '이 계정의 연결을 해제할까요? 어시스턴트가 해당 도구에 접근할 수 없게 됩니다.';

  @override
  String get connectorOpenFailed => '인증 페이지를 열 수 없습니다.';

  @override
  String get customMcpTitle => '맞춤 MCP 서버 추가';

  @override
  String get customMcpSubtitle =>
      '어시스턴트를 원하는 MCP 서버로 연결하세요. 도구를 탐색해 어시스턴트가 사용할 수 있게 합니다.';

  @override
  String get customMcpName => '이름';

  @override
  String get customMcpUrl => '서버 URL';

  @override
  String get customMcpAuth => '인증';

  @override
  String get customMcpAuthNone => '없음';

  @override
  String get customMcpAuthApiKey => 'API 키';

  @override
  String get customMcpAuthOauth => 'OAuth';

  @override
  String get customMcpCredential => '자격 증명';

  @override
  String get customMcpDiscover => '도구 탐색';

  @override
  String get customMcpSave => '저장';

  @override
  String get customMcpSaved => '맞춤 MCP 서버를 추가했습니다.';

  @override
  String customMcpToolsFound(int count) {
    return '도구 $count개 발견';
  }

  @override
  String get permissionsTitle => 'AI 권한';

  @override
  String get permissionsSubtitle => '이 커넥터를 통해 어시스턴트가 수행할 수 있는 작업을 선택하세요.';

  @override
  String get permView => '보기';

  @override
  String get permCreate => '생성';

  @override
  String get permEdit => '편집';

  @override
  String get permDelete => '삭제';

  @override
  String get permViewDesc => '데이터 읽기, 검색, 요약 (읽기 전용).';

  @override
  String get permCreateDesc => '파일, 일정, 레코드 등 새 항목을 추가합니다.';

  @override
  String get permEditDesc => '기존 항목과 내용을 수정합니다.';

  @override
  String get permDeleteDesc => '항목을 영구적으로 삭제합니다.';

  @override
  String get permManage => '권한';

  @override
  String get permSaved => '권한이 업데이트되었습니다.';

  @override
  String get skillsTitle => '스킬';

  @override
  String get skillsSubtitle =>
      '스킬은 도구 모음과 작업 방식을 묶습니다. 필요한 것만 켜세요 — 각 스킬이 필요한 항목을 알려줍니다.';

  @override
  String get skillsRealActionNote =>
      '스킬은 어시스턴트가 생각하고 말하는 방식을 바꿉니다. 실제로 작동하게 하려면(메일 전송, 일정 생성, Notion에 기록 등) 아래의 해당 앱을 연결하세요.';

  @override
  String get skillsSettingsSubtitle => '어시스턴트의 장점을 선택하세요';

  @override
  String skillNeeds(String requirements) {
    return '$requirements 필요';
  }

  @override
  String get skillSchedulerName => '일정 관리';

  @override
  String get skillSchedulerDesc =>
      '회의 시간을 제안하고 초대장을 작성해 줍니다 — 전송은 캘린더/메일 앱에서 직접 하세요(또는 Google 캘린더/Gmail을 연결하면 직접 처리할 수 있습니다).';

  @override
  String get skillMailWriterName => '메일 작성';

  @override
  String get skillMailWriterDesc => '당신의 어조로 답장을 작성하고 긴 스레드를 요약합니다.';

  @override
  String get skillResearcherName => '리서처';

  @override
  String get skillResearcherDesc =>
      '이 대화 내용과 기존 지식을 바탕으로 답하며 가능한 경우 출처를 표시합니다 — 실시간 웹 검색이 아닙니다.';

  @override
  String get skillProjectKeeperName => '프로젝트 관리';

  @override
  String get skillProjectKeeperDesc =>
      '대화에서 작업, 담당자, 결정 사항을 추적하고 요약합니다 — Notion을 연결하면 실제로 기록할 수 있습니다.';

  @override
  String get skillMeetingNotesName => '회의록';

  @override
  String get skillMeetingNotesDesc => '회의를 요약하고 결정 사항과 실행 항목을 정리합니다.';

  @override
  String get skillInboxTriageName => '받은 편지함 정리';

  @override
  String get skillInboxTriageDesc => '메시지 우선순위를 정하고 빠른 답장을 제안합니다.';

  @override
  String get skillDataAnalystName => '데이터 분석가';

  @override
  String get skillDataAnalystDesc => '표와 수치를 분석하여 추세와 이상치를 드러냅니다.';

  @override
  String get skillDocDrafterName => '문서 작성';

  @override
  String get skillDocDrafterDesc => '구조화된 제안서, 사양서, 보고서를 작성합니다.';

  @override
  String get skillTranslatorName => '번역';

  @override
  String get skillTranslatorDesc => '여러 언어로 텍스트를 자연스럽게 번역하고 현지화합니다.';

  @override
  String get skillWebSearchName => '웹 검색';

  @override
  String get skillWebSearchDesc => '웹에서 최신 정보를 찾고 출처를 인용합니다.';

  @override
  String get skillWeatherForecastName => '날씨 예보';

  @override
  String get skillWeatherForecastDesc => '모든 위치의 날씨와 예보를 조회합니다.';

  @override
  String get adminTitle => '관리자 콘솔';

  @override
  String get adminSubtitle => '워크스페이스, 부서, 멤버, 역할을 관리';

  @override
  String get adminBack => '뒤로';

  @override
  String get adminLoading => '불러오는 중…';

  @override
  String get adminSave => '저장';

  @override
  String get adminSaving => '저장 중…';

  @override
  String get adminCancel => '취소';

  @override
  String get adminToastSaved => '저장됨';

  @override
  String get adminToastDeleted => '삭제됨';

  @override
  String get adminToastError => '문제가 발생했습니다';

  @override
  String get adminMenu => '관리자';

  @override
  String get adminSettingsSubtitle => '워크스페이스, 부서, 멤버 및 역할';

  @override
  String get adminNavWorkspace => '워크스페이스';

  @override
  String get adminNavDepartments => '부서';

  @override
  String get adminNavMembers => '멤버';

  @override
  String get adminNavRoles => '역할';

  @override
  String get adminNavAudit => '감사 로그';

  @override
  String get adminNavAi => 'AI 어시스턴트';

  @override
  String get adminAiInheritHint => '비워 두거나 \"상속\"을 선택하면 서버 기본값을 사용합니다.';

  @override
  String get adminAiInheritOption => '상속 (기본값)';

  @override
  String get adminAiOn => '켜기';

  @override
  String get adminAiOff => '끄기';

  @override
  String get adminAiPersonaSection => '페르소나';

  @override
  String get adminAiPersonaName => '기본 어시스턴트 이름';

  @override
  String get adminAiTone => '기본 톤';

  @override
  String get adminAiToneFriendly => '친근함';

  @override
  String get adminAiToneProfessional => '전문적';

  @override
  String get adminAiToneConcise => '간결함';

  @override
  String get adminAiToneCreative => '창의적';

  @override
  String get adminAiModelSection => '모델';

  @override
  String get adminAiModelTier => '기본 모델 등급';

  @override
  String get adminAiTierAuto => '자동 (라우터)';

  @override
  String get adminAiTierSimple => '단순';

  @override
  String get adminAiTierMid => '균형';

  @override
  String get adminAiTierComplex => '고급';

  @override
  String get adminAiCapabilitiesSection => '기능';

  @override
  String get adminAiWebSearch => '웹 검색';

  @override
  String get adminAiWebSearchDesc => '어시스턴트가 웹을 검색하도록 허용합니다.';

  @override
  String get adminAiThinking => '확장 사고';

  @override
  String get adminAiThinkingDesc => '어시스턴트가 단계별로 추론하도록 허용합니다.';

  @override
  String get adminAiDigestSection => '일일 요약';

  @override
  String get adminAiDailyDigest => '일일 요약';

  @override
  String get adminAiDailyDigestDesc => '각 AI 대화의 활동을 하루 한 번 요약하여 게시합니다.';

  @override
  String get adminAiDailyDigestHour => '전송 시각';

  @override
  String get adminAiDailyDigestHourDesc =>
      '요약을 전송하는 현지 시각입니다. 요약이 켜져 있을 때 설정할 수 있습니다.';

  @override
  String get adminAiQuotaSection => '사용 한도';

  @override
  String get adminAiTokenLimit => '월간 토큰 한도';

  @override
  String get adminAiTokenLimitDesc => '비우면 상속하며 0은 모든 사용을 차단합니다.';

  @override
  String get adminAiConnectorsSection => '허용된 커넥터';

  @override
  String get adminAiRestrictConnectors => 'AI 커넥터 제한';

  @override
  String get adminAiConnectorsInherit => '워크스페이스 허용 목록을 상속합니다.';

  @override
  String get adminAiConnectorsExplicit => 'AI는 아래에서 선택한 커넥터만 사용할 수 있습니다.';

  @override
  String get adminWsIdentity => '아이덴티티 및 브랜딩';

  @override
  String get adminWsName => '워크스페이스 이름';

  @override
  String get adminWsNamePlaceholder => 'Acme 주식회사';

  @override
  String get adminWsLogoUrl => '로고 URL';

  @override
  String get adminWsPrimaryColor => '기본 색상';

  @override
  String get adminWsFeatures => '기능 플래그';

  @override
  String get adminWsNoFeatures => '구성된 기능 플래그가 없습니다.';

  @override
  String get adminWsAllowList => '커넥터 허용 목록';

  @override
  String get adminWsAllowListDesc => '멤버가 개인적으로 연결할 수 있는 커넥터.';

  @override
  String get adminWsNoCatalog => '사용 가능한 커넥터가 없습니다.';

  @override
  String get adminDeptNew => '새 부서';

  @override
  String get adminDeptEdit => '부서 편집';

  @override
  String get adminDeptEmpty => '아직 부서가 없습니다.';

  @override
  String get adminDeptLead => '리더';

  @override
  String get adminDeptLeadNone => '없음';

  @override
  String get adminDeptName => '이름';

  @override
  String get adminDeptDescription => '설명';

  @override
  String get adminDeptDialogDesc => '부서는 멤버를 그룹화하고 부서 채팅을 소유합니다.';

  @override
  String adminDeptDeleteConfirm(String name) {
    return '부서 \"$name\"을(를) 삭제하시겠습니까?';
  }

  @override
  String get adminMemberHint => '각 멤버에게 역할과 부서를 할당합니다.';

  @override
  String get adminMemberEdit => '멤버 편집';

  @override
  String get adminMemberRevokeNote => '저장하면 멤버의 활성 세션이 취소됩니다.';

  @override
  String get adminMemberRole => '역할';

  @override
  String get adminMemberRoleNone => '없음';

  @override
  String get adminMemberDepartments => '부서';

  @override
  String get adminRoleHint => '각 역할의 권한을 전환합니다. Owner 역할은 읽기 전용입니다.';

  @override
  String get adminRoleCapability => '권한';

  @override
  String get adminRolePreset => '프리셋';

  @override
  String get adminRoleClone => '복제';

  @override
  String adminRoleCloneTitle(String name) {
    return '$name 복제';
  }

  @override
  String get adminRoleName => '역할 이름';

  @override
  String get adminAuditTitle => '감사 로그';

  @override
  String get adminAuditComingSoon => '감사 로그는 향후 업데이트에서 제공됩니다.';

  @override
  String get adminCapManageWorkspace => '워크스페이스 관리';

  @override
  String get adminCapManageDepartments => '부서 관리';

  @override
  String get adminCapManageMembers => '멤버 관리';

  @override
  String get adminCapManageRoles => '역할 관리';

  @override
  String get adminCapConnectWorkspaceConnector => '워크스페이스 커넥터 연결';

  @override
  String get adminCapAddCustomMcp => '커스텀 MCP 추가';

  @override
  String get adminCapConnectPersonalConnector => '개인 커넥터 연결';

  @override
  String get adminCapUsePersonalAssistant => '개인 비서 사용';

  @override
  String get adminCapUseGroupBot => '그룹 봇 사용';

  @override
  String get adminCapRunSensitiveSkill => '민감한 스킬 실행';

  @override
  String get adminCapViewAuditLog => '감사 로그 보기';

  @override
  String get adminAuditEmpty => '감사 기록이 아직 없습니다.';

  @override
  String get adminAuditPrev => '이전';

  @override
  String get adminAuditNext => '다음';

  @override
  String get newConvDepartment => '부서 (선택)';

  @override
  String get newConvNoDepartment => '부서 없음';

  @override
  String get loginWithSso => 'SSO로 로그인';

  @override
  String get adminNavSso => 'SSO';

  @override
  String get adminSsoTitle => '싱글 사인온 (SSO)';

  @override
  String get adminSsoHint =>
      'OIDC 로그인을 구성합니다. 공급자 자격 증명은 .env에 설정하고, 여기에서 IdP 그룹을 역할 및 부서에 매핑합니다.';

  @override
  String get adminSsoEnabled => 'SSO 활성화';

  @override
  String get adminSsoAllowedDomains => '허용된 이메일 도메인';

  @override
  String get adminSsoAllowedDomainsHint => '쉼표로 구분. 비워두면 확인된 모든 이메일을 허용합니다.';

  @override
  String get adminSsoDefaultRole => '기본 역할';

  @override
  String get adminSsoNone => '없음';

  @override
  String get adminSsoGroupRoleMap => '그룹 → 역할';

  @override
  String get adminSsoGroupDeptMap => '그룹 → 부서';

  @override
  String get adminSsoGroupPlaceholder => 'IdP 그룹 이름';

  @override
  String get adminSsoAddMapping => '매핑 추가';

  @override
  String get sectionDirectoryTitle => 'MCP 디렉터리';

  @override
  String get sectionDirectoryDesc =>
      'MCP 서버를 둘러보고 한 번의 클릭으로 연결하세요 — OAuth가 자동으로 실행됩니다.';

  @override
  String get directoryAdd => '항목 추가';

  @override
  String get directorySearch => '디렉터리 검색…';

  @override
  String get directoryEmpty => '검색과 일치하는 항목이 없습니다.';

  @override
  String get directoryEdit => '항목 편집';

  @override
  String get directoryDelete => '항목 삭제';

  @override
  String get tierWorkspace => '워크스페이스';

  @override
  String get tierPersonal => '개인';

  @override
  String get tierBoth => '개인 / 워크스페이스';

  @override
  String get directorySaveSuccess => '디렉터리 항목을 저장했습니다.';

  @override
  String get directoryDeleteSuccess => '디렉터리 항목을 삭제했습니다.';

  @override
  String get directoryAddTitle => '디렉터리 항목 추가';

  @override
  String get directoryEditTitle => '디렉터리 항목 편집';

  @override
  String get directoryDialogDesc => '구성원이 한 번의 클릭으로 연결할 수 있는 공개 MCP 서버를 추가합니다.';

  @override
  String get directorySlug => '슬러그';

  @override
  String get directoryName => '이름';

  @override
  String get directoryDescription => '설명';

  @override
  String get directoryMcpUrl => 'MCP URL';

  @override
  String get directoryAuthMode => '인증 모드';

  @override
  String get directoryTier => '범위';

  @override
  String get directoryEnvHint =>
      'env-oauth의 경우: OAuth 클라이언트 자격 증명을 담은 환경 변수를 참조하세요.';

  @override
  String get directoryEnvClientId => 'Client ID 환경 변수';

  @override
  String get directoryEnvClientSecret => 'Client secret 환경 변수';

  @override
  String get directoryAuthorizeUrl => '인증 URL';

  @override
  String get directoryTokenUrl => '토큰 URL';

  @override
  String get directoryCancel => '취소';

  @override
  String get directorySave => '저장';

  @override
  String directoryKeyTitle(String provider) {
    return '$provider 연결';
  }

  @override
  String get directoryKeyLabel => 'API 키';

  @override
  String directoryConnected(String provider) {
    return '$provider에 연결되었습니다.';
  }

  @override
  String get editNicknames => '별명 편집';

  @override
  String get nicknameModalTitle => '별명';

  @override
  String get nicknameNonePlaceholder => '별명 없음';

  @override
  String get nicknameYouSuffix => '(나)';

  @override
  String get adminNavUsage => '사용량';

  @override
  String get usageThisMonth => '이번 달';

  @override
  String get usageTotalTokens => '총 토큰';

  @override
  String get usageRequests => '요청 수';

  @override
  String get usageEstCost => '예상 비용';

  @override
  String get usageThumbsDownRate => '비추천 비율';

  @override
  String usageFeedbackBreakdown(int down, int total) {
    return '$total건 중 $down건';
  }

  @override
  String get usagePerModelTitle => '모델별 비용';

  @override
  String usageModelTokens(String input, String output, String requests) {
    return '입력 $input / 출력 $output · $requests건';
  }

  @override
  String get usageTopUsersTitle => '상위 사용자';

  @override
  String usageUserRequests(int count) {
    return '$count건의 요청';
  }

  @override
  String get usageWorstAnswersTitle => '평가가 가장 낮은 답변';

  @override
  String get usageNoPreview => '(답변 미리보기 없음)';

  @override
  String usageUserComment(String comment) {
    return '“$comment”';
  }

  @override
  String get usageNoData => '이 기간의 데이터가 없습니다.';

  @override
  String get usageLoadError => '사용량 대시보드를 불러오지 못했습니다.';

  @override
  String get usageRetry => '다시 시도';

  @override
  String get assistantDefaultName => '내 어시스턴트';

  @override
  String get assistantSubtitle => '당신의 개인 어시스턴트';

  @override
  String get assistantOpenChat => '어시스턴트 채팅 열기';

  @override
  String get assistantSetupCta => '어시스턴트 설정';

  @override
  String get assistantSetupTitle => '어시스턴트 설정';

  @override
  String get assistantSetupStepName => '어시스턴트 이름 정하기';

  @override
  String get assistantSetupStepPersona => '성격 정의하기';

  @override
  String get assistantSetupStepModel => '모델 선택';

  @override
  String get assistantSetupStepConfirm => '확인 후 생성';

  @override
  String get assistantSetupNamePlaceholder => '예: Aria';

  @override
  String get assistantSetupPersonaPlaceholder => '당신은 도움을 주는 어시스턴트로…';

  @override
  String get assistantSetupPersonaHint => '어시스턴트가 어떻게 말하고 행동할지 설명하세요.';

  @override
  String get assistantSetupCreateButton => '어시스턴트 생성';

  @override
  String get assistantSetupCreating => '생성 중…';

  @override
  String get assistantSetupSuccess => '어시스턴트가 준비되었습니다';

  @override
  String get assistantSettingsTitle => '어시스턴트 설정';

  @override
  String get assistantSettingsEditPersona => '성격';

  @override
  String get assistantSettingsChangeModel => '모델';

  @override
  String get assistantSettingsDeleteTitle => '어시스턴트 삭제';

  @override
  String get assistantSettingsDeleteConfirm =>
      '어시스턴트와 해당 채팅이 삭제됩니다. 이 작업은 취소할 수 없습니다.';

  @override
  String get assistantSettingsDeleteButton => '어시스턴트 삭제';

  @override
  String get botAdminTitle => '봇 연동';

  @override
  String get botAdminGenerateToken => '토큰 생성';

  @override
  String get botAdminRevokeToken => '해지';

  @override
  String get botAdminTokenWarning => '이 토큰은 한 번만 표시되며 다시 확인할 수 없습니다. 지금 복사하세요.';

  @override
  String get botAdminCopyToken => '복사';

  @override
  String get botAdminMcpUrl => 'MCP URL';

  @override
  String get botAdminToken => '연동 토큰';

  @override
  String get botAdminLastUsed => '마지막 사용';

  @override
  String get botAdminNeverUsed => '사용한 적 없음';

  @override
  String get botAdminNoBotsRegistered => '등록된 봇이 아직 없습니다.';

  @override
  String get helpTitle => '도움말 및 FAQ';

  @override
  String get settingsHelp => '도움말 및 FAQ';

  @override
  String get settingsHelpSubtitle => '도움말 센터 및 자주 묻는 질문';

  @override
  String get helpSearchHint => '도움말 검색…';

  @override
  String get helpNoResults => '결과를 찾을 수 없습니다';

  @override
  String get helpCatGettingStarted => '시작하기';

  @override
  String get helpCatMessaging => '메시지';

  @override
  String get helpCatAiFeatures => 'AI 기능';

  @override
  String get helpCatGroups => '그룹';

  @override
  String get helpCatAccountSecurity => '계정 및 보안';

  @override
  String get helpGettingStartedQ1 => 'PON이란 무엇인가요?';

  @override
  String get helpGettingStartedA1 =>
      'PON은 팀 커뮤니케이션과 통합 AI 어시스턴트를 결합한 자체 호스팅 AI 기반 메시징 플랫폼입니다. 다이렉트 메시지, 그룹 채팅, AI 기반 워크플로를 지원합니다.';

  @override
  String get helpGettingStartedQ2 => '계정은 어떻게 만드나요?';

  @override
  String get helpGettingStartedA2 =>
      '계정은 워크스페이스 관리자가 생성합니다. 비밀번호 설정 및 계정 인증 방법이 담긴 초대 이메일을 받게 됩니다.';

  @override
  String get helpGettingStartedQ3 => '친구는 어떻게 찾고 추가하나요?';

  @override
  String get helpGettingStartedA3 =>
      '친구 탭으로 이동하여 검색창에서 이름이나 이메일로 동료를 찾으세요. 친구 요청을 보내고 수락되면 대화를 시작할 수 있습니다.';

  @override
  String get helpGettingStartedQ4 => '대화는 어떻게 시작하나요?';

  @override
  String get helpGettingStartedA4 =>
      '대화 화면에서 작성 아이콘을 누르고 연락처를 검색한 후 선택하면 새 대화가 열립니다.';

  @override
  String get helpMessagingQ1 => '메시지는 어떻게 보내나요?';

  @override
  String get helpMessagingA1 =>
      '대화 하단의 텍스트 입력란에 메시지를 입력하고 Enter 키를 누르거나 전송 버튼을 누르세요.';

  @override
  String get helpMessagingQ2 => '음성 메시지를 보낼 수 있나요?';

  @override
  String get helpMessagingA2 =>
      '네! 메시지 입력 영역의 마이크 버튼을 길게 눌러 음성 메시지를 녹음하세요. 손을 떼면 전송되고, 밀면 취소됩니다.';

  @override
  String get helpMessagingQ3 => '파일과 이미지는 어떻게 보내나요?';

  @override
  String get helpMessagingA3 =>
      '메시지 입력란 옆의 첨부 아이콘을 눌러 기기에서 이미지, 동영상, 파일을 선택하세요.';

  @override
  String get helpMessagingQ4 => '중요한 메시지는 어떻게 고정하나요?';

  @override
  String get helpMessagingA4 =>
      '메시지를 길게 누르거나 마우스를 올린 후 더보기 메뉴(⋯)를 누르고 \'메시지 고정\'을 선택하세요. 고정된 메시지는 대화 상단에 표시됩니다. 대화당 최대 2개의 메시지를 고정할 수 있습니다.';

  @override
  String get helpMessagingQ5 => '메시지 반응이란 무엇인가요?';

  @override
  String get helpMessagingA5 =>
      '메시지에 마우스를 올리거나 길게 누른 후 이모지 아이콘을 눌러 빠른 반응을 추가하세요. 다른 사람도 이를 보고 자신의 반응을 추가할 수 있습니다.';

  @override
  String get helpAiFeaturesQ1 => 'AI 어시스턴트는 무엇을 할 수 있나요?';

  @override
  String get helpAiFeaturesA1 =>
      'AI 어시스턴트(@AI)는 질문에 답하고, 대화를 요약하고, 메시지 작성을 돕고, 업로드된 문서를 분석하며, 연결된 도구를 사용해 작업을 실행할 수 있습니다.';

  @override
  String get helpAiFeaturesQ2 => '대화에서 @AI는 어떻게 사용하나요?';

  @override
  String get helpAiFeaturesA2 =>
      '어떤 대화에서든 @AI 뒤에 질문이나 요청을 입력하세요. 어시스턴트가 대화 스레드에서 답변합니다.';

  @override
  String get helpAiFeaturesQ3 => 'AI 메모리란 무엇인가요?';

  @override
  String get helpAiFeaturesA3 =>
      'AI 메모리는 어시스턴트가 이전 대화의 맥락을 기억하도록 하여 시간이 지날수록 상호작용을 더욱 개인화하고 효율적으로 만들어 줍니다.';

  @override
  String get helpAiFeaturesQ4 => '개인 어시스턴트는 어떻게 설정하나요?';

  @override
  String get helpAiFeaturesA4 =>
      'AI 어시스턴트 섹션으로 이동하여 \'어시스턴트 설정\'을 누르세요. 어시스턴트의 페르소나를 구성하고, 도구를 연결하고, 환경설정을 지정할 수 있습니다.';

  @override
  String get helpGroupsQ1 => '그룹은 어떻게 만드나요?';

  @override
  String get helpGroupsA1 =>
      '작성 아이콘을 누르고 \'새 그룹\'을 선택한 후 이름을 검색해 멤버를 추가하고, 그룹 이름을 설정한 다음 만들기를 누르세요.';

  @override
  String get helpGroupsQ2 => '그룹에 멤버는 어떻게 추가하나요?';

  @override
  String get helpGroupsA2 =>
      '그룹 대화를 열고 설정 아이콘을 누른 후 \'멤버 추가\'를 선택하세요. 연락처를 검색하여 추가하세요.';

  @override
  String get helpGroupsQ3 => '그룹 역할에는 무엇이 있나요?';

  @override
  String get helpGroupsA3 =>
      '그룹에는 관리자와 멤버 두 가지 역할이 있습니다. 관리자는 멤버를 추가/삭제하고, 그룹 이름과 아바타를 변경하며, 그룹 설정을 관리할 수 있습니다.';

  @override
  String get helpAccountSecurityQ1 => '프로필 사진은 어떻게 변경하나요?';

  @override
  String get helpAccountSecurityA1 =>
      '설정 → 프로필로 이동하여 현재 아바타를 누르고 기기에서 새 사진을 선택하세요.';

  @override
  String get helpAccountSecurityQ2 => '사라지는 메시지는 어떻게 켜나요?';

  @override
  String get helpAccountSecurityA2 =>
      '대화를 열고 설정 아이콘을 누른 후 채팅 맞춤설정으로 이동하여 원하는 타이머로 \'사라지는 메시지\'를 켜세요.';

  @override
  String get helpAccountSecurityQ3 => '사용자는 어떻게 차단하나요?';

  @override
  String get helpAccountSecurityA3 =>
      '해당 사용자와의 대화를 열고 설정 아이콘을 누른 후 개인정보 및 지원으로 스크롤하여 \'사용자 차단\'을 선택하세요.';

  @override
  String get helpAccountSecurityQ4 => '메시지 기록은 어떻게 삭제하나요?';

  @override
  String get helpAccountSecurityA4 =>
      '대화를 열고 설정을 누른 후 개인정보 및 지원으로 이동하여 \'기록 지우기\'를 선택하세요. 이 작업은 기기에서만 기록을 삭제합니다.';

  @override
  String get blockedChats => '차단됨';

  @override
  String get noBlockedChats => '차단된 대화가 없습니다';

  @override
  String get blockAndHide => '차단하고 숨기기';

  @override
  String get unblockAndRestore => '차단 해제';

  @override
  String get callBlocked => '이 사용자는 연락을 원하지 않습니다';

  @override
  String get mute15min => '15분';

  @override
  String get mute30min => '30분';

  @override
  String get mute1hour => '1시간';

  @override
  String get mute24hours => '24시간';

  @override
  String get muteForever => '직접 끌 때까지';

  @override
  String get profileBlockedByOwner => '이 사용자의 프로필을 볼 수 없습니다';

  @override
  String get unsavedChangesTitle => '저장하지 않은 변경 사항이 있습니다';

  @override
  String get unsavedChangesDesc => '페이지를 떠나면 변경 사항이 사라집니다.';

  @override
  String get keepEditing => '계속 편집';

  @override
  String get saveAndLeave => '저장 후 나가기';

  @override
  String get leaveWithoutSaving => '저장하지 않고 나가기';

  @override
  String get aiSessionHistory => '대화 기록';

  @override
  String get aiNewSession => '새 대화';

  @override
  String get aiSessionActive => '사용 중';

  @override
  String get aiSessionSummarized => '요약됨';

  @override
  String get aiSessionEmpty => '이전 대화가 없습니다';

  @override
  String get aiSessionResume => '다시 시작';

  @override
  String get aiSessionLoadError => '대화 기록을 불러올 수 없습니다';

  @override
  String multiSelectCount(int count) {
    return '$count개 선택됨';
  }

  @override
  String get multiSelectEmpty => '선택된 메시지가 없습니다';

  @override
  String get multiSelectCancel => '취소';

  @override
  String multiSelectTypeWarning(String type) {
    return '$type을(를) 선택하고 있습니다. 같은 유형만 선택할 수 있습니다.';
  }

  @override
  String multiDeleted(int count) {
    return '$count개의 메시지를 삭제했습니다';
  }

  @override
  String multiRecalled(int count) {
    return '$count개의 메시지를 회수했습니다';
  }

  @override
  String get multiForwardHint => '전달할 메시지를 하나만 선택하세요';

  @override
  String get msgTypeText => '텍스트';

  @override
  String get msgTypeImage => '사진/동영상';

  @override
  String get msgTypeFile => '파일';

  @override
  String get selectMessages => '메시지 선택';

  @override
  String get removeAttachment => '제거';

  @override
  String get addMore => '추가';

  @override
  String get attachHdOn => 'HD — 고화질';

  @override
  String get attachHdOff => 'SD — 압축';

  @override
  String get hdOn => 'HD 켜기';

  @override
  String get hdOff => 'HD 끄기';

  @override
  String get videoCannotPlay => '동영상을 재생할 수 없습니다';

  @override
  String get aiContextTitle => 'AI Context';

  @override
  String get aiContextIdentityTitle => 'Identity & organization';

  @override
  String get aiContextResponseStyleTitle => 'Response style';

  @override
  String get aiContextLearnedFactsTitle => 'What the AI has learned';

  @override
  String get aiContextCompanyTitle => 'Company context';

  @override
  String get aiContextDepartmentTitle => 'Department context';

  @override
  String get aiContextLabelRole => 'Role';

  @override
  String get aiContextLabelDepartment => 'Department';

  @override
  String get aiContextLabelJobTitle => 'Job title';

  @override
  String get aiContextLabelProjects => 'Projects';

  @override
  String get aiContextRoleUnknown => 'Not assigned';

  @override
  String get aiContextNoDepartment => 'No department';

  @override
  String get aiContextNotSet => 'Not set';

  @override
  String get aiContextIdentityManaged =>
      'These are set by your manager or admin.';

  @override
  String get aiContextStyleLabel => 'Preferred response style';

  @override
  String get aiContextStyleHint => 'e.g. concise, formal, code-first';

  @override
  String get aiContextPreferencesLabel => 'Other preferences';

  @override
  String get aiContextPreferencesHint =>
      'e.g. avoid emoji, answer in Vietnamese';

  @override
  String get aiContextUpdate => 'Update';

  @override
  String get aiContextSaving => 'Saving...';

  @override
  String get aiContextStyleSaved => 'Response style updated';

  @override
  String get aiContextSaveError => 'Failed to save';

  @override
  String get aiContextKeyFacts => 'Key facts:';

  @override
  String get aiContextMemoryEmpty => 'Nothing learned yet';

  @override
  String get aiContextMemoryEmptyHint =>
      'As you chat, the assistant will remember useful facts about you here.';

  @override
  String get aiContextTierPublic => 'Public';

  @override
  String get aiContextTierInternal => 'Internal';

  @override
  String get aiContextTierConfidential => 'Confidential';

  @override
  String get adminEditAiContext => 'Edit AI context';

  @override
  String get adminAiContextJobTitle => 'Job title';

  @override
  String get adminAiContextProjects => 'Current projects';

  @override
  String get adminAiContextProjectsHint => 'One project per line';

  @override
  String get adminAiContextEntriesTitle => 'Company AI context';

  @override
  String get adminAiContextEntriesEmpty => 'No context entries yet.';

  @override
  String get adminEntryLabel => 'Label';

  @override
  String get adminEntryText => 'Context';

  @override
  String get adminEntryTier => 'Sensitivity';

  @override
  String get adminEntryScope => 'Scope';

  @override
  String get adminScopeCompany => 'Company';

  @override
  String get adminScopeDepartment => 'Department';

  @override
  String get adminCreateEntry => 'Add entry';

  @override
  String get adminEditEntry => 'Edit entry';

  @override
  String get adminDeleteEntry => 'Delete entry';
}
