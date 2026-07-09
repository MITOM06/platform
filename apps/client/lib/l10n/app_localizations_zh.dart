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
  String get notificationsTitle => '通知';

  @override
  String get notificationsSectionUnread => '未读';

  @override
  String get notificationsSectionRead => '已读';

  @override
  String get notificationsEmpty => '暂无通知';

  @override
  String get notificationsMarkAllRead => '全部标记为已读';

  @override
  String get notificationAccept => '接受';

  @override
  String get notificationDecline => '拒绝';

  @override
  String notificationFriendRequestTitle(String name) {
    return '$name 向你发送了好友请求';
  }

  @override
  String notificationFriendAcceptedTitle(String name) {
    return '$name 接受了你的好友请求';
  }

  @override
  String get notificationPhoneSetupTitle => '验证手机号码';

  @override
  String get notificationPhoneSetupBody => '添加并验证手机号码，让好友能找到你并增强账户安全性。';

  @override
  String get notificationPasswordSetupTitle => '保护你的账户';

  @override
  String get notificationPasswordSetupBody => '你的账户还没有设置密码。请设置密码以增强安全性。';

  @override
  String get securityTitle => '密码与安全';

  @override
  String get securitySubtitle => '更改你的密码';

  @override
  String get securityNoPasswordCardSubtitle => '未设置密码';

  @override
  String get securityNoPasswordTitle => '尚未设置密码';

  @override
  String get securityNoPasswordSubtitle => '设置密码以保护账户并启用基于电子邮件的恢复。';

  @override
  String get securityChangePasswordTitle => '更改密码';

  @override
  String get securityChangePasswordSubtitle => '更新你当前的密码。';

  @override
  String get securitySetPasswordTitle => '设置密码';

  @override
  String get securitySetPasswordSubtitle => '为账户添加密码以增强安全性。';

  @override
  String get securitySetButton => '设置密码';

  @override
  String get securityChangeButton => '更改密码';

  @override
  String get securitySetSuccess => '密码设置成功';

  @override
  String get securityTwoFaTitle => '双重验证';

  @override
  String get securityTwoFaSubtitle => '为你的账户增加一层安全保护。';

  @override
  String get securityTwoFaComingSoon => '双重验证即将推出。';

  @override
  String get securityComingSoon => '即将推出';

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
  String get errSlow => '连接过慢，请重试';

  @override
  String get errSessionExpired => '登录会话已过期';

  @override
  String get errForbidden => '您没有执行此操作的权限';

  @override
  String get errNotFound => '未找到数据';

  @override
  String get errConflict => '数据已存在';

  @override
  String get errInvalidData => '数据无效';

  @override
  String get errServer => '服务器错误，请稍后重试';

  @override
  String errRequestFailed(String code) {
    return '请求失败（$code）';
  }

  @override
  String get errCancelled => '请求已取消';

  @override
  String get errConnection => '连接出错，请重试';

  @override
  String get errGeneric => '出错了，请重试';

  @override
  String get detailsTitle => '详情';

  @override
  String get themeMenuItem => '主题';

  @override
  String get quickReactionTitle => '快捷表情';

  @override
  String get wallpaperDefaultName => '默认';

  @override
  String get wallpaperCategoryColors => '简约配色';

  @override
  String get wallpaperCategoryVibrant => '鲜艳渐变';

  @override
  String get wallpaperCategoryMinimal => '极简';

  @override
  String get wallpaperShowMore => '显示更多';

  @override
  String get wallpaperShowLess => '收起';

  @override
  String get wallpaperCategoryThemes => '主题';

  @override
  String get wallpaperThemeForest => '森林';

  @override
  String get wallpaperThemeOcean => '海洋';

  @override
  String get wallpaperThemeMountain => '雪山';

  @override
  String get wallpaperThemeCherryBlossom => '樱花';

  @override
  String get wallpaperThemeSpace => '太空';

  @override
  String get wallpaperThemeAurora => '极光';

  @override
  String get wallpaperThemeCityNight => '城市夜景';

  @override
  String get wallpaperThemeDesert => '沙漠';

  @override
  String get wallpaperPresetMidnightGlow => '午夜微光';

  @override
  String get wallpaperPresetNeonTeal => '霓虹青';

  @override
  String get wallpaperPresetSunset => '日落';

  @override
  String get wallpaperPresetSweetPink => '甜美粉';

  @override
  String get wallpaperPresetDarkShadow => '暗影';

  @override
  String get wallpaperPresetOceanBlue => '海洋蓝';

  @override
  String get wallpaperPresetForestGreen => '森林绿';

  @override
  String get wallpaperPresetPurpleHaze => '紫雾';

  @override
  String get wallpaperPresetWarmAmber => '暖琥珀';

  @override
  String get wallpaperPresetRoseGold => '玫瑰金';

  @override
  String get wallpaperPresetStorm => '风暴';

  @override
  String get wallpaperPresetCherryBlossom => '樱花';

  @override
  String get wallpaperPresetMidnightPurple => '午夜紫';

  @override
  String get wallpaperPresetCoralReef => '珊瑚礁';

  @override
  String get wallpaperPresetArcticIce => '北极冰';

  @override
  String get wallpaperPresetAurora => '极光';

  @override
  String get wallpaperPresetGalaxy => '银河';

  @override
  String get wallpaperPresetFireIce => '冰与火';

  @override
  String get wallpaperPresetTropical => '热带';

  @override
  String get wallpaperPresetCandy => '糖果';

  @override
  String get wallpaperPresetPureDark => '纯黑';

  @override
  String get wallpaperPresetSoftGray => '柔灰';

  @override
  String get wallpaperPresetWarmNight => '暖夜';

  @override
  String get changeChatThemeTitle => '更改聊天主题';

  @override
  String get uploadImageButton => '上传图片';

  @override
  String get imageFitLabel => '图片适配';

  @override
  String get fitCoverLabel => '覆盖';

  @override
  String get fitContainLabel => '适应';

  @override
  String get fitFillLabel => '拉伸';

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
  String get searchConversationsHint => '搜索会话...';

  @override
  String get noConversationsFound => '未找到会话';

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
  String get tabArchived => '已归档';

  @override
  String get tabRequests => '请求';

  @override
  String get noRequests => '没有待处理的请求';

  @override
  String get declineRequest => '拒绝';

  @override
  String get dmRequestSubtitle => '想给你发消息';

  @override
  String get groupInviteSubtitle => '邀请您加入群组';

  @override
  String get blockedChatsTitle => '已屏蔽的聊天';

  @override
  String get newGroup => '新建群组';

  @override
  String get newDirect => '新建聊天';

  @override
  String get createGroup => '创建群组';

  @override
  String get groupName => '群组名称';

  @override
  String get groupDefaultName => '群组';

  @override
  String get valGroupNameRequired => '请输入群组名称';

  @override
  String get selectMembers => '选择成员';

  @override
  String get valSelectMembers => '请至少选择2位成员';

  @override
  String get searchUsers => '按姓名、邮箱或电话搜索';

  @override
  String get phoneSearchHint => '请输入完整电话号码进行搜索';

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
  String get someone => '某人';

  @override
  String get aiHubTitle => 'AI 中心';

  @override
  String get aiHubSubtitle => '关于你的 AI 助手的一切';

  @override
  String get aiHubStartChat => '开始与 PON AI 聊天';

  @override
  String get aiHubMemory => '记忆';

  @override
  String get aiHubIntegrations => '连接器';

  @override
  String get aiHubSkills => '技能';

  @override
  String get aiHubTokenUsage => '用量';

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
  String get messageSendFailedRetry => '发送失败，点按重试。';

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
  String get attachVoice => '语音消息';

  @override
  String get attachSticker => '贴纸';

  @override
  String get pinnedMessageTitle => '置顶消息';

  @override
  String get pinnedSystemMessage => '系统消息';

  @override
  String get uploading => '上传中…';

  @override
  String get downloadMedia => '下载';

  @override
  String get imageDownloadHd => '查看高清';

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
  String get callToggleMic => '切换麦克风';

  @override
  String get callToggleCam => '切换摄像头';

  @override
  String get callLeave => '离开';

  @override
  String get callJoin => '加入';

  @override
  String get callAccept => '接听';

  @override
  String get callDecline => '拒绝';

  @override
  String get groupCallTitle => '群组通话';

  @override
  String groupCallParticipants(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count 名参与者',
      one: '1 名参与者',
    );
    return '$_temp0';
  }

  @override
  String get groupCallNotetakerActive => 'AI 正在记录';

  @override
  String get groupCallStartTitle => '发起群组通话';

  @override
  String get groupCallAudio => '语音';

  @override
  String get groupCallVideo => '视频';

  @override
  String get groupCallNotetakerToggle => 'AI 记录员';

  @override
  String get groupCallNotetakerHint => 'AI 会聆听并在结束后发布会议摘要。';

  @override
  String get groupCallStartAction => '开始通话';

  @override
  String activeCallBanner(int count) {
    return '群组通话 · $count 人已加入';
  }

  @override
  String get incomingGroupCallTitle => '来电：群组通话';

  @override
  String incomingGroupCallBody(String name) {
    return '$name 发起了群组通话';
  }

  @override
  String get meetingSummaryTitle => '会议摘要';

  @override
  String meetingSummaryDuration(String duration) {
    return '时长 $duration';
  }

  @override
  String meetingSummaryAttendees(String names) {
    return '参与者：$names';
  }

  @override
  String get meetingSummaryOverview => '概述';

  @override
  String get meetingSummaryKeyPoints => '要点';

  @override
  String get meetingSummaryActionItems => '待办事项';

  @override
  String get profileTitle => '个人资料';

  @override
  String get profileRoleLabel => '角色';

  @override
  String get profileRoleMemberDefault => '成员';

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
  String get aiPersonality => '个性';

  @override
  String get aiMemory => '记忆';

  @override
  String get aiSkills => '技能';

  @override
  String get adminOwnerOnly => '仅限管理员或所有者';

  @override
  String get aiConnectedApps => '已连接的应用';

  @override
  String get aiUsage => '用量';

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
  String get profileShowDateOfBirth => '向他人显示出生日期';

  @override
  String get profileShowPhone => '向他人显示电话号码';

  @override
  String get profileShowGender => '向他人显示性别';

  @override
  String get phoneVerifiedBadge => '已验证';

  @override
  String get phoneSendOtp => '发送验证码';

  @override
  String get phoneSending => '正在发送...';

  @override
  String get phoneChangeNumber => '更换号码';

  @override
  String get phoneNotVerified => '未验证';

  @override
  String get phoneSendOtpError => '无法发送验证码，请稍后重试。';

  @override
  String get phoneVerifyTitle => '验证手机号码';

  @override
  String phoneOtpSubtitle(String phone) {
    return '请输入发送至 $phone 的6位验证码';
  }

  @override
  String get phoneOtpIncomplete => '请输入完整的6位数字';

  @override
  String get phoneOtpInvalid => '验证码错误或已过期';

  @override
  String get phoneVerifiedSuccess => '手机号码已验证！';

  @override
  String get phoneVerifying => '正在验证...';

  @override
  String get phoneConfirm => '确认';

  @override
  String get phoneHint => '901 234 567';

  @override
  String get phoneNoNumber => '暂无电话号码';

  @override
  String get phoneNoticeText => '添加电话号码以提升账户安全性。';

  @override
  String get phoneVerifyAction => '验证';

  @override
  String get phoneUnverifiedBadge => '未验证';

  @override
  String get phoneModalPhoneSubtitle => '输入电话号码以接收验证码。';

  @override
  String get phoneRateLimit => '请稍候再请求新的验证码。';

  @override
  String get phoneAlreadyTaken => '该电话号码已被使用。';

  @override
  String get phoneInvalidNumber => '电话号码无效。';

  @override
  String get phoneOtpExpired => '验证码已过期，请重新获取。';

  @override
  String get phoneResend => '重新发送验证码';

  @override
  String phoneResendCountdown(int seconds) {
    return '$seconds秒后重新发送';
  }

  @override
  String get profilePrivacySection => '隐私';

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
  String get aiErrStreamInterrupted => 'AI流已中断，请重试。';

  @override
  String get aiErrUnavailable => 'AI暂时不可用。';

  @override
  String get aiErrRateLimited => 'AI 请求过于频繁。请稍后再试。';

  @override
  String get feedbackHelpful => '有帮助';

  @override
  String get feedbackNotHelpful => '没帮助';

  @override
  String get feedbackCommentHint => '告诉我们哪里有问题（可选）';

  @override
  String get feedbackThanks => '感谢您的反馈';

  @override
  String get feedbackSend => '发送';

  @override
  String get feedbackError => '无法提交反馈。请重试。';

  @override
  String get aiSensitiveAction => '敏感操作';

  @override
  String get sourcesLabel => '来源';

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
  String get avatarUploadLabel => '更换头像';

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
  String get errEmailDomainInvalid => '该邮箱地址不存在';

  @override
  String get valPasswordMin8 => '密码至少需要 8 个字符';

  @override
  String get valPasswordUppercase => '必须包含一个大写字母 (A-Z)';

  @override
  String get valPasswordLowercase => '必须包含一个小写字母 (a-z)';

  @override
  String get valPasswordDigit => '必须包含一个数字 (0-9)';

  @override
  String get valPasswordSpecial => '必须包含一个特殊字符 (!@#\$%^&*)';

  @override
  String get pwStrengthWeak => '弱';

  @override
  String get pwStrengthMedium => '中';

  @override
  String get pwStrengthStrong => '强';

  @override
  String get pwStrengthVeryStrong => '非常强';

  @override
  String get pwReqLength => '≥8 个字符';

  @override
  String get pwReqUppercase => '大写字母 (A-Z)';

  @override
  String get pwReqLowercase => '小写字母 (a-z)';

  @override
  String get pwReqDigit => '数字 (0-9)';

  @override
  String get pwReqSpecial => '特殊字符 (!@#\$...)';

  @override
  String get loginWithGoogle => '使用 Google 登录';

  @override
  String get registerWithGoogle => '使用 Google 注册';

  @override
  String get orContinueWith => '或使用以下方式继续';

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
  String get youColon => '你：';

  @override
  String get systemNicknameChanged => '昵称已更改';

  @override
  String get systemThemeChanged => '聊天主题已更改';

  @override
  String get systemQuickReactionChanged => '快捷回应已更改';

  @override
  String get wallpaperUploadError => '图片上传失败';

  @override
  String get wallpaperScale => '缩放';

  @override
  String get wallpaperPreviewHint => '捏合或拖动以调整';

  @override
  String get wallpaperPreviewIncoming => '嗨！这样看起来怎么样？';

  @override
  String get wallpaperPreviewOutgoing => '看起来很棒 🎉';

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
  String sysPinnedMessage(String actorName) {
    return '$actorName 置顶了一条消息';
  }

  @override
  String sysUnpinnedMessage(String actorName) {
    return '$actorName 取消置顶了一条消息';
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

  @override
  String get legalScreenTitle => '隐私与条款';

  @override
  String get legalLastUpdated => '最后更新：2026年6月15日';

  @override
  String get legalDataCollectionTitle => '1. 数据收集';

  @override
  String get legalDataCollectionContent =>
      '我们收集您直接提供给我们的信息，例如您创建或修改账户、使用我们的服务或与我们通信时的信息，包括您的姓名、电子邮件地址、头像和您发送的消息。';

  @override
  String get legalDataUsageTitle => '2. 数据使用方式';

  @override
  String get legalDataUsageContent =>
      '您的数据用于提供、维护和改善我们的服务，包括促进用户间的通信、确保安全性以及个性化您的体验。';

  @override
  String get legalSecurityTitle => '3. 安全性';

  @override
  String get legalSecurityContent =>
      '我们实施行业标准的安全措施来保护您的个人信息和消息。对数据的访问受到严格控制，我们使用加密来保护敏感信息。';

  @override
  String get legalUserRightsTitle => '4. 您的权利';

  @override
  String get legalUserRightsContent => '您有权访问、更正或删除您的个人数据。您可以随时通过应用程序设置删除您的账户。';

  @override
  String get legalTermsTitle => '5. 服务条款';

  @override
  String get legalTermsContent =>
      '使用我们的平台即表示您同意不参与任何滥用、骚扰或违法活动。我们保留暂停或终止违反这些条款的账户的权利。';

  @override
  String get authMsgLoginSuccess => '登录成功。';

  @override
  String get authMsgLogoutSuccess => '退出成功。';

  @override
  String get authMsgOtpSent => 'OTP已发送至您的邮箱。';

  @override
  String get authMsgOtpValid => 'OTP验证成功。';

  @override
  String get authMsgOtpResent => '新OTP已发送。';

  @override
  String get authMsgPasswordUpdated => '密码已成功更新，请重新登录。';

  @override
  String get authMsgRegisterSuccess => '注册成功，OTP已发送至您的邮箱。';

  @override
  String get authMsgAccountUnverifiedOtpSent => '账户尚未验证，新OTP已发送至您的邮箱。';

  @override
  String get authErrOtpInvalid => 'OTP验证码无效。';

  @override
  String get authErrOtpExpired => 'OTP已过期。';

  @override
  String get authErrOtpAttemptsExceeded => '错误次数过多，请重新申请OTP。';

  @override
  String authErrOtpWrongWithRemaining(int remaining) {
    return 'OTP不正确，剩余$remaining次尝试。';
  }

  @override
  String authErrOtpResendCooldown(int ttl) {
    return '请等待$ttl秒后再申请新OTP。';
  }

  @override
  String get authErrEmailDomainInvalid => '邮箱域名不存在或无MX记录。';

  @override
  String get authErrEmailNotFound => '系统中不存在该邮箱。';

  @override
  String get authErrEmailInUse => '该邮箱已被使用。';

  @override
  String get authErrValEmailInvalid => '邮箱格式无效。';

  @override
  String get authErrValEmailRequired => '邮箱为必填项。';

  @override
  String get authErrValDisplaynameRequired => '显示名称为必填项。';

  @override
  String get authErrValDisplaynameTooShort => '显示名称过短（至少2个字符）。';

  @override
  String get authErrValPasswordTooShort => '密码至少需要8个字符。';

  @override
  String authErrAccountLocked(int minutes) {
    return '由于登录失败次数过多，账户已被暂时锁定$minutes分钟。';
  }

  @override
  String authErrLoginFailedWithRemaining(int remaining) {
    return '邮箱或密码不正确，剩余$remaining次尝试。';
  }

  @override
  String authErrLoginFailedLocked(int minutes) {
    return '登录失败次数过多，账户已锁定$minutes分钟。';
  }

  @override
  String get authErrTokenInvalid => 'Token无效。';

  @override
  String get authErrSessionNotFound => '会话不存在或已过期。';

  @override
  String get authErrSessionInvalid => '会话不存在或已过期。';

  @override
  String get authErrSessionRevoked => '会话已被撤销。';

  @override
  String get authErrRefreshTokenReuse => '安全警告：检测到refresh token重用，所有会话已被撤销。';

  @override
  String get authErrRefreshTokenInvalid => 'Refresh token无效。';

  @override
  String get authErrRefreshTokenRotated => 'Refresh token已轮换。';

  @override
  String get authErrTokenSessionMismatch => 'Token与会话不匹配。';

  @override
  String get authErrSocialEmailUnavailable => '无法从社交账户获取邮箱。';

  @override
  String get authErrLoginCodeInvalid => '登录码无效或已过期。';

  @override
  String get authErrUserNotFound => '用户不存在。';

  @override
  String get integrationsTitle => '集成';

  @override
  String get integrationsSubtitle => '只需连接一次账户。之后只要给助手发消息——它便会代你行事，权限内行事，绝不越界。';

  @override
  String get integrationsSettingsSubtitle => '连接助手可使用的工具';

  @override
  String get connectorStatusConnected => '已连接';

  @override
  String get connectorStatusAvailable => '可用';

  @override
  String get connectorStatusComingSoon => '即将推出';

  @override
  String get connectorConnect => '连接';

  @override
  String get connectorManage => '管理';

  @override
  String get connectorDisconnect => '断开连接';

  @override
  String get connectorDisconnectConfirm => '断开此账户？助手将无法再使用其工具。';

  @override
  String get connectorOpenFailed => '无法打开授权页面。';

  @override
  String get customMcpTitle => '添加自定义 MCP 服务器';

  @override
  String get customMcpSubtitle => '将助手指向任意 MCP 服务器。我们会发现其工具，助手即可使用它们。';

  @override
  String get customMcpName => '名称';

  @override
  String get customMcpUrl => '服务器 URL';

  @override
  String get customMcpAuth => '认证';

  @override
  String get customMcpAuthNone => '无';

  @override
  String get customMcpAuthApiKey => 'API 密钥';

  @override
  String get customMcpAuthOauth => 'OAuth';

  @override
  String get customMcpCredential => '凭据';

  @override
  String get customMcpDiscover => '发现工具';

  @override
  String get customMcpSave => '保存';

  @override
  String get customMcpSaved => '已添加自定义 MCP 服务器。';

  @override
  String customMcpToolsFound(int count) {
    return '发现 $count 个工具';
  }

  @override
  String get permissionsTitle => 'AI 权限';

  @override
  String get permissionsSubtitle => '选择助手可以通过此连接器执行的操作。';

  @override
  String get permView => '查看';

  @override
  String get permCreate => '创建';

  @override
  String get permEdit => '编辑';

  @override
  String get permDelete => '删除';

  @override
  String get permViewDesc => '读取数据、搜索和总结（只读）。';

  @override
  String get permCreateDesc => '添加新项目，如文件、事件或记录。';

  @override
  String get permEditDesc => '修改现有项目及其内容。';

  @override
  String get permDeleteDesc => '永久删除项目。';

  @override
  String get permManage => '权限';

  @override
  String get permSaved => '权限已更新。';

  @override
  String get skillsTitle => '技能';

  @override
  String get skillsSubtitle => '技能将一组工具和工作方式打包。只开启你需要的——每个技能都会告诉你它的要求。';

  @override
  String get skillsSettingsSubtitle => '选择助手擅长的事';

  @override
  String skillNeeds(String requirements) {
    return '需要 $requirements';
  }

  @override
  String get skillSchedulerName => '日程助手';

  @override
  String get skillSchedulerDesc => '预订会议、查找空档、发送邀请和提醒。';

  @override
  String get skillMailWriterName => '邮件撰写';

  @override
  String get skillMailWriterDesc => '用你的语气起草回复，总结长邮件。';

  @override
  String get skillResearcherName => '研究员';

  @override
  String get skillResearcherDesc => '搜索网络和你的云端硬盘，返回带引用的答案。';

  @override
  String get skillProjectKeeperName => '项目管家';

  @override
  String get skillProjectKeeperDesc => '将笔记和任务归档到 Notion，保持数据库整洁。';

  @override
  String get skillMeetingNotesName => '会议纪要';

  @override
  String get skillMeetingNotesDesc => '总结会议内容，提取决议与待办事项。';

  @override
  String get skillInboxTriageName => '收件箱整理';

  @override
  String get skillInboxTriageDesc => '为消息排序优先级并建议快速回复。';

  @override
  String get skillDataAnalystName => '数据分析师';

  @override
  String get skillDataAnalystDesc => '分析表格与数字，揭示趋势与异常值。';

  @override
  String get skillDocDrafterName => '文档起草';

  @override
  String get skillDocDrafterDesc => '撰写结构化的提案、规格说明与报告。';

  @override
  String get skillTranslatorName => '翻译';

  @override
  String get skillTranslatorDesc => '在多种语言之间自然地翻译和本地化文本。';

  @override
  String get skillWebSearchName => '网络搜索';

  @override
  String get skillWebSearchDesc => '在网络上查找最新信息并引用来源。';

  @override
  String get skillWeatherForecastName => '天气预报';

  @override
  String get skillWeatherForecastDesc => '查询任何地点的天气和预报。';

  @override
  String get adminTitle => '管理控制台';

  @override
  String get adminSubtitle => '管理工作区、部门、成员和角色';

  @override
  String get adminBack => '返回';

  @override
  String get adminLoading => '加载中…';

  @override
  String get adminSave => '保存';

  @override
  String get adminSaving => '保存中…';

  @override
  String get adminCancel => '取消';

  @override
  String get adminToastSaved => '已保存';

  @override
  String get adminToastDeleted => '已删除';

  @override
  String get adminToastError => '发生错误';

  @override
  String get adminMenu => '管理';

  @override
  String get adminSettingsSubtitle => '工作区、部门、成员和角色';

  @override
  String get adminNavWorkspace => '工作区';

  @override
  String get adminNavDepartments => '部门';

  @override
  String get adminNavMembers => '成员';

  @override
  String get adminNavRoles => '角色';

  @override
  String get adminNavAudit => '审计日志';

  @override
  String get adminNavAi => 'AI 助手';

  @override
  String get adminAiInheritHint => '留空或选择“继承”以使用服务器默认值。';

  @override
  String get adminAiInheritOption => '继承（默认）';

  @override
  String get adminAiOn => '开';

  @override
  String get adminAiOff => '关';

  @override
  String get adminAiPersonaSection => '人设';

  @override
  String get adminAiPersonaName => '默认助手名称';

  @override
  String get adminAiTone => '默认语气';

  @override
  String get adminAiToneFriendly => '友好';

  @override
  String get adminAiToneProfessional => '专业';

  @override
  String get adminAiToneConcise => '简洁';

  @override
  String get adminAiToneCreative => '创意';

  @override
  String get adminAiModelSection => '模型';

  @override
  String get adminAiModelTier => '默认模型级别';

  @override
  String get adminAiTierAuto => '自动（路由）';

  @override
  String get adminAiTierSimple => '简单';

  @override
  String get adminAiTierMid => '均衡';

  @override
  String get adminAiTierComplex => '高级';

  @override
  String get adminAiCapabilitiesSection => '功能';

  @override
  String get adminAiWebSearch => '网络搜索';

  @override
  String get adminAiWebSearchDesc => '允许助手搜索网络。';

  @override
  String get adminAiThinking => '扩展思考';

  @override
  String get adminAiThinkingDesc => '允许助手逐步推理。';

  @override
  String get adminAiDigestSection => '每日摘要';

  @override
  String get adminAiDailyDigest => '每日摘要';

  @override
  String get adminAiDailyDigestDesc => '每天发布一次各 AI 对话活动的摘要。';

  @override
  String get adminAiDailyDigestHour => '发送时间';

  @override
  String get adminAiDailyDigestHourDesc => '发送摘要的本地时间。开启摘要后可设置。';

  @override
  String get adminAiQuotaSection => '使用上限';

  @override
  String get adminAiTokenLimit => '每月令牌上限';

  @override
  String get adminAiTokenLimitDesc => '留空表示继承；0 表示禁止所有使用。';

  @override
  String get adminAiConnectorsSection => '允许的连接器';

  @override
  String get adminAiRestrictConnectors => '为 AI 限制连接器';

  @override
  String get adminAiConnectorsInherit => '继承工作区允许列表。';

  @override
  String get adminAiConnectorsExplicit => 'AI 只能使用下面选中的连接器。';

  @override
  String get adminWsIdentity => '标识与品牌';

  @override
  String get adminWsName => '工作区名称';

  @override
  String get adminWsNamePlaceholder => 'Acme 公司';

  @override
  String get adminWsLogoUrl => 'Logo 链接';

  @override
  String get adminWsPrimaryColor => '主色';

  @override
  String get adminWsFeatures => '功能开关';

  @override
  String get adminWsNoFeatures => '尚未配置功能开关。';

  @override
  String get adminWsAllowList => '连接器白名单';

  @override
  String get adminWsAllowListDesc => '成员可个人连接的连接器。';

  @override
  String get adminWsNoCatalog => '没有可用的连接器。';

  @override
  String get adminDeptNew => '新建部门';

  @override
  String get adminDeptEdit => '编辑部门';

  @override
  String get adminDeptEmpty => '暂无部门。';

  @override
  String get adminDeptLead => '负责人';

  @override
  String get adminDeptLeadNone => '无';

  @override
  String get adminDeptName => '名称';

  @override
  String get adminDeptDescription => '描述';

  @override
  String get adminDeptDialogDesc => '部门用于分组成员并拥有部门聊天。';

  @override
  String adminDeptDeleteConfirm(String name) {
    return '删除部门\"$name\"？';
  }

  @override
  String get adminMemberHint => '为每位成员分配角色和部门。';

  @override
  String get adminMemberEdit => '编辑成员';

  @override
  String get adminMemberRevokeNote => '保存将吊销该成员的活动会话。';

  @override
  String get adminMemberRole => '角色';

  @override
  String get adminMemberRoleNone => '无';

  @override
  String get adminMemberDepartments => '部门';

  @override
  String get adminRoleHint => '切换每个角色的权限。Owner 角色为只读。';

  @override
  String get adminRoleCapability => '权限';

  @override
  String get adminRolePreset => '预设';

  @override
  String get adminRoleClone => '克隆';

  @override
  String adminRoleCloneTitle(String name) {
    return '克隆 $name';
  }

  @override
  String get adminRoleName => '角色名称';

  @override
  String get adminAuditTitle => '审计日志';

  @override
  String get adminAuditComingSoon => '审计日志将在未来更新中提供。';

  @override
  String get adminCapManageWorkspace => '管理工作区';

  @override
  String get adminCapManageDepartments => '管理部门';

  @override
  String get adminCapManageMembers => '管理成员';

  @override
  String get adminCapManageRoles => '管理角色';

  @override
  String get adminCapConnectWorkspaceConnector => '连接工作区连接器';

  @override
  String get adminCapAddCustomMcp => '添加自定义 MCP';

  @override
  String get adminCapConnectPersonalConnector => '连接个人连接器';

  @override
  String get adminCapUsePersonalAssistant => '使用个人助手';

  @override
  String get adminCapUseGroupBot => '使用群组机器人';

  @override
  String get adminCapRunSensitiveSkill => '运行敏感技能';

  @override
  String get adminCapViewAuditLog => '查看审计日志';

  @override
  String get adminAuditEmpty => '暂无审计记录。';

  @override
  String get adminAuditPrev => '上一页';

  @override
  String get adminAuditNext => '下一页';

  @override
  String get newConvDepartment => '部门（可选）';

  @override
  String get newConvNoDepartment => '无部门';

  @override
  String get loginWithSso => '使用 SSO 登录';

  @override
  String get adminNavSso => 'SSO';

  @override
  String get adminSsoTitle => '单点登录 (SSO)';

  @override
  String get adminSsoHint => '配置 OIDC 登录。提供商凭据在部署 .env 中设置；在此将 IdP 组映射到角色和部门。';

  @override
  String get adminSsoEnabled => '启用 SSO';

  @override
  String get adminSsoAllowedDomains => '允许的邮箱域名';

  @override
  String get adminSsoAllowedDomainsHint => '用逗号分隔。留空则允许任何已验证的邮箱。';

  @override
  String get adminSsoDefaultRole => '默认角色';

  @override
  String get adminSsoNone => '无';

  @override
  String get adminSsoGroupRoleMap => '组 → 角色';

  @override
  String get adminSsoGroupDeptMap => '组 → 部门';

  @override
  String get adminSsoGroupPlaceholder => 'IdP 组名称';

  @override
  String get adminSsoAddMapping => '添加映射';

  @override
  String get sectionDirectoryTitle => 'MCP 目录';

  @override
  String get sectionDirectoryDesc => '浏览 MCP 服务器并一键连接——OAuth 自动完成。';

  @override
  String get directoryAdd => '添加条目';

  @override
  String get directorySearch => '搜索目录…';

  @override
  String get directoryEmpty => '没有匹配的目录条目。';

  @override
  String get directoryEdit => '编辑条目';

  @override
  String get directoryDelete => '删除条目';

  @override
  String get tierWorkspace => '工作区';

  @override
  String get tierPersonal => '个人';

  @override
  String get tierBoth => '个人 / 工作区';

  @override
  String get directorySaveSuccess => '已保存目录条目。';

  @override
  String get directoryDeleteSuccess => '已删除目录条目。';

  @override
  String get directoryAddTitle => '添加目录条目';

  @override
  String get directoryEditTitle => '编辑目录条目';

  @override
  String get directoryDialogDesc => '添加公开的 MCP 服务器，成员可一键连接。';

  @override
  String get directorySlug => '标识 (slug)';

  @override
  String get directoryName => '名称';

  @override
  String get directoryDescription => '描述';

  @override
  String get directoryMcpUrl => 'MCP 网址';

  @override
  String get directoryAuthMode => '认证方式';

  @override
  String get directoryTier => '层级';

  @override
  String get directoryEnvHint => '对于 env-oauth：引用保存 OAuth 客户端凭据的环境变量。';

  @override
  String get directoryEnvClientId => 'Client ID 环境变量';

  @override
  String get directoryEnvClientSecret => 'Client secret 环境变量';

  @override
  String get directoryAuthorizeUrl => '授权网址';

  @override
  String get directoryTokenUrl => '令牌网址';

  @override
  String get directoryCancel => '取消';

  @override
  String get directorySave => '保存';

  @override
  String directoryKeyTitle(String provider) {
    return '连接 $provider';
  }

  @override
  String get directoryKeyLabel => 'API 密钥';

  @override
  String directoryConnected(String provider) {
    return '已连接 $provider。';
  }

  @override
  String get editNicknames => '编辑昵称';

  @override
  String get nicknameModalTitle => '昵称';

  @override
  String get nicknameNonePlaceholder => '暂无昵称';

  @override
  String get nicknameYouSuffix => '(你)';

  @override
  String get adminNavUsage => '用量';

  @override
  String get usageThisMonth => '本月';

  @override
  String get usageTotalTokens => '总令牌数';

  @override
  String get usageRequests => '请求数';

  @override
  String get usageEstCost => '预计费用';

  @override
  String get usageThumbsDownRate => '差评率';

  @override
  String usageFeedbackBreakdown(int down, int total) {
    return '$total 条评价中 $down 条';
  }

  @override
  String get usagePerModelTitle => '按模型计费';

  @override
  String usageModelTokens(String input, String output, String requests) {
    return '输入 $input / 输出 $output · $requests 次请求';
  }

  @override
  String get usageTopUsersTitle => '主要用户';

  @override
  String usageUserRequests(int count) {
    return '$count 次请求';
  }

  @override
  String get usageWorstAnswersTitle => '评价最差的回答';

  @override
  String get usageNoPreview => '（无回答预览）';

  @override
  String usageUserComment(String comment) {
    return '“$comment”';
  }

  @override
  String get usageNoData => '此期间暂无数据。';

  @override
  String get usageLoadError => '无法加载用量面板。';

  @override
  String get usageRetry => '重试';

  @override
  String get assistantDefaultName => '我的助手';

  @override
  String get assistantSubtitle => '您的私人助手';

  @override
  String get assistantOpenChat => '打开助手对话';

  @override
  String get assistantSetupCta => '设置助手';

  @override
  String get assistantSetupTitle => '设置我的助手';

  @override
  String get assistantSetupStepName => '为助手命名';

  @override
  String get assistantSetupStepPersona => '定义个性';

  @override
  String get assistantSetupStepModel => '选择模型';

  @override
  String get assistantSetupStepConfirm => '确认并创建';

  @override
  String get assistantSetupNamePlaceholder => '例如：Aria';

  @override
  String get assistantSetupPersonaPlaceholder => '你是一位乐于助人的助手，会……';

  @override
  String get assistantSetupPersonaHint => '描述你的助手应如何交谈和行事。';

  @override
  String get assistantSetupCreateButton => '创建助手';

  @override
  String get assistantSetupCreating => '正在创建……';

  @override
  String get assistantSetupSuccess => '你的助手已准备就绪';

  @override
  String get assistantSettingsTitle => '助手设置';

  @override
  String get assistantSettingsEditPersona => '个性';

  @override
  String get assistantSettingsChangeModel => '模型';

  @override
  String get assistantSettingsDeleteTitle => '删除助手';

  @override
  String get assistantSettingsDeleteConfirm => '此操作将删除你的助手及其对话，且无法撤销。';

  @override
  String get assistantSettingsDeleteButton => '删除助手';

  @override
  String get botAdminTitle => '机器人集成';

  @override
  String get botAdminGenerateToken => '生成令牌';

  @override
  String get botAdminRevokeToken => '撤销';

  @override
  String get botAdminTokenWarning => '请立即复制此令牌——它仅显示一次，无法再次获取。';

  @override
  String get botAdminCopyToken => '复制';

  @override
  String get botAdminMcpUrl => 'MCP 地址';

  @override
  String get botAdminToken => '集成令牌';

  @override
  String get botAdminLastUsed => '最近使用';

  @override
  String get botAdminNeverUsed => '从未使用';

  @override
  String get botAdminNoBotsRegistered => '尚未注册任何机器人。';

  @override
  String get helpTitle => '帮助与常见问题';

  @override
  String get settingsHelp => '帮助与常见问题';

  @override
  String get settingsHelpSubtitle => '帮助中心与常见问题';

  @override
  String get helpSearchHint => '搜索帮助…';

  @override
  String get helpNoResults => '未找到结果';

  @override
  String get helpCatGettingStarted => '快速入门';

  @override
  String get helpCatMessaging => '消息';

  @override
  String get helpCatAiFeatures => 'AI 功能';

  @override
  String get helpCatGroups => '群组';

  @override
  String get helpCatAccountSecurity => '账户与安全';

  @override
  String get helpGettingStartedQ1 => '什么是 PON？';

  @override
  String get helpGettingStartedA1 =>
      'PON 是一个自托管的 AI 消息平台，将团队沟通与集成的 AI 助手相结合。它支持私信、群聊和由 AI 驱动的工作流程。';

  @override
  String get helpGettingStartedQ2 => '如何创建账户？';

  @override
  String get helpGettingStartedA2 =>
      '您的账户由工作区管理员创建。您将收到一封邀请邮件，其中包含设置密码和验证账户的说明。';

  @override
  String get helpGettingStartedQ3 => '如何查找并添加好友？';

  @override
  String get helpGettingStartedA3 =>
      '进入「好友」标签页，使用搜索栏按姓名或电子邮件查找同事。发送好友请求，对方接受后即可开始聊天。';

  @override
  String get helpGettingStartedQ4 => '如何发起对话？';

  @override
  String get helpGettingStartedA4 => '在对话列表界面点击撰写图标，搜索联系人，选择后即可打开新对话。';

  @override
  String get helpMessagingQ1 => '如何发送消息？';

  @override
  String get helpMessagingA1 => '在对话底部的文本框中输入消息，然后按回车键或点击发送按钮。';

  @override
  String get helpMessagingQ2 => '我可以发送语音消息吗？';

  @override
  String get helpMessagingA2 => '可以！按住消息输入区的麦克风按钮录制语音消息。松开即可发送，或滑动取消。';

  @override
  String get helpMessagingQ3 => '如何发送文件和图片？';

  @override
  String get helpMessagingA3 => '点击消息输入框旁边的附件图标，从您的设备中选择图片、视频或文件。';

  @override
  String get helpMessagingQ4 => '如何置顶重要消息？';

  @override
  String get helpMessagingA4 =>
      '长按或将鼠标悬停在消息上，点击更多菜单（⋯），然后选择「置顶消息」。置顶消息会显示在对话顶部。每个对话最多可置顶 2 条消息。';

  @override
  String get helpMessagingQ5 => '什么是消息表情回应？';

  @override
  String get helpMessagingA5 =>
      '将鼠标悬停在消息上或长按消息，点击表情图标即可添加快速回应。其他人可以看到并添加自己的回应。';

  @override
  String get helpAiFeaturesQ1 => 'AI 助手能做什么？';

  @override
  String get helpAiFeaturesA1 =>
      'AI 助手（@AI）可以回答问题、总结对话、协助起草消息、分析上传的文档，并使用已连接的工具执行任务。';

  @override
  String get helpAiFeaturesQ2 => '如何在对话中使用 @AI？';

  @override
  String get helpAiFeaturesA2 => '在任何对话中输入 @AI，后面跟上您的问题或请求。助手将在对话线程中回复。';

  @override
  String get helpAiFeaturesQ3 => '什么是 AI 记忆？';

  @override
  String get helpAiFeaturesA3 => 'AI 记忆使助手能够记住先前对话的上下文，随着时间推移让交互更加个性化和高效。';

  @override
  String get helpAiFeaturesQ4 => '如何设置我的个人助手？';

  @override
  String get helpAiFeaturesA4 => '进入 AI 助手部分，点击「设置助手」。您可以配置助手的人格、连接工具并设置偏好。';

  @override
  String get helpGroupsQ1 => '如何创建群组？';

  @override
  String get helpGroupsA1 => '点击撰写图标，选择「新建群组」，通过搜索姓名添加成员，设置群组名称，然后点击创建。';

  @override
  String get helpGroupsQ2 => '如何向群组添加成员？';

  @override
  String get helpGroupsA2 => '打开群组对话，点击设置图标，然后选择「添加成员」。搜索联系人并添加他们。';

  @override
  String get helpGroupsQ3 => '群组角色有哪些？';

  @override
  String get helpGroupsA3 => '群组有两种角色：管理员和成员。管理员可以添加/移除成员、更改群组名称和头像，并管理群组设置。';

  @override
  String get helpAccountSecurityQ1 => '如何更改我的头像？';

  @override
  String get helpAccountSecurityA1 => '进入设置 → 个人资料，点击当前头像，然后从您的设备中选择一张新照片。';

  @override
  String get helpAccountSecurityQ2 => '如何启用阅后即焚消息？';

  @override
  String get helpAccountSecurityA2 =>
      '打开一个对话，点击设置图标，进入自定义聊天，然后启用「阅后即焚消息」并设置您偏好的计时器。';

  @override
  String get helpAccountSecurityQ3 => '如何屏蔽用户？';

  @override
  String get helpAccountSecurityA3 => '打开与该用户的对话，点击设置图标，滚动到隐私与支持，然后选择「屏蔽用户」。';

  @override
  String get helpAccountSecurityQ4 => '如何删除消息历史记录？';

  @override
  String get helpAccountSecurityA4 =>
      '打开对话，点击设置，进入隐私与支持，然后选择「清除历史记录」。此操作仅删除您设备上的历史记录。';

  @override
  String get blockedChats => '已屏蔽';

  @override
  String get noBlockedChats => '没有被屏蔽的会话';

  @override
  String get blockAndHide => '屏蔽并隐藏';

  @override
  String get unblockAndRestore => '解除屏蔽';

  @override
  String get callBlocked => '该用户不希望被联系';

  @override
  String get mute15min => '15 分钟';

  @override
  String get mute30min => '30 分钟';

  @override
  String get mute1hour => '1 小时';

  @override
  String get mute24hours => '24 小时';

  @override
  String get muteForever => '直到我手动开启';

  @override
  String get profileBlockedByOwner => '该用户的个人资料不可用';

  @override
  String get unsavedChangesTitle => '您有未保存的更改';

  @override
  String get unsavedChangesDesc => '如果离开，您的更改将会丢失。';

  @override
  String get keepEditing => '继续编辑';

  @override
  String get saveAndLeave => '保存并离开';

  @override
  String get leaveWithoutSaving => '不保存离开';

  @override
  String get aiSessionHistory => '对话历史';

  @override
  String get aiNewSession => '新对话';

  @override
  String get aiSessionActive => '使用中';

  @override
  String get aiSessionSummarized => '已摘要';

  @override
  String get aiSessionEmpty => '暂无历史对话';

  @override
  String get aiSessionResume => '恢复';

  @override
  String get aiSessionLoadError => '无法加载对话历史';

  @override
  String multiSelectCount(int count) {
    return '已选择 $count 条';
  }

  @override
  String get multiSelectEmpty => '未选择任何消息';

  @override
  String get multiSelectCancel => '取消';

  @override
  String multiSelectTypeWarning(String type) {
    return '您正在选择$type。只能选择同一类型。';
  }

  @override
  String multiDeleted(int count) {
    return '已删除 $count 条消息';
  }

  @override
  String multiRecalled(int count) {
    return '已撤回 $count 条消息';
  }

  @override
  String get multiForwardHint => '请选择一条消息进行转发';

  @override
  String get msgTypeText => '文本';

  @override
  String get msgTypeImage => '图片/视频';

  @override
  String get msgTypeFile => '文件';

  @override
  String get selectMessages => '选择消息';

  @override
  String get removeAttachment => '移除';

  @override
  String get addMore => '添加';

  @override
  String get attachHdOn => 'HD — 高清';

  @override
  String get attachHdOff => 'SD — 压缩';
}
