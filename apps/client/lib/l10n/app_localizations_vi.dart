// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Vietnamese (`vi`).
class AppLocalizationsVi extends AppLocalizations {
  AppLocalizationsVi([String locale = 'vi']) : super(locale);

  @override
  String get appName => 'PON';

  @override
  String get notificationsTitle => 'Thông báo';

  @override
  String get notificationsEmpty => 'Chưa có thông báo nào';

  @override
  String get notificationsMarkAllRead => 'Đánh dấu tất cả đã đọc';

  @override
  String get notificationAccept => 'Chấp nhận';

  @override
  String get notificationDecline => 'Từ chối';

  @override
  String get securityTitle => 'Mật khẩu & Bảo mật';

  @override
  String get securitySubtitle => 'Thay đổi mật khẩu của bạn';

  @override
  String get securityNoPasswordCardSubtitle => 'Chưa đặt mật khẩu';

  @override
  String get securityNoPasswordTitle => 'Chưa đặt mật khẩu';

  @override
  String get securityNoPasswordSubtitle =>
      'Đặt mật khẩu để bảo vệ tài khoản và bật khôi phục qua email.';

  @override
  String get securityChangePasswordTitle => 'Đổi mật khẩu';

  @override
  String get securityChangePasswordSubtitle =>
      'Cập nhật mật khẩu hiện tại của bạn.';

  @override
  String get securitySetPasswordTitle => 'Thiết lập mật khẩu';

  @override
  String get securitySetPasswordSubtitle =>
      'Thêm mật khẩu vào tài khoản để tăng cường bảo mật.';

  @override
  String get securitySetButton => 'Đặt mật khẩu';

  @override
  String get securityChangeButton => 'Đổi mật khẩu';

  @override
  String get securitySetSuccess => 'Đặt mật khẩu thành công';

  @override
  String get securityTwoFaTitle => 'Xác thực hai yếu tố';

  @override
  String get securityTwoFaSubtitle =>
      'Thêm một lớp bảo mật cho tài khoản của bạn.';

  @override
  String get securityTwoFaComingSoon => 'Xác thực hai yếu tố sẽ sớm ra mắt.';

  @override
  String get securityComingSoon => 'Sắp ra mắt';

  @override
  String get languageName => 'Tiếng Việt';

  @override
  String get actionCancel => 'Huỷ';

  @override
  String get actionConfirm => 'Xác nhận';

  @override
  String get actionRetry => 'THỬ LẠI';

  @override
  String get actionSave => 'LƯU';

  @override
  String get actionLogout => 'Đăng xuất';

  @override
  String get actionDelete => 'Xoá';

  @override
  String get actionLeave => 'Rời';

  @override
  String get loadingDots => '...';

  @override
  String errorWithMsg(String error) {
    return 'Lỗi: $error';
  }

  @override
  String get loginTitle => 'Đăng Nhập';

  @override
  String get fieldEmail => 'Email';

  @override
  String get fieldPassword => 'Mật khẩu';

  @override
  String get forgotPasswordLink => 'Quên mật khẩu?';

  @override
  String get loginButton => 'ĐĂNG NHẬP';

  @override
  String get noAccountYet => 'Chưa có tài khoản? ';

  @override
  String get registerNow => 'Đăng ký ngay';

  @override
  String get valEmailRequired => 'Vui lòng nhập email';

  @override
  String get valEmailInvalid => 'Email không hợp lệ';

  @override
  String get valPasswordRequired => 'Vui lòng nhập mật khẩu';

  @override
  String get valPasswordMin6 => 'Mật khẩu tối thiểu 6 ký tự';

  @override
  String get errInvalidCredentials => 'Email hoặc mật khẩu không đúng';

  @override
  String get errNetwork => 'Không thể kết nối server, kiểm tra mạng';

  @override
  String get errSlow => 'Kết nối quá chậm, thử lại';

  @override
  String get errSessionExpired => 'Phiên đăng nhập hết hạn';

  @override
  String get errForbidden => 'Không có quyền thực hiện';

  @override
  String get errNotFound => 'Không tìm thấy dữ liệu';

  @override
  String get errConflict => 'Dữ liệu đã tồn tại';

  @override
  String get errInvalidData => 'Dữ liệu không hợp lệ';

  @override
  String get errServer => 'Lỗi server, thử lại sau';

  @override
  String errRequestFailed(String code) {
    return 'Yêu cầu thất bại ($code)';
  }

  @override
  String get errCancelled => 'Yêu cầu đã bị hủy';

  @override
  String get errConnection => 'Lỗi kết nối, thử lại';

  @override
  String get errGeneric => 'Đã xảy ra lỗi, thử lại';

  @override
  String get detailsTitle => 'Thông tin';

  @override
  String get themeMenuItem => 'Chủ đề';

  @override
  String get quickReactionTitle => 'Biểu tượng cảm xúc nhanh';

  @override
  String get wallpaperDefaultName => 'Mặc định';

  @override
  String get wallpaperCategoryColors => 'Màu sắc đơn giản';

  @override
  String get wallpaperCategoryVibrant => 'Gradient sống động';

  @override
  String get wallpaperCategoryMinimal => 'Tối giản';

  @override
  String get wallpaperShowMore => 'Xem thêm';

  @override
  String get wallpaperShowLess => 'Ẩn bớt';

  @override
  String get wallpaperCategoryThemes => 'Chủ đề';

  @override
  String get wallpaperThemeForest => 'Rừng';

  @override
  String get wallpaperThemeOcean => 'Đại dương';

  @override
  String get wallpaperThemeMountain => 'Núi tuyết';

  @override
  String get wallpaperThemeCherryBlossom => 'Hoa anh đào';

  @override
  String get wallpaperThemeSpace => 'Vũ trụ';

  @override
  String get wallpaperThemeAurora => 'Bắc cực quang';

  @override
  String get wallpaperThemeCityNight => 'Thành phố đêm';

  @override
  String get wallpaperThemeDesert => 'Sa mạc';

  @override
  String get changeChatThemeTitle => 'Đổi chủ đề đoạn chat';

  @override
  String get uploadImageButton => 'Tải ảnh lên';

  @override
  String get imageFitLabel => 'Căn chỉnh ảnh';

  @override
  String get fitCoverLabel => 'Phủ kín';

  @override
  String get fitContainLabel => 'Vừa khung';

  @override
  String get fitFillLabel => 'Kéo giãn';

  @override
  String get errLoginFailed => 'Đăng nhập thất bại, thử lại';

  @override
  String get registerTitle => 'Tạo Tài Khoản';

  @override
  String get welcomeToApp => 'Chào mừng bạn đến với PON';

  @override
  String get fieldDisplayName => 'Tên hiển thị';

  @override
  String get fieldConfirmPassword => 'Xác nhận mật khẩu';

  @override
  String get registerButton => 'ĐĂNG KÝ';

  @override
  String get haveAccount => 'Đã có tài khoản? ';

  @override
  String get loginLink => 'Đăng nhập';

  @override
  String get valNameRequired => 'Vui lòng nhập tên';

  @override
  String get valNameMin2 => 'Tên tối thiểu 2 ký tự';

  @override
  String get valPasswordMismatch => 'Mật khẩu không khớp';

  @override
  String get errEmailExists => 'Email này đã được đăng ký';

  @override
  String get errRegisterFailed => 'Đăng ký thất bại, thử lại';

  @override
  String get verifyOtpTitle => 'Xác Thực OTP';

  @override
  String get verifyAccountHeading => 'Xác thực tài khoản';

  @override
  String otpSentTo(String email) {
    return 'Mã OTP 6 chữ số đã gửi đến\n$email';
  }

  @override
  String get fieldOtp => 'Mã OTP';

  @override
  String get confirmButton => 'XÁC NHẬN';

  @override
  String resendIn(int seconds) {
    return 'Gửi lại sau ${seconds}s';
  }

  @override
  String get resendOtp => 'Gửi lại mã OTP';

  @override
  String get otpResent => 'Mã OTP mới đã được gửi tới email của bạn';

  @override
  String get errResendFailed => 'Gửi lại thất bại, thử lại sau';

  @override
  String get valOtp6 => 'Nhập đủ 6 chữ số OTP';

  @override
  String get verifySuccess => 'Xác thực thành công! Đăng nhập ngay';

  @override
  String get errVerifyFailed => 'Xác thực thất bại, thử lại';

  @override
  String get forgotTitle => 'Đặt Lại Mật Khẩu';

  @override
  String get forgotHeading => 'Quên mật khẩu?';

  @override
  String get forgotSubtitle =>
      'Nhập email của bạn để nhận mã OTP thiết lập mật khẩu mới';

  @override
  String get sendOtpButton => 'GỬI MÃ OTP';

  @override
  String get errEmailNotRegistered => 'Email này chưa được đăng ký';

  @override
  String get errSendRequestFailed => 'Gửi yêu cầu thất bại, thử lại';

  @override
  String get newPasswordTitle => 'Mật Khẩu Mới';

  @override
  String get newPasswordHeading => 'Tạo mật khẩu mới';

  @override
  String newPasswordSubtitle(String email) {
    return 'Nhập mã OTP đã gửi đến $email\nvà mật khẩu mới của bạn';
  }

  @override
  String get fieldNewPassword => 'Mật khẩu mới';

  @override
  String get valNewPasswordRequired => 'Nhập mật khẩu mới';

  @override
  String get resetPasswordSuccess => 'Đặt lại mật khẩu thành công!';

  @override
  String get errOtpInvalidExpired => 'OTP không đúng hoặc đã hết hạn';

  @override
  String get errResetFailed => 'Đặt lại mật khẩu thất bại, thử lại';

  @override
  String get settingsTitle => 'Cài Đặt';

  @override
  String get valNameEmpty => 'Tên không được để trống';

