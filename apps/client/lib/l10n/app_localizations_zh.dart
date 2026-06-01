// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Chinese (`zh`).
class AppLocalizationsZh extends AppLocalizations {
  AppLocalizationsZh([String locale = 'zh']) : super(locale);

  @override
  String get appName => 'PON';

  @override
  String get languageName => '中文';

  @override
  String get actionCancel => '取消';

  @override
  String get actionConfirm => '确认';

  @override
  String get actionRetry => '重试';

  @override
  String get actionSave => '保存';

  @override
  String get actionLogout => '退出登录';

  @override
  String get actionDelete => '删除';

  @override
  String get actionLeave => '退出';

  @override
  String get loadingDots => '...';

  @override
  String errorWithMsg(String error) {
    return '错误：$error';
  }

  @override
  String get loginTitle => '登录';

  @override
  String get fieldEmail => '邮箱';

  @override
  String get fieldPassword => '密码';

  @override
  String get forgotPasswordLink => '忘记密码？';

  @override
  String get loginButton => '登录';

  @override
  String get noAccountYet => '还没有账号？ ';

  @override
  String get registerNow => '立即注册';

  @override
  String get valEmailRequired => '请输入邮箱';

  @override
  String get valEmailInvalid => '邮箱无效';

  @override
  String get valPasswordRequired => '请输入密码';

  @override
  String get valPasswordMin6 => '密码至少6个字符';

  @override
  String get errInvalidCredentials => '邮箱或密码错误';

  @override
  String get errNetwork => '无法连接服务器，请检查网络';

  @override
  String get errLoginFailed => '登录失败，请重试';

  @override
  String get registerTitle => '创建账号';

  @override
  String get welcomeToApp => '欢迎来到 PON';

  @override
  String get fieldDisplayName => '显示名称';

  @override
  String get fieldConfirmPassword => '确认密码';

  @override
  String get registerButton => '注册';

  @override
  String get haveAccount => '已有账号？ ';

  @override
  String get loginLink => '登录';

  @override
  String get valNameRequired => '请输入姓名';

  @override
  String get valNameMin2 => '姓名至少2个字符';

  @override
  String get valPasswordMismatch => '两次密码不一致';

  @override
  String get errEmailExists => '该邮箱已被注册';

  @override
  String get errRegisterFailed => '注册失败，请重试';

  @override
  String get verifyOtpTitle => '验证 OTP';

  @override
  String get verifyAccountHeading => '验证你的账号';

  @override
  String otpSentTo(String email) {
    return '6位验证码已发送至\n$email';
  }

  @override
  String get fieldOtp => '验证码';

  @override
  String get confirmButton => '确认';

  @override
  String resendIn(int seconds) {
    return '$seconds秒后重新发送';
  }

  @override
  String get resendOtp => '重新发送验证码';

  @override
  String get otpResent => '新的验证码已发送至你的邮箱';

  @override
  String get errResendFailed => '发送失败，请稍后再试';

  @override
  String get valOtp6 => '请输入6位验证码';

  @override
  String get verifySuccess => '验证成功！立即登录';

  @override
  String get errVerifyFailed => '验证失败，请重试';

  @override
  String get forgotTitle => '重置密码';

  @override
  String get forgotHeading => '忘记密码？';

  @override
  String get forgotSubtitle => '输入邮箱以接收验证码并设置新密码';

  @override
  String get sendOtpButton => '发送验证码';

  @override
  String get errEmailNotRegistered => '该邮箱尚未注册';

  @override
  String get errSendRequestFailed => '请求失败，请重试';

  @override
  String get newPasswordTitle => '新密码';

  @override
  String get newPasswordHeading => '创建新密码';

  @override
  String newPasswordSubtitle(String email) {
    return '输入发送至 $email 的验证码\n以及你的新密码';
  }

  @override
  String get fieldNewPassword => '新密码';

  @override
  String get valNewPasswordRequired => '请输入新密码';

  @override
  String get resetPasswordSuccess => '密码重置成功！';

  @override
  String get errOtpInvalidExpired => '验证码错误或已过期';

  @override
  String get errResetFailed => '密码重置失败，请重试';

  @override
  String get settingsTitle => '设置';

  @override
  String get valNameEmpty => '名称不能为空';

  @override
  String get nameUpdated => '显示名称已更新';

  @override
  String get personalInfo => '个人信息';

  @override
  String get appearance => '外观';

  @override
  String get chooseThemeTitle => '选择主题';

  @override
  String get themeLight => '浅色主题';

  @override
  String get themeDark => '深色主题';

  @override
  String get themeSystem => '跟随系统';

  @override
  String get language => '语言';

  @override
  String get chooseLanguageTitle => '选择语言';

  @override
  String get logoutConfirmBody => '确定要退出登录吗？';

  @override
  String get onboardingChooseTheme => '选择主题';

  @override
  String get onboardingChooseSubtitle => '选择最适合你的界面风格。';

  @override
  String get themeLightSubtitle => '明亮、清晰、易于阅读';

  @override
  String get themeDarkSubtitle => '现代、神秘、护眼';

  @override
  String get themeSystemSubtitle => '自动跟随你的设备';

