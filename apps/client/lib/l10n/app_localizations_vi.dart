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
  String get uploading => 'Đang tải lên…';

  @override
  String get downloadMedia => 'Tải về';

  @override
  String get attachmentLabel => '📎 Tệp đính kèm';
}
