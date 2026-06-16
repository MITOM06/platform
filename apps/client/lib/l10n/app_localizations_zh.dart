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
  String get searchConversationsHint => 'Search conversations...';

  @override
  String get noConversationsFound => 'No conversations found';

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
    return '$count 名成员';
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
  String get actionEdit => '编辑';

  @override
  String get messageEdited => '(已编辑)';

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
  String get attachFile => '文件';

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

  @override
  String get profileTitle => '个人资料';

  @override
  String get editProfile => '编辑资料';

  @override
  String get bio => '简介';

  @override
  String friendsCountLabel(int count) {
    return '$count 位好友';
  }

  @override
  String get messageAction => '发消息';

  @override
  String get activeFriends => '在线好友';

  @override
  String get noFriendsOnline => '没有好友在线';

  @override
  String get strangerBannerTitle => '消息请求';

  @override
  String get strangerBannerBody => '此人不在你的联系人中。接受后即可回复。';

  @override
  String get acceptRequest => '接受';

  @override
  String get rejectRequest => '拒绝';

  @override
  String get friends => '好友';

  @override
  String get contacts => '通讯录';

  @override
  String get friendRequests => '好友请求';

  @override
  String get addFriend => '加为好友';

  @override
  String get friendRequestSent => '好友请求已发送';

  @override
  String get acceptFriend => '接受';

  @override
  String get noFriends => '还没有好友';

  @override
  String get noFriendRequests => '没有待处理的请求';

  @override
  String get friendRequestPending => '待处理';

  @override
  String get friendsTabSearch => '搜索';

  @override
  String get declineFriend => '拒绝';

  @override
  String get searchUsersPrompt => '搜索可添加为好友的用户';

  @override
  String get noSearchResults => '未找到用户';

  @override
  String get unfriend => '删除好友';

  @override
  String get unfriendConfirm => '确定删除该好友吗？';

  @override
  String get blockUser => '拉黑';

  @override
  String get unblockUser => '解除拉黑';

  @override
  String get blockUserConfirm => '拉黑该用户？你们将无法互相发送消息。';

  @override
  String get blockedComposerNotice => '你无法向此聊天发送消息';

  @override
  String get userBlocked => '已拉黑该用户';

  @override
  String get userUnblocked => '已解除拉黑';

  @override
  String get mentionNotificationTitle => '提到了你';

  @override
  String mentionNotificationBody(String name) {
    return '$name 提到了你';
  }

  @override
  String get searchMessages => '搜索消息';

  @override
  String get searchHint => '在对话中搜索';

  @override
  String get searchNoResults => '未找到消息';

  @override
  String get exploreChannels => '探索频道';

  @override
  String get searchChannelsHint => '搜索频道…';

  @override
  String get noPublicChannels => '未找到公开频道';

  @override
  String get joinChannel => '加入';

  @override
  String get pinMessage => '置顶';

  @override
  String get unpinMessage => '取消置顶';

  @override
  String get pinnedMessagesTitle => '置顶消息';

  @override
  String get pinLimitReached => '最多只能置顶 2 条消息';

  @override
  String get cannotPinCall => '通话无法置顶';

  @override
  String get forwardMessage => '转发';

  @override
  String get messageForwarded => '消息已转发';

  @override
  String get forwardFailed => '转发失败';

  @override
  String get noConversationsToForward => '没有可转发的对话';

  @override
  String get rateLimitError => '消息发送过于频繁，请放慢速度。';

  @override
  String get sharedMediaTitle => '共享媒体与文件';

  @override
  String get tabMedia => '媒体';

  @override
  String get tabFiles => '文件';

  @override
  String get tabLinks => '链接';

  @override
  String get noMediaFound => '未找到媒体';

  @override
  String get noFilesFound => '未找到文件';

  @override
  String get noLinksFound => '未找到链接';

  @override
  String get reactionsDetail => '表情反应';

  @override
  String get changePasswordTitle => '修改密码';

  @override
  String get currentPassword => '当前密码';

  @override
  String get newPassword => '新密码';

  @override
  String get confirmPassword => '确认新密码';

  @override
  String get dateOfBirth => '出生日期';

  @override
  String get notSet => '未设置';

  @override
  String get passwordChangedSuccess => '密码修改成功';

  @override
  String get errCurrentPasswordIncorrect => '当前密码不正确';

  @override
  String get changeCoverPhoto => '修改背景图片';

  @override
  String get markAsRead => '标为已读';

  @override
  String get markAsUnread => '标为未读';

  @override
  String get muteNotifications => '静音通知';

  @override
  String get unmuteNotifications => '取消静音';

  @override
  String get viewProfile => '查看个人资料';

  @override
  String get voiceCall => '语音通话';

  @override
  String get videoCall => '视频通话';

  @override
  String get archiveChat => '归档聊天';

  @override
  String get unarchiveChat => '取消归档';

  @override
  String get mutedLabel => '已静音';

  @override
  String get newNotificationTitle => '新消息';

  @override
  String newNotificationBody(String name) {
    return '$name 给你发了一条消息';
  }

  @override
  String get archivedChats => '已归档的聊天';

  @override
  String get archivedChatsSubtitle => '查看已归档的对话';

  @override
  String get emptyArchivedChats => '没有已归档的聊天';

  @override
  String get webNoChatSelected => '选择一个会话开始聊天';

  @override
  String get endToEndEncrypted => '端对端加密';

  @override
  String get chatInfoCategory => '聊天详情';

  @override
  String get customizeChatCategory => '自定义聊天';

  @override
  String get filesAndMediaCategory => '媒体、文件和链接';

  @override
  String get privacyAndSupportCategory => '隐私与支持';

  @override
  String get callSelectMember => '选择成员拨打电话';

  @override
  String get profileHideInfo => '隐藏个人信息';

  @override
  String get profileInfoHidden => '个人信息已被隐藏';

  @override
  String get profileGender => '性别';

  @override
  String get profilePhone => '电话号码';

  @override
  String get profileBio => '简介';

  @override
  String get profileDateOfBirth => '出生日期';

  @override
  String get profileEditMode => '编辑资料';

  @override
  String get profileSave => '保存';

  @override
  String get actionMessage => '发消息';

  @override
  String get actionAddFriend => '加好友';

  @override
  String get actionBlock => '拉黑';

  @override
  String get readDetails => '已读详情';

  @override
  String get seenStatus => '已看';

  @override
  String get noReadsYet => '暂无人阅读';

  @override
  String get voiceMicTooltip => '语音消息';

  @override
  String get recording => '录音中...';

  @override
  String get stickerLabel => '贴纸';

  @override
  String get emojiTab => '表情';

  @override
  String get aiAssistant => 'AI助手';

  @override
  String get startChatWithAI => '与PON AI聊天';

  @override
  String get aiThinking => 'AI正在思考...';

  @override
  String get aiError => 'AI暂时不可用。请重试。';

  @override
  String get aiErrorRetry => '重试';

  @override
  String get aiMessageDeleted => '消息已删除';

  @override
  String get aiMemoryTitle => 'AI记忆';

  @override
  String get aiMemoryEmptyState => '暂无记忆。与PON AI聊天以开始建立记忆。';

  @override
  String get aiMemoryDeleteConfirm => '删除此记忆？AI将不再记住此对话的上下文。';

  @override
  String get aiMemoryDeleted => '记忆已删除';

  @override
  String aiMemoryUpdated(String date) {
    return '更新于 $date';
  }

  @override
  String get aiMemoryFacts => '关键事实：';

  @override
  String get viewAiMemory => '查看记忆';

  @override
  String get kbTitle => '知识库';

  @override
  String get kbEmptyState => '暂无文档。\n点击上传按钮添加 PDF、DOCX 或 TXT 文件。';

  @override
  String get kbUploadButton => '上传文档';

  @override
  String get kbDeleteConfirm => '删除此文档？';

  @override
  String get kbProcessing => '处理中';

  @override
  String get kbReady => '就绪';

  @override
  String get kbError => '错误';

  @override
  String get kbManage => '知识库';

  @override
  String get kbSources => '来源';

  @override
  String get kbChunks => '块';

  @override
  String aiToolCalling(String toolName) {
    return '正在使用工具：$toolName';
  }

  @override
  String get aiToolTrace => '工具日志';

  @override
  String get toolSearchMessages => '正在搜索消息...';

  @override
  String get toolGetUserInfo => '正在查询用户信息...';

  @override
  String get toolSearchKnowledgeBase => '正在搜索知识库...';

  @override
  String get toolSummarizeConversation => '正在总结对话...';

  @override
  String get toolCreateReminder => '正在创建提醒...';

  @override
  String get reminders => '提醒';

  @override
  String get remindersEmpty => '暂无待处理提醒。\n请让 PON AI 为您设置提醒。';

  @override
  String get reminderDone => '标记为完成';

  @override
  String get tokenUsage => 'Token 用量';

  @override
  String get tokenUsageTitle => 'Token 用量仪表板';

  @override
  String get tokenUsageThisMonth => '本月总 Token';

  @override
  String get tokenUsageRequests => 'AI 请求次数';

  @override
  String get tokenUsageEstCost => '预估费用 (USD)';

  @override
  String get tokenUsageDailyChart => '每日 Token 用量（最近 30 天）';

  @override
  String get aiTraceTitle => 'AI 追踪';

  @override
  String get aiTraceThinking => '思考过程';

  @override
  String get aiTraceTools => '工具调用';

  @override
  String get aiTraceStats => '统计';

  @override
  String get aiPersonaTitle => 'AI 角色';

  @override
  String get avatarUploadLabel => 'Change avatar';

  @override
  String get aiPersonaNameHint => '机器人名称（例如：DevBot）';

  @override
  String get aiPersonaInstructionsHint => '自定义指令（例如：始终以列表形式回答）';

  @override
  String get aiPersonaAdminOnly => '只有群组管理员才能配置 AI 角色。';

  @override
  String get configureAiPersona => '配置 AI 角色';

  @override
  String get aiPersonaToneFriendly => '友好';

  @override
  String get aiPersonaToneProfessional => '专业';

  @override
  String get aiPersonaToneConcise => '简洁';

  @override
  String get aiPersonaToneCreative => '创意';

  @override
  String get aiQuotaExceeded => '已超出每月 AI 使用配额。请联系您的管理员。';

  @override
  String get viewUsage => '查看用量';

  @override
  String get tokenUsageQuota => '月度配额';

  @override
  String get errEmailDomainInvalid => 'This email address does not exist';

  @override
  String get valPasswordMin8 => 'Password must be at least 8 characters';

  @override
  String get valPasswordUppercase => 'Must contain an uppercase letter (A-Z)';

  @override
  String get valPasswordLowercase => 'Must contain a lowercase letter (a-z)';

  @override
  String get valPasswordDigit => 'Must contain a digit (0-9)';

  @override
  String get valPasswordSpecial =>
      'Must contain a special character (!@#\$%^&*)';

  @override
  String get pwStrengthWeak => 'Weak';

  @override
  String get pwStrengthMedium => 'Medium';

  @override
  String get pwStrengthStrong => 'Strong';

  @override
  String get pwStrengthVeryStrong => 'Very Strong';

  @override
  String get pwReqLength => '≥8 characters';

  @override
  String get pwReqUppercase => 'Uppercase (A-Z)';

  @override
  String get pwReqLowercase => 'Lowercase (a-z)';

  @override
  String get pwReqDigit => 'Digit (0-9)';

  @override
  String get pwReqSpecial => 'Special char (!@#\$...)';

  @override
  String get loginWithGoogle => 'Sign in with Google';

  @override
  String get registerWithGoogle => 'Sign up with Google';

  @override
  String get orContinueWith => 'Or continue with';

  @override
  String agreeToTerms(String privacyPolicy, String termsOfService) {
    return '我同意$privacyPolicy和$termsOfService';
  }

  @override
  String get privacyPolicy => '隐私政策';

  @override
  String get termsOfService => '服务条款';

  @override
  String get valMustAgreeTerms => '您必须同意服务条款才能注册';

  @override
  String get youColon => 'You:';

  @override
  String get systemNicknameChanged => 'Nickname was changed';

  @override
  String get systemThemeChanged => 'Chat theme changed';

  @override
  String get systemQuickReactionChanged => 'Quick reaction changed';

  @override
  String get wallpaperUploadError => 'Failed to upload image';

  @override
  String get wallpaperScale => 'Scale';

  @override
  String get wallpaperPreviewHint => 'Pinch or drag to adjust';

  @override
  String get wallpaperPreviewIncoming => 'Hi! How does this look?';

  @override
  String get wallpaperPreviewOutgoing => 'Looks great 🎉';

  @override
  String get errCannotOpenLink => '无法打开链接';

  @override
  String sysNicknameClearedSelf(String actorName) {
    return '$actorName清除了自己的昵称';
  }

  @override
  String sysNicknameClearedOther(String actorName, String targetName) {
    return '$actorName清除了$targetName的昵称';
  }

  @override
  String sysNicknameSetSelf(String actorName, String nickname) {
    return '$actorName将自己的昵称设置为$nickname';
  }

  @override
  String sysNicknameSetOther(
      String actorName, String targetName, String nickname) {
    return '$actorName将$targetName的昵称设置为$nickname';
  }

  @override
  String sysThemeChanged(String actorName) {
    return '$actorName更改了聊天主题';
  }

  @override
  String sysQuickReactionChanged(String actorName, String emoji) {
    return '$actorName将快捷表情更改为$emoji';
  }

  @override
  String sysGroupCreated(String actorName) {
    return '$actorName创建了群组';
  }

  @override
  String sysMembersAdded(String actorName) {
    return '$actorName添加了新成员';
  }

  @override
  String sysMemberLeft(String actorName) {
    return '$actorName离开了群组';
  }

  @override
  String sysMemberRemoved(String actorName) {
    return '$actorName移除了一位成员';
  }

  @override
  String sysMemberJoined(String actorName) {
    return '$actorName加入了群组';
  }

  @override
  String systemVideoCallEnded(String duration) {
    return '视频通话已结束 · $duration';
  }

  @override
  String systemVoiceCallEnded(String duration) {
    return '语音通话已结束 · $duration';
  }

  @override
  String get systemVideoCallMissed => '未接视频通话';

  @override
  String get systemVoiceCallMissed => '未接语音通话';

  @override
  String get errActionFailed => '出现错误，请重试。';

  @override
  String get kbDeleteFailed => '删除失败，请重试';

  @override
  String get exploreJoinFailed => '加入频道失败';

  @override
  String get unnamedChannel => '未命名';

  @override
  String get actionOk => '确定';

  @override
  String get reminderDeleteConfirm => '删除此提醒？';

  @override
  String get profileNameLabel => '姓名';

  @override
  String get genderMale => '男';

  @override
  String get genderFemale => '女';

  @override
  String get genderOther => '其他';

  @override
  String get aiPersonaSaved => '已保存';

  @override
  String get aiPersonaResetTitle => '重置 AI 角色';

  @override
  String get aiPersonaResetConfirm => '将 AI 角色重置为默认设置？';

  @override
  String get aiPersonaToneLabel => '语气';

  @override
  String get aiPersonaResetToDefault => '重置为默认';

  @override
  String tokenUsagePercentUsed(String percent) {
    return '本月已使用 $percent%';
  }

  @override
  String tokenUsageCostUsd(String amount) {
    return '$amount 美元';
  }

  @override
  String get notifications => '通知';

  @override
  String get notificationsEnabled => '通知已开启';

  @override
  String get notificationsDisabled => '通知已关闭';
}
