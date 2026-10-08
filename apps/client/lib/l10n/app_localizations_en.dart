// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTagline => 'Connect & Chat';

  @override
  String get appName => 'PON';

  @override
  String get notificationsTitle => 'Notifications';

  @override
  String get notificationsSectionUnread => 'Unread';

  @override
  String get notificationsSectionRead => 'Earlier';

  @override
  String get notificationsEmpty => 'No notifications yet';

  @override
  String get notificationsMarkAllRead => 'Mark all as read';

  @override
  String get notificationAccept => 'Accept';

  @override
  String get notificationDecline => 'Decline';

  @override
  String notificationFriendRequestTitle(String name) {
    return '$name sent you a friend request';
  }

  @override
  String notificationFriendAcceptedTitle(String name) {
    return '$name accepted your friend request';
  }

  @override
  String get notificationPhoneSetupTitle => 'Verify phone number';

  @override
  String get notificationPhoneSetupBody =>
      'Add and verify a phone number so friends can find you and to improve account security.';

  @override
  String get notificationPasswordSetupTitle => 'Protect your account';

  @override
  String get notificationPasswordSetupBody =>
      'Your account doesn\'t have a password yet. Set one to improve security.';

  @override
  String get securityTitle => 'Password & Security';

  @override
  String get securitySubtitle => 'Change your password';

  @override
  String get securityNoPasswordCardSubtitle => 'No password set';

  @override
  String get securityNoPasswordTitle => 'No password set yet';

  @override
  String get securityNoPasswordSubtitle =>
      'Set a password to secure your account and enable email-based recovery.';

  @override
  String get securityChangePasswordTitle => 'Change password';

  @override
  String get securityChangePasswordSubtitle => 'Update your current password.';

  @override
  String get securitySetPasswordTitle => 'Set up your password';

  @override
  String get securitySetPasswordSubtitle =>
      'Add a password to your account for an extra layer of security.';

  @override
  String get securitySetButton => 'Set password';

  @override
  String get securityChangeButton => 'Change password';

  @override
  String get securitySetSuccess => 'Password set successfully';

  @override
  String get securityTwoFaTitle => 'Two-factor authentication';

  @override
  String get securityTwoFaSubtitle =>
      'Add an extra layer of security to your account.';

  @override
  String get securityTwoFaComingSoon =>
      'Two-factor authentication is coming soon.';

  @override
  String get securityComingSoon => 'Coming soon';

  @override
  String get languageName => 'English';

  @override
  String get actionCancel => 'Cancel';

  @override
  String get actionConfirm => 'Confirm';

  @override
  String get actionRetry => 'Retry';

  @override
  String get actionSave => 'Save';

  @override
  String get actionLogout => 'Log out';

  @override
  String get actionDelete => 'Delete';

  @override
  String get actionLeave => 'Leave';

  @override
  String get loadingDots => '...';

  @override
  String get loginTitle => 'Sign In';

  @override
  String get fieldEmail => 'Email';

  @override
  String get fieldPassword => 'Password';

  @override
  String get forgotPasswordLink => 'Forgot password?';

  @override
  String get loginButton => 'Sign In';

  @override
  String get valEmailRequired => 'Please enter your email';

  @override
  String get valEmailInvalid => 'Invalid email';

  @override
  String get valPasswordRequired => 'Please enter your password';

  @override
  String get valPasswordMin6 => 'Password must be at least 6 characters';

  @override
  String get errInvalidCredentials => 'Incorrect email or password';

  @override
  String get errNetwork => 'Cannot reach the server, check your connection';

  @override
  String get errSlow => 'Connection is too slow, please try again';

  @override
  String get errSessionExpired => 'Your session has expired';

  @override
  String get errForbidden => 'You don\'t have permission to do this';

  @override
  String get errNotFound => 'Data not found';

  @override
  String get errConflict => 'This data already exists';

  @override
  String get errInvalidData => 'Invalid data';

  @override
  String get errServer => 'Server error, please try again later';

  @override
  String errRequestFailed(String code) {
    return 'Request failed ($code)';
  }

  @override
  String get errCancelled => 'The request was cancelled';

  @override
  String get errConnection => 'Connection error, please try again';

  @override
  String get errGeneric => 'Something went wrong, please try again';

  @override
  String get detailsTitle => 'Details';

  @override
  String get themeMenuItem => 'Theme';

  @override
  String get quickReactionTitle => 'Quick Reaction';

  @override
  String get wallpaperDefaultName => 'Default';

  @override
  String get wallpaperCategoryColors => 'Simple Colors';

  @override
  String get wallpaperCategoryVibrant => 'Vibrant Gradients';

  @override
  String get wallpaperCategoryMinimal => 'Minimal';

  @override
  String get wallpaperShowMore => 'Show more';

  @override
  String get wallpaperShowLess => 'Show less';

  @override
  String get wallpaperCategoryThemes => 'Themes';

  @override
  String get wallpaperThemeForest => 'Forest';

  @override
  String get wallpaperThemeOcean => 'Ocean';

  @override
  String get wallpaperThemeMountain => 'Snow Mountain';

  @override
  String get wallpaperThemeCherryBlossom => 'Cherry Blossom';

  @override
  String get wallpaperThemeSpace => 'Space';

  @override
  String get wallpaperThemeAurora => 'Northern Lights';

  @override
  String get wallpaperThemeCityNight => 'City Night';

  @override
  String get wallpaperThemeDesert => 'Desert';

  @override
  String get wallpaperPresetMidnightGlow => 'Midnight Glow';

  @override
  String get wallpaperPresetNeonTeal => 'Neon Teal';

  @override
  String get wallpaperPresetSunset => 'Sunset';

  @override
  String get wallpaperPresetSweetPink => 'Sweet Pink';

  @override
  String get wallpaperPresetDarkShadow => 'Dark Shadow';

  @override
  String get wallpaperPresetOceanBlue => 'Ocean Blue';

  @override
  String get wallpaperPresetForestGreen => 'Forest Green';

  @override
  String get wallpaperPresetPurpleHaze => 'Purple Haze';

  @override
  String get wallpaperPresetWarmAmber => 'Warm Amber';

  @override
  String get wallpaperPresetRoseGold => 'Rose Gold';

  @override
  String get wallpaperPresetStorm => 'Storm';

  @override
  String get wallpaperPresetCherryBlossom => 'Cherry Blossom';

  @override
  String get wallpaperPresetMidnightPurple => 'Midnight Purple';

  @override
  String get wallpaperPresetCoralReef => 'Coral Reef';

  @override
  String get wallpaperPresetArcticIce => 'Arctic Ice';

  @override
  String get wallpaperPresetAurora => 'Aurora';

  @override
  String get wallpaperPresetGalaxy => 'Galaxy';

  @override
  String get wallpaperPresetFireIce => 'Fire & Ice';

  @override
  String get wallpaperPresetTropical => 'Tropical';

  @override
  String get wallpaperPresetCandy => 'Candy';

  @override
  String get wallpaperPresetPureDark => 'Pure Dark';

  @override
  String get wallpaperPresetSoftGray => 'Soft Gray';

  @override
  String get wallpaperPresetWarmNight => 'Warm Night';

  @override
  String get changeChatThemeTitle => 'Change Chat Theme';

  @override
  String get uploadImageButton => 'Upload image';

  @override
  String get imageFitLabel => 'Image fit';

  @override
  String get fitCoverLabel => 'Cover';

  @override
  String get fitContainLabel => 'Contain';

  @override
  String get fitFillLabel => 'Fill';

  @override
  String get errLoginFailed => 'Sign in failed, please try again';

  @override
  String get welcomeToApp => 'Welcome to PON';

  @override
  String get fieldDisplayName => 'Display name';

  @override
  String get fieldConfirmPassword => 'Confirm password';

  @override
  String get valNameRequired => 'Please enter your name';

  @override
  String get valNameMin2 => 'Name must be at least 2 characters';

  @override
  String get valPasswordMismatch => 'Passwords do not match';

  @override
  String get errEmailExists => 'This email is already registered';

  @override
  String get verifyOtpTitle => 'Verify OTP';

  @override
  String get verifyAccountHeading => 'Verify your account';

  @override
  String otpSentTo(String email) {
    return 'A 6-digit OTP was sent to\n$email';
  }

  @override
  String get fieldOtp => 'OTP code';

  @override
  String get confirmButton => 'Confirm';

  @override
  String resendIn(int seconds) {
    return 'Resend in ${seconds}s';
  }

  @override
  String get resendOtp => 'Resend OTP code';

  @override
  String get otpResent => 'A new OTP code has been sent to your email';

  @override
  String get errResendFailed => 'Resend failed, try again later';

  @override
  String get valOtp6 => 'Enter all 6 OTP digits';

  @override
  String get verifySuccess => 'Verified successfully! Sign in now';

  @override
  String get errVerifyFailed => 'Verification failed, please try again';

  @override
  String get forgotTitle => 'Reset Password';

  @override
  String get forgotHeading => 'Forgot password?';

  @override
  String get forgotSubtitle =>
      'Enter your email to receive an OTP and set a new password';

  @override
  String get sendOtpButton => 'Send OTP Code';

  @override
  String get errSendRequestFailed => 'Request failed, please try again';

  @override
  String get newPasswordTitle => 'New Password';

  @override
  String get newPasswordHeading => 'Create a new password';

  @override
  String newPasswordSubtitle(String email) {
    return 'Enter the OTP sent to $email\nand your new password';
  }

  @override
  String get fieldNewPassword => 'New password';

  @override
  String get valNewPasswordRequired => 'Enter a new password';

  @override
  String get resetPasswordSuccess => 'Password reset successfully!';

  @override
  String get errOtpInvalidExpired => 'OTP is incorrect or has expired';

  @override
  String get errResetFailed => 'Password reset failed, please try again';

  @override
  String get settingsTitle => 'Settings';

  @override
  String get valNameEmpty => 'Name cannot be empty';

  @override
  String get nameUpdated => 'Display name updated';

  @override
  String get personalInfo => 'Personal information';

  @override
  String get appearance => 'Appearance';

  @override
  String get chooseThemeTitle => 'Choose theme';

  @override
  String get themeLight => 'Light theme';

  @override
  String get themeDark => 'Dark theme';

  @override
  String get themeSystem => 'System';

  @override
  String get language => 'Language';

  @override
  String get chooseLanguageTitle => 'Choose language';

  @override
  String get logoutConfirmBody => 'Are you sure you want to log out?';

  @override
  String get onboardingChooseTheme => 'Choose a Theme';

  @override
  String get onboardingChooseSubtitle =>
      'Pick the interface style that suits you best.';

  @override
  String get themeLightSubtitle => 'Bright, clear and easy to read';

  @override
  String get themeDarkSubtitle => 'Modern, mysterious and easy on the eyes';

  @override
  String get themeSystemSubtitle => 'Automatically match your device';

  @override
  String get startExperience => 'Start Exploring';

  @override
  String get tooltipSettings => 'Settings';

  @override
  String get tooltipNewConversation => 'New conversation';

  @override
  String get listLoadFailed => 'Couldn\'t load the list';

  @override
  String get listCheckNetwork => 'Check your network connection and try again.';

  @override
  String get listGenericError =>
      'Something went wrong. Please try again later.';

  @override
  String get emptyConversations => 'No conversations yet';

  @override
  String get emptyTapPlus => 'Tap the \"+\" button below to start!';

  @override
  String get searchConversationsHint => 'Search conversations...';

  @override
  String get noConversationsFound => 'No conversations found';

  @override
  String get offlineBanner => 'No network connection';

  @override
  String get conversationDefault => 'Conversation';

  @override
  String get newConversationTitle => 'New Conversation';

  @override
  String get startConversationHeading => 'Start a conversation';

  @override
  String get fieldRecipient => 'Recipient email or User ID';

  @override
  String get valRecipientRequired => 'Please enter an email or User ID';

  @override
  String get errUserNotFoundEmail => 'No user found with this email.';

  @override
  String get errUserNotFoundOrConn => 'User not found or connection error.';

  @override
  String get startConversationButton => 'Start Chatting';

  @override
  String get chatDefaultTitle => 'Chat';

  @override
  String get statusOnline => 'active now';

  @override
  String get statusOffline => 'offline';

  @override
  String get typingLabel => 'typing';

  @override
  String get messageHint => 'Type a message...';

  @override
  String get tabChats => 'Chats';

  @override
  String get tabArchived => 'Archived';

  @override
  String get tabRequests => 'Requests';

  @override
  String get tabNew => 'New';

  @override
  String get noRequests => 'No pending requests';

  @override
  String get declineRequest => 'Decline';

  @override
  String get dmRequestSubtitle => 'Wants to message you';

  @override
  String get groupInviteSubtitle => 'Invited you to a group';

  @override
  String get blockedChatsTitle => 'Blocked chats';

  @override
  String get newGroup => 'New group';

  @override
  String get newDirect => 'New chat';

  @override
  String get createGroup => 'Create group';

  @override
  String get groupName => 'Group name';

  @override
  String get groupDefaultName => 'Group';

  @override
  String get valGroupNameRequired => 'Please enter a group name';

  @override
  String get selectMembers => 'Select members';

  @override
  String get valSelectMembers => 'Select at least 2 members';

  @override
  String get searchUsers => 'Search by name, email or phone';

  @override
  String get phoneSearchHint => 'Enter the full phone number to search';

  @override
  String get groupInfo => 'Group info';

  @override
  String get members => 'Members';

  @override
  String membersCount(int count) {
    return '$count members';
  }

  @override
  String get addMembers => 'Add members';

  @override
  String get removeMember => 'Remove from group';

  @override
  String get leaveGroup => 'Leave group';

  @override
  String get leaveGroupConfirm => 'Are you sure you want to leave this group?';

  @override
  String get renameGroup => 'Rename group';

  @override
  String get admin => 'Admin';

  @override
  String get you => 'You';

  @override
  String get someone => 'Someone';

  @override
  String get aiHubTitle => 'AI Hub';

  @override
  String get aiHubSubtitle => 'Everything about your AI assistant';

  @override
  String get aiHubStartChat => 'Start chat with PON AI';

  @override
  String get aiHubMemory => 'Memory';

  @override
  String get aiHubIntegrations => 'Connectors';

  @override
  String get aiHubSkills => 'Skills';

  @override
  String get aiHubTokenUsage => 'Usage';

  @override
  String systemAddedMember(String actor, String target) {
    return '$actor added $target';
  }

  @override
  String systemRemovedMember(String actor, String target) {
    return '$actor removed $target';
  }

  @override
  String systemLeftGroup(String actor) {
    return '$actor left the group';
  }

  @override
  String systemRenamedGroup(String actor, String name) {
    return '$actor renamed the group to $name';
  }

  @override
  String systemCreatedGroup(String actor) {
    return '$actor created the group';
  }

  @override
  String get actionReply => 'Reply';

  @override
  String get actionRecall => 'Recall';

  @override
  String get actionEdit => 'Edit';

  @override
  String get messageEdited => '(edited)';

  @override
  String get actionDeleteForMe => 'Delete for me';

  @override
  String get actionCopy => 'Copy';

  @override
  String get downloadAction => 'Download';

  @override
  String get actionReact => 'React';

  @override
  String get messageRecalled => 'Message was recalled';

  @override
  String get messageSendFailedRetry => 'Failed to send. Tap to retry.';

  @override
  String replyingTo(String name) {
    return 'Replying to $name';
  }

  @override
  String get copiedToClipboard => 'Copied to clipboard';

  @override
  String get recallConfirm => 'Recall this message for everyone?';

  @override
  String get deleteConversation => 'Delete conversation';

  @override
  String get deleteConversationConfirm =>
      'Delete this conversation? It will be hidden from your list.';

  @override
  String get clearHistory => 'Clear chat history';

  @override
  String get clearHistoryConfirm =>
      'Clear all messages in this conversation for you?';

  @override
  String get disappearingMessages => 'Disappearing messages';

  @override
  String get disappearingOff => 'Off';

  @override
  String get disappearing24h => '24 hours';

  @override
  String get disappearing7d => '7 days';

  @override
  String get changeAvatar => 'Change avatar';

  @override
  String get uploadFailed => 'Upload failed, please try again';

  @override
  String get lastSeenJustNow => 'active just now';

  @override
  String lastSeenMinutes(int minutes) {
    return 'active ${minutes}m ago';
  }

  @override
  String lastSeenHours(int hours) {
    return 'active ${hours}h ago';
  }

  @override
  String lastSeenDays(int days) {
    return 'active ${days}d ago';
  }

  @override
  String get dateToday => 'Today';

  @override
  String get dateYesterday => 'Yesterday';

  @override
  String get attachPhoto => 'Photo';

  @override
  String get attachVideo => 'Video';

  @override
  String get attachFile => 'File';

  @override
  String get attachVoice => 'Voice message';

  @override
  String get attachSticker => 'Sticker';

  @override
  String get pinnedMessageTitle => 'Pinned message';

  @override
  String get pinnedSystemMessage => 'System message';

  @override
  String get uploading => 'Uploading…';

  @override
  String get downloadMedia => 'Download';

  @override
  String get imageDownloadHd => 'View HD';

  @override
  String get attachmentLabel => '📎 Attachment';

  @override
  String get callIncoming => 'Incoming call';

  @override
  String callIncomingBody(String name) {
    return '$name is calling you';
  }

  @override
  String callCalling(String name) {
    return 'Calling $name…';
  }

  @override
  String get callConnecting => 'Connecting…';

  @override
  String get callMediaError =>
      'Cannot access camera/microphone (HTTPS or localhost required)';

  @override
  String get callNoAnswer => 'No answer';

  @override
  String get callUnknownCaller => 'Someone';

  @override
  String get callToggleMic => 'Toggle microphone';

  @override
  String get callToggleCam => 'Toggle camera';

  @override
  String get callLeave => 'Leave';

  @override
  String get callJoin => 'Join';

  @override
  String get callAccept => 'Accept';

  @override
  String get callDecline => 'Decline';

  @override
  String get groupCallTitle => 'Group call';

  @override
  String groupCallParticipants(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count participants',
      one: '1 participant',
    );
    return '$_temp0';
  }

  @override
  String get groupCallNotetakerActive => 'AI is taking notes';

  @override
  String get groupCallStartTitle => 'Start a group call';

  @override
  String get groupCallAudio => 'Audio';

  @override
  String get groupCallVideo => 'Video';

  @override
  String get groupCallNotetakerToggle => 'AI notetaker';

  @override
  String get groupCallNotetakerHint =>
      'The AI listens and posts a meeting summary afterward.';

  @override
  String get groupCallStartAction => 'Start call';

  @override
  String activeCallBanner(int count) {
    return 'Group call · $count joined';
  }

  @override
  String get incomingGroupCallTitle => 'Incoming group call';

  @override
  String incomingGroupCallBody(String name) {
    return '$name started a group call';
  }

  @override
  String get meetingSummaryTitle => 'Meeting summary';

  @override
  String meetingSummaryDuration(String duration) {
    return 'Duration $duration';
  }

  @override
  String meetingSummaryAttendees(String names) {
    return 'Attendees: $names';
  }

  @override
  String get meetingSummaryOverview => 'Overview';

  @override
  String get meetingSummaryKeyPoints => 'Key points';

  @override
  String get meetingSummaryActionItems => 'Action items';

  @override
  String get profileTitle => 'Profile';

  @override
  String get profileRoleLabel => 'Role';

  @override
  String get profileRoleMemberDefault => 'Member';

  @override
  String get roleLabel => 'Role';

  @override
  String get privacySectionLabel => 'Privacy';

  @override
  String get editProfile => 'Edit profile';

  @override
  String get bio => 'Bio';

  @override
  String friendsCountLabel(int count) {
    return '$count friends';
  }

  @override
  String get messageAction => 'Message';

  @override
  String get activeFriends => 'Active now';

  @override
  String get noFriendsOnline => 'No friends online';

  @override
  String get strangerBannerTitle => 'Message request';

  @override
  String get strangerBannerBody =>
      'This person isn\'t in your contacts. Accept to reply.';

  @override
  String get acceptRequest => 'Accept';

  @override
  String get rejectRequest => 'Decline';

  @override
  String get friends => 'Friends';

  @override
  String get contacts => 'Contacts';

  @override
  String get friendRequests => 'Friend requests';

  @override
  String get addFriend => 'Add friend';

  @override
  String get friendRequestSent => 'Friend request sent';

  @override
  String get acceptFriend => 'Accept';

  @override
  String get noFriends => 'No friends yet';

  @override
  String get noFriendRequests => 'No pending requests';

  @override
  String get friendRequestPending => 'Pending';

  @override
  String get friendsTabSearch => 'Search';

  @override
  String get declineFriend => 'Decline';

  @override
  String get searchUsersPrompt => 'Search for people to add as friends';

  @override
  String get noSearchResults => 'No users found';

  @override
  String get unfriend => 'Unfriend';

  @override
  String get unfriendConfirm => 'Remove this friend?';

  @override
  String get blockUser => 'Block';

  @override
  String get unblockUser => 'Unblock';

  @override
  String get blockUserConfirm =>
      'Block this user? You won\'t be able to message each other.';

  @override
  String get blockedComposerNotice => 'You can\'t send messages to this chat';

  @override
  String get userBlocked => 'User blocked';

  @override
  String get userUnblocked => 'User unblocked';

  @override
  String get mentionNotificationTitle => 'Mentioned you';

  @override
  String mentionNotificationBody(String name) {
    return '$name mentioned you';
  }

  @override
  String get searchMessages => 'Search messages';

  @override
  String get searchHint => 'Search in conversation';

  @override
  String get searchNoResults => 'No messages found';

  @override
  String get exploreChannels => 'Explore Channels';

  @override
  String get searchChannelsHint => 'Search channels…';

  @override
  String get noPublicChannels => 'No public channels found';

  @override
  String get joinChannel => 'Join';

  @override
  String get pinMessage => 'Pin';

  @override
  String get unpinMessage => 'Unpin';

  @override
  String get pinnedMessagesTitle => 'Pinned Messages';

  @override
  String get pinLimitReached => 'You can pin up to 5 messages';

  @override
  String get cannotPinCall => 'Calls can\'t be pinned';

  @override
  String get forwardMessage => 'Forward';

  @override
  String get messageForwarded => 'Message forwarded';

  @override
  String get forwardFailed => 'Failed to forward message';

  @override
  String get noConversationsToForward => 'No conversations available';

  @override
  String get rateLimitError => 'Too many messages. Please slow down.';

  @override
  String get sharedMediaTitle => 'Shared Media & Files';

  @override
  String get tabMedia => 'Media';

  @override
  String get tabFiles => 'Files';

  @override
  String get tabLinks => 'Links';

  @override
  String get noMediaFound => 'No media found';

  @override
  String get noFilesFound => 'No files found';

  @override
  String get noLinksFound => 'No links found';

  @override
  String get reactionsDetail => 'Reactions';

  @override
  String get changePasswordTitle => 'Change Password';

  @override
  String get currentPassword => 'Current Password';

  @override
  String get newPassword => 'New Password';

  @override
  String get confirmPassword => 'Confirm New Password';

  @override
  String get dateOfBirth => 'Date of Birth';

  @override
  String get notSet => 'Not set';

  @override
  String get passwordChangedSuccess => 'Password changed successfully';

  @override
  String get errCurrentPasswordIncorrect => 'Incorrect current password';

  @override
  String get changeCoverPhoto => 'Change cover photo';

  @override
  String get markAsRead => 'Mark as read';

  @override
  String get markAsUnread => 'Mark as unread';

  @override
  String get muteNotifications => 'Mute notifications';

  @override
  String get unmuteNotifications => 'Unmute notifications';

  @override
  String get viewProfile => 'View profile';

  @override
  String get voiceCall => 'Voice call';

  @override
  String get videoCall => 'Video call';

  @override
  String get archiveChat => 'Archive chat';

  @override
  String get unarchiveChat => 'Unarchive chat';

  @override
  String get mutedLabel => 'Muted';

  @override
  String get newNotificationTitle => 'New message';

  @override
  String newNotificationBody(String name) {
    return '$name sent you a message';
  }

  @override
  String get archivedChats => 'Archived chats';

  @override
  String get archivedChatsSubtitle => 'View archived conversations';

  @override
  String get emptyArchivedChats => 'No archived chats';

  @override
  String get webNoChatSelected => 'Select a conversation to start chatting';

  @override
  String get aiPersonality => 'Personality';

  @override
  String get aiSkills => 'Skills';

  @override
  String get adminOwnerOnly => 'Admin or Owner only';

  @override
  String get aiConnectedApps => 'Connected apps';

  @override
  String get aiUsage => 'Usage';

  @override
  String get chatInfoCategory => 'Chat Details';

  @override
  String get customizeChatCategory => 'Customize Chat';

  @override
  String get filesAndMediaCategory => 'Media, files and links';

  @override
  String get privacyAndSupportCategory => 'Privacy & support';

  @override
  String get callSelectMember => 'Select a member to call';

  @override
  String get profileHideInfo => 'Hide personal info';

  @override
  String get profileInfoHidden => 'Personal information is hidden';

  @override
  String get profileGender => 'Gender';

  @override
  String get profilePhone => 'Phone number';

  @override
  String get profileBio => 'Bio';

  @override
  String get profileDateOfBirth => 'Date of birth';

  @override
  String get profileShowDateOfBirth => 'Show date of birth to others';

  @override
  String get profileShowPhone => 'Show phone number to others';

  @override
  String get profileShowGender => 'Show gender to others';

  @override
  String get phoneVerifiedBadge => 'Verified';

  @override
  String get phoneSendOtp => 'Send verification code';

  @override
  String get phoneSending => 'Sending...';

  @override
  String get phoneChangeNumber => 'Change number';

  @override
  String get phoneNotVerified => 'Not verified';

  @override
  String get phoneSendOtpError => 'Couldn\'t send the code. Try again later.';

  @override
  String get phoneVerifyTitle => 'Verify phone number';

  @override
  String phoneOtpSubtitle(String phone) {
    return 'Enter the 6-digit code sent to $phone';
  }

  @override
  String get phoneOtpIncomplete => 'Enter all 6 digits';

  @override
  String get phoneOtpInvalid => 'Incorrect or expired code';

  @override
  String get phoneVerifiedSuccess => 'Phone number verified!';

  @override
  String get phoneVerifying => 'Verifying...';

  @override
  String get phoneConfirm => 'Confirm';

  @override
  String get phoneHint => '901 234 567';

  @override
  String get phoneNoNumber => 'No phone number';

  @override
  String get phoneNoticeText =>
      'Add a phone number to help secure your account.';

  @override
  String get phoneVerifyAction => 'Verify';

  @override
  String get phoneUnverifiedBadge => 'Unverified';

  @override
  String get phoneModalPhoneSubtitle =>
      'Enter your phone number to receive a verification code.';

  @override
  String get phoneRateLimit => 'Please wait before requesting another code.';

  @override
  String get phoneAlreadyTaken => 'This phone number is already in use.';

  @override
  String get phoneInvalidNumber => 'Invalid phone number.';

  @override
  String get phoneOtpExpired => 'Code expired — request a new one.';

  @override
  String get phoneResend => 'Resend code';

  @override
  String phoneResendCountdown(int seconds) {
    return 'Resend in ${seconds}s';
  }

  @override
  String get profilePrivacySection => 'Privacy';

  @override
  String get profileEditMode => 'Edit Profile';

  @override
  String get profileSave => 'Save';

  @override
  String get actionMessage => 'Message';

  @override
  String get actionAddFriend => 'Add Friend';

  @override
  String get actionBlock => 'Block';

  @override
  String get readDetails => 'Read details';

  @override
  String get seenStatus => 'Seen';

  @override
  String get noReadsYet => 'No one has read this yet';

  @override
  String get voiceMicTooltip => 'Voice message';

  @override
  String get recording => 'Recording...';

  @override
  String get stickerLabel => 'Stickers';

  @override
  String get emojiTab => 'Emoji';

  @override
  String get aiAssistant => 'AI Assistant';

  @override
  String get startChatWithAI => 'Chat with PON AI';

  @override
  String get aiThinking => 'AI is thinking...';

  @override
  String get aiError => 'AI is temporarily unavailable. Please try again.';

  @override
  String get aiErrStreamInterrupted =>
      'AI stream was interrupted. Please try again.';

  @override
  String get aiErrUnavailable => 'AI is temporarily unavailable.';

  @override
  String get aiErrRateLimited =>
      'Too many AI requests. Please slow down and try again shortly.';

  @override
  String get feedbackHelpful => 'Helpful';

  @override
  String get feedbackNotHelpful => 'Not helpful';

  @override
  String get feedbackCommentHint => 'Tell us what went wrong (optional)';

  @override
  String get feedbackThanks => 'Thanks for your feedback';

  @override
  String get feedbackSend => 'Send';

  @override
  String get feedbackError => 'Couldn\'t submit feedback. Please try again.';

  @override
  String get aiSensitiveAction => 'sensitive action';

  @override
  String get sourcesLabel => 'Sources';

  @override
  String get aiErrorRetry => 'Retry';

  @override
  String get aiMessageDeleted => 'Message deleted';

  @override
  String get viewAiMemory => 'View Memory';

  @override
  String get kbTitle => 'Knowledge Base';

  @override
  String get kbEmptyState =>
      'No documents yet.\nTap the upload button to add a PDF, DOCX, or TXT file.';

  @override
  String get kbUploadButton => 'Upload Document';

  @override
  String get kbDeleteConfirm => 'Delete this document?';

  @override
  String get kbProcessing => 'Processing';

  @override
  String get kbReady => 'Ready';

  @override
  String get kbError => 'Error';

  @override
  String get kbManage => 'Knowledge Base';

  @override
  String get kbSources => 'source(s)';

  @override
  String get kbChunks => 'chunks';

  @override
  String aiToolCalling(String toolName) {
    return 'Using tool: $toolName';
  }

  @override
  String get aiToolTrace => 'Tool trace';

  @override
  String get toolSearchMessages => 'Searching messages...';

  @override
  String get toolGetUserInfo => 'Looking up user info...';

  @override
  String get toolSearchKnowledgeBase => 'Searching knowledge base...';

  @override
  String get toolSummarizeConversation => 'Summarizing conversation...';

  @override
  String get toolCreateReminder => 'Creating reminder...';

  @override
  String get reminders => 'Reminders';

  @override
  String get remindersEmpty =>
      'No pending reminders.\nAsk PON AI to set a reminder for you.';

  @override
  String get reminderDone => 'Mark as done';

  @override
  String get tokenUsage => 'Token Usage';

  @override
  String get tokenUsageTitle => 'Token Usage Dashboard';

  @override
  String get tokenUsageSelectRange => 'Select date range';

  @override
  String get tokenUsageDateRangeError => 'Start date must be before end date';

  @override
  String get coverPhotoPreviewTitle => 'Preview cover photo';

  @override
  String get saveCoverPhoto => 'Set as cover';

  @override
  String get tokenUsageThisMonth => 'Total tokens this month';

  @override
  String get tokenUsageRequests => 'AI requests';

  @override
  String get tokenUsageEstCost => 'Estimated cost (USD)';

  @override
  String get tokenUsageDailyChart => 'Daily token usage (last 30 days)';

  @override
  String get aiTraceTitle => 'Agent trace';

  @override
  String get aiTraceThinking => 'Thinking';

  @override
  String get aiTraceTools => 'Tool calls';

  @override
  String get aiTraceStats => 'Stats';

  @override
  String get aiPersonaTitle => 'AI Persona';

  @override
  String get avatarUploadLabel => 'Change avatar';

  @override
  String get aiPersonaNameHint => 'Bot name (e.g. DevBot)';

  @override
  String get aiPersonaInstructionsHint =>
      'Custom instructions (e.g. Always respond with bullet points)';

  @override
  String get aiPersonaAdminOnly =>
      'Only group admins can configure the AI persona.';

  @override
  String get configureAiPersona => 'Configure AI Persona';

  @override
  String get aiPersonaToneFriendly => 'Friendly';

  @override
  String get aiPersonaToneProfessional => 'Professional';

  @override
  String get aiPersonaToneConcise => 'Concise';

  @override
  String get aiPersonaToneCreative => 'Creative';

  @override
  String get aiQuotaExceeded =>
      'Monthly AI usage quota exceeded. Please contact your admin.';

  @override
  String get viewUsage => 'View usage';

  @override
  String get tokenUsageQuota => 'Monthly quota';

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
  String get orContinueWith => 'Or continue with';

  @override
  String agreeToTerms(String privacyPolicy, String termsOfService) {
    return 'I agree to the $privacyPolicy and $termsOfService';
  }

  @override
  String get privacyPolicy => 'Privacy Policy';

  @override
  String get termsOfService => 'Terms of Service';

  @override
  String get valMustAgreeTerms =>
      'You must agree to the Terms of Service to continue';

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
  String get errCannotOpenLink => 'Couldn\'t open the link';

  @override
  String sysNicknameClearedSelf(String actorName) {
    return '$actorName cleared their own nickname';
  }

  @override
  String sysNicknameClearedOther(String actorName, String targetName) {
    return '$actorName cleared the nickname of $targetName';
  }

  @override
  String sysNicknameSetSelf(String actorName, String nickname) {
    return '$actorName set their nickname to $nickname';
  }

  @override
  String sysNicknameSetOther(
      String actorName, String targetName, String nickname) {
    return '$actorName set the nickname of $targetName to $nickname';
  }

  @override
  String sysThemeChanged(String actorName) {
    return '$actorName changed the chat theme';
  }

  @override
  String sysQuickReactionChanged(String actorName, String emoji) {
    return '$actorName changed the quick reaction to $emoji';
  }

  @override
  String sysGroupCreated(String actorName) {
    return '$actorName created the group';
  }

  @override
  String sysMembersAdded(String actorName) {
    return '$actorName added new members';
  }

  @override
  String sysMemberLeft(String actorName) {
    return '$actorName left the group';
  }

  @override
  String sysMemberRemoved(String actorName) {
    return '$actorName removed a member';
  }

  @override
  String sysMemberJoined(String actorName) {
    return '$actorName joined the group';
  }

  @override
  String sysPinnedMessage(String actorName) {
    return '$actorName pinned a message';
  }

  @override
  String sysUnpinnedMessage(String actorName) {
    return '$actorName unpinned a message';
  }

  @override
  String systemVideoCallEnded(String duration) {
    return 'Video call ended · $duration';
  }

  @override
  String systemVoiceCallEnded(String duration) {
    return 'Voice call ended · $duration';
  }

  @override
  String get systemVideoCallMissed => 'Missed video call';

  @override
  String get systemVoiceCallMissed => 'Missed voice call';

  @override
  String get errActionFailed => 'Something went wrong. Please try again.';

  @override
  String get kbDeleteFailed => 'Delete failed, please try again';

  @override
  String get exploreJoinFailed => 'Failed to join channel';

  @override
  String get unnamedChannel => 'Unnamed';

  @override
  String get actionOk => 'OK';

  @override
  String get reminderDeleteConfirm => 'Delete this reminder?';

  @override
  String get profileNameLabel => 'Name';

  @override
  String get genderMale => 'Male';

  @override
  String get genderFemale => 'Female';

  @override
  String get genderOther => 'Other';

  @override
  String get aiPersonaSaved => 'Saved';

  @override
  String get aiPersonaResetTitle => 'Reset AI persona';

  @override
  String get aiPersonaResetConfirm =>
      'Reset the AI persona to its default settings?';

  @override
  String get aiPersonaToneLabel => 'Tone';

  @override
  String get aiPersonaResetToDefault => 'Reset to Default';

  @override
  String tokenUsagePercentUsed(String percent) {
    return '$percent% used this month';
  }

  @override
  String tokenUsageCostUsd(String amount) {
    return '\$$amount';
  }

  @override
  String get notifications => 'Notifications';

  @override
  String get notificationsEnabled => 'Notifications are enabled';

  @override
  String get notificationsDisabled => 'Notifications are disabled';

  @override
  String get legalScreenTitle => 'Privacy & Terms';

  @override
  String get legalLastUpdated => 'Last updated: June 15, 2026';

  @override
  String get legalDataCollectionTitle => '1. Data Collection';

  @override
  String get legalDataCollectionContent =>
      'We collect information you provide directly to us, such as when you create or modify your account, use our services, or communicate with us. This includes your name, email address, profile picture, and the messages you send.';

  @override
  String get legalDataUsageTitle => '2. How We Use Your Data';

  @override
  String get legalDataUsageContent =>
      'Your data is used to provide, maintain, and improve our services, including facilitating communication between users, ensuring security, and personalizing your experience.';

  @override
  String get legalSecurityTitle => '3. Security';

  @override
  String get legalSecurityContent =>
      'We implement industry-standard security measures to protect your personal information and messages. Access to data is strictly controlled and we use encryption to secure sensitive information.';

  @override
  String get legalUserRightsTitle => '4. Your Rights';

  @override
  String get legalUserRightsContent =>
      'You have the right to access, correct, or delete your personal data. You can delete your account at any time through the application settings.';

  @override
  String get legalTermsTitle => '5. Terms of Service';

  @override
  String get legalTermsContent =>
      'By using our platform, you agree not to engage in any abusive, harassing, or illegal activities. We reserve the right to suspend or terminate accounts that violate these terms.';

  @override
  String get authMsgLoginSuccess => 'Login successful.';

  @override
  String get authMsgLogoutSuccess => 'Logout successful.';

  @override
  String get authMsgOtpSent => 'OTP has been sent to your email.';

  @override
  String get authMsgOtpValid => 'OTP verified successfully.';

  @override
  String get authMsgOtpResent => 'A new OTP has been sent.';

  @override
  String get authMsgPasswordUpdated =>
      'Password updated successfully. Please log in again.';

  @override
  String get authMsgAccountUnverifiedOtpSent =>
      'Account not yet verified. A new OTP has been sent to your email.';

  @override
  String get authErrOtpInvalid => 'Invalid OTP code.';

  @override
  String get authErrOtpExpired => 'OTP has expired.';

  @override
  String get authErrOtpAttemptsExceeded =>
      'Too many incorrect attempts. Please request a new OTP.';

  @override
  String authErrOtpWrongWithRemaining(int remaining) {
    return 'Incorrect OTP. $remaining attempt(s) remaining.';
  }

  @override
  String authErrOtpResendCooldown(int ttl) {
    return 'Please wait $ttl seconds before requesting a new OTP.';
  }

  @override
  String get authErrOtpSendFailed =>
      'We couldn\'t send the verification code right now. Please try again in a moment.';

  @override
  String get authErrEmailNotFound => 'Email does not exist in the system.';

  @override
  String get authErrValEmailInvalid => 'Invalid email format.';

  @override
  String get authErrValEmailRequired => 'Email is required.';

  @override
  String get authErrValDisplaynameRequired => 'Display name is required.';

  @override
  String get authErrValDisplaynameTooShort =>
      'Display name is too short (minimum 2 characters).';

  @override
  String get authErrValPasswordTooShort =>
      'Password must be at least 8 characters.';

  @override
  String authErrAccountLocked(int minutes) {
    return 'Account temporarily locked for $minutes minute(s) due to too many failed attempts.';
  }

  @override
  String authErrLoginFailedWithRemaining(int remaining) {
    return 'Incorrect email or password. $remaining attempt(s) remaining.';
  }

  @override
  String authErrLoginFailedLocked(int minutes) {
    return 'Too many failed attempts. Account locked for $minutes minute(s).';
  }

  @override
  String get authErrTokenInvalid => 'Invalid token.';

  @override
  String get authErrSessionNotFound => 'Session not found or has expired.';

  @override
  String get authErrSessionInvalid => 'Session does not exist or has expired.';

  @override
  String get authErrSessionRevoked => 'Session has been revoked.';

  @override
  String get authErrRefreshTokenReuse =>
      'Security alert: refresh token reuse detected. All sessions revoked.';

  @override
  String get authErrRefreshTokenInvalid => 'Invalid refresh token.';

  @override
  String get authErrRefreshTokenRotated =>
      'Refresh token has already been rotated.';

  @override
  String get authErrTokenSessionMismatch => 'Token does not match the session.';

  @override
  String get authErrSocialEmailUnavailable =>
      'Unable to retrieve email from social account.';

  @override
  String get authErrLoginCodeInvalid => 'Login code is invalid or has expired.';

  @override
  String get authErrUserNotFound => 'User not found.';

  @override
  String get integrationsTitle => 'Integrations';

  @override
  String get integrationsSubtitle =>
      'Connect an account once. From then on, just message your assistant — it acts on your behalf, with your permissions and nothing more.';

  @override
  String get integrationsSettingsSubtitle =>
      'Connect tools your assistant can use';

  @override
  String get connectorStatusConnected => 'Connected';

  @override
  String get connectorStatusAvailable => 'Available';

  @override
  String get connectorStatusComingSoon => 'Coming soon';

  @override
  String get connectorConnect => 'Connect';

  @override
  String get connectorManage => 'Manage';

  @override
  String get connectorDisconnect => 'Disconnect';

  @override
  String get connectorDisconnectConfirm =>
      'Disconnect this account? Your assistant will lose access to its tools.';

  @override
  String get connectorOpenFailed => 'Couldn\'t open the authorization page.';

  @override
  String get customMcpTitle => 'Add a custom MCP server';

  @override
  String get customMcpSubtitle =>
      'Point your assistant at any MCP server. We\'ll discover its tools and your assistant can use them.';

  @override
  String get customMcpName => 'Name';

  @override
  String get customMcpUrl => 'Server URL';

  @override
  String get customMcpAuth => 'Auth';

  @override
  String get customMcpAuthNone => 'None';

  @override
  String get customMcpAuthApiKey => 'API key';

  @override
  String get customMcpAuthOauth => 'OAuth';

  @override
  String get customMcpCredential => 'Credential';

  @override
  String get customMcpDiscover => 'Discover tools';

  @override
  String get customMcpSave => 'Save';

  @override
  String get customMcpSaved => 'Custom MCP server added.';

  @override
  String customMcpToolsFound(int count) {
    return '$count tools discovered';
  }

  @override
  String get permissionsTitle => 'AI permissions';

  @override
  String get permissionsSubtitle =>
      'Choose which actions your assistant may take through this connector.';

  @override
  String get permView => 'View';

  @override
  String get permCreate => 'Create';

  @override
  String get permEdit => 'Edit';

  @override
  String get permDelete => 'Delete';

  @override
  String get permViewDesc => 'Read data, search, and summarize (read-only).';

  @override
  String get permCreateDesc =>
      'Add new items such as files, events, or records.';

  @override
  String get permEditDesc => 'Modify existing items and their content.';

  @override
  String get permDeleteDesc => 'Remove items permanently.';

  @override
  String get permManage => 'Permissions';

  @override
  String get permSaved => 'Permissions updated.';

  @override
  String get skillsTitle => 'Skills';

  @override
  String get skillsSubtitle =>
      'Skills bundle a set of tools and a way of working. Turn on only what you need — each one tells you what it requires.';

  @override
  String get skillsRealActionNote =>
      'Skills change how your assistant thinks and talks. To let it actually act (send email, create events, write to Notion...), connect the matching app below.';

  @override
  String get skillsSettingsSubtitle => 'Choose what your assistant is good at';

  @override
  String skillNeeds(String requirements) {
    return 'Needs $requirements';
  }

  @override
  String get skillSchedulerName => 'Scheduler';

  @override
  String get skillSchedulerDesc =>
      'Suggests meeting times and drafts invites — you still send them via your calendar/mail app (or connect Google Calendar/Gmail so it can act directly).';

  @override
  String get skillMailWriterName => 'Mail writer';

  @override
  String get skillMailWriterDesc =>
      'Drafts replies in your voice, summarizes long threads.';

  @override
  String get skillResearcherName => 'Researcher';

  @override
  String get skillResearcherDesc =>
      'Answers from what\'s in this conversation and your training knowledge, with sources cited when possible — not a live web search.';

  @override
  String get skillProjectKeeperName => 'Project keeper';

  @override
  String get skillProjectKeeperDesc =>
      'Tracks tasks, owners and decisions in the conversation and summarizes them — connect Notion so it can actually write them there.';

  @override
  String get skillMeetingNotesName => 'Meeting notes';

  @override
  String get skillMeetingNotesDesc =>
      'Summarize meetings and pull out decisions and action items.';

  @override
  String get skillInboxTriageName => 'Inbox triage';

  @override
  String get skillInboxTriageDesc =>
      'Prioritize messages and suggest quick replies.';

  @override
  String get skillDataAnalystName => 'Data analyst';

  @override
  String get skillDataAnalystDesc =>
      'Analyze tables and numbers; surface trends and outliers.';

  @override
  String get skillDocDrafterName => 'Document drafter';

  @override
  String get skillDocDrafterDesc =>
      'Draft structured proposals, specs and reports.';

  @override
  String get skillTranslatorName => 'Translator';

  @override
  String get skillTranslatorDesc =>
      'Translate and localize text naturally across languages.';

  @override
  String get skillWebSearchName => 'Web Searcher';

  @override
  String get skillWebSearchDesc =>
      'Finds current information on the web and cites sources.';

  @override
  String get skillWeatherForecastName => 'Weather Forecast';

  @override
  String get skillWeatherForecastDesc =>
      'Looks up weather and forecast for any location.';

  @override
  String get adminTitle => 'Admin Console';

  @override
  String get adminSubtitle =>
      'Manage your workspace, departments, members and roles';

  @override
  String get adminBack => 'Back';

  @override
  String get adminLoading => 'Loading…';

  @override
  String get adminSave => 'Save';

  @override
  String get adminSaving => 'Saving…';

  @override
  String get adminCancel => 'Cancel';

  @override
  String get adminToastSaved => 'Saved';

  @override
  String get adminToastDeleted => 'Deleted';

  @override
  String get adminToastError => 'Something went wrong';

  @override
  String get adminMenu => 'Admin';

  @override
  String get adminSettingsSubtitle => 'Workspace, departments, members & roles';

  @override
  String get adminNavWorkspace => 'Workspace';

  @override
  String get adminNavDepartments => 'Departments';

  @override
  String get adminNavMembers => 'Members';

  @override
  String get adminNavRoles => 'Roles';

  @override
  String get adminNavAudit => 'Audit log';

  @override
  String get adminNavAi => 'AI assistant';

  @override
  String get adminAiInheritHint =>
      'Leave a field empty or set \"Inherit\" to use the server default.';

  @override
  String get adminAiInheritOption => 'Inherit (default)';

  @override
  String get adminAiOn => 'On';

  @override
  String get adminAiOff => 'Off';

  @override
  String get adminAiPersonaSection => 'Persona';

  @override
  String get adminAiPersonaName => 'Default assistant name';

  @override
  String get adminAiTone => 'Default tone';

  @override
  String get adminAiToneFriendly => 'Friendly';

  @override
  String get adminAiToneProfessional => 'Professional';

  @override
  String get adminAiToneConcise => 'Concise';

  @override
  String get adminAiToneCreative => 'Creative';

  @override
  String get adminAiModelSection => 'Model';

  @override
  String get adminAiModelTier => 'Default model tier';

  @override
  String get adminAiTierAuto => 'Auto (router)';

  @override
  String get adminAiTierSimple => 'Simple';

  @override
  String get adminAiTierMid => 'Balanced';

  @override
  String get adminAiTierComplex => 'Advanced';

  @override
  String get adminAiCapabilitiesSection => 'Capabilities';

  @override
  String get adminAiWebSearch => 'Web search';

  @override
  String get adminAiWebSearchDesc => 'Allow the assistant to search the web.';

  @override
  String get adminAiThinking => 'Extended thinking';

  @override
  String get adminAiThinkingDesc =>
      'Allow the assistant to reason step by step.';

  @override
  String get adminAiDigestSection => 'Daily digest';

  @override
  String get adminAiDailyDigest => 'Daily digest';

  @override
  String get adminAiDailyDigestDesc =>
      'Post a once-a-day summary of each AI conversation\'s activity.';

  @override
  String get adminAiDailyDigestHour => 'Delivery time';

  @override
  String get adminAiDailyDigestHourDesc =>
      'Local hour the digest is delivered. Available when the digest is on.';

  @override
  String get adminAiQuotaSection => 'Usage limit';

  @override
  String get adminAiTokenLimit => 'Monthly token limit';

  @override
  String get adminAiTokenLimitDesc =>
      'Leave empty to inherit; 0 blocks all usage.';

  @override
  String get adminAiConnectorsSection => 'Allowed connectors';

  @override
  String get adminAiRestrictConnectors => 'Restrict connectors for AI';

  @override
  String get adminAiConnectorsInherit => 'Inheriting the workspace allow-list.';

  @override
  String get adminAiConnectorsExplicit =>
      'AI may only use the connectors selected below.';

  @override
  String get adminWsIdentity => 'Identity & branding';

  @override
  String get adminWsName => 'Workspace name';

  @override
  String get adminWsNamePlaceholder => 'Acme Inc.';

  @override
  String get adminWsLogoUrl => 'Logo URL';

  @override
  String get adminWsPrimaryColor => 'Primary color';

  @override
  String get adminWsFeatures => 'Feature flags';

  @override
  String get adminWsNoFeatures => 'No feature flags configured.';

  @override
  String get adminWsAllowList => 'Connector allow-list';

  @override
  String get adminWsAllowListDesc =>
      'Connectors members may personally connect.';

  @override
  String get adminWsNoCatalog => 'No connectors available.';

  @override
  String get adminDeptNew => 'New department';

  @override
  String get adminDeptEdit => 'Edit department';

  @override
  String get adminDeptEmpty => 'No departments yet.';

  @override
  String get adminDeptLead => 'Lead';

  @override
  String get adminDeptLeadNone => 'No lead';

  @override
  String get adminDeptName => 'Name';

  @override
  String get adminDeptDescription => 'Description';

  @override
  String get adminDeptDialogDesc =>
      'Departments group members and own department chats.';

  @override
  String adminDeptDeleteConfirm(String name) {
    return 'Delete department \"$name\"?';
  }

  @override
  String get adminMemberHint => 'Assign a role and departments to each member.';

  @override
  String get adminMemberEdit => 'Edit member';

  @override
  String get adminMemberRevokeNote =>
      'Saving revokes the member\'s active sessions.';

  @override
  String get adminMemberRole => 'Role';

  @override
  String get adminMemberRoleNone => 'No role';

  @override
  String get adminMemberRoleLockedSelf => 'You can\'t change your own role.';

  @override
  String get adminMemberRoleLockedOwner =>
      'Only an Owner can change an Owner\'s role.';

  @override
  String get adminMemberDepartments => 'Departments';

  @override
  String get adminRoleHint =>
      'Toggle each role\'s permissions. The Owner role is read-only.';

  @override
  String get adminRoleCapability => 'Capability';

  @override
  String get adminRolePreset => 'Preset';

  @override
  String get adminRoleClone => 'Clone';

  @override
  String adminRoleCloneTitle(String name) {
    return 'Clone $name';
  }

  @override
  String get adminRoleName => 'Role name';

  @override
  String get adminAuditTitle => 'Audit log';

  @override
  String get adminAuditComingSoon =>
      'The audit log will be available in a future update.';

  @override
  String get adminCapManageWorkspace => 'Manage workspace';

  @override
  String get adminCapManageDepartments => 'Manage departments';

  @override
  String get adminCapManageMembers => 'Manage members';

  @override
  String get adminCapManageRoles => 'Manage roles';

  @override
  String get adminCapConnectWorkspaceConnector =>
      'Connect workspace connectors';

  @override
  String get adminCapAddCustomMcp => 'Add custom MCP';

  @override
  String get adminCapConnectPersonalConnector => 'Connect personal connectors';

  @override
  String get adminCapUsePersonalAssistant => 'Use personal assistant';

  @override
  String get adminCapUseGroupBot => 'Use group bot';

  @override
  String get adminCapRunSensitiveSkill => 'Run sensitive skills';

  @override
  String get adminCapViewAuditLog => 'View audit log';

  @override
  String get adminAuditEmpty => 'No audit entries yet.';

  @override
  String get adminAuditPrev => 'Previous';

  @override
  String get adminAuditNext => 'Next';

  @override
  String get newConvDepartment => 'Department (optional)';

  @override
  String get newConvNoDepartment => 'No department';

  @override
  String get loginWithSso => 'Sign in with SSO';

  @override
  String get adminNavSso => 'SSO';

  @override
  String get adminSsoTitle => 'Single Sign-On (SSO)';

  @override
  String get adminSsoHint =>
      'Configure OIDC login. Provider credentials are set in the deployment .env; here you map IdP groups to roles and departments.';

  @override
  String get adminSsoEnabled => 'Enable SSO';

  @override
  String get adminSsoAllowedDomains => 'Allowed email domains';

  @override
  String get adminSsoAllowedDomainsHint =>
      'Comma-separated. Leave empty to allow any verified email.';

  @override
  String get adminSsoDefaultRole => 'Default role';

  @override
  String get adminSsoNone => 'None';

  @override
  String get adminSsoGroupRoleMap => 'Group → Role';

  @override
  String get adminSsoGroupDeptMap => 'Group → Department';

  @override
  String get adminSsoGroupPlaceholder => 'IdP group name';

  @override
  String get adminSsoAddMapping => 'Add mapping';

  @override
  String get sectionDirectoryTitle => 'MCP directory';

  @override
  String get sectionDirectoryDesc =>
      'Browse MCP servers and connect with one click — OAuth runs automatically.';

  @override
  String get directoryAdd => 'Add entry';

  @override
  String get directorySearch => 'Search the directory…';

  @override
  String get directoryEmpty => 'No directory entries match your search.';

  @override
  String get directoryEdit => 'Edit entry';

  @override
  String get directoryDelete => 'Delete entry';

  @override
  String get tierWorkspace => 'Workspace';

  @override
  String get tierPersonal => 'Personal';

  @override
  String get tierBoth => 'Personal / Workspace';

  @override
  String get directorySaveSuccess => 'Directory entry saved.';

  @override
  String get directoryDeleteSuccess => 'Directory entry deleted.';

  @override
  String get directoryAddTitle => 'Add directory entry';

  @override
  String get directoryEditTitle => 'Edit directory entry';

  @override
  String get directoryDialogDesc =>
      'Add a public MCP server members can connect with one click.';

  @override
  String get directorySlug => 'Slug';

  @override
  String get directoryName => 'Name';

  @override
  String get directoryDescription => 'Description';

  @override
  String get directoryMcpUrl => 'MCP URL';

  @override
  String get directoryAuthMode => 'Auth mode';

  @override
  String get directoryTier => 'Tier';

  @override
  String get directoryEnvHint =>
      'For env-oauth: reference the env vars holding the OAuth client credentials.';

  @override
  String get directoryEnvClientId => 'Client ID env';

  @override
  String get directoryEnvClientSecret => 'Client secret env';

  @override
  String get directoryAuthorizeUrl => 'Authorize URL';

  @override
  String get directoryTokenUrl => 'Token URL';

  @override
  String get directoryCancel => 'Cancel';

  @override
  String get directorySave => 'Save';

  @override
  String directoryKeyTitle(String provider) {
    return 'Connect $provider';
  }

  @override
  String get directoryKeyLabel => 'API key';

  @override
  String directoryConnected(String provider) {
    return 'Connected $provider.';
  }

  @override
  String get editNicknames => 'Edit nicknames';

  @override
  String get nicknameModalTitle => 'Nicknames';

  @override
  String get nicknameNonePlaceholder => 'No nickname';

  @override
  String get nicknameYouSuffix => '(you)';

  @override
  String get adminNavUsage => 'Usage';

  @override
  String get usageThisMonth => 'This month';

  @override
  String get usageTotalTokens => 'Total tokens';

  @override
  String get usageRequests => 'Requests';

  @override
  String get usageEstCost => 'Estimated cost';

  @override
  String get usageThumbsDownRate => 'Thumbs-down rate';

  @override
  String usageFeedbackBreakdown(int down, int total) {
    return '$down of $total rated';
  }

  @override
  String get usagePerModelTitle => 'Cost by model';

  @override
  String usageModelTokens(String input, String output, String requests) {
    return '$input in / $output out · $requests req';
  }

  @override
  String get usageTopUsersTitle => 'Top users';

  @override
  String usageUserRequests(int count) {
    return '$count requests';
  }

  @override
  String get usageWorstAnswersTitle => 'Worst-rated answers';

  @override
  String get usageNoPreview => '(no answer preview)';

  @override
  String usageUserComment(String comment) {
    return '“$comment”';
  }

  @override
  String get usageNoData => 'No data for this period.';

  @override
  String get usageLoadError => 'Could not load the usage dashboard.';

  @override
  String get usageRetry => 'Retry';

  @override
  String get assistantDefaultName => 'My Assistant';

  @override
  String get assistantSubtitle => 'Your personal assistant';

  @override
  String get assistantOpenChat => 'Open assistant chat';

  @override
  String get assistantSetupCta => 'Set up assistant';

  @override
  String get assistantSetupTitle => 'Set up your assistant';

  @override
  String get assistantSetupStepName => 'Name your assistant';

  @override
  String get assistantSetupStepPersona => 'Define its personality';

  @override
  String get assistantSetupStepModel => 'Choose a model';

  @override
  String get assistantSetupStepConfirm => 'Review and create';

  @override
  String get assistantSetupNamePlaceholder => 'e.g. Aria';

  @override
  String get assistantSetupPersonaPlaceholder =>
      'You are a helpful assistant who…';

  @override
  String get assistantSetupPersonaHint =>
      'Describe how your assistant should talk and behave.';

  @override
  String get assistantSetupCreateButton => 'Create assistant';

  @override
  String get assistantSetupCreating => 'Creating…';

  @override
  String get assistantSetupSuccess => 'Your assistant is ready';

  @override
  String get assistantSettingsTitle => 'Assistant settings';

  @override
  String get assistantSettingsEditPersona => 'Personality';

  @override
  String get assistantSettingsChangeModel => 'Model';

  @override
  String get assistantSettingsDeleteTitle => 'Delete assistant';

  @override
  String get assistantSettingsDeleteConfirm =>
      'This will remove your assistant and its chat. This cannot be undone.';

  @override
  String get assistantSettingsDeleteButton => 'Delete assistant';

  @override
  String get botAdminTitle => 'Bot Integration';

  @override
  String get botAdminGenerateToken => 'Generate token';

  @override
  String get botAdminRevokeToken => 'Revoke';

  @override
  String get botAdminTokenWarning =>
      'Copy this token now — it is shown only once and cannot be retrieved again.';

  @override
  String get botAdminCopyToken => 'Copy';

  @override
  String get botAdminMcpUrl => 'MCP URL';

  @override
  String get botAdminToken => 'Integration token';

  @override
  String get botAdminLastUsed => 'Last used';

  @override
  String get botAdminNeverUsed => 'Never used';

  @override
  String get botAdminNoBotsRegistered => 'No bots registered yet.';

  @override
  String get helpTitle => 'Help & FAQ';

  @override
  String get settingsHelp => 'Help & FAQ';

  @override
  String get settingsHelpSubtitle => 'Help center & FAQs';

  @override
  String get helpSearchHint => 'Search help…';

  @override
  String get helpNoResults => 'No results found';

  @override
  String get helpCatGettingStarted => 'Getting Started';

  @override
  String get helpCatMessaging => 'Messaging';

  @override
  String get helpCatAiFeatures => 'AI Features';

  @override
  String get helpCatGroups => 'Groups';

  @override
  String get helpCatAccountSecurity => 'Account & Security';

  @override
  String get helpGettingStartedQ1 => 'What is PON?';

  @override
  String get helpGettingStartedA1 =>
      'PON is a self-hosted AI-powered messaging platform that combines team communication with an integrated AI assistant. It supports direct messages, group chats, and AI-driven workflows.';

  @override
  String get helpGettingStartedQ2 => 'How do I create an account?';

  @override
  String get helpGettingStartedA2 =>
      'Your account is created by your workspace administrator. You\'ll receive an invitation email with instructions to set your password and verify your account.';

  @override
  String get helpGettingStartedQ3 => 'How do I find and add friends?';

  @override
  String get helpGettingStartedA3 =>
      'Go to the Friends tab and use the search bar to find colleagues by name or email. Send a friend request and start chatting once accepted.';

  @override
  String get helpGettingStartedQ4 => 'How do I start a conversation?';

  @override
  String get helpGettingStartedA4 =>
      'Tap the compose icon on the conversations screen, search for a contact, and select them to open a new conversation.';

  @override
  String get helpMessagingQ1 => 'How do I send messages?';

  @override
  String get helpMessagingA1 =>
      'Type your message in the text field at the bottom of the conversation and press Enter or tap the send button.';

  @override
  String get helpMessagingQ2 => 'Can I send voice messages?';

  @override
  String get helpMessagingA2 =>
      'Yes! Hold the microphone button in the message input area to record a voice message. Release to send or swipe to cancel.';

  @override
  String get helpMessagingQ3 => 'How do I send files and images?';

  @override
  String get helpMessagingA3 =>
      'Tap the attachment icon next to the message input to select images, videos, or files from your device.';

  @override
  String get helpMessagingQ4 => 'How do I pin important messages?';

  @override
  String get helpMessagingA4 =>
      'Long-press or hover over a message, tap the More menu (⋯), and select \'Pin message\'. Pinned messages appear at the top of the conversation. You can pin up to 2 messages per conversation.';

  @override
  String get helpMessagingQ5 => 'What are message reactions?';

  @override
  String get helpMessagingA5 =>
      'Hover over or long-press a message and tap the emoji icon to add a quick reaction. Others can see and add their own reactions.';

  @override
  String get helpAiFeaturesQ1 => 'What can the AI Assistant do?';

  @override
  String get helpAiFeaturesA1 =>
      'The AI Assistant (@AI) can answer questions, summarize conversations, help draft messages, analyze uploaded documents, and execute tasks using connected tools.';

  @override
  String get helpAiFeaturesQ2 => 'How do I use @AI in a conversation?';

  @override
  String get helpAiFeaturesA2 =>
      'In any conversation, type @AI followed by your question or request. The assistant will respond in the conversation thread.';

  @override
  String get helpAiFeaturesQ3 => 'What is AI memory?';

  @override
  String get helpAiFeaturesA3 =>
      'AI memory allows the assistant to remember context from previous conversations, making interactions more personalized and efficient over time.';

  @override
  String get helpAiFeaturesQ4 => 'How do I set up my personal assistant?';

  @override
  String get helpAiFeaturesA4 =>
      'Go to the AI Assistant section and tap \'Set up assistant\'. You can configure the assistant\'s persona, connect tools, and set preferences.';

  @override
  String get helpGroupsQ1 => 'How do I create a group?';

  @override
  String get helpGroupsA1 =>
      'Tap the compose icon, select \'New Group\', add members by searching their names, set a group name, and tap Create.';

  @override
  String get helpGroupsQ2 => 'How do I add members to a group?';

  @override
  String get helpGroupsA2 =>
      'Open the group conversation, tap the Settings icon, and select \'Add Members\'. Search for contacts and add them.';

  @override
  String get helpGroupsQ3 => 'What are group roles?';

  @override
  String get helpGroupsA3 =>
      'Groups have two roles: Admin and Member. Admins can add/remove members, change the group name and avatar, and manage group settings.';

  @override
  String get helpAccountSecurityQ1 => 'How do I change my profile picture?';

  @override
  String get helpAccountSecurityA1 =>
      'Go to Settings → Profile, tap your current avatar, and choose a new photo from your device.';

  @override
  String get helpAccountSecurityQ2 => 'How do I enable disappearing messages?';

  @override
  String get helpAccountSecurityA2 =>
      'Open a conversation, tap the Settings icon, go to Customize Chat, and enable \'Disappearing Messages\' with your preferred timer.';

  @override
  String get helpAccountSecurityQ3 => 'How do I block a user?';

  @override
  String get helpAccountSecurityA3 =>
      'Open the conversation with the user, tap the Settings icon, scroll to Privacy & Support, and select \'Block User\'.';

  @override
  String get helpAccountSecurityQ4 => 'How do I delete message history?';

  @override
  String get helpAccountSecurityA4 =>
      'Open the conversation, tap Settings, go to Privacy & Support, and select \'Clear History\'. This only removes history from your device.';

  @override
  String get blockedChats => 'Blocked';

  @override
  String get noBlockedChats => 'No blocked conversations';

  @override
  String get blockAndHide => 'Block and hide';

  @override
  String get unblockAndRestore => 'Unblock';

  @override
  String get callBlocked => 'This user doesn\'t want to be contacted';

  @override
  String get mute15min => '15 minutes';

  @override
  String get mute30min => '30 minutes';

  @override
  String get mute1hour => '1 hour';

  @override
  String get mute24hours => '24 hours';

  @override
  String get muteForever => 'Until I turn it back on';

  @override
  String get profileBlockedByOwner => 'This user\'s profile is not available';

  @override
  String get unsavedChangesTitle => 'You have unsaved changes';

  @override
  String get unsavedChangesDesc => 'If you leave, your changes will be lost.';

  @override
  String get keepEditing => 'Keep editing';

  @override
  String get saveAndLeave => 'Save and leave';

  @override
  String get leaveWithoutSaving => 'Leave without saving';

  @override
  String get aiSessionHistory => 'Conversation history';

  @override
  String get aiNewSession => 'New conversation';

  @override
  String get aiSessionActive => 'Active';

  @override
  String get aiSessionSummarized => 'Summarized';

  @override
  String get aiSessionEmpty => 'No previous conversations';

  @override
  String get aiSessionResume => 'Resume';

  @override
  String get aiSessionLoadError => 'Couldn\'t load conversation history';

  @override
  String multiSelectCount(int count) {
    return '$count selected';
  }

  @override
  String get multiSelectEmpty => 'No messages selected';

  @override
  String get multiSelectCancel => 'Cancel';

  @override
  String multiSelectTypeWarning(String type) {
    return 'You\'re selecting $type. You can only select one type at a time.';
  }

  @override
  String multiDeleted(int count) {
    return 'Deleted $count messages';
  }

  @override
  String multiRecalled(int count) {
    return 'Recalled $count messages';
  }

  @override
  String get multiForwardHint => 'Select a single message to forward';

  @override
  String get msgTypeText => 'text';

  @override
  String get msgTypeImage => 'photos/videos';

  @override
  String get msgTypeFile => 'files';

  @override
  String get selectMessages => 'Select messages';

  @override
  String get removeAttachment => 'Remove';

  @override
  String get addMore => 'Add more';

  @override
  String get attachHdOn => 'HD — high quality';

  @override
  String get attachHdOff => 'SD — compressed';

  @override
  String get hdOn => 'HD On';

  @override
  String get hdOff => 'HD Off';

  @override
  String get videoCannotPlay => 'Cannot play video';

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

  @override
  String get loginInviteOnlyHint =>
      'PON is invite-only. Ask your administrator for an invitation.';

  @override
  String get loginHaveInviteLink => 'Have an invitation link?';

  @override
  String get inviteLinkDialogTitle => 'Open an invitation';

  @override
  String get inviteLinkDialogHint =>
      'Paste the invitation link from your email';

  @override
  String get inviteLinkInvalid =>
      'This doesn\'t look like a valid invitation link.';

  @override
  String get inviteOpen => 'Open';

  @override
  String get inviteCancel => 'Cancel';

  @override
  String get inviteRetry => 'Try again';

  @override
  String get inviteTitle => 'You\'re invited';

  @override
  String inviteSubtitle(String inviter, String workspace, String role) {
    return '$inviter invited you to join $workspace as $role';
  }

  @override
  String inviteSubtitleNoRole(String inviter, String workspace) {
    return '$inviter invited you to join $workspace';
  }

  @override
  String get inviteContinueWithGoogle => 'Continue with Google';

  @override
  String inviteGoogleHint(String email) {
    return 'Use the Google account for $email';
  }

  @override
  String get inviteOrSetPassword => 'or set a password';

  @override
  String get inviteSubmit => 'Create account';

  @override
  String get inviteInvalidTitle => 'Invalid invitation';

  @override
  String get inviteInvalidBody =>
      'This invitation link is invalid. Check the link in your email or ask your administrator for a new one.';

  @override
  String get inviteExpiredTitle => 'Invitation expired';

  @override
  String get inviteExpiredBody =>
      'This invitation has expired. Ask your administrator to resend it.';

  @override
  String get inviteRevokedTitle => 'Invitation revoked';

  @override
  String get inviteRevokedBody =>
      'This invitation was revoked by your administrator.';

  @override
  String get inviteAcceptedTitle => 'Already accepted';

  @override
  String get inviteAcceptedBody =>
      'This invitation was already accepted. Sign in to continue.';

  @override
  String get inviteLoadFailedTitle => 'Couldn\'t load the invitation';

  @override
  String get inviteBackToLogin => 'Back to sign in';

  @override
  String get authMsgInvitationAccepted => 'Invitation accepted. Welcome!';

  @override
  String get authErrAccountNotProvisioned =>
      'The account you chose doesn\'t have access to PON yet. Try another account, or ask your administrator for an invitation.';

  @override
  String get authErrAccountBlocked =>
      'This account has been blocked. Contact your administrator.';

  @override
  String get authErrInvitationPending =>
      'You have a pending invitation. Open the invitation link in your email to finish setting up.';

  @override
  String get authErrInvitationInvalid => 'This invitation link is invalid.';

  @override
  String get authErrInvitationExpired =>
      'This invitation has expired. Ask your administrator to resend it.';

  @override
  String get authErrInvitationRevoked => 'This invitation was revoked.';

  @override
  String get authErrInvitationAlreadyAccepted =>
      'This invitation was already accepted. Please sign in.';

  @override
  String get authErrInvitationEmailMismatch =>
      'Sign in with the Google account that matches the invited email.';

  @override
  String get authErrInvitationAlreadyPending =>
      'This email already has a pending invitation.';

  @override
  String get authErrInvitationNotPending =>
      'This invitation is no longer pending.';

  @override
  String get authErrInvitationNotFound => 'Invitation not found.';

  @override
  String authErrInvitationResendCooldown(int ttl) {
    return 'Please wait ${ttl}s before resending.';
  }

  @override
  String get authErrMemberAlreadyExists =>
      'A member with this email already exists.';

  @override
  String get authErrMemberNotFound => 'Member not found.';

  @override
  String get authErrRoleNotFound => 'Role not found.';

  @override
  String get authErrDepartmentNotFound => 'Department not found.';

  @override
  String get authErrOwnerRoleAssignForbidden =>
      'Only an Owner can grant the Owner role or change an Owner\'s role.';

  @override
  String get authErrCannotChangeOwnRole => 'You can\'t change your own role.';

  @override
  String get authErrLastOwnerCannotBeDemoted =>
      'The last Owner can\'t be demoted. Make another member Owner first.';

  @override
  String get authErrCannotBlockSelf => 'You cannot block your own account.';

  @override
  String get authErrOwnerBlockForbidden =>
      'Only an Owner can block another Owner.';

  @override
  String get authErrLastOwnerCannotBeBlocked =>
      'The last Owner cannot be blocked.';

  @override
  String get authErrSsoDisabled => 'Single sign-on is disabled.';

  @override
  String get authErrSsoDomainNotAllowed =>
      'Your email domain is not allowed for SSO.';

  @override
  String get adminInviteMember => 'Invite member';

  @override
  String get adminInviteTitle => 'Invite a member';

  @override
  String get adminInviteEmail => 'Email address';

  @override
  String get adminInviteRole => 'Role';

  @override
  String get adminInviteDepartments => 'Departments';

  @override
  String get adminInviteSubmit => 'Send invitation';

  @override
  String get adminInviteSent => 'Invitation sent';

  @override
  String get adminInviteEmailFailed =>
      'Invitation created, but the email could not be sent. Check the mail settings and resend it.';

  @override
  String get adminPendingInvitations => 'Pending invitations';

  @override
  String get adminInviteStatusPending => 'Pending';

  @override
  String get adminInviteStatusExpired => 'Expired';

  @override
  String adminInviteExpires(String date) {
    return 'Expires $date';
  }

  @override
  String adminInviteInvitedBy(String name) {
    return 'Invited by $name';
  }

  @override
  String get adminInviteResend => 'Resend';

  @override
  String get adminInviteResent => 'Invitation resent';

  @override
  String get adminInviteRevoke => 'Revoke';

  @override
  String adminInviteRevokeConfirm(String email) {
    return 'Revoke the invitation for $email? The link will stop working.';
  }

  @override
  String get adminInviteRevoked => 'Invitation revoked';

  @override
  String get adminMemberStatusBlocked => 'Blocked';

  @override
  String get adminMemberBlock => 'Block';

  @override
  String get adminMemberUnblock => 'Unblock';

  @override
  String adminMemberBlockConfirm(String name) {
    return 'Block $name? They will be signed out everywhere.';
  }

  @override
  String adminMemberUnblockConfirm(String name) {
    return 'Unblock $name? They will be able to sign in again.';
  }

  @override
  String get adminMemberBlocked => 'Member blocked';

  @override
  String get adminMemberUnblocked => 'Member unblocked';

  @override
  String get adminLoadFailed =>
      'Couldn\'t load this section. Please try again.';

  @override
  String callDeclined(String name) {
    return '$name declined the call';
  }

  @override
  String callBusy(String name) {
    return '$name is on another call';
  }

  @override
  String callPeerMediaError(String name) {
    return '$name couldn\'t turn on their microphone or camera';
  }

  @override
  String get callEnded => 'Call ended';

  @override
  String get callConnectionLost => 'Call dropped — connection lost';

  @override
  String get callSpeaker => 'Speaker';

  @override
  String get callSwitchCamera => 'Switch camera';

  @override
  String get callHangUp => 'End call';

  @override
  String get aiContextLearnedFactsLoadError =>
      'Couldn\'t load what the assistant has learned.';

  @override
  String get errTooManyRequests =>
      'Too many requests. Please wait a moment and try again.';

  @override
  String get removedFromConversation =>
      'You are no longer a member of this conversation';

  @override
  String get errGroupAdminRequired => 'Only group admins can do this';

  @override
  String get errChatUserBlocked => 'You can\'t message this person';

  @override
  String get errReplyTargetInvalid =>
      'The message you replied to is no longer available';

  @override
  String get errMessageTypeNotAllowed =>
      'This kind of message can\'t be sent here';

  @override
  String get errInvalidUrl => 'This link can\'t be previewed';

  @override
  String get errNotAGroup => 'This only works in group chats';

  @override
  String get errNotAMember => 'This person is no longer in the group';

  @override
  String get errLastAdminCannotBeRemoved => 'A group needs at least one admin';

  @override
  String get errPublicDepartmentChannel =>
      'A department group can\'t be a public channel';

  @override
  String get publicChannelToggle => 'Public channel';

  @override
  String get publicChannelHint =>
      'Anyone in the workspace can find it in Explore and join';

  @override
  String get groupMakeAdmin => 'Make admin';

  @override
  String get groupRemoveAdmin => 'Remove as admin';

  @override
  String get aiErrEmptyResponse =>
      'The assistant didn\'t produce an answer. Please try again.';

  @override
  String get sysGroupCreatedNoActor => 'Group created';

  @override
  String get sysMembersAddedNoActor => 'New members were added';

  @override
  String get sysMemberLeftNoActor => 'A member left the group';

  @override
  String get sysMemberRemovedNoActor => 'A member was removed';

  @override
  String get sysMemberJoinedNoActor => 'A new member joined';

  @override
  String get sysAutoDeleteOff => 'Disappearing messages turned off';

  @override
  String sysAutoDeleteOn(String duration) {
    return 'Disappearing messages set to $duration';
  }

  @override
  String sysAutoDeleteOffBy(String actorName) {
    return '$actorName turned off disappearing messages';
  }

  @override
  String sysAutoDeleteOnBy(String actorName, String duration) {
    return '$actorName set disappearing messages to $duration';
  }

  @override
  String sysAdminPromoted(String targetName) {
    return '$targetName is now an admin';
  }

  @override
  String sysAdminDemoted(String targetName) {
    return '$targetName is no longer an admin';
  }

  @override
  String sysAdminPromotedBy(String actorName, String targetName) {
    return '$actorName made $targetName an admin';
  }

  @override
  String sysAdminDemotedBy(String actorName, String targetName) {
    return '$actorName removed $targetName as admin';
  }

  @override
  String durationSeconds(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count seconds',
      one: '1 second',
    );
    return '$_temp0';
  }

  @override
  String durationMinutes(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count minutes',
      one: '1 minute',
    );
    return '$_temp0';
  }

  @override
  String durationHours(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count hours',
      one: '1 hour',
    );
    return '$_temp0';
  }

  @override
  String durationDays(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count days',
      one: '1 day',
    );
    return '$_temp0';
  }

  @override
  String durationShortMinutes(int count) {
    return '${count}m';
  }

  @override
  String durationShortHours(int count) {
    return '${count}h';
  }

  @override
  String durationShortDays(int count) {
    return '${count}d';
  }

  @override
  String get authErrUserBlocked =>
      'Not available — one of you has blocked the other';

  @override
  String get authErrCurrentPasswordRequired => 'Enter your current password';

  @override
  String get authErrSsoEmailUnverified =>
      'Your sign-in provider hasn\'t verified this email address';

  @override
  String get authErrSocialAccountConflict =>
      'This email is already linked to a different sign-in account';

  @override
  String get aiActionConfirm => 'Confirm';

  @override
  String get aiActionCancel => 'Cancel';

  @override
  String get aiActionSendEmail => 'Send email';

  @override
  String get aiActionDraftEmail => 'Draft email';

  @override
  String get aiActionCreateEvent => 'Create calendar event';

  @override
  String get aiActionUpdateEvent => 'Update calendar event';

  @override
  String get aiActionCreatePage => 'Create page';

  @override
  String get aiActionUpdatePage => 'Update page';

  @override
  String get aiActionGeneric => 'Run an action';

  @override
  String aiActionGenericNamed(String tool) {
    return 'Run “$tool”';
  }

  @override
  String aiActionVia(String connector) {
    return 'via $connector';
  }

  @override
  String aiActionWaitingFor(String name) {
    return 'Waiting for $name to confirm';
  }

  @override
  String get aiActionFieldTo => 'To';

  @override
  String get aiActionFieldSubject => 'Subject';

  @override
  String get aiActionFieldTitle => 'Title';

  @override
  String get aiActionFieldWhen => 'When';

  @override
  String get aiActionStatusConfirmed => 'Done';

  @override
  String get aiActionStatusCancelled => 'Cancelled';

  @override
  String get aiActionStatusFailed => 'Failed';

  @override
  String get aiActionStatusExpired => 'Expired';

  @override
  String get aiActionStatusHandled => 'Already handled';

  @override
  String get aiActionErrNotFound => 'This action no longer exists';

  @override
  String get aiActionErrNotOwner =>
      'Only the person who asked can confirm this';

  @override
  String get aiActionErrAlreadyResolved => 'This action was already handled';

  @override
  String get aiActionErrExpired => 'This request expired';

  @override
  String get aiActionErrGeneric => 'Couldn’t complete this action';

  @override
  String get aiToolWebSearch => 'Searching the web';

  @override
  String get aiToolRememberFact => 'Saving to memory';

  @override
  String get aiToolCreateReminder => 'Creating a reminder';

  @override
  String get aiToolGetUserInfo => 'Looking up a colleague';

  @override
  String get aiToolSearchKnowledgeBase => 'Searching the knowledge base';

  @override
  String get aiToolSearchMessages => 'Searching messages';

  @override
  String get aiToolSummarizeConversation => 'Summarizing the conversation';

  @override
  String aiToolOnConnector(String tool, String connector) {
    return '$tool on $connector';
  }

  @override
  String get aiTraceToolAwaiting => 'Awaiting confirmation';

  @override
  String get aiTraceToolDone => 'Done';

  @override
  String get aiTraceToolNotRun => 'Not run';

  @override
  String aiTraceTokens(String input, String output) {
    return '$input in · $output out';
  }

  @override
  String aiTraceCacheTokens(String read, String written) {
    return 'cache $read read · $written written';
  }

  @override
  String aiTraceThinkingTokens(String count) {
    return '$count thinking';
  }

  @override
  String aiTraceDuration(String seconds) {
    return '${seconds}s';
  }

  @override
  String aiTraceSteps(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count steps',
      one: '1 step',
    );
    return '$_temp0';
  }

  @override
  String get connectorGenericName => 'Connector';

  @override
  String get connectorCustomName => 'Custom MCP server';

  @override
  String get connectorReconnect => 'Reconnect';

  @override
  String get connectorStatusReconnect => 'Reconnect needed';

  @override
  String get connectorStatusUnavailable => 'Unavailable';

  @override
  String get connectorDisconnectWorkspaceConfirm =>
      'Disconnect this workspace connector? Everyone in the workspace loses access to its tools.';

  @override
  String connectorDisconnected(String name) {
    return '$name disconnected';
  }

  @override
  String get customMcpListTitle => 'Your MCP servers';

  @override
  String get customMcpDelete => 'Remove';

  @override
  String get customMcpDeleteConfirm =>
      'Remove this MCP server? The AI will no longer use its tools.';

  @override
  String customMcpDeleted(String name) {
    return '$name removed';
  }

  @override
  String get directoryDeleteConfirm => 'Delete this directory entry?';

  @override
  String get directoryAuthOauth => 'OAuth sign-in';

  @override
  String get directoryAuthMcpOauth => 'OAuth (MCP server)';

  @override
  String get directoryAuthEnvOauth => 'OAuth (workspace app)';

  @override
  String get directoryAuthApiKey => 'API key';

  @override
  String get directoryAuthNone => 'No sign-in needed';

  @override
  String get scopeEmailSend => 'Send email';

  @override
  String get scopeEmailDraft => 'Create drafts';

  @override
  String get scopeEmailRead => 'Read email';

  @override
  String get scopeEmailManage => 'Manage email';

  @override
  String get scopeCalendarRead => 'Read calendar';

  @override
  String get scopeCalendarEvents => 'Manage events';

  @override
  String get scopeCalendarManage => 'Manage calendars';

  @override
  String get scopeFilesRead => 'Read files';

  @override
  String get scopeFilesManage => 'Manage files';

  @override
  String get scopeReadContent => 'Read content';

  @override
  String get scopeInsertContent => 'Add content';

  @override
  String get scopeUpdateContent => 'Edit content';

  @override
  String get scopeOther => 'Other access';

  @override
  String get connErrUnsafeUrl =>
      'That address isn’t allowed. Use a public https URL.';

  @override
  String get connErrDiscoveryFailed => 'Couldn’t reach that MCP server';

  @override
  String get connErrInsufficientPermission =>
      'You don’t have permission to do this';

  @override
  String get connErrNotAllowed =>
      'This connector isn’t allowed in your workspace';

  @override
  String get connErrUnavailable => 'This connector is unavailable right now';

  @override
  String get connErrOauthSetup => 'This connector isn’t set up for sign-in yet';

  @override
  String get connErrBotBridgeDisabled =>
      'The personal assistant service isn’t configured';

  @override
  String get connErrBotNotFound => 'Assistant not found';

  @override
  String get connErrBotOwnerMismatch =>
      'This assistant belongs to another member';

  @override
  String get connErrMemberInactive => 'This member’s account is inactive';

  @override
  String oauthConnected(String name) {
    return '$name connected';
  }

  @override
  String oauthErrAccessDenied(String name) {
    return 'You declined access to $name';
  }

  @override
  String oauthErrFailed(String name) {
    return 'Couldn’t connect $name';
  }

  @override
  String oauthNotCompleted(String name) {
    return 'Connecting $name wasn’t completed';
  }

  @override
  String get oauthErrExpired => 'The sign-in took too long. Please try again.';

  @override
  String get tokenUsageDailyChartTitle => 'Daily usage';

  @override
  String get tokenUsageTotalInRange => 'Total in the selected range';

  @override
  String get tokenUsageQuotaBlocked => 'AI is turned off for this workspace';

  @override
  String get tokenUsageQuotaExceeded => 'Monthly AI limit reached';

  @override
  String tokenUsageQuotaResets(String date) {
    return 'Resets on $date';
  }

  @override
  String authErrRoleGrantExceedsOwnPermissions(String capabilities) {
    return 'You can\'t grant permissions you don\'t have yourself: $capabilities.';
  }

  @override
  String get authErrRoleGrantExceedsOwnPermissionsGeneric =>
      'You can\'t grant permissions you don\'t have yourself.';

  @override
  String get authErrCannotEditOwnRole => 'You can\'t edit your own role.';

  @override
  String get authErrPresetRoleRenameForbidden =>
      'Built-in roles can\'t be renamed.';

  @override
  String get authErrRoleNameTaken => 'A role with this name already exists.';

  @override
  String get authErrOwnerRoleImmutable =>
      'The Owner role can\'t be modified or deleted.';

  @override
  String get authErrOwnerSsoMappingForbidden =>
      'Only an Owner can map SSO groups to the Owner role.';

  @override
  String get authErrInsufficientPermission =>
      'You don\'t have permission to do this.';

  @override
  String get authErrAiContextEntryNotFound =>
      'This context entry no longer exists.';

  @override
  String get authErrAiConnectorsNotInAllowList =>
      'The selected AI connectors must also be allowed in the workspace connector list.';

  @override
  String authErrPasswordTooShortMin(int min) {
    return 'Password must be at least $min characters.';
  }

  @override
  String get adminCapManageAiContext => 'Manage AI context';

  @override
  String get adminCapViewInternalContext => 'View internal context';

  @override
  String get adminCapViewConfidentialContext => 'View confidential context';

  @override
  String get adminCapUnknown => 'Other permission';

  @override
  String get adminAuditSystem => 'System';

  @override
  String get adminAuditFormerMember => 'A former member';

  @override
  String get adminAuditActionOther => 'Other action';

  @override
  String get adminAuditActionWorkspaceUpdate => 'Workspace updated';

  @override
  String get adminAuditActionDepartmentCreate => 'Department created';

  @override
  String get adminAuditActionDepartmentUpdate => 'Department updated';

  @override
  String get adminAuditActionDepartmentDelete => 'Department deleted';

  @override
  String get adminAuditActionMemberUpdate => 'Member updated';

  @override
  String get adminAuditActionMemberSsoUpdate => 'Member updated by SSO';

  @override
  String get adminAuditActionMemberBlock => 'Member blocked';

  @override
  String get adminAuditActionMemberUnblock => 'Member unblocked';

  @override
  String get adminAuditActionRoleCreate => 'Role created';

  @override
  String get adminAuditActionRoleUpdate => 'Role updated';

  @override
  String get adminAuditActionInvitationCreate => 'Invitation sent';

  @override
  String get adminAuditActionInvitationResend => 'Invitation resent';

  @override
  String get adminAuditActionInvitationRevoke => 'Invitation revoked';

  @override
  String get adminAuditActionInvitationAccept => 'Invitation accepted';

  @override
  String get adminAuditActionConnectorConnect => 'Connector connected';

  @override
  String get adminAuditActionConnectorDisconnect => 'Connector disconnected';

  @override
  String get adminAuditActionConnectorReplace => 'Connector reconnected';

  @override
  String get adminAuditActionConnectionPermissionsUpdate =>
      'Connector permissions updated';

  @override
  String get adminAuditActionCustomMcpAdd => 'Custom MCP added';

  @override
  String get adminAuditActionCustomMcpDelete => 'Custom MCP removed';

  @override
  String get adminAuditActionDirectoryCreate => 'Directory entry added';

  @override
  String get adminAuditActionDirectoryUpdate => 'Directory entry updated';

  @override
  String get adminAuditActionDirectoryDelete => 'Directory entry removed';

  @override
  String get adminAuditActionSensitiveSkillRun => 'Sensitive skill run';

  @override
  String get adminAuditTargetWorkspace => 'Workspace';

  @override
  String get adminAuditTargetMember => 'A member';

  @override
  String get adminAuditTargetRole => 'A role';

  @override
  String get adminAuditTargetDepartment => 'A department';

  @override
  String get adminAuditTargetInvitation => 'An invitation';

  @override
  String get adminAuditTargetConnector => 'A connector';

  @override
  String get adminAuditTargetDirectoryEntry => 'A directory entry';

  @override
  String get adminAuditTargetTool => 'A tool';

  @override
  String get adminAuditTargetOther => 'Something else';

  @override
  String get adminAiConnectorsAllAllowed =>
      'The workspace allow-list is empty, so every connector is allowed. Pick the ones the AI may use.';

  @override
  String get errAssistantSetupIncomplete =>
      'Add a persona and pick a model to finish setting up your assistant.';

  @override
  String get errAssistantNotConfigured =>
      'Personal assistants aren\'t available on this workspace yet. Ask your administrator.';

  @override
  String get errAssistantUpstreamFailed =>
      'The assistant service didn\'t respond. Please try again in a moment.';

  @override
  String adminBotOwnedBy(String name) {
    return 'Owned by $name';
  }

  @override
  String adminRoleCloneDefaultName(String name) {
    return '$name copy';
  }

  @override
  String get setPasswordTitle => 'Create your PON password';

  @override
  String get setPasswordSubtitle =>
      'You joined with Google. Create a password so you can also sign in with your email.';

  @override
  String get setPasswordSubmit => 'Create password';

  @override
  String get setPasswordSuccess =>
      'Password created. You can now also sign in with your email.';

  @override
  String get mfaVerifyTitle => 'Two-factor authentication';

  @override
  String get mfaVerifySubtitle =>
      'Enter the 6-digit code from your authenticator app to finish signing in.';

  @override
  String get mfaBackupSubtitle =>
      'Enter one of your backup codes (XXXXX-XXXXX). Each code works only once.';

  @override
  String get mfaCodeLabel => '6-digit code';

  @override
  String get mfaBackupCodeLabel => 'Backup code';

  @override
  String get mfaVerifyButton => 'Verify';

  @override
  String get mfaUseBackupCode => 'Use a backup code';

  @override
  String get mfaUseAuthenticatorCode => 'Use your authenticator app instead';

  @override
  String get mfaBackToSignIn => 'Back to sign in';

  @override
  String mfaBackupCodeUsed(int remaining) {
    return 'Backup code used. $remaining backup code(s) left.';
  }

  @override
  String get valMfaCodeInvalid => 'Enter the 6-digit code.';

  @override
  String get valMfaBackupCodeInvalid => 'Enter a backup code like ABCDE-FGHIJ.';

  @override
  String get mfaEnrollTitle => 'Set up two-factor authentication';

  @override
  String get mfaEnrollSubtitle =>
      'Your role requires a code from an authenticator app every time you sign in.';

  @override
  String get mfaEnrollStepInstall =>
      '1. Install Google Authenticator (or another authenticator app).';

  @override
  String get mfaEnrollStepScan =>
      '2. Scan this QR code, open it in the app, or enter the setup key.';

  @override
  String get mfaEnrollStepCode => '3. Enter the 6-digit code the app shows.';

  @override
  String get mfaEnrollOpenApp => 'Open in authenticator app';

  @override
  String get mfaEnrollNoApp =>
      'No authenticator app found. Install Google Authenticator or enter the setup key manually.';

  @override
  String get mfaEnrollManualKey => 'Setup key';

  @override
  String get mfaCopyKey => 'Copy key';

  @override
  String get mfaKeyCopied => 'Setup key copied';

  @override
  String get mfaQrSemantic => 'QR code for your authenticator app';

  @override
  String get mfaEnrollConfirm => 'Confirm';

  @override
  String get mfaBackupCodesTitle => 'Save your backup codes';

  @override
  String get mfaBackupCodesSubtitle =>
      'Each code lets you sign in once if you lose your phone. They won\'t be shown again, so keep them somewhere safe.';

  @override
  String get mfaCopyCodes => 'Copy codes';

  @override
  String get mfaCodesCopied => 'Backup codes copied';

  @override
  String get mfaSavedCheckbox => 'I saved my backup codes';

  @override
  String get mfaContinue => 'Continue';

  @override
  String get securityMfaOn =>
      'A code from your authenticator app is required every time you sign in.';

  @override
  String get securityMfaPending =>
      'Required for your role. You\'ll set it up at your next sign-in.';

  @override
  String get securityMfaStatusOn => 'On';

  @override
  String get securityMfaStatusOff => 'Not set up';

  @override
  String get securityMfaRegenerate => 'Regenerate backup codes';

  @override
  String get securityMfaRegenerateHint =>
      'Enter a current code from your authenticator app. Your old backup codes will stop working.';

  @override
  String get securityMfaRegenerateSubmit => 'Generate';

  @override
  String get securityMfaDone => 'Done';

  @override
  String get adminMfaBadge => '2FA on';

  @override
  String get adminMfaReset => 'Reset 2FA';

  @override
  String adminMfaResetConfirm(String name) {
    return 'Reset two-factor authentication for $name? They will be signed out everywhere and must set it up again at their next sign-in.';
  }

  @override
  String get adminMfaResetDone =>
      '2FA reset. They\'ll set it up again at their next sign-in.';

  @override
  String get authMsgMfaRequired =>
      'Enter the code from your authenticator app to finish signing in.';

  @override
  String get authErrMfaTokenInvalid =>
      'Your sign-in has expired. Please sign in again.';

  @override
  String get authErrMfaCodeInvalid => 'Incorrect code. Please try again.';

  @override
  String authErrMfaCodeInvalidRemaining(int remaining) {
    return 'Incorrect code. $remaining attempt(s) remaining.';
  }

  @override
  String get authErrMfaTooManyAttempts =>
      'Too many incorrect codes. Please sign in again.';

  @override
  String get authErrMfaNotEnrolled =>
      'Two-factor authentication isn\'t set up for this account yet.';

  @override
  String get authErrMfaAlreadyEnrolled =>
      'Two-factor authentication is already set up for this account.';

  @override
  String get authErrMfaResetForbidden =>
      'Only an Owner can reset two-factor authentication.';

  @override
  String get authErrMfaResetSelfForbidden =>
      'You can\'t reset your own two-factor authentication.';

  @override
  String get callSelfWeakNetwork => 'Your network is weak';

  @override
  String callPeerWeakNetwork(String name) {
    return '$name\'s network is weak';
  }

  @override
  String get callUnstableNetwork => 'Unstable connection';

  @override
  String get callReconnectingSelf => 'Connection lost — reconnecting…';

  @override
  String callWaitingForPeer(String name) {
    return 'Waiting for $name to reconnect…';
  }

  @override
  String callReconnectCountdown(int seconds) {
    return 'The call ends in ${seconds}s if it cannot reconnect';
  }

  @override
  String get callSwitchToVideo => 'Switch to video';

  @override
  String get callVideoUnavailable =>
      'Video isn\'t available in this call — the other person may need to update the app';
}
