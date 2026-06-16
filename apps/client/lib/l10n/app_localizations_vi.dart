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
  String get endToEndEncrypted => 'Được mã hóa đầu cuối';

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
}
