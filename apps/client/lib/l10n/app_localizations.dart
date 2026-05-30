import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_es.dart';
import 'app_localizations_fr.dart';
import 'app_localizations_ja.dart';
import 'app_localizations_ko.dart';
import 'app_localizations_vi.dart';
import 'app_localizations_zh.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
      : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('es'),
    Locale('fr'),
    Locale('ja'),
    Locale('ko'),
    Locale('vi'),
    Locale('zh')
  ];

  /// No description provided for @appName.
  ///
  /// In en, this message translates to:
  /// **'PON'**
  String get appName;

  /// No description provided for @languageName.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get languageName;

  /// No description provided for @actionCancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get actionCancel;

  /// No description provided for @actionConfirm.
  ///
  /// In en, this message translates to:
  /// **'Confirm'**
  String get actionConfirm;

  /// No description provided for @actionRetry.
  ///
  /// In en, this message translates to:
  /// **'RETRY'**
  String get actionRetry;

  /// No description provided for @actionSave.
  ///
  /// In en, this message translates to:
  /// **'SAVE'**
  String get actionSave;

  /// No description provided for @actionLogout.
  ///
  /// In en, this message translates to:
  /// **'Log out'**
  String get actionLogout;

  /// No description provided for @actionDelete.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get actionDelete;

  /// No description provided for @actionLeave.
  ///
  /// In en, this message translates to:
  /// **'Leave'**
  String get actionLeave;

  /// No description provided for @loadingDots.
  ///
  /// In en, this message translates to:
  /// **'...'**
  String get loadingDots;

  /// No description provided for @errorWithMsg.
  ///
  /// In en, this message translates to:
  /// **'Error: {error}'**
  String errorWithMsg(String error);

  /// No description provided for @loginTitle.
  ///
  /// In en, this message translates to:
  /// **'Sign In'**
  String get loginTitle;

  /// No description provided for @fieldEmail.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get fieldEmail;

  /// No description provided for @fieldPassword.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get fieldPassword;

  /// No description provided for @forgotPasswordLink.
  ///
  /// In en, this message translates to:
  /// **'Forgot password?'**
  String get forgotPasswordLink;

  /// No description provided for @loginButton.
  ///
  /// In en, this message translates to:
  /// **'SIGN IN'**
  String get loginButton;

  /// No description provided for @noAccountYet.
  ///
  /// In en, this message translates to:
  /// **'Don\'t have an account? '**
  String get noAccountYet;

  /// No description provided for @registerNow.
  ///
  /// In en, this message translates to:
  /// **'Sign up now'**
  String get registerNow;

  /// No description provided for @valEmailRequired.
  ///
  /// In en, this message translates to:
  /// **'Please enter your email'**
  String get valEmailRequired;

  /// No description provided for @valEmailInvalid.
  ///
  /// In en, this message translates to:
  /// **'Invalid email'**
  String get valEmailInvalid;

  /// No description provided for @valPasswordRequired.
  ///
  /// In en, this message translates to:
  /// **'Please enter your password'**
  String get valPasswordRequired;

  /// No description provided for @valPasswordMin6.
  ///
  /// In en, this message translates to:
  /// **'Password must be at least 6 characters'**
  String get valPasswordMin6;

  /// No description provided for @errInvalidCredentials.
  ///
  /// In en, this message translates to:
  /// **'Incorrect email or password'**
  String get errInvalidCredentials;

  /// No description provided for @errNetwork.
  ///
  /// In en, this message translates to:
  /// **'Cannot reach the server, check your connection'**
  String get errNetwork;

  /// No description provided for @errLoginFailed.
  ///
  /// In en, this message translates to:
  /// **'Sign in failed, please try again'**
  String get errLoginFailed;

  /// No description provided for @registerTitle.
  ///
  /// In en, this message translates to:
  /// **'Create Account'**
  String get registerTitle;

  /// No description provided for @welcomeToApp.
  ///
  /// In en, this message translates to:
  /// **'Welcome to PON'**
  String get welcomeToApp;

  /// No description provided for @fieldDisplayName.
  ///
  /// In en, this message translates to:
  /// **'Display name'**
  String get fieldDisplayName;

  /// No description provided for @fieldConfirmPassword.
  ///
  /// In en, this message translates to:
  /// **'Confirm password'**
  String get fieldConfirmPassword;

  /// No description provided for @registerButton.
  ///
  /// In en, this message translates to:
  /// **'SIGN UP'**
  String get registerButton;

  /// No description provided for @haveAccount.
  ///
  /// In en, this message translates to:
  /// **'Already have an account? '**
  String get haveAccount;

  /// No description provided for @loginLink.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get loginLink;

  /// No description provided for @valNameRequired.
  ///
  /// In en, this message translates to:
  /// **'Please enter your name'**
  String get valNameRequired;

  /// No description provided for @valNameMin2.
  ///
  /// In en, this message translates to:
  /// **'Name must be at least 2 characters'**
  String get valNameMin2;

  /// No description provided for @valPasswordMismatch.
  ///
  /// In en, this message translates to:
  /// **'Passwords do not match'**
  String get valPasswordMismatch;

  /// No description provided for @errEmailExists.
  ///
  /// In en, this message translates to:
  /// **'This email is already registered'**
  String get errEmailExists;

  /// No description provided for @errRegisterFailed.
  ///
  /// In en, this message translates to:
  /// **'Sign up failed, please try again'**
  String get errRegisterFailed;

  /// No description provided for @verifyOtpTitle.
  ///
  /// In en, this message translates to:
  /// **'Verify OTP'**
  String get verifyOtpTitle;

  /// No description provided for @verifyAccountHeading.
  ///
  /// In en, this message translates to:
  /// **'Verify your account'**
  String get verifyAccountHeading;

  /// No description provided for @otpSentTo.
  ///
  /// In en, this message translates to:
  /// **'A 6-digit OTP was sent to\n{email}'**
  String otpSentTo(String email);

  /// No description provided for @fieldOtp.
  ///
  /// In en, this message translates to:
  /// **'OTP code'**
  String get fieldOtp;

  /// No description provided for @confirmButton.
  ///
  /// In en, this message translates to:
  /// **'CONFIRM'**
  String get confirmButton;

  /// No description provided for @resendIn.
  ///
  /// In en, this message translates to:
  /// **'Resend in {seconds}s'**
  String resendIn(int seconds);

  /// No description provided for @resendOtp.
  ///
  /// In en, this message translates to:
  /// **'Resend OTP code'**
  String get resendOtp;

  /// No description provided for @otpResent.
  ///
  /// In en, this message translates to:
  /// **'A new OTP code has been sent to your email'**
  String get otpResent;

  /// No description provided for @errResendFailed.
  ///
  /// In en, this message translates to:
  /// **'Resend failed, try again later'**
  String get errResendFailed;

  /// No description provided for @valOtp6.
  ///
  /// In en, this message translates to:
  /// **'Enter all 6 OTP digits'**
  String get valOtp6;

  /// No description provided for @verifySuccess.
  ///
  /// In en, this message translates to:
  /// **'Verified successfully! Sign in now'**
  String get verifySuccess;

  /// No description provided for @errVerifyFailed.
  ///
  /// In en, this message translates to:
  /// **'Verification failed, please try again'**
  String get errVerifyFailed;

  /// No description provided for @forgotTitle.
  ///
  /// In en, this message translates to:
  /// **'Reset Password'**
  String get forgotTitle;

  /// No description provided for @forgotHeading.
  ///
  /// In en, this message translates to:
  /// **'Forgot password?'**
  String get forgotHeading;

  /// No description provided for @forgotSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Enter your email to receive an OTP and set a new password'**
  String get forgotSubtitle;

  /// No description provided for @sendOtpButton.
  ///
  /// In en, this message translates to:
  /// **'SEND OTP CODE'**
  String get sendOtpButton;

  /// No description provided for @errEmailNotRegistered.
  ///
  /// In en, this message translates to:
  /// **'This email is not registered'**
  String get errEmailNotRegistered;

  /// No description provided for @errSendRequestFailed.
  ///
  /// In en, this message translates to:
  /// **'Request failed, please try again'**
  String get errSendRequestFailed;

  /// No description provided for @newPasswordTitle.
  ///
  /// In en, this message translates to:
  /// **'New Password'**
  String get newPasswordTitle;

  /// No description provided for @newPasswordHeading.
  ///
  /// In en, this message translates to:
  /// **'Create a new password'**
  String get newPasswordHeading;

  /// No description provided for @newPasswordSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Enter the OTP sent to {email}\nand your new password'**
  String newPasswordSubtitle(String email);

  /// No description provided for @fieldNewPassword.
  ///
  /// In en, this message translates to:
  /// **'New password'**
  String get fieldNewPassword;

  /// No description provided for @valNewPasswordRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter a new password'**
  String get valNewPasswordRequired;

  /// No description provided for @resetPasswordSuccess.
  ///
  /// In en, this message translates to:
  /// **'Password reset successfully!'**
  String get resetPasswordSuccess;

  /// No description provided for @errOtpInvalidExpired.
  ///
  /// In en, this message translates to:
  /// **'OTP is incorrect or has expired'**
  String get errOtpInvalidExpired;

  /// No description provided for @errResetFailed.
  ///
  /// In en, this message translates to:
  /// **'Password reset failed, please try again'**
  String get errResetFailed;

  /// No description provided for @settingsTitle.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settingsTitle;

  /// No description provided for @valNameEmpty.
  ///
  /// In en, this message translates to:
  /// **'Name cannot be empty'**
  String get valNameEmpty;

  /// No description provided for @nameUpdated.
  ///
  /// In en, this message translates to:
  /// **'Display name updated'**
  String get nameUpdated;

  /// No description provided for @personalInfo.
  ///
  /// In en, this message translates to:
  /// **'Personal information'**
  String get personalInfo;

  /// No description provided for @appearance.
  ///
  /// In en, this message translates to:
  /// **'Appearance'**
  String get appearance;

  /// No description provided for @chooseThemeTitle.
  ///
  /// In en, this message translates to:
  /// **'Choose theme'**
  String get chooseThemeTitle;

  /// No description provided for @themeLight.
  ///
  /// In en, this message translates to:
  /// **'Light theme'**
  String get themeLight;

  /// No description provided for @themeDark.
  ///
  /// In en, this message translates to:
  /// **'Dark theme'**
  String get themeDark;

  /// No description provided for @themeSystem.
  ///
  /// In en, this message translates to:
  /// **'System'**
  String get themeSystem;

  /// No description provided for @language.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get language;

  /// No description provided for @chooseLanguageTitle.
  ///
  /// In en, this message translates to:
  /// **'Choose language'**
  String get chooseLanguageTitle;

  /// No description provided for @logoutConfirmBody.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to log out?'**
  String get logoutConfirmBody;

  /// No description provided for @onboardingChooseTheme.
  ///
  /// In en, this message translates to:
  /// **'CHOOSE A THEME'**
  String get onboardingChooseTheme;

  /// No description provided for @onboardingChooseSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Pick the interface style that suits you best.'**
  String get onboardingChooseSubtitle;

  /// No description provided for @themeLightSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Bright, clear and easy to read'**
  String get themeLightSubtitle;

  /// No description provided for @themeDarkSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Modern, mysterious and easy on the eyes'**
  String get themeDarkSubtitle;

  /// No description provided for @themeSystemSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Automatically match your device'**
  String get themeSystemSubtitle;

  /// No description provided for @startExperience.
  ///
  /// In en, this message translates to:
  /// **'START EXPLORING'**
  String get startExperience;

  /// No description provided for @tooltipSettings.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get tooltipSettings;

  /// No description provided for @tooltipNewConversation.
  ///
  /// In en, this message translates to:
  /// **'New conversation'**
  String get tooltipNewConversation;

  /// No description provided for @listLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t load the list'**
  String get listLoadFailed;

  /// No description provided for @listCheckNetwork.
  ///
  /// In en, this message translates to:
  /// **'Check your network connection and try again.'**
  String get listCheckNetwork;

  /// No description provided for @listGenericError.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Please try again later.'**
  String get listGenericError;

  /// No description provided for @emptyConversations.
  ///
  /// In en, this message translates to:
  /// **'No conversations yet'**
  String get emptyConversations;

  /// No description provided for @emptyTapPlus.
  ///
  /// In en, this message translates to:
  /// **'Tap the \"+\" button below to start!'**
  String get emptyTapPlus;

  /// No description provided for @offlineBanner.
  ///
  /// In en, this message translates to:
  /// **'No network connection'**
  String get offlineBanner;

  /// No description provided for @conversationDefault.
  ///
  /// In en, this message translates to:
  /// **'Conversation'**
  String get conversationDefault;

  /// No description provided for @newConversationTitle.
  ///
  /// In en, this message translates to:
  /// **'New Conversation'**
  String get newConversationTitle;

  /// No description provided for @startConversationHeading.
  ///
  /// In en, this message translates to:
  /// **'Start a conversation'**
  String get startConversationHeading;

  /// No description provided for @fieldRecipient.
  ///
  /// In en, this message translates to:
  /// **'Recipient email or User ID'**
  String get fieldRecipient;

  /// No description provided for @valRecipientRequired.
  ///
  /// In en, this message translates to:
  /// **'Please enter an email or User ID'**
  String get valRecipientRequired;

  /// No description provided for @errUserNotFoundEmail.
  ///
  /// In en, this message translates to:
  /// **'No user found with this email.'**
  String get errUserNotFoundEmail;

  /// No description provided for @errUserNotFoundOrConn.
  ///
  /// In en, this message translates to:
  /// **'User not found or connection error.'**
  String get errUserNotFoundOrConn;

  /// No description provided for @startConversationButton.
  ///
  /// In en, this message translates to:
  /// **'START CHATTING'**
  String get startConversationButton;

  /// No description provided for @chatDefaultTitle.
  ///
  /// In en, this message translates to:
  /// **'Chat'**
  String get chatDefaultTitle;

  /// No description provided for @statusOnline.
  ///
  /// In en, this message translates to:
  /// **'active now'**
  String get statusOnline;

  /// No description provided for @statusOffline.
  ///
  /// In en, this message translates to:
  /// **'offline'**
  String get statusOffline;

  /// No description provided for @typingLabel.
  ///
  /// In en, this message translates to:
  /// **'typing'**
  String get typingLabel;

  /// No description provided for @messageHint.
  ///
  /// In en, this message translates to:
  /// **'Type a message...'**
  String get messageHint;

  /// No description provided for @tabChats.
  ///
  /// In en, this message translates to:
  /// **'Chats'**
  String get tabChats;

  /// No description provided for @newGroup.
  ///
  /// In en, this message translates to:
  /// **'New group'**
  String get newGroup;

  /// No description provided for @newDirect.
  ///
  /// In en, this message translates to:
  /// **'New chat'**
  String get newDirect;

  /// No description provided for @createGroup.
  ///
  /// In en, this message translates to:
  /// **'Create group'**
  String get createGroup;

  /// No description provided for @groupName.
  ///
  /// In en, this message translates to:
  /// **'Group name'**
  String get groupName;

  /// No description provided for @valGroupNameRequired.
  ///
  /// In en, this message translates to:
  /// **'Please enter a group name'**
  String get valGroupNameRequired;

  /// No description provided for @selectMembers.
  ///
  /// In en, this message translates to:
  /// **'Select members'**
  String get selectMembers;

  /// No description provided for @valSelectMembers.
  ///
  /// In en, this message translates to:
  /// **'Select at least 2 members'**
  String get valSelectMembers;

  /// No description provided for @searchUsers.
  ///
  /// In en, this message translates to:
  /// **'Search by name or email'**
  String get searchUsers;

  /// No description provided for @groupInfo.
  ///
  /// In en, this message translates to:
  /// **'Group info'**
  String get groupInfo;

  /// No description provided for @members.
  ///
  /// In en, this message translates to:
  /// **'Members'**
  String get members;

  /// No description provided for @membersCount.
  ///
  /// In en, this message translates to:
  /// **'{count} members'**
  String membersCount(int count);

  /// No description provided for @addMembers.
  ///
  /// In en, this message translates to:
  /// **'Add members'**
  String get addMembers;

  /// No description provided for @removeMember.
  ///
  /// In en, this message translates to:
  /// **'Remove from group'**
  String get removeMember;

  /// No description provided for @leaveGroup.
  ///
  /// In en, this message translates to:
  /// **'Leave group'**
  String get leaveGroup;

  /// No description provided for @leaveGroupConfirm.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to leave this group?'**
  String get leaveGroupConfirm;

  /// No description provided for @renameGroup.
  ///
  /// In en, this message translates to:
  /// **'Rename group'**
  String get renameGroup;

  /// No description provided for @admin.
  ///
  /// In en, this message translates to:
  /// **'Admin'**
  String get admin;

  /// No description provided for @you.
  ///
  /// In en, this message translates to:
  /// **'You'**
  String get you;

  /// No description provided for @systemAddedMember.
  ///
  /// In en, this message translates to:
  /// **'{actor} added {target}'**
  String systemAddedMember(String actor, String target);

  /// No description provided for @systemRemovedMember.
  ///
  /// In en, this message translates to:
  /// **'{actor} removed {target}'**
  String systemRemovedMember(String actor, String target);

  /// No description provided for @systemLeftGroup.
  ///
  /// In en, this message translates to:
  /// **'{actor} left the group'**
  String systemLeftGroup(String actor);

  /// No description provided for @systemRenamedGroup.
  ///
  /// In en, this message translates to:
  /// **'{actor} renamed the group to {name}'**
  String systemRenamedGroup(String actor, String name);

  /// No description provided for @systemCreatedGroup.
  ///
  /// In en, this message translates to:
  /// **'{actor} created the group'**
  String systemCreatedGroup(String actor);

  /// No description provided for @actionReply.
  ///
  /// In en, this message translates to:
  /// **'Reply'**
  String get actionReply;

  /// No description provided for @actionRecall.
  ///
  /// In en, this message translates to:
  /// **'Recall'**
  String get actionRecall;

  /// No description provided for @actionDeleteForMe.
  ///
  /// In en, this message translates to:
  /// **'Delete for me'**
  String get actionDeleteForMe;

  /// No description provided for @actionCopy.
  ///
  /// In en, this message translates to:
  /// **'Copy'**
  String get actionCopy;

  /// No description provided for @actionReact.
  ///
  /// In en, this message translates to:
  /// **'React'**
  String get actionReact;

  /// No description provided for @messageRecalled.
  ///
  /// In en, this message translates to:
  /// **'Message was recalled'**
  String get messageRecalled;

  /// No description provided for @replyingTo.
  ///
  /// In en, this message translates to:
  /// **'Replying to {name}'**
  String replyingTo(String name);

  /// No description provided for @copiedToClipboard.
  ///
  /// In en, this message translates to:
  /// **'Copied to clipboard'**
  String get copiedToClipboard;

  /// No description provided for @recallConfirm.
  ///
  /// In en, this message translates to:
  /// **'Recall this message for everyone?'**
  String get recallConfirm;

  /// No description provided for @deleteConversation.
  ///
  /// In en, this message translates to:
  /// **'Delete conversation'**
  String get deleteConversation;

  /// No description provided for @deleteConversationConfirm.
  ///
  /// In en, this message translates to:
  /// **'Delete this conversation? It will be hidden from your list.'**
  String get deleteConversationConfirm;

  /// No description provided for @clearHistory.
  ///
  /// In en, this message translates to:
  /// **'Clear chat history'**
  String get clearHistory;

  /// No description provided for @clearHistoryConfirm.
  ///
  /// In en, this message translates to:
  /// **'Clear all messages in this conversation for you?'**
  String get clearHistoryConfirm;

  /// No description provided for @disappearingMessages.
  ///
  /// In en, this message translates to:
  /// **'Disappearing messages'**
  String get disappearingMessages;

  /// No description provided for @disappearingOff.
  ///
  /// In en, this message translates to:
  /// **'Off'**
  String get disappearingOff;

  /// No description provided for @disappearing24h.
  ///
  /// In en, this message translates to:
  /// **'24 hours'**
  String get disappearing24h;

  /// No description provided for @disappearing7d.
  ///
  /// In en, this message translates to:
  /// **'7 days'**
  String get disappearing7d;

  /// No description provided for @changeAvatar.
  ///
  /// In en, this message translates to:
  /// **'Change avatar'**
  String get changeAvatar;

  /// No description provided for @uploadFailed.
  ///
  /// In en, this message translates to:
  /// **'Upload failed, please try again'**
  String get uploadFailed;

  /// No description provided for @lastSeenJustNow.
  ///
  /// In en, this message translates to:
  /// **'active just now'**
  String get lastSeenJustNow;

  /// No description provided for @lastSeenMinutes.
  ///
  /// In en, this message translates to:
  /// **'active {minutes}m ago'**
  String lastSeenMinutes(int minutes);

  /// No description provided for @lastSeenHours.
  ///
  /// In en, this message translates to:
  /// **'active {hours}h ago'**
  String lastSeenHours(int hours);

  /// No description provided for @lastSeenDays.
  ///
  /// In en, this message translates to:
  /// **'active {days}d ago'**
  String lastSeenDays(int days);

  /// No description provided for @dateToday.
  ///
  /// In en, this message translates to:
  /// **'Today'**
  String get dateToday;

  /// No description provided for @dateYesterday.
  ///
  /// In en, this message translates to:
  /// **'Yesterday'**
  String get dateYesterday;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) => <String>[
        'en',
        'es',
        'fr',
        'ja',
        'ko',
        'vi',
        'zh'
      ].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'es':
      return AppLocalizationsEs();
    case 'fr':
      return AppLocalizationsFr();
    case 'ja':
      return AppLocalizationsJa();
    case 'ko':
      return AppLocalizationsKo();
    case 'vi':
      return AppLocalizationsVi();
    case 'zh':
      return AppLocalizationsZh();
  }

  throw FlutterError(
      'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
      'an issue with the localizations generation tool. Please file an issue '
      'on GitHub with a reproducible sample app and the gen-l10n configuration '
      'that was used.');
}