  @override
  String get startExperience => '开始体验';

  @override
  String get tooltipSettings => '设置';

  @override
  String get tooltipNewConversation => '新会话';

  @override
  String get listLoadFailed => '无法加载列表';

  @override
  String get listCheckNetwork => '请检查网络连接后重试。';

  @override
  String get listGenericError => '出错了，请稍后再试。';

  @override
  String get emptyConversations => '暂无会话';

  @override
  String get emptyTapPlus => '点击下方的“+”按钮开始吧！';

  @override
  String get offlineBanner => '无网络连接';

  @override
  String get conversationDefault => '会话';

  @override
  String get newConversationTitle => '新会话';

  @override
  String get startConversationHeading => '开始会话';

  @override
  String get fieldRecipient => '对方邮箱或用户ID';

  @override
  String get valRecipientRequired => '请输入邮箱或用户ID';

  @override
  String get errUserNotFoundEmail => '未找到使用该邮箱的用户。';

  @override
  String get errUserNotFoundOrConn => '未找到用户或连接出错。';

  @override
  String get startConversationButton => '开始聊天';

  @override
  String get chatDefaultTitle => '聊天';

  @override
  String get statusOnline => '在线';

  @override
  String get statusOffline => '离线';

  @override
  String get typingLabel => '正在输入';

  @override
  String get messageHint => '输入消息…';

  @override
  String get tabChats => '聊天';

  @override
  String get newGroup => '新建群组';

  @override
  String get newDirect => '新建聊天';

  @override
  String get createGroup => '创建群组';

  @override
  String get groupName => '群组名称';

  @override
  String get valGroupNameRequired => '请输入群组名称';

  @override
  String get selectMembers => '选择成员';

  @override
  String get valSelectMembers => '请至少选择2位成员';

  @override
  String get searchUsers => '按姓名或邮箱搜索';

  @override
  String get groupInfo => '群组信息';

  @override
  String get members => '成员';

  @override
  String membersCount(int count) {
    return '$count 位成员';
  }

  @override
  String get addMembers => '添加成员';

  @override
  String get removeMember => '移出群组';

  @override
  String get leaveGroup => '退出群组';

  @override
  String get leaveGroupConfirm => '确定要退出该群组吗？';

  @override
  String get renameGroup => '重命名群组';

  @override
  String get admin => '管理员';

  @override
  String get you => '你';

  @override
  String systemAddedMember(String actor, String target) {
    return '$actor 添加了 $target';
  }

  @override
  String systemRemovedMember(String actor, String target) {
    return '$actor 移除了 $target';
  }

  @override
  String systemLeftGroup(String actor) {
    return '$actor 退出了群组';
  }

  @override
  String systemRenamedGroup(String actor, String name) {
    return '$actor 将群组重命名为 $name';
  }

  @override
  String systemCreatedGroup(String actor) {
    return '$actor 创建了群组';
  }

  @override
  String get actionReply => '回复';

  @override
  String get actionRecall => '撤回';

  @override
  String get actionDeleteForMe => '删除（仅自己）';

  @override
  String get actionCopy => '复制';

  @override
  String get actionReact => '表态';

  @override
  String get messageRecalled => '消息已撤回';

  @override
  String replyingTo(String name) {
    return '正在回复 $name';
  }

  @override
  String get copiedToClipboard => '已复制到剪贴板';

  @override
  String get recallConfirm => '对所有人撤回这条消息吗？';

  @override
  String get deleteConversation => '删除会话';

  @override
  String get deleteConversationConfirm => '删除该会话？它将从你的列表中隐藏。';

  @override
  String get clearHistory => '清空聊天记录';

  @override
  String get clearHistoryConfirm => '为你清空该会话中的所有消息吗？';

  @override
  String get disappearingMessages => '阅后即焚消息';

  @override
  String get disappearingOff => '关闭';

  @override
  String get disappearing24h => '24 小时';

  @override
  String get disappearing7d => '7 天';

  @override
  String get changeAvatar => '更换头像';

  @override
  String get uploadFailed => '上传失败，请重试';

  @override
  String get lastSeenJustNow => '刚刚在线';

  @override
  String lastSeenMinutes(int minutes) {
    return '$minutes 分钟前在线';
  }

  @override
  String lastSeenHours(int hours) {
    return '$hours 小时前在线';
  }

  @override
  String lastSeenDays(int days) {
    return '$days 天前在线';
  }

  @override
  String get dateToday => '今天';

  @override
  String get dateYesterday => '昨天';

  @override
  String get attachPhoto => '照片';

  @override
  String get attachVideo => '视频';

  @override
  String get uploading => '上传中…';

  @override
  String get downloadMedia => '下载';

  @override
  String get attachmentLabel => '📎 附件';

  @override
  String get callIncoming => '来电';

  @override
  String callIncomingBody(String name) {
    return '$name 正在呼叫您';
  }

  @override
  String callCalling(String name) {
    return '正在呼叫 $name…';
  }

  @override
  String get callConnecting => '连接中…';

  @override
  String get callMediaError => '无法访问摄像头/麦克风（需要 HTTPS 或 localhost）';

  @override
  String get callUnknownCaller => '某人';
}
