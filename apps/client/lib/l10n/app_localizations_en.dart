// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'PON';

  @override
  String get languageName => 'English';

  @override
  String get actionCancel => 'Cancel';

  @override
  String get actionConfirm => 'Confirm';

  @override
  String get actionRetry => 'RETRY';

  @override
  String get actionSave => 'SAVE';

  @override
  String get actionLogout => 'Log out';

  @override
  String get actionDelete => 'Delete';

  @override
  String get actionLeave => 'Leave';

  @override
  String get loadingDots => '...';

  @override
  String errorWithMsg(String error) {
    return 'Error: $error';
  }

  @override
  String get loginTitle => 'Sign In';

  @override
  String get fieldEmail => 'Email';

  @override
  String get fieldPassword => 'Password';

  @override
  String get forgotPasswordLink => 'Forgot password?';

  @override
  String get loginButton => 'SIGN IN';

  @override
  String get noAccountYet => 'Don\'t have an account? ';

  @override
  String get registerNow => 'Sign up now';

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
  String get errLoginFailed => 'Sign in failed, please try again';

  @override
  String get registerTitle => 'Create Account';

  @override
  String get welcomeToApp => 'Welcome to PON';

  @override
  String get fieldDisplayName => 'Display name';

  @override
  String get fieldConfirmPassword => 'Confirm password';

  @override
  String get registerButton => 'SIGN UP';

  @override
  String get haveAccount => 'Already have an account? ';

  @override
  String get loginLink => 'Sign in';

  @override
  String get valNameRequired => 'Please enter your name';

  @override
  String get valNameMin2 => 'Name must be at least 2 characters';

  @override
  String get valPasswordMismatch => 'Passwords do not match';

  @override
  String get errEmailExists => 'This email is already registered';

  @override
  String get errRegisterFailed => 'Sign up failed, please try again';

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
  String get confirmButton => 'CONFIRM';

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
  String get sendOtpButton => 'SEND OTP CODE';

  @override
  String get errEmailNotRegistered => 'This email is not registered';

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
  String get onboardingChooseTheme => 'CHOOSE A THEME';

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
  String get startExperience => 'START EXPLORING';

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
  String get startConversationButton => 'START CHATTING';

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
  String get newGroup => 'New group';

  @override
  String get newDirect => 'New chat';

  @override
  String get createGroup => 'Create group';

  @override
  String get groupName => 'Group name';

  @override
  String get valGroupNameRequired => 'Please enter a group name';

  @override
  String get selectMembers => 'Select members';

  @override
  String get valSelectMembers => 'Select at least 2 members';

  @override
  String get searchUsers => 'Search by name or email';

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
  String get actionReact => 'React';

  @override
  String get messageRecalled => 'Message was recalled';

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
  String get uploading => 'Uploading…';

  @override
  String get downloadMedia => 'Download';

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
  String get callUnknownCaller => 'Someone';

  @override
  String get profileTitle => 'Profile';

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
  String get endToEndEncrypted => 'End-to-end encrypted';

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
  String get aiErrorRetry => 'Retry';

  @override
  String get aiMessageDeleted => 'Message deleted';
}
