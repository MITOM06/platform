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
  String get pinLimitReached => 'You can pin up to 2 messages';

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
  String get aiMemory => 'Memory';

  @override
  String get aiSkills => 'Skills';

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
  String get aiMemoryTitle => 'AI Memory';

  @override
  String get aiMemoryEmptyState =>
      'No memories yet. Chat with PON AI to start building memories.';

  @override
  String get aiMemoryDeleteConfirm =>
      'Delete this memory? The AI will no longer remember this conversation\'s context.';

  @override
  String get aiMemoryDeleted => 'Memory deleted';

  @override
  String aiMemoryUpdated(String date) {
    return 'Updated $date';
  }

  @override
  String get aiMemoryFacts => 'Key facts:';

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
  String get registerWithGoogle => 'Sign up with Google';

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
      'You must agree to the Terms of Service to register';

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
  String get authMsgRegisterSuccess =>
      'Registration successful. OTP has been sent to your email.';

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
  String get authErrEmailDomainInvalid =>
      'Email domain does not exist or has no MX records.';

  @override
  String get authErrEmailNotFound => 'Email does not exist in the system.';

  @override
  String get authErrEmailInUse => 'This email is already in use.';

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
  String get customMcpAuth => 'AUTH';

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
  String get skillsSettingsSubtitle => 'Choose what your assistant is good at';

  @override
  String skillNeeds(String requirements) {
    return 'Needs $requirements';
  }

  @override
  String get skillSchedulerName => 'Scheduler';

  @override
  String get skillSchedulerDesc =>
      'Books meetings, finds slots, sends invites and reminders.';

  @override
  String get skillMailWriterName => 'Mail writer';

  @override
  String get skillMailWriterDesc =>
      'Drafts replies in your voice, summarizes long threads.';

  @override
  String get skillResearcherName => 'Researcher';

  @override
  String get skillResearcherDesc =>
      'Searches the web and your Drive, returns cited answers.';

  @override
  String get skillProjectKeeperName => 'Project keeper';

  @override
  String get skillProjectKeeperDesc =>
      'Files notes and tasks into Notion, keeps databases tidy.';

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
}