  @override
  String get nameUpdated => 'Đã cập nhật tên hiển thị';

  @override
  String get personalInfo => 'Thông tin cá nhân';

  @override
  String get appearance => 'Giao diện';

  @override
  String get chooseThemeTitle => 'Chọn giao diện';

  @override
  String get themeLight => 'Giao diện Sáng';

  @override
  String get themeDark => 'Giao diện Tối';

  @override
  String get themeSystem => 'Hệ thống';

  @override
  String get language => 'Ngôn ngữ';

  @override
  String get chooseLanguageTitle => 'Chọn ngôn ngữ';

  @override
  String get logoutConfirmBody => 'Bạn có chắc muốn đăng xuất không?';

  @override
  String get onboardingChooseTheme => 'CHỌN GIAO DIỆN';

  @override
  String get onboardingChooseSubtitle =>
      'Chọn phong cách giao diện phù hợp nhất với bạn.';

  @override
  String get themeLightSubtitle => 'Tươi sáng, rõ ràng và dễ đọc';

  @override
  String get themeDarkSubtitle => 'Hiện đại, huyền bí và dịu mắt';

  @override
  String get themeSystemSubtitle => 'Tự động đồng bộ với thiết bị của bạn';

  @override
  String get startExperience => 'BẮT ĐẦU TRẢI NGHIỆM';

  @override
  String get tooltipSettings => 'Cài đặt';

  @override
  String get tooltipNewConversation => 'Cuộc trò chuyện mới';

  @override
  String get listLoadFailed => 'Không tải được danh sách';

  @override
  String get listCheckNetwork => 'Kiểm tra kết nối mạng và thử lại.';

  @override
  String get listGenericError => 'Có lỗi xảy ra. Vui lòng thử lại sau.';

  @override
  String get emptyConversations => 'Chưa có cuộc trò chuyện nào';

  @override
  String get emptyTapPlus => 'Nhấn nút \"+\" bên dưới để bắt đầu!';

  @override
  String get searchConversationsHint => 'Tìm kiếm đoạn chat...';

  @override
  String get noConversationsFound => 'Không tìm thấy đoạn chat nào';

  @override
  String get offlineBanner => 'Không có kết nối mạng';

  @override
  String get conversationDefault => 'Cuộc trò chuyện';

  @override
  String get newConversationTitle => 'Cuộc Trò Chuyện Mới';

  @override
  String get startConversationHeading => 'Bắt đầu cuộc trò chuyện';

  @override
  String get fieldRecipient => 'Email hoặc User ID đối phương';

  @override
  String get valRecipientRequired => 'Vui lòng nhập email hoặc User ID';

  @override
  String get errUserNotFoundEmail => 'Không tìm thấy người dùng có email này.';

  @override
  String get errUserNotFoundOrConn =>
      'Không tìm thấy người dùng hoặc lỗi kết nối.';

  @override
  String get startConversationButton => 'BẮT ĐẦU TRÒ CHUYỆN';

  @override
  String get chatDefaultTitle => 'Trò chuyện';

  @override
  String get statusOnline => 'đang hoạt động';

  @override
  String get statusOffline => 'ngoại tuyến';

  @override
  String get typingLabel => 'đang nhập';

  @override
  String get messageHint => 'Nhập tin nhắn...';

  @override
  String get tabChats => 'Trò chuyện';

  @override
  String get newGroup => 'Tạo nhóm';

  @override
  String get newDirect => 'Trò chuyện mới';

  @override
  String get createGroup => 'Tạo nhóm';

  @override
  String get groupName => 'Tên nhóm';

  @override
  String get groupDefaultName => 'Nhóm';

  @override
  String get valGroupNameRequired => 'Vui lòng nhập tên nhóm';

  @override
  String get selectMembers => 'Chọn thành viên';

  @override
  String get valSelectMembers => 'Chọn ít nhất 2 thành viên';

  @override
  String get searchUsers => 'Tìm theo tên hoặc email';

  @override
  String get groupInfo => 'Thông tin nhóm';

  @override
  String get members => 'Thành viên';

  @override
  String membersCount(int count) {
    return '$count thành viên';
  }

  @override
  String get addMembers => 'Thêm thành viên';

  @override
  String get removeMember => 'Xoá khỏi nhóm';

  @override
  String get leaveGroup => 'Rời nhóm';

  @override
  String get leaveGroupConfirm => 'Bạn có chắc muốn rời nhóm này?';

  @override
  String get renameGroup => 'Đổi tên nhóm';

  @override
  String get admin => 'Quản trị';

  @override
  String get you => 'Bạn';

  @override
  String get someone => 'Ai đó';

  @override
  String get aiHubTitle => 'Trung tâm AI';

  @override
  String get aiHubSubtitle => 'Mọi thứ về trợ lý AI của bạn';

  @override
  String get aiHubStartChat => 'Bắt đầu trò chuyện với PON AI';

  @override
  String get aiHubMemory => 'Bộ nhớ';

  @override
  String get aiHubIntegrations => 'Kết nối';

  @override
  String get aiHubSkills => 'Kỹ năng';

  @override
  String get aiHubTokenUsage => 'Sử dụng';

  @override
  String systemAddedMember(String actor, String target) {
    return '$actor đã thêm $target';
  }

  @override
  String systemRemovedMember(String actor, String target) {
    return '$actor đã xoá $target';
  }

  @override
  String systemLeftGroup(String actor) {
    return '$actor đã rời nhóm';
  }

  @override
  String systemRenamedGroup(String actor, String name) {
    return '$actor đã đổi tên nhóm thành $name';
  }

  @override
  String systemCreatedGroup(String actor) {
    return '$actor đã tạo nhóm';
  }

  @override
  String get actionReply => 'Trả lời';

  @override
  String get actionRecall => 'Thu hồi';

  @override
  String get actionEdit => 'Chỉnh sửa';

  @override
  String get messageEdited => '(đã sửa)';

  @override
  String get actionDeleteForMe => 'Xoá phía tôi';

  @override
  String get actionCopy => 'Sao chép';

  @override
  String get actionReact => 'Cảm xúc';

  @override
  String get messageRecalled => 'Tin nhắn đã được thu hồi';

  @override
  String replyingTo(String name) {
    return 'Đang trả lời $name';
  }

  @override
  String get copiedToClipboard => 'Đã sao chép';

  @override
  String get recallConfirm => 'Thu hồi tin nhắn này với mọi người?';

  @override
  String get deleteConversation => 'Xoá đoạn chat';

  @override
  String get deleteConversationConfirm =>
      'Xoá đoạn chat này? Nó sẽ bị ẩn khỏi danh sách của bạn.';

  @override
  String get clearHistory => 'Chat lại từ đầu';

  @override
  String get clearHistoryConfirm =>
      'Xoá toàn bộ tin nhắn trong đoạn chat này phía bạn?';

  @override
  String get disappearingMessages => 'Tin nhắn tự xoá';

  @override
  String get disappearingOff => 'Tắt';

  @override
  String get disappearing24h => '24 giờ';

  @override
  String get disappearing7d => '7 ngày';

  @override
  String get changeAvatar => 'Đổi ảnh đại diện';

  @override
  String get uploadFailed => 'Tải lên thất bại, thử lại';

  @override
  String get lastSeenJustNow => 'vừa truy cập';

  @override
  String lastSeenMinutes(int minutes) {
    return 'hoạt động $minutes phút trước';
  }

  @override
  String lastSeenHours(int hours) {
    return 'hoạt động $hours giờ trước';
  }

  @override
  String lastSeenDays(int days) {
    return 'hoạt động $days ngày trước';
  }

  @override
  String get dateToday => 'Hôm nay';

  @override
  String get dateYesterday => 'Hôm qua';

  @override
  String get attachPhoto => 'Ảnh';

  @override
  String get attachVideo => 'Video';

  @override
  String get attachFile => 'Tệp';

  @override
  String get attachVoice => 'Tin nhắn thoại';

  @override
  String get attachSticker => 'Nhãn dán';

  @override
  String get pinnedMessageTitle => 'Tin nhắn đã ghim';

  @override
  String get pinnedSystemMessage => 'Tin nhắn hệ thống';

  @override
  String get uploading => 'Đang tải lên…';

  @override
  String get downloadMedia => 'Tải về';

  @override
  String get attachmentLabel => '📎 Tệp đính kèm';

  @override
  String get callIncoming => 'Cuộc gọi đến';

  @override
  String callIncomingBody(String name) {
    return '$name đang gọi cho bạn';
  }

  @override
  String callCalling(String name) {
    return 'Đang gọi $name…';
  }

  @override
  String get callConnecting => 'Đang kết nối…';

  @override
  String get callMediaError =>
      'Không thể truy cập camera/micro (cần HTTPS hoặc localhost)';

  @override
  String get callUnknownCaller => 'Ai đó';

  @override
  String get callToggleMic => 'Bật/tắt micro';

  @override
  String get callToggleCam => 'Bật/tắt camera';

  @override
  String get callLeave => 'Rời';

  @override
  String get callJoin => 'Tham gia';

  @override
  String get callAccept => 'Chấp nhận';

  @override
  String get callDecline => 'Từ chối';

  @override
  String get groupCallTitle => 'Cuộc gọi nhóm';

  @override
  String groupCallParticipants(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count người tham gia',
      one: '1 người tham gia',
    );
    return '$_temp0';
  }

  @override
  String get groupCallNotetakerActive => 'AI đang ghi chú';

  @override
  String get groupCallStartTitle => 'Bắt đầu cuộc gọi nhóm';

  @override
  String get groupCallAudio => 'Âm thanh';

  @override
  String get groupCallVideo => 'Video';

  @override
  String get groupCallNotetakerToggle => 'AI ghi chú';

  @override
  String get groupCallNotetakerHint =>
      'AI sẽ lắng nghe và đăng bản tóm tắt cuộc họp sau đó.';

  @override
  String get groupCallStartAction => 'Bắt đầu gọi';

  @override
  String activeCallBanner(int count) {
    return 'Cuộc gọi nhóm · $count đã tham gia';
  }

  @override
  String get incomingGroupCallTitle => 'Cuộc gọi nhóm đến';

  @override
  String incomingGroupCallBody(String name) {
    return '$name đã bắt đầu một cuộc gọi nhóm';
  }

  @override
  String get meetingSummaryTitle => 'Tóm tắt cuộc họp';

  @override
  String meetingSummaryDuration(String duration) {
    return 'Thời lượng $duration';
  }

  @override
  String meetingSummaryAttendees(String names) {
    return 'Người tham dự: $names';
  }

  @override
  String get meetingSummaryOverview => 'Tổng quan';

  @override
  String get meetingSummaryKeyPoints => 'Điểm chính';

  @override
  String get meetingSummaryActionItems => 'Việc cần làm';

  @override
  String get profileTitle => 'Trang cá nhân';

  @override
  String get editProfile => 'Chỉnh sửa trang cá nhân';

  @override
  String get bio => 'Tiểu sử';

  @override
  String friendsCountLabel(int count) {
    return '$count bạn bè';
  }

  @override
  String get messageAction => 'Nhắn tin';

  @override
  String get activeFriends => 'Đang hoạt động';

  @override
  String get noFriendsOnline => 'Không có bạn nào trực tuyến';

  @override
  String get strangerBannerTitle => 'Yêu cầu nhắn tin';

  @override
  String get strangerBannerBody =>
      'Người này không nằm trong danh bạ của bạn. Chấp nhận để trả lời.';

  @override
  String get acceptRequest => 'Chấp nhận';

  @override
  String get rejectRequest => 'Từ chối';

  @override
  String get friends => 'Bạn bè';

  @override
  String get contacts => 'Danh bạ';

  @override
  String get friendRequests => 'Lời mời kết bạn';

  @override
  String get addFriend => 'Kết bạn';

  @override
  String get friendRequestSent => 'Đã gửi lời mời kết bạn';

  @override
  String get acceptFriend => 'Chấp nhận';

  @override
  String get noFriends => 'Chưa có bạn bè';

  @override
  String get noFriendRequests => 'Không có lời mời nào';

  @override
  String get friendRequestPending => 'Đang chờ';

  @override
  String get friendsTabSearch => 'Tìm kiếm';

  @override
  String get declineFriend => 'Từ chối';

  @override
  String get searchUsersPrompt => 'Tìm người để kết bạn';

  @override
  String get noSearchResults => 'Không tìm thấy người dùng';

  @override
  String get unfriend => 'Hủy kết bạn';

  @override
  String get unfriendConfirm => 'Hủy kết bạn với người này?';

  @override
  String get blockUser => 'Chặn người này';

  @override
  String get unblockUser => 'Bỏ chặn';

  @override
  String get blockUserConfirm =>
      'Chặn người này? Hai bạn sẽ không thể nhắn tin cho nhau.';

  @override
  String get blockedComposerNotice =>
      'Bạn không thể gửi tin nhắn cho đoạn chat này';

  @override
  String get userBlocked => 'Đã chặn người dùng';

  @override
  String get userUnblocked => 'Đã bỏ chặn người dùng';

  @override
  String get mentionNotificationTitle => 'Đã nhắc đến bạn';

  @override
  String mentionNotificationBody(String name) {
    return '$name đã nhắc đến bạn';
  }

  @override
  String get searchMessages => 'Tìm tin nhắn';

  @override
  String get searchHint => 'Tìm trong cuộc trò chuyện';

  @override
  String get searchNoResults => 'Không tìm thấy tin nhắn';

  @override
  String get exploreChannels => 'Khám phá kênh';

  @override
  String get searchChannelsHint => 'Tìm kênh…';

  @override
  String get noPublicChannels => 'Không tìm thấy kênh công khai';

  @override
  String get joinChannel => 'Tham gia';

  @override
  String get pinMessage => 'Ghim';

  @override
  String get unpinMessage => 'Bỏ ghim';

  @override
  String get pinnedMessagesTitle => 'Tin nhắn đã ghim';

  @override
  String get pinLimitReached => 'Bạn chỉ có thể ghim tối đa 2 tin nhắn';

  @override
  String get cannotPinCall => 'Không thể ghim cuộc gọi';

  @override
  String get forwardMessage => 'Chuyển tiếp';

  @override
  String get messageForwarded => 'Đã chuyển tiếp tin nhắn';

  @override
  String get forwardFailed => 'Chuyển tiếp thất bại';

  @override
  String get noConversationsToForward => 'Không có cuộc trò chuyện nào';

  @override
  String get rateLimitError => 'Bạn gửi quá nhiều tin nhắn. Hãy chậm lại.';

  @override
  String get sharedMediaTitle => 'Ảnh, video & tệp';

  @override
  String get tabMedia => 'Phương tiện';

  @override
  String get tabFiles => 'Tệp';

  @override
  String get tabLinks => 'Liên kết';

  @override
  String get noMediaFound => 'Không tìm thấy ảnh/video';

  @override
  String get noFilesFound => 'Không tìm thấy tệp';

  @override
  String get noLinksFound => 'Không tìm thấy liên kết';

  @override
  String get reactionsDetail => 'Cảm xúc';

  @override
  String get changePasswordTitle => 'Đổi mật khẩu';

  @override
  String get currentPassword => 'Mật khẩu hiện tại';

  @override
  String get newPassword => 'Mật khẩu mới';

  @override
  String get confirmPassword => 'Xác nhận mật khẩu mới';

  @override
  String get dateOfBirth => 'Ngày sinh';

  @override
  String get notSet => 'Chưa thiết lập';

  @override
  String get passwordChangedSuccess => 'Đổi mật khẩu thành công';

  @override
  String get errCurrentPasswordIncorrect => 'Mật khẩu hiện tại không chính xác';

  @override
  String get changeCoverPhoto => 'Đổi ảnh nền';

  @override
  String get markAsRead => 'Đánh dấu là đã đọc';

  @override
  String get markAsUnread => 'Đánh dấu là chưa đọc';

  @override
  String get muteNotifications => 'Tắt thông báo';

  @override
  String get unmuteNotifications => 'Bật thông báo';

  @override
  String get viewProfile => 'Xem trang cá nhân';

  @override
  String get voiceCall => 'Gọi thoại';

  @override
  String get videoCall => 'Chat video';

  @override
  String get archiveChat => 'Lưu trữ đoạn chat';

  @override
  String get unarchiveChat => 'Bỏ lưu trữ đoạn chat';

  @override
  String get mutedLabel => 'Đã tắt thông báo';

  @override
  String get newNotificationTitle => 'Tin nhắn mới';

  @override
  String newNotificationBody(String name) {
    return '$name đã nhắn tin cho bạn';
  }

  @override
  String get archivedChats => 'Trò chuyện đã lưu trữ';

  @override
  String get archivedChatsSubtitle => 'Xem các đoạn chat đã lưu trữ';

  @override
  String get emptyArchivedChats => 'Chưa có trò chuyện nào được lưu trữ';

  @override
  String get webNoChatSelected => 'Chọn một cuộc trò chuyện để bắt đầu';

  @override
  String get aiPersonality => 'Tính cách';

  @override
  String get aiMemory => 'Bộ nhớ';

  @override
  String get aiSkills => 'Kỹ năng';

  @override
  String get aiConnectedApps => 'Ứng dụng đã kết nối';

  @override
  String get aiUsage => 'Sử dụng';

  @override
  String get chatInfoCategory => 'Thông tin về đoạn chat';

  @override
  String get customizeChatCategory => 'Tùy chỉnh đoạn chat';

  @override
  String get filesAndMediaCategory => 'File phương tiện và file';

  @override
  String get privacyAndSupportCategory => 'Quyền riêng tư và hỗ trợ';

  @override
  String get callSelectMember => 'Chọn thành viên để gọi';

  @override
  String get profileHideInfo => 'Ẩn thông tin cá nhân';

  @override
  String get profileInfoHidden => 'Thông tin cá nhân đã được ẩn';

  @override
  String get profileGender => 'Giới tính';

  @override
  String get profilePhone => 'Số điện thoại';

  @override
  String get profileBio => 'Giới thiệu';

  @override
  String get profileDateOfBirth => 'Ngày sinh';

  @override
  String get profileShowDateOfBirth => 'Hiển thị ngày sinh cho người khác';

  @override
  String get profileShowPhone => 'Hiển thị số điện thoại cho người khác';

  @override
  String get profileShowGender => 'Hiển thị giới tính cho người khác';

  @override
  String get profilePrivacySection => 'Quyền riêng tư';

  @override
  String get profileEditMode => 'Chỉnh sửa hồ sơ';

  @override
  String get profileSave => 'Lưu';

  @override
  String get actionMessage => 'Nhắn tin';

  @override
  String get actionAddFriend => 'Kết bạn';

  @override
  String get actionBlock => 'Chặn';

  @override
  String get readDetails => 'Chi tiết lượt đọc';

  @override
  String get seenStatus => 'Đã xem';

  @override
  String get noReadsYet => 'Chưa có ai đọc tin nhắn này';

  @override
  String get voiceMicTooltip => 'Tin nhắn thoại';

  @override
  String get recording => 'Đang ghi...';

  @override
  String get stickerLabel => 'Nhãn dán';

  @override
  String get emojiTab => 'Emoji';

  @override
  String get aiAssistant => 'Trợ lý AI';

  @override
  String get startChatWithAI => 'Trò chuyện với PON AI';

  @override
  String get aiThinking => 'AI đang suy nghĩ...';

  @override
  String get aiError => 'AI tạm thời không khả dụng. Vui lòng thử lại.';

  @override
  String get aiErrStreamInterrupted =>
      'Luồng AI bị gián đoạn. Vui lòng thử lại.';

  @override
  String get aiErrUnavailable => 'AI tạm thời không khả dụng.';

  @override
  String get aiErrRateLimited =>
      'Quá nhiều yêu cầu AI. Vui lòng chậm lại và thử lại sau giây lát.';

  @override
  String get feedbackHelpful => 'Hữu ích';

  @override
  String get feedbackNotHelpful => 'Không hữu ích';

  @override
  String get feedbackCommentHint =>
      'Cho chúng tôi biết điều gì chưa ổn (không bắt buộc)';

  @override
  String get feedbackThanks => 'Cảm ơn phản hồi của bạn';

  @override
  String get feedbackSend => 'Gửi';

  @override
  String get feedbackError => 'Không thể gửi phản hồi. Vui lòng thử lại.';

  @override
  String get aiSensitiveAction => 'hành động nhạy cảm';

  @override
  String get sourcesLabel => 'Nguồn';

  @override
  String get aiErrorRetry => 'Thử lại';

  @override
  String get aiMessageDeleted => 'Tin nhắn đã bị xóa';

  @override
  String get aiMemoryTitle => 'Bộ nhớ AI';

  @override
  String get aiMemoryEmptyState =>
      'Chưa có bộ nhớ nào. Hãy chat với PON AI để bắt đầu tạo bộ nhớ.';

  @override
  String get aiMemoryDeleteConfirm =>
      'Xóa bộ nhớ này? AI sẽ không còn nhớ ngữ cảnh cuộc trò chuyện này nữa.';

  @override
  String get aiMemoryDeleted => 'Đã xóa bộ nhớ';

  @override
  String aiMemoryUpdated(String date) {
    return 'Cập nhật $date';
  }

  @override
  String get aiMemoryFacts => 'Thông tin chính:';

  @override
  String get viewAiMemory => 'Xem bộ nhớ';

  @override
  String get kbTitle => 'Cơ sở tri thức';

  @override
  String get kbEmptyState =>
      'Chưa có tài liệu nào.\nNhấn nút tải lên để thêm tệp PDF, DOCX hoặc TXT.';

  @override
  String get kbUploadButton => 'Tải tài liệu lên';

  @override
  String get kbDeleteConfirm => 'Xóa tài liệu này?';

  @override
  String get kbProcessing => 'Đang xử lý';

  @override
  String get kbReady => 'Sẵn sàng';

  @override
  String get kbError => 'Lỗi';

  @override
  String get kbManage => 'Cơ sở tri thức';

  @override
  String get kbSources => 'nguồn';

  @override
  String get kbChunks => 'đoạn';

  @override
  String aiToolCalling(String toolName) {
    return 'Đang dùng công cụ: $toolName';
  }

  @override
  String get aiToolTrace => 'Nhật ký công cụ';

  @override
  String get toolSearchMessages => 'Đang tìm kiếm tin nhắn...';

  @override
  String get toolGetUserInfo => 'Đang tra cứu thông tin người dùng...';

  @override
  String get toolSearchKnowledgeBase => 'Đang tìm kiếm cơ sở tri thức...';

  @override
  String get toolSummarizeConversation => 'Đang tóm tắt cuộc trò chuyện...';

  @override
  String get toolCreateReminder => 'Đang tạo nhắc nhở...';

  @override
  String get reminders => 'Nhắc nhở';

  @override
  String get remindersEmpty =>
      'Không có nhắc nhở nào.\nHãy nhờ PON AI đặt nhắc nhở cho bạn.';

  @override
  String get reminderDone => 'Đánh dấu hoàn thành';

  @override
  String get tokenUsage => 'Sử dụng Token';

  @override
  String get tokenUsageTitle => 'Bảng thống kê Token';

  @override
  String get tokenUsageThisMonth => 'Tổng token tháng này';

  @override
  String get tokenUsageRequests => 'Số yêu cầu AI';

  @override
  String get tokenUsageEstCost => 'Chi phí ước tính (USD)';

  @override
  String get tokenUsageDailyChart => 'Sử dụng token hàng ngày (30 ngày qua)';

  @override
  String get aiTraceTitle => 'Nhật ký AI';

  @override
  String get aiTraceThinking => 'Suy nghĩ';

  @override
  String get aiTraceTools => 'Công cụ đã dùng';

  @override
  String get aiTraceStats => 'Thống kê';

  @override
  String get aiPersonaTitle => 'Nhân vật AI';

  @override
  String get avatarUploadLabel => 'Đổi ảnh đại diện';

  @override
  String get aiPersonaNameHint => 'Tên bot (ví dụ: DevBot)';

  @override
  String get aiPersonaInstructionsHint =>
      'Hướng dẫn tùy chỉnh (ví dụ: Luôn trả lời bằng gạch đầu dòng)';

  @override
  String get aiPersonaAdminOnly =>
      'Chỉ quản trị viên nhóm mới có thể cấu hình nhân vật AI.';

  @override
  String get configureAiPersona => 'Cấu hình nhân vật AI';

  @override
  String get aiPersonaToneFriendly => 'Thân thiện';

  @override
  String get aiPersonaToneProfessional => 'Chuyên nghiệp';

  @override
  String get aiPersonaToneConcise => 'Ngắn gọn';

  @override
  String get aiPersonaToneCreative => 'Sáng tạo';

  @override
  String get aiQuotaExceeded =>
      'Đã vượt hạn mức sử dụng AI hàng tháng. Vui lòng liên hệ quản trị viên.';

  @override
  String get viewUsage => 'Xem lượng dùng';

  @override
  String get tokenUsageQuota => 'Hạn mức tháng';

  @override
  String get errEmailDomainInvalid => 'Email này không tồn tại';

  @override
  String get valPasswordMin8 => 'Mật khẩu phải có ít nhất 8 ký tự';

  @override
  String get valPasswordUppercase => 'Phải có chữ hoa (A-Z)';

  @override
  String get valPasswordLowercase => 'Phải có chữ thường (a-z)';

  @override
  String get valPasswordDigit => 'Phải có chữ số (0-9)';

  @override
  String get valPasswordSpecial => 'Phải có ký tự đặc biệt (!@#\$%^&*)';

  @override
  String get pwStrengthWeak => 'Yếu';

  @override
  String get pwStrengthMedium => 'Trung bình';

  @override
  String get pwStrengthStrong => 'Mạnh';

  @override
  String get pwStrengthVeryStrong => 'Rất mạnh';

  @override
  String get pwReqLength => '≥8 ký tự';

  @override
  String get pwReqUppercase => 'Chữ hoa (A-Z)';

  @override
  String get pwReqLowercase => 'Chữ thường (a-z)';

  @override
  String get pwReqDigit => 'Số (0-9)';

  @override
  String get pwReqSpecial => 'Ký tự đặc biệt (!@#\$...)';

  @override
  String get loginWithGoogle => 'Đăng nhập bằng Google';

  @override
  String get registerWithGoogle => 'Đăng ký bằng Google';

  @override
  String get orContinueWith => 'Hoặc tiếp tục với';

  @override
  String agreeToTerms(String privacyPolicy, String termsOfService) {
    return 'Tôi đồng ý với $privacyPolicy và $termsOfService';
  }

  @override
  String get privacyPolicy => 'Chính sách Quyền riêng tư';

  @override
  String get termsOfService => 'Điều khoản Dịch vụ';

  @override
  String get valMustAgreeTerms =>
      'Bạn phải đồng ý với Điều khoản Dịch vụ để đăng ký';

  @override
  String get youColon => 'Bạn:';

  @override
  String get systemNicknameChanged => 'Biệt danh đã được thay đổi';

  @override
  String get systemThemeChanged => 'Chủ đề đoạn chat đã thay đổi';

  @override
  String get systemQuickReactionChanged =>
      'Biểu tượng cảm xúc nhanh đã thay đổi';

  @override
  String get wallpaperUploadError => 'Tải ảnh lên thất bại';

  @override
  String get wallpaperScale => 'Tỉ lệ';

  @override
  String get wallpaperPreviewHint => 'Chụm hoặc kéo để điều chỉnh';

  @override
  String get wallpaperPreviewIncoming => 'Chào! Trông thế nào?';

  @override
  String get wallpaperPreviewOutgoing => 'Tuyệt vời 🎉';

  @override
  String get errCannotOpenLink => 'Không thể mở liên kết';

  @override
  String sysNicknameClearedSelf(String actorName) {
    return '$actorName đã gỡ bỏ biệt danh của mình';
  }

  @override
  String sysNicknameClearedOther(String actorName, String targetName) {
    return '$actorName đã gỡ bỏ biệt danh của $targetName';
  }

  @override
  String sysNicknameSetSelf(String actorName, String nickname) {
    return '$actorName đã đặt biệt danh cho mình là $nickname';
  }

  @override
  String sysNicknameSetOther(
      String actorName, String targetName, String nickname) {
    return '$actorName đã đặt biệt danh cho $targetName là $nickname';
  }

  @override
  String sysThemeChanged(String actorName) {
    return '$actorName đã thay đổi chủ đề đoạn chat';
  }

  @override
  String sysQuickReactionChanged(String actorName, String emoji) {
    return '$actorName đã thay đổi biểu tượng cảm xúc nhanh thành $emoji';
  }

  @override
  String sysGroupCreated(String actorName) {
    return '$actorName đã tạo nhóm';
  }

  @override
  String sysMembersAdded(String actorName) {
    return '$actorName đã thêm thành viên mới';
  }

  @override
  String sysMemberLeft(String actorName) {
    return '$actorName đã rời khỏi nhóm';
  }

  @override
  String sysMemberRemoved(String actorName) {
    return '$actorName đã xóa một thành viên';
  }

  @override
  String sysMemberJoined(String actorName) {
    return '$actorName đã tham gia nhóm';
  }

  @override
  String sysPinnedMessage(String actorName) {
    return '$actorName đã ghim một tin nhắn';
  }

  @override
  String sysUnpinnedMessage(String actorName) {
    return '$actorName đã bỏ ghim một tin nhắn';
  }

  @override
  String systemVideoCallEnded(String duration) {
    return 'Cuộc gọi video đã kết thúc · $duration';
  }

  @override
  String systemVoiceCallEnded(String duration) {
    return 'Cuộc gọi thoại đã kết thúc · $duration';
  }

  @override
  String get systemVideoCallMissed => 'Cuộc gọi video nhỡ';

  @override
  String get systemVoiceCallMissed => 'Cuộc gọi thoại nhỡ';

  @override
  String get errActionFailed => 'Đã xảy ra lỗi. Vui lòng thử lại.';

  @override
  String get kbDeleteFailed => 'Xóa thất bại, vui lòng thử lại';

  @override
  String get exploreJoinFailed => 'Không thể tham gia kênh';

  @override
  String get unnamedChannel => 'Chưa đặt tên';

  @override
  String get actionOk => 'OK';

  @override
  String get reminderDeleteConfirm => 'Xóa lời nhắc này?';

  @override
  String get profileNameLabel => 'Tên';

  @override
  String get genderMale => 'Nam';

  @override
  String get genderFemale => 'Nữ';

  @override
  String get genderOther => 'Khác';

  @override
  String get aiPersonaSaved => 'Đã lưu';

  @override
  String get aiPersonaResetTitle => 'Đặt lại AI persona';

  @override
  String get aiPersonaResetConfirm => 'Đặt lại AI persona về cài đặt mặc định?';

  @override
  String get aiPersonaToneLabel => 'Giọng điệu';

  @override
  String get aiPersonaResetToDefault => 'Đặt lại mặc định';

  @override
  String tokenUsagePercentUsed(String percent) {
    return 'Đã dùng $percent% trong tháng này';
  }

  @override
  String tokenUsageCostUsd(String amount) {
    return '$amount USD';
  }

  @override
  String get notifications => 'Thông báo';

  @override
  String get notificationsEnabled => 'Thông báo đang bật';

  @override
  String get notificationsDisabled => 'Thông báo đang tắt';

  @override
  String get legalScreenTitle => 'Quyền riêng tư & Điều khoản';

  @override
  String get legalLastUpdated => 'Cập nhật lần cuối: 15/06/2026';

  @override
  String get legalDataCollectionTitle => '1. Thu thập dữ liệu';

  @override
  String get legalDataCollectionContent =>
      'Chúng tôi thu thập thông tin bạn cung cấp trực tiếp cho chúng tôi, ví dụ như khi bạn tạo hoặc sửa đổi tài khoản, sử dụng dịch vụ của chúng tôi hoặc liên lạc với chúng tôi. Điều này bao gồm tên, địa chỉ email, ảnh đại diện và các tin nhắn bạn gửi.';

  @override
  String get legalDataUsageTitle => '2. Cách chúng tôi sử dụng dữ liệu';

  @override
  String get legalDataUsageContent =>
      'Dữ liệu của bạn được sử dụng để cung cấp, duy trì và cải thiện các dịch vụ của chúng tôi, bao gồm tạo điều kiện giao tiếp giữa những người dùng, đảm bảo bảo mật và cá nhân hóa trải nghiệm của bạn.';

  @override
  String get legalSecurityTitle => '3. Bảo mật';

  @override
  String get legalSecurityContent =>
      'Chúng tôi áp dụng các biện pháp bảo mật tiêu chuẩn ngành để bảo vệ thông tin cá nhân và tin nhắn của bạn. Quyền truy cập dữ liệu được kiểm soát chặt chẽ và chúng tôi sử dụng mã hóa để bảo mật thông tin nhạy cảm.';

  @override
  String get legalUserRightsTitle => '4. Quyền của bạn';

  @override
  String get legalUserRightsContent =>
      'Bạn có quyền truy cập, chỉnh sửa hoặc xóa dữ liệu cá nhân của mình. Bạn có thể xóa tài khoản của mình bất kỳ lúc nào thông qua cài đặt ứng dụng.';

  @override
  String get legalTermsTitle => '5. Điều khoản Dịch vụ';

  @override
  String get legalTermsContent =>
      'Bằng cách sử dụng nền tảng của chúng tôi, bạn đồng ý không tham gia vào bất kỳ hoạt động lạm dụng, quấy rối hoặc bất hợp pháp nào. Chúng tôi có quyền đình chỉ hoặc chấm dứt các tài khoản vi phạm các điều khoản này.';

  @override
  String get authMsgLoginSuccess => 'Đăng nhập thành công.';

  @override
  String get authMsgLogoutSuccess => 'Đăng xuất thành công.';

  @override
  String get authMsgOtpSent => 'Mã OTP đã được gửi tới email của bạn.';

  @override
  String get authMsgOtpValid => 'Xác thực OTP thành công.';

  @override
  String get authMsgOtpResent => 'Mã OTP mới đã được gửi.';

  @override
  String get authMsgPasswordUpdated =>
      'Cập nhật mật khẩu thành công. Vui lòng đăng nhập lại.';

  @override
  String get authMsgRegisterSuccess =>
      'Đăng ký thành công. Mã OTP đã được gửi tới email của bạn.';

  @override
  String get authMsgAccountUnverifiedOtpSent =>
      'Tài khoản chưa được xác thực. Mã OTP mới đã được gửi tới email của bạn.';

  @override
  String get authErrOtpInvalid => 'Mã OTP không hợp lệ.';

  @override
  String get authErrOtpExpired => 'Mã OTP đã hết hạn.';

  @override
  String get authErrOtpAttemptsExceeded =>
      'Quá nhiều lần nhập sai. Vui lòng yêu cầu mã OTP mới.';

  @override
  String authErrOtpWrongWithRemaining(int remaining) {
    return 'OTP không đúng. Còn $remaining lần thử.';
  }

  @override
  String authErrOtpResendCooldown(int ttl) {
    return 'Vui lòng đợi $ttl giây trước khi yêu cầu mã OTP mới.';
  }

  @override
  String get authErrEmailDomainInvalid =>
      'Tên miền email không tồn tại hoặc không có bản ghi MX.';

  @override
  String get authErrEmailNotFound => 'Email không tồn tại trong hệ thống.';

  @override
  String get authErrEmailInUse => 'Email này đã được sử dụng.';

  @override
  String get authErrValEmailInvalid => 'Định dạng email không hợp lệ.';

  @override
  String get authErrValEmailRequired => 'Email là bắt buộc.';

  @override
  String get authErrValDisplaynameRequired => 'Tên hiển thị là bắt buộc.';

  @override
  String get authErrValDisplaynameTooShort =>
      'Tên hiển thị quá ngắn (tối thiểu 2 ký tự).';

  @override
  String get authErrValPasswordTooShort => 'Mật khẩu phải có ít nhất 8 ký tự.';

  @override
  String authErrAccountLocked(int minutes) {
    return 'Tài khoản tạm thời bị khoá trong $minutes phút do đăng nhập sai quá nhiều lần.';
  }

  @override
  String authErrLoginFailedWithRemaining(int remaining) {
    return 'Email hoặc mật khẩu không đúng. Còn $remaining lần thử.';
  }

  @override
  String authErrLoginFailedLocked(int minutes) {
    return 'Đăng nhập sai quá nhiều lần. Tài khoản bị khoá trong $minutes phút.';
  }

  @override
  String get authErrTokenInvalid => 'Token không hợp lệ.';

  @override
  String get authErrSessionNotFound => 'Phiên không tìm thấy hoặc đã hết hạn.';

  @override
  String get authErrSessionInvalid => 'Phiên không tồn tại hoặc đã hết hạn.';

  @override
  String get authErrSessionRevoked => 'Phiên đã bị thu hồi.';

  @override
  String get authErrRefreshTokenReuse =>
      'Cảnh báo bảo mật: phát hiện tái sử dụng refresh token. Tất cả phiên đã bị thu hồi.';

  @override
  String get authErrRefreshTokenInvalid => 'Refresh token không hợp lệ.';

  @override
  String get authErrRefreshTokenRotated => 'Refresh token đã được xoay vòng.';

  @override
  String get authErrTokenSessionMismatch => 'Token không khớp với phiên.';

  @override
  String get authErrSocialEmailUnavailable =>
      'Không thể lấy email từ tài khoản mạng xã hội.';

  @override
  String get authErrLoginCodeInvalid =>
      'Mã đăng nhập không hợp lệ hoặc đã hết hạn.';

  @override
  String get authErrUserNotFound => 'Không tìm thấy người dùng.';

  @override
  String get integrationsTitle => 'Tích hợp';

  @override
  String get integrationsSubtitle =>
      'Kết nối tài khoản một lần. Từ đó, chỉ cần nhắn cho trợ lý — nó hành động thay bạn, trong giới hạn quyền bạn cấp và không hơn.';

  @override
  String get integrationsSettingsSubtitle =>
      'Kết nối các công cụ trợ lý có thể dùng';

  @override
  String get connectorStatusConnected => 'Đã kết nối';

  @override
  String get connectorStatusAvailable => 'Có sẵn';

  @override
  String get connectorStatusComingSoon => 'Sắp ra mắt';

  @override
  String get connectorConnect => 'Kết nối';

  @override
  String get connectorManage => 'Quản lý';

  @override
  String get connectorDisconnect => 'Ngắt kết nối';

  @override
  String get connectorDisconnectConfirm =>
      'Ngắt kết nối tài khoản này? Trợ lý sẽ mất quyền sử dụng các công cụ của nó.';

  @override
  String get connectorOpenFailed => 'Không thể mở trang ủy quyền.';

  @override
  String get customMcpTitle => 'Thêm máy chủ MCP tùy chỉnh';

  @override
  String get customMcpSubtitle =>
      'Trỏ trợ lý đến bất kỳ máy chủ MCP nào. Chúng tôi sẽ khám phá công cụ và trợ lý có thể sử dụng chúng.';

  @override
  String get customMcpName => 'Tên';

  @override
  String get customMcpUrl => 'URL máy chủ';

  @override
  String get customMcpAuth => 'XÁC THỰC';

  @override
  String get customMcpAuthNone => 'Không';

  @override
  String get customMcpAuthApiKey => 'Khóa API';

  @override
  String get customMcpAuthOauth => 'OAuth';

  @override
  String get customMcpCredential => 'Thông tin xác thực';

  @override
  String get customMcpDiscover => 'Khám phá công cụ';

  @override
  String get customMcpSave => 'Lưu';

  @override
  String get customMcpSaved => 'Đã thêm máy chủ MCP tùy chỉnh.';

  @override
  String customMcpToolsFound(int count) {
    return 'Đã tìm thấy $count công cụ';
  }

  @override
  String get permissionsTitle => 'Quyền AI';

  @override
  String get permissionsSubtitle =>
      'Chọn những hành động trợ lý có thể thực hiện qua trình kết nối này.';

  @override
  String get permView => 'Xem';

  @override
  String get permCreate => 'Tạo';

  @override
  String get permEdit => 'Sửa';

  @override
  String get permDelete => 'Xóa';

  @override
  String get permViewDesc => 'Đọc dữ liệu, tìm kiếm và tóm tắt (chỉ đọc).';

  @override
  String get permCreateDesc => 'Thêm mục mới như tệp, sự kiện hoặc bản ghi.';

  @override
  String get permEditDesc => 'Chỉnh sửa các mục hiện có và nội dung của chúng.';

  @override
  String get permDeleteDesc => 'Xóa vĩnh viễn các mục.';

  @override
  String get permManage => 'Quyền';

  @override
  String get permSaved => 'Đã cập nhật quyền.';

  @override
  String get skillsTitle => 'Kỹ năng';

  @override
  String get skillsSubtitle =>
      'Kỹ năng gói gọn một bộ công cụ và cách làm việc. Chỉ bật những gì bạn cần — mỗi kỹ năng cho biết nó yêu cầu gì.';

  @override
  String get skillsSettingsSubtitle => 'Chọn thế mạnh cho trợ lý của bạn';

  @override
  String skillNeeds(String requirements) {
    return 'Cần $requirements';
  }

  @override
  String get skillSchedulerName => 'Trợ lý lịch';

  @override
  String get skillSchedulerDesc =>
      'Đặt lịch họp, tìm khung giờ, gửi lời mời và nhắc nhở.';

  @override
  String get skillMailWriterName => 'Soạn thư';

  @override
  String get skillMailWriterDesc =>
      'Soạn thư trả lời theo giọng văn của bạn, tóm tắt chuỗi thư dài.';

  @override
  String get skillResearcherName => 'Nghiên cứu';

  @override
  String get skillResearcherDesc =>
      'Tìm trên web và Drive của bạn, trả lời kèm trích dẫn.';

  @override
  String get skillProjectKeeperName => 'Quản lý dự án';

  @override
  String get skillProjectKeeperDesc =>
      'Lưu ghi chú và việc cần làm vào Notion, giữ cơ sở dữ liệu gọn gàng.';

  @override
  String get skillMeetingNotesName => 'Ghi chú cuộc họp';

  @override
  String get skillMeetingNotesDesc =>
      'Tóm tắt cuộc họp và rút ra quyết định cùng việc cần làm.';

  @override
  String get skillInboxTriageName => 'Phân loại hộp thư';

  @override
  String get skillInboxTriageDesc =>
      'Sắp xếp ưu tiên tin nhắn và gợi ý trả lời nhanh.';

  @override
  String get skillDataAnalystName => 'Phân tích dữ liệu';

  @override
  String get skillDataAnalystDesc =>
      'Phân tích bảng và số liệu; làm nổi bật xu hướng và giá trị bất thường.';

  @override
  String get skillDocDrafterName => 'Soạn tài liệu';

  @override
  String get skillDocDrafterDesc =>
      'Soạn đề xuất, đặc tả và báo cáo có cấu trúc.';

  @override
  String get skillTranslatorName => 'Phiên dịch';

  @override
  String get skillTranslatorDesc =>
      'Dịch và bản địa hóa văn bản tự nhiên giữa các ngôn ngữ.';

  @override
  String get adminTitle => 'Bảng quản trị';

  @override
  String get adminSubtitle =>
      'Quản lý workspace, phòng ban, thành viên và vai trò';

  @override
  String get adminBack => 'Quay lại';

  @override
  String get adminLoading => 'Đang tải…';

  @override
  String get adminSave => 'Lưu';

  @override
  String get adminSaving => 'Đang lưu…';

  @override
  String get adminCancel => 'Hủy';

  @override
  String get adminToastSaved => 'Đã lưu';

  @override
  String get adminToastDeleted => 'Đã xóa';

  @override
  String get adminToastError => 'Đã xảy ra lỗi';

  @override
  String get adminMenu => 'Quản trị';

  @override
  String get adminSettingsSubtitle =>
      'Workspace, phòng ban, thành viên & vai trò';

  @override
  String get adminNavWorkspace => 'Workspace';

  @override
  String get adminNavDepartments => 'Phòng ban';

  @override
  String get adminNavMembers => 'Thành viên';

  @override
  String get adminNavRoles => 'Vai trò';

  @override
  String get adminNavAudit => 'Nhật ký';

  @override
  String get adminNavAi => 'Trợ lý AI';

  @override
  String get adminAiInheritHint =>
      'Để trống hoặc chọn \"Kế thừa\" để dùng mặc định của máy chủ.';

  @override
  String get adminAiInheritOption => 'Kế thừa (mặc định)';

  @override
  String get adminAiOn => 'Bật';

  @override
  String get adminAiOff => 'Tắt';

  @override
  String get adminAiPersonaSection => 'Tính cách';

  @override
  String get adminAiPersonaName => 'Tên trợ lý mặc định';

  @override
  String get adminAiTone => 'Giọng điệu mặc định';

  @override
  String get adminAiToneFriendly => 'Thân thiện';

  @override
  String get adminAiToneProfessional => 'Chuyên nghiệp';

  @override
  String get adminAiToneConcise => 'Ngắn gọn';

  @override
  String get adminAiToneCreative => 'Sáng tạo';

  @override
  String get adminAiModelSection => 'Mô hình';

  @override
  String get adminAiModelTier => 'Cấp mô hình mặc định';

  @override
  String get adminAiTierAuto => 'Tự động (bộ định tuyến)';

  @override
  String get adminAiTierSimple => 'Đơn giản';

  @override
  String get adminAiTierMid => 'Cân bằng';

  @override
  String get adminAiTierComplex => 'Nâng cao';

  @override
  String get adminAiCapabilitiesSection => 'Khả năng';

  @override
  String get adminAiWebSearch => 'Tìm kiếm web';

  @override
  String get adminAiWebSearchDesc => 'Cho phép trợ lý tìm kiếm trên web.';

  @override
  String get adminAiThinking => 'Suy luận mở rộng';

  @override
  String get adminAiThinkingDesc => 'Cho phép trợ lý suy luận từng bước.';

  @override
  String get adminAiDigestSection => 'Bản tóm tắt hằng ngày';

  @override
  String get adminAiDailyDigest => 'Bản tóm tắt hằng ngày';

  @override
  String get adminAiDailyDigestDesc =>
      'Đăng một bản tóm tắt mỗi ngày về hoạt động của từng cuộc trò chuyện AI.';

  @override
  String get adminAiDailyDigestHour => 'Thời điểm gửi';

  @override
  String get adminAiDailyDigestHourDesc =>
      'Giờ địa phương gửi bản tóm tắt. Khả dụng khi bật bản tóm tắt.';

  @override
  String get adminAiQuotaSection => 'Giới hạn sử dụng';

  @override
  String get adminAiTokenLimit => 'Giới hạn token hằng tháng';

  @override
  String get adminAiTokenLimitDesc =>
      'Để trống để kế thừa; 0 chặn mọi sử dụng.';

  @override
  String get adminAiConnectorsSection => 'Trình kết nối được phép';

  @override
  String get adminAiRestrictConnectors => 'Hạn chế trình kết nối cho AI';

  @override
  String get adminAiConnectorsInherit =>
      'Kế thừa danh sách cho phép của không gian làm việc.';

  @override
  String get adminAiConnectorsExplicit =>
      'AI chỉ dùng các trình kết nối được chọn bên dưới.';

  @override
  String get adminWsIdentity => 'Nhận diện & thương hiệu';

  @override
  String get adminWsName => 'Tên workspace';

  @override
  String get adminWsNamePlaceholder => 'Công ty ABC';

  @override
  String get adminWsLogoUrl => 'URL logo';

  @override
  String get adminWsPrimaryColor => 'Màu chủ đạo';

  @override
  String get adminWsFeatures => 'Cờ tính năng';

  @override
  String get adminWsNoFeatures => 'Chưa cấu hình cờ tính năng nào.';

  @override
  String get adminWsAllowList => 'Danh sách connector cho phép';

  @override
  String get adminWsAllowListDesc =>
      'Các connector mà thành viên được tự kết nối.';

  @override
  String get adminWsNoCatalog => 'Không có connector nào.';

  @override
  String get adminDeptNew => 'Phòng ban mới';

  @override
  String get adminDeptEdit => 'Sửa phòng ban';

  @override
  String get adminDeptEmpty => 'Chưa có phòng ban nào.';

  @override
  String get adminDeptLead => 'Trưởng phòng';

  @override
  String get adminDeptLeadNone => 'Không có';

  @override
  String get adminDeptName => 'Tên';

  @override
  String get adminDeptDescription => 'Mô tả';

  @override
  String get adminDeptDialogDesc =>
      'Phòng ban nhóm thành viên và sở hữu chat phòng ban.';

  @override
  String adminDeptDeleteConfirm(String name) {
    return 'Xóa phòng ban \"$name\"?';
  }

  @override
  String get adminMemberHint => 'Gán vai trò và phòng ban cho từng thành viên.';

  @override
  String get adminMemberEdit => 'Sửa thành viên';

  @override
  String get adminMemberRevokeNote =>
      'Lưu sẽ thu hồi các phiên đang hoạt động của thành viên.';

  @override
  String get adminMemberRole => 'Vai trò';

  @override
  String get adminMemberRoleNone => 'Không có';

  @override
  String get adminMemberDepartments => 'Phòng ban';

  @override
  String get adminRoleHint =>
      'Bật/tắt quyền cho từng vai trò. Vai trò Owner chỉ đọc.';

  @override
  String get adminRoleCapability => 'Quyền';

  @override
  String get adminRolePreset => 'Mặc định';

  @override
  String get adminRoleClone => 'Nhân bản';

  @override
  String adminRoleCloneTitle(String name) {
    return 'Nhân bản $name';
  }

  @override
  String get adminRoleName => 'Tên vai trò';

  @override
  String get adminAuditTitle => 'Nhật ký kiểm toán';

  @override
  String get adminAuditComingSoon =>
      'Nhật ký kiểm toán sẽ có trong bản cập nhật sắp tới.';

  @override
  String get adminCapManageWorkspace => 'Quản lý workspace';

  @override
  String get adminCapManageDepartments => 'Quản lý phòng ban';

  @override
  String get adminCapManageMembers => 'Quản lý thành viên';

  @override
  String get adminCapManageRoles => 'Quản lý vai trò';

  @override
  String get adminCapConnectWorkspaceConnector => 'Kết nối connector workspace';

  @override
  String get adminCapAddCustomMcp => 'Thêm MCP tùy chỉnh';

  @override
  String get adminCapConnectPersonalConnector => 'Kết nối connector cá nhân';

  @override
  String get adminCapUsePersonalAssistant => 'Dùng trợ lý cá nhân';

  @override
  String get adminCapUseGroupBot => 'Dùng bot nhóm';

  @override
  String get adminCapRunSensitiveSkill => 'Chạy kỹ năng nhạy cảm';

  @override
  String get adminCapViewAuditLog => 'Xem nhật ký kiểm toán';

  @override
  String get adminAuditEmpty => 'Chưa có bản ghi kiểm toán nào.';

  @override
  String get adminAuditPrev => 'Trước';

  @override
  String get adminAuditNext => 'Sau';

  @override
  String get newConvDepartment => 'Phòng ban (tùy chọn)';

  @override
  String get newConvNoDepartment => 'Không có phòng ban';

  @override
  String get loginWithSso => 'Đăng nhập bằng SSO';

  @override
  String get adminNavSso => 'SSO';

  @override
  String get adminSsoTitle => 'Đăng nhập một lần (SSO)';

  @override
  String get adminSsoHint =>
      'Cấu hình đăng nhập OIDC. Thông tin nhà cung cấp đặt trong .env; tại đây bạn ánh xạ nhóm IdP sang vai trò và phòng ban.';

  @override
  String get adminSsoEnabled => 'Bật SSO';

  @override
  String get adminSsoAllowedDomains => 'Tên miền email được phép';

  @override
  String get adminSsoAllowedDomainsHint =>
      'Phân tách bằng dấu phẩy. Để trống để cho phép mọi email đã xác minh.';

  @override
  String get adminSsoDefaultRole => 'Vai trò mặc định';

  @override
  String get adminSsoNone => 'Không';

  @override
  String get adminSsoGroupRoleMap => 'Nhóm → Vai trò';

  @override
  String get adminSsoGroupDeptMap => 'Nhóm → Phòng ban';

  @override
  String get adminSsoGroupPlaceholder => 'Tên nhóm IdP';

  @override
  String get adminSsoAddMapping => 'Thêm ánh xạ';

  @override
  String get sectionDirectoryTitle => 'Danh bạ MCP';

  @override
  String get sectionDirectoryDesc =>
      'Duyệt các máy chủ MCP và kết nối chỉ với một nhấp — OAuth chạy tự động.';

  @override
  String get directoryAdd => 'Thêm mục';

  @override
  String get directorySearch => 'Tìm trong danh bạ…';

  @override
  String get directoryEmpty => 'Không có mục nào khớp với tìm kiếm.';

  @override
  String get directoryEdit => 'Sửa mục';

  @override
  String get directoryDelete => 'Xoá mục';

  @override
  String get tierWorkspace => 'Không gian làm việc';

  @override
  String get tierPersonal => 'Cá nhân';

  @override
  String get tierBoth => 'Cá nhân / Không gian làm việc';

  @override
  String get directorySaveSuccess => 'Đã lưu mục danh bạ.';

  @override
  String get directoryDeleteSuccess => 'Đã xoá mục danh bạ.';

  @override
  String get directoryAddTitle => 'Thêm mục danh bạ';

  @override
  String get directoryEditTitle => 'Sửa mục danh bạ';

  @override
  String get directoryDialogDesc =>
      'Thêm máy chủ MCP công khai để thành viên kết nối chỉ với một nhấp.';

  @override
  String get directorySlug => 'Slug';

  @override
  String get directoryName => 'Tên';

  @override
  String get directoryDescription => 'Mô tả';

  @override
  String get directoryMcpUrl => 'URL MCP';

  @override
  String get directoryAuthMode => 'Chế độ xác thực';

  @override
  String get directoryTier => 'Phạm vi';

  @override
  String get directoryEnvHint =>
      'Với env-oauth: tham chiếu các biến môi trường chứa thông tin client OAuth.';

  @override
  String get directoryEnvClientId => 'Biến Client ID';

  @override
  String get directoryEnvClientSecret => 'Biến Client secret';

  @override
  String get directoryAuthorizeUrl => 'URL Authorize';

  @override
  String get directoryTokenUrl => 'URL Token';

  @override
  String get directoryCancel => 'Huỷ';

  @override
  String get directorySave => 'Lưu';

  @override
  String directoryKeyTitle(String provider) {
    return 'Kết nối $provider';
  }

  @override
  String get directoryKeyLabel => 'API key';

  @override
  String directoryConnected(String provider) {
    return 'Đã kết nối $provider.';
  }

  @override
  String get editNicknames => 'Sửa biệt danh';

  @override
  String get nicknameModalTitle => 'Biệt danh';

  @override
  String get nicknameNonePlaceholder => 'Chưa có biệt danh';

  @override
  String get nicknameYouSuffix => '(bạn)';

  @override
  String get adminNavUsage => 'Sử dụng';

  @override
  String get usageThisMonth => 'Tháng này';

  @override
  String get usageTotalTokens => 'Tổng token';

  @override
  String get usageRequests => 'Yêu cầu';

  @override
  String get usageEstCost => 'Chi phí ước tính';

  @override
  String get usageThumbsDownRate => 'Tỉ lệ không hài lòng';

  @override
  String usageFeedbackBreakdown(int down, int total) {
    return '$down trên $total đã đánh giá';
  }

  @override
  String get usagePerModelTitle => 'Chi phí theo mô hình';

  @override
  String usageModelTokens(String input, String output, String requests) {
    return '$input vào / $output ra · $requests yêu cầu';
  }

  @override
  String get usageTopUsersTitle => 'Người dùng hàng đầu';

  @override
  String usageUserRequests(int count) {
    return '$count yêu cầu';
  }

  @override
  String get usageWorstAnswersTitle => 'Câu trả lời bị đánh giá thấp';

  @override
  String get usageNoPreview => '(không có bản xem trước)';

  @override
  String usageUserComment(String comment) {
    return '“$comment”';
  }

  @override
  String get usageNoData => 'Không có dữ liệu cho giai đoạn này.';

  @override
  String get usageLoadError => 'Không thể tải bảng điều khiển sử dụng.';

  @override
  String get usageRetry => 'Thử lại';

  @override
  String get assistantDefaultName => 'Trợ lý của tôi';

  @override
  String get assistantSubtitle => 'Trợ lý cá nhân của bạn';

  @override
  String get assistantOpenChat => 'Mở trò chuyện với trợ lý';

  @override
  String get assistantSetupCta => 'Thiết lập trợ lý';

  @override
  String get assistantSetupTitle => 'Thiết lập trợ lý của tôi';

  @override
  String get assistantSetupStepName => 'Đặt tên cho trợ lý';

  @override
  String get assistantSetupStepPersona => 'Xác định tính cách';

  @override
  String get assistantSetupStepModel => 'Chọn mô hình';

  @override
  String get assistantSetupStepConfirm => 'Xem lại và tạo';

  @override
  String get assistantSetupNamePlaceholder => 'ví dụ: Aria';

  @override
  String get assistantSetupPersonaPlaceholder =>
      'Bạn là một trợ lý hữu ích, người…';

  @override
  String get assistantSetupPersonaHint =>
      'Mô tả cách trợ lý của bạn trò chuyện và hành xử.';

  @override
  String get assistantSetupCreateButton => 'Tạo trợ lý';

  @override
  String get assistantSetupCreating => 'Đang tạo…';

  @override
  String get assistantSetupSuccess => 'Trợ lý của bạn đã sẵn sàng';

  @override
  String get assistantSettingsTitle => 'Cài đặt trợ lý';

  @override
  String get assistantSettingsEditPersona => 'Tính cách';

  @override
  String get assistantSettingsChangeModel => 'Mô hình';

  @override
  String get assistantSettingsDeleteTitle => 'Xoá trợ lý';

  @override
  String get assistantSettingsDeleteConfirm =>
      'Thao tác này sẽ xoá trợ lý và cuộc trò chuyện của bạn. Không thể hoàn tác.';

  @override
  String get assistantSettingsDeleteButton => 'Xoá trợ lý';

  @override
  String get botAdminTitle => 'Tích hợp Bot';

  @override
  String get botAdminGenerateToken => 'Tạo token';

  @override
  String get botAdminRevokeToken => 'Thu hồi';

  @override
  String get botAdminTokenWarning =>
      'Hãy sao chép token ngay — nó chỉ hiển thị một lần và không thể lấy lại.';

  @override
  String get botAdminCopyToken => 'Sao chép';

  @override
  String get botAdminMcpUrl => 'URL MCP';

  @override
  String get botAdminToken => 'Token tích hợp';

  @override
  String get botAdminLastUsed => 'Lần dùng cuối';

  @override
  String get botAdminNeverUsed => 'Chưa từng dùng';

  @override
  String get botAdminNoBotsRegistered => 'Chưa có bot nào được đăng ký.';

  @override
  String get helpTitle => 'Trợ giúp & Câu hỏi thường gặp';

  @override
  String get settingsHelp => 'Trợ giúp & FAQ';

  @override
  String get settingsHelpSubtitle => 'Trung tâm trợ giúp & câu hỏi thường gặp';

  @override
  String get helpSearchHint => 'Tìm kiếm trợ giúp…';

  @override
  String get helpNoResults => 'Không tìm thấy kết quả';

  @override
  String get helpCatGettingStarted => 'Bắt đầu';

  @override
  String get helpCatMessaging => 'Nhắn tin';

  @override
  String get helpCatAiFeatures => 'Tính năng AI';

  @override
  String get helpCatGroups => 'Nhóm';

  @override
  String get helpCatAccountSecurity => 'Tài khoản & Bảo mật';

  @override
  String get helpGettingStartedQ1 => 'PON là gì?';

  @override
  String get helpGettingStartedA1 =>
      'PON là nền tảng nhắn tin tự lưu trữ tích hợp AI, kết hợp giao tiếp nhóm với trợ lý AI tích hợp. Nền tảng hỗ trợ tin nhắn trực tiếp, trò chuyện nhóm và quy trình làm việc do AI điều khiển.';

  @override
  String get helpGettingStartedQ2 => 'Làm thế nào để tạo tài khoản?';

  @override
  String get helpGettingStartedA2 =>
      'Tài khoản của bạn được quản trị viên không gian làm việc tạo. Bạn sẽ nhận được email mời kèm hướng dẫn để đặt mật khẩu và xác minh tài khoản.';

  @override
  String get helpGettingStartedQ3 => 'Làm thế nào để tìm và thêm bạn bè?';

  @override
  String get helpGettingStartedA3 =>
      'Vào tab Bạn bè và sử dụng thanh tìm kiếm để tìm đồng nghiệp theo tên hoặc email. Gửi lời mời kết bạn và bắt đầu trò chuyện sau khi được chấp nhận.';

  @override
  String get helpGettingStartedQ4 =>
      'Làm thế nào để bắt đầu một cuộc trò chuyện?';

  @override
  String get helpGettingStartedA4 =>
      'Nhấn vào biểu tượng soạn tin trên màn hình trò chuyện, tìm kiếm một liên hệ và chọn họ để mở cuộc trò chuyện mới.';

  @override
  String get helpMessagingQ1 => 'Làm thế nào để gửi tin nhắn?';

  @override
  String get helpMessagingA1 =>
      'Nhập tin nhắn vào ô văn bản ở cuối cuộc trò chuyện và nhấn Enter hoặc nhấn nút gửi.';

  @override
  String get helpMessagingQ2 => 'Tôi có thể gửi tin nhắn thoại không?';

  @override
  String get helpMessagingA2 =>
      'Có! Giữ nút micro trong khu vực nhập tin nhắn để ghi âm tin nhắn thoại. Thả ra để gửi hoặc vuốt để hủy.';

  @override
  String get helpMessagingQ3 => 'Làm thế nào để gửi tệp và hình ảnh?';

  @override
  String get helpMessagingA3 =>
      'Nhấn vào biểu tượng đính kèm bên cạnh ô nhập tin nhắn để chọn hình ảnh, video hoặc tệp từ thiết bị của bạn.';

  @override
  String get helpMessagingQ4 => 'Làm thế nào để ghim tin nhắn quan trọng?';

  @override
  String get helpMessagingA4 =>
      'Nhấn giữ hoặc di chuột qua một tin nhắn, nhấn menu Thêm (⋯) và chọn \'Ghim tin nhắn\'. Tin nhắn đã ghim sẽ hiển thị ở đầu cuộc trò chuyện. Bạn có thể ghim tối đa 2 tin nhắn cho mỗi cuộc trò chuyện.';

  @override
  String get helpMessagingQ5 => 'Biểu cảm tin nhắn là gì?';

  @override
  String get helpMessagingA5 =>
      'Di chuột qua hoặc nhấn giữ một tin nhắn và nhấn biểu tượng emoji để thêm biểu cảm nhanh. Người khác có thể thấy và thêm biểu cảm của riêng họ.';

  @override
  String get helpAiFeaturesQ1 => 'Trợ lý AI có thể làm gì?';

  @override
  String get helpAiFeaturesA1 =>
      'Trợ lý AI (@AI) có thể trả lời câu hỏi, tóm tắt cuộc trò chuyện, hỗ trợ soạn tin nhắn, phân tích tài liệu đã tải lên và thực hiện các tác vụ bằng các công cụ đã kết nối.';

  @override
  String get helpAiFeaturesQ2 =>
      'Làm thế nào để dùng @AI trong cuộc trò chuyện?';

  @override
  String get helpAiFeaturesA2 =>
      'Trong bất kỳ cuộc trò chuyện nào, hãy nhập @AI theo sau là câu hỏi hoặc yêu cầu của bạn. Trợ lý sẽ phản hồi trong luồng trò chuyện.';

  @override
  String get helpAiFeaturesQ3 => 'Bộ nhớ AI là gì?';

  @override
  String get helpAiFeaturesA3 =>
      'Bộ nhớ AI cho phép trợ lý ghi nhớ ngữ cảnh từ các cuộc trò chuyện trước đó, giúp các tương tác trở nên cá nhân hóa và hiệu quả hơn theo thời gian.';

  @override
  String get helpAiFeaturesQ4 => 'Làm thế nào để thiết lập trợ lý cá nhân?';

  @override
  String get helpAiFeaturesA4 =>
      'Vào mục Trợ lý AI và nhấn \'Thiết lập trợ lý\'. Bạn có thể cấu hình tính cách của trợ lý, kết nối công cụ và đặt tùy chọn.';

  @override
  String get helpGroupsQ1 => 'Làm thế nào để tạo một nhóm?';

  @override
  String get helpGroupsA1 =>
      'Nhấn vào biểu tượng soạn tin, chọn \'Nhóm mới\', thêm thành viên bằng cách tìm kiếm tên của họ, đặt tên nhóm và nhấn Tạo.';

  @override
  String get helpGroupsQ2 => 'Làm thế nào để thêm thành viên vào nhóm?';

  @override
  String get helpGroupsA2 =>
      'Mở cuộc trò chuyện nhóm, nhấn vào biểu tượng Cài đặt và chọn \'Thêm thành viên\'. Tìm kiếm liên hệ và thêm họ.';

  @override
  String get helpGroupsQ3 => 'Vai trò trong nhóm là gì?';

  @override
  String get helpGroupsA3 =>
      'Nhóm có hai vai trò: Quản trị viên và Thành viên. Quản trị viên có thể thêm/xóa thành viên, thay đổi tên và ảnh đại diện nhóm, và quản lý cài đặt nhóm.';

  @override
  String get helpAccountSecurityQ1 => 'Làm thế nào để thay đổi ảnh đại diện?';

  @override
  String get helpAccountSecurityA1 =>
      'Vào Cài đặt → Hồ sơ, nhấn vào ảnh đại diện hiện tại và chọn một ảnh mới từ thiết bị của bạn.';

  @override
  String get helpAccountSecurityQ2 => 'Làm thế nào để bật tin nhắn tự hủy?';

  @override
  String get helpAccountSecurityA2 =>
      'Mở một cuộc trò chuyện, nhấn vào biểu tượng Cài đặt, vào Tùy chỉnh trò chuyện và bật \'Tin nhắn tự hủy\' với bộ hẹn giờ bạn muốn.';

  @override
  String get helpAccountSecurityQ3 => 'Làm thế nào để chặn một người dùng?';

  @override
  String get helpAccountSecurityA3 =>
      'Mở cuộc trò chuyện với người dùng, nhấn vào biểu tượng Cài đặt, cuộn đến Quyền riêng tư & Hỗ trợ và chọn \'Chặn người dùng\'.';

  @override
  String get helpAccountSecurityQ4 => 'Làm thế nào để xóa lịch sử tin nhắn?';

  @override
  String get helpAccountSecurityA4 =>
      'Mở cuộc trò chuyện, nhấn Cài đặt, vào Quyền riêng tư & Hỗ trợ và chọn \'Xóa lịch sử\'. Thao tác này chỉ xóa lịch sử khỏi thiết bị của bạn.';
}
