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

  /// No description provided for @searchConversationsHint.
  ///
  /// In en, this message translates to:
  /// **'Search conversations...'**
  String get searchConversationsHint;

  /// No description provided for @noConversationsFound.
  ///
  /// In en, this message translates to:
  /// **'No conversations found'**
  String get noConversationsFound;

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

  /// No description provided for @someone.
  ///
  /// In en, this message translates to:
  /// **'Someone'**
  String get someone;

  /// No description provided for @aiHubTitle.
  ///
  /// In en, this message translates to:
  /// **'AI Hub'**
  String get aiHubTitle;

  /// No description provided for @aiHubSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Everything about your AI assistant'**
  String get aiHubSubtitle;

  /// No description provided for @aiHubStartChat.
  ///
  /// In en, this message translates to:
  /// **'Start chat with PON AI'**
  String get aiHubStartChat;

  /// No description provided for @aiHubMemory.
  ///
  /// In en, this message translates to:
  /// **'Memory'**
  String get aiHubMemory;

  /// No description provided for @aiHubIntegrations.
  ///
  /// In en, this message translates to:
  /// **'Connectors'**
  String get aiHubIntegrations;

  /// No description provided for @aiHubSkills.
  ///
  /// In en, this message translates to:
  /// **'Skills'**
  String get aiHubSkills;

  /// No description provided for @aiHubTokenUsage.
  ///
  /// In en, this message translates to:
  /// **'Usage'**
  String get aiHubTokenUsage;

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

  /// No description provided for @actionEdit.
  ///
  /// In en, this message translates to:
  /// **'Edit'**
  String get actionEdit;

  /// No description provided for @messageEdited.
  ///
  /// In en, this message translates to:
  /// **'(edited)'**
  String get messageEdited;

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

  /// No description provided for @attachPhoto.
  ///
  /// In en, this message translates to:
  /// **'Photo'**
  String get attachPhoto;

  /// No description provided for @attachVideo.
  ///
  /// In en, this message translates to:
  /// **'Video'**
  String get attachVideo;

  /// No description provided for @attachFile.
  ///
  /// In en, this message translates to:
  /// **'File'**
  String get attachFile;

  /// No description provided for @uploading.
  ///
  /// In en, this message translates to:
  /// **'Uploading…'**
  String get uploading;

  /// No description provided for @downloadMedia.
  ///
  /// In en, this message translates to:
  /// **'Download'**
  String get downloadMedia;

  /// No description provided for @attachmentLabel.
  ///
  /// In en, this message translates to:
  /// **'📎 Attachment'**
  String get attachmentLabel;

  /// No description provided for @callIncoming.
  ///
  /// In en, this message translates to:
  /// **'Incoming call'**
  String get callIncoming;

  /// No description provided for @callIncomingBody.
  ///
  /// In en, this message translates to:
  /// **'{name} is calling you'**
  String callIncomingBody(String name);

  /// No description provided for @callCalling.
  ///
  /// In en, this message translates to:
  /// **'Calling {name}…'**
  String callCalling(String name);

  /// No description provided for @callConnecting.
  ///
  /// In en, this message translates to:
  /// **'Connecting…'**
  String get callConnecting;

  /// No description provided for @callMediaError.
  ///
  /// In en, this message translates to:
  /// **'Cannot access camera/microphone (HTTPS or localhost required)'**
  String get callMediaError;

  /// No description provided for @callUnknownCaller.
  ///
  /// In en, this message translates to:
  /// **'Someone'**
  String get callUnknownCaller;

  /// No description provided for @callToggleMic.
  ///
  /// In en, this message translates to:
  /// **'Toggle microphone'**
  String get callToggleMic;

  /// No description provided for @callToggleCam.
  ///
  /// In en, this message translates to:
  /// **'Toggle camera'**
  String get callToggleCam;

  /// No description provided for @callLeave.
  ///
  /// In en, this message translates to:
  /// **'Leave'**
  String get callLeave;

  /// No description provided for @callJoin.
  ///
  /// In en, this message translates to:
  /// **'Join'**
  String get callJoin;

  /// No description provided for @callAccept.
  ///
  /// In en, this message translates to:
  /// **'Accept'**
  String get callAccept;

  /// No description provided for @callDecline.
  ///
  /// In en, this message translates to:
  /// **'Decline'**
  String get callDecline;

  /// No description provided for @groupCallTitle.
  ///
  /// In en, this message translates to:
  /// **'Group call'**
  String get groupCallTitle;

  /// No description provided for @groupCallParticipants.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 participant} other{{count} participants}}'**
  String groupCallParticipants(int count);

  /// No description provided for @groupCallNotetakerActive.
  ///
  /// In en, this message translates to:
  /// **'AI is taking notes'**
  String get groupCallNotetakerActive;

  /// No description provided for @groupCallStartTitle.
  ///
  /// In en, this message translates to:
  /// **'Start a group call'**
  String get groupCallStartTitle;

  /// No description provided for @groupCallAudio.
  ///
  /// In en, this message translates to:
  /// **'Audio'**
  String get groupCallAudio;

  /// No description provided for @groupCallVideo.
  ///
  /// In en, this message translates to:
  /// **'Video'**
  String get groupCallVideo;

  /// No description provided for @groupCallNotetakerToggle.
  ///
  /// In en, this message translates to:
  /// **'AI notetaker'**
  String get groupCallNotetakerToggle;

  /// No description provided for @groupCallNotetakerHint.
  ///
  /// In en, this message translates to:
  /// **'The AI listens and posts a meeting summary afterward.'**
  String get groupCallNotetakerHint;

  /// No description provided for @groupCallStartAction.
  ///
  /// In en, this message translates to:
  /// **'Start call'**
  String get groupCallStartAction;

  /// No description provided for @activeCallBanner.
  ///
  /// In en, this message translates to:
  /// **'Group call · {count} joined'**
  String activeCallBanner(int count);

  /// No description provided for @incomingGroupCallTitle.
  ///
  /// In en, this message translates to:
  /// **'Incoming group call'**
  String get incomingGroupCallTitle;

  /// No description provided for @incomingGroupCallBody.
  ///
  /// In en, this message translates to:
  /// **'{name} started a group call'**
  String incomingGroupCallBody(String name);

  /// No description provided for @meetingSummaryTitle.
  ///
  /// In en, this message translates to:
  /// **'Meeting summary'**
  String get meetingSummaryTitle;

  /// No description provided for @meetingSummaryDuration.
  ///
  /// In en, this message translates to:
  /// **'Duration {duration}'**
  String meetingSummaryDuration(String duration);

  /// No description provided for @meetingSummaryAttendees.
  ///
  /// In en, this message translates to:
  /// **'Attendees: {names}'**
  String meetingSummaryAttendees(String names);

  /// No description provided for @meetingSummaryOverview.
  ///
  /// In en, this message translates to:
  /// **'Overview'**
  String get meetingSummaryOverview;

  /// No description provided for @meetingSummaryKeyPoints.
  ///
  /// In en, this message translates to:
  /// **'Key points'**
  String get meetingSummaryKeyPoints;

  /// No description provided for @meetingSummaryActionItems.
  ///
  /// In en, this message translates to:
  /// **'Action items'**
  String get meetingSummaryActionItems;

  /// No description provided for @profileTitle.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get profileTitle;

  /// No description provided for @editProfile.
  ///
  /// In en, this message translates to:
  /// **'Edit profile'**
  String get editProfile;

  /// No description provided for @bio.
  ///
  /// In en, this message translates to:
  /// **'Bio'**
  String get bio;

  /// No description provided for @friendsCountLabel.
  ///
  /// In en, this message translates to:
  /// **'{count} friends'**
  String friendsCountLabel(int count);

  /// No description provided for @messageAction.
  ///
  /// In en, this message translates to:
  /// **'Message'**
  String get messageAction;

  /// No description provided for @activeFriends.
  ///
  /// In en, this message translates to:
  /// **'Active now'**
  String get activeFriends;

  /// No description provided for @noFriendsOnline.
  ///
  /// In en, this message translates to:
  /// **'No friends online'**
  String get noFriendsOnline;

  /// No description provided for @strangerBannerTitle.
  ///
  /// In en, this message translates to:
  /// **'Message request'**
  String get strangerBannerTitle;

  /// No description provided for @strangerBannerBody.
  ///
  /// In en, this message translates to:
  /// **'This person isn\'t in your contacts. Accept to reply.'**
  String get strangerBannerBody;

  /// No description provided for @acceptRequest.
  ///
  /// In en, this message translates to:
  /// **'Accept'**
  String get acceptRequest;

  /// No description provided for @rejectRequest.
  ///
  /// In en, this message translates to:
  /// **'Decline'**
  String get rejectRequest;

  /// No description provided for @friends.
  ///
  /// In en, this message translates to:
  /// **'Friends'**
  String get friends;

  /// No description provided for @contacts.
  ///
  /// In en, this message translates to:
  /// **'Contacts'**
  String get contacts;

  /// No description provided for @friendRequests.
  ///
  /// In en, this message translates to:
  /// **'Friend requests'**
  String get friendRequests;

  /// No description provided for @addFriend.
  ///
  /// In en, this message translates to:
  /// **'Add friend'**
  String get addFriend;

  /// No description provided for @friendRequestSent.
  ///
  /// In en, this message translates to:
  /// **'Friend request sent'**
  String get friendRequestSent;

  /// No description provided for @acceptFriend.
  ///
  /// In en, this message translates to:
  /// **'Accept'**
  String get acceptFriend;

  /// No description provided for @noFriends.
  ///
  /// In en, this message translates to:
  /// **'No friends yet'**
  String get noFriends;

  /// No description provided for @noFriendRequests.
  ///
  /// In en, this message translates to:
  /// **'No pending requests'**
  String get noFriendRequests;

  /// No description provided for @friendRequestPending.
  ///
  /// In en, this message translates to:
  /// **'Pending'**
  String get friendRequestPending;

  /// No description provided for @friendsTabSearch.
  ///
  /// In en, this message translates to:
  /// **'Search'**
  String get friendsTabSearch;

  /// No description provided for @declineFriend.
  ///
  /// In en, this message translates to:
  /// **'Decline'**
  String get declineFriend;

  /// No description provided for @searchUsersPrompt.
  ///
  /// In en, this message translates to:
  /// **'Search for people to add as friends'**
  String get searchUsersPrompt;

  /// No description provided for @noSearchResults.
  ///
  /// In en, this message translates to:
  /// **'No users found'**
  String get noSearchResults;

  /// No description provided for @unfriend.
  ///
  /// In en, this message translates to:
  /// **'Unfriend'**
  String get unfriend;

  /// No description provided for @unfriendConfirm.
  ///
  /// In en, this message translates to:
  /// **'Remove this friend?'**
  String get unfriendConfirm;

  /// No description provided for @blockUser.
  ///
  /// In en, this message translates to:
  /// **'Block'**
  String get blockUser;

  /// No description provided for @unblockUser.
  ///
  /// In en, this message translates to:
  /// **'Unblock'**
  String get unblockUser;

  /// No description provided for @blockUserConfirm.
  ///
  /// In en, this message translates to:
  /// **'Block this user? You won\'t be able to message each other.'**
  String get blockUserConfirm;

  /// No description provided for @blockedComposerNotice.
  ///
  /// In en, this message translates to:
  /// **'You can\'t send messages to this chat'**
  String get blockedComposerNotice;

  /// No description provided for @userBlocked.
  ///
  /// In en, this message translates to:
  /// **'User blocked'**
  String get userBlocked;

  /// No description provided for @userUnblocked.
  ///
  /// In en, this message translates to:
  /// **'User unblocked'**
  String get userUnblocked;

  /// No description provided for @mentionNotificationTitle.
  ///
  /// In en, this message translates to:
  /// **'Mentioned you'**
  String get mentionNotificationTitle;

  /// No description provided for @mentionNotificationBody.
  ///
  /// In en, this message translates to:
  /// **'{name} mentioned you'**
  String mentionNotificationBody(String name);

  /// No description provided for @searchMessages.
  ///
  /// In en, this message translates to:
  /// **'Search messages'**
  String get searchMessages;

  /// No description provided for @searchHint.
  ///
  /// In en, this message translates to:
  /// **'Search in conversation'**
  String get searchHint;

  /// No description provided for @searchNoResults.
  ///
  /// In en, this message translates to:
  /// **'No messages found'**
  String get searchNoResults;

  /// No description provided for @exploreChannels.
  ///
  /// In en, this message translates to:
  /// **'Explore Channels'**
  String get exploreChannels;

  /// No description provided for @searchChannelsHint.
  ///
  /// In en, this message translates to:
  /// **'Search channels…'**
  String get searchChannelsHint;

  /// No description provided for @noPublicChannels.
  ///
  /// In en, this message translates to:
  /// **'No public channels found'**
  String get noPublicChannels;

  /// No description provided for @joinChannel.
  ///
  /// In en, this message translates to:
  /// **'Join'**
  String get joinChannel;

  /// No description provided for @pinMessage.
  ///
  /// In en, this message translates to:
  /// **'Pin'**
  String get pinMessage;

  /// No description provided for @unpinMessage.
  ///
  /// In en, this message translates to:
  /// **'Unpin'**
  String get unpinMessage;

  /// No description provided for @pinnedMessagesTitle.
  ///
  /// In en, this message translates to:
  /// **'Pinned Messages'**
  String get pinnedMessagesTitle;

  /// No description provided for @pinLimitReached.
  ///
  /// In en, this message translates to:
  /// **'You can pin up to 2 messages'**
  String get pinLimitReached;

  /// No description provided for @cannotPinCall.
  ///
  /// In en, this message translates to:
  /// **'Calls can\'t be pinned'**
  String get cannotPinCall;

  /// No description provided for @forwardMessage.
  ///
  /// In en, this message translates to:
  /// **'Forward'**
  String get forwardMessage;

  /// No description provided for @messageForwarded.
  ///
  /// In en, this message translates to:
  /// **'Message forwarded'**
  String get messageForwarded;

  /// No description provided for @forwardFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to forward message'**
  String get forwardFailed;

  /// No description provided for @noConversationsToForward.
  ///
  /// In en, this message translates to:
  /// **'No conversations available'**
  String get noConversationsToForward;

  /// No description provided for @rateLimitError.
  ///
  /// In en, this message translates to:
  /// **'Too many messages. Please slow down.'**
  String get rateLimitError;

  /// No description provided for @sharedMediaTitle.
  ///
  /// In en, this message translates to:
  /// **'Shared Media & Files'**
  String get sharedMediaTitle;

  /// No description provided for @tabMedia.
  ///
  /// In en, this message translates to:
  /// **'Media'**
  String get tabMedia;

  /// No description provided for @tabFiles.
  ///
  /// In en, this message translates to:
  /// **'Files'**
  String get tabFiles;

  /// No description provided for @tabLinks.
  ///
  /// In en, this message translates to:
  /// **'Links'**
  String get tabLinks;

  /// No description provided for @noMediaFound.
  ///
  /// In en, this message translates to:
  /// **'No media found'**
  String get noMediaFound;

  /// No description provided for @noFilesFound.
  ///
  /// In en, this message translates to:
  /// **'No files found'**
  String get noFilesFound;

  /// No description provided for @noLinksFound.
  ///
  /// In en, this message translates to:
  /// **'No links found'**
  String get noLinksFound;

  /// No description provided for @reactionsDetail.
  ///
  /// In en, this message translates to:
  /// **'Reactions'**
  String get reactionsDetail;

  /// No description provided for @changePasswordTitle.
  ///
  /// In en, this message translates to:
  /// **'Change Password'**
  String get changePasswordTitle;

  /// No description provided for @currentPassword.
  ///
  /// In en, this message translates to:
  /// **'Current Password'**
  String get currentPassword;

  /// No description provided for @newPassword.
  ///
  /// In en, this message translates to:
  /// **'New Password'**
  String get newPassword;

  /// No description provided for @confirmPassword.
  ///
  /// In en, this message translates to:
  /// **'Confirm New Password'**
  String get confirmPassword;

  /// No description provided for @dateOfBirth.
  ///
  /// In en, this message translates to:
  /// **'Date of Birth'**
  String get dateOfBirth;

  /// No description provided for @notSet.
  ///
  /// In en, this message translates to:
  /// **'Not set'**
  String get notSet;

  /// No description provided for @passwordChangedSuccess.
  ///
  /// In en, this message translates to:
  /// **'Password changed successfully'**
  String get passwordChangedSuccess;

  /// No description provided for @errCurrentPasswordIncorrect.
  ///
  /// In en, this message translates to:
  /// **'Incorrect current password'**
  String get errCurrentPasswordIncorrect;

  /// No description provided for @changeCoverPhoto.
  ///
  /// In en, this message translates to:
  /// **'Change cover photo'**
  String get changeCoverPhoto;

  /// No description provided for @markAsRead.
  ///
  /// In en, this message translates to:
  /// **'Mark as read'**
  String get markAsRead;

  /// No description provided for @markAsUnread.
  ///
  /// In en, this message translates to:
  /// **'Mark as unread'**
  String get markAsUnread;

  /// No description provided for @muteNotifications.
  ///
  /// In en, this message translates to:
  /// **'Mute notifications'**
  String get muteNotifications;

  /// No description provided for @unmuteNotifications.
  ///
  /// In en, this message translates to:
  /// **'Unmute notifications'**
  String get unmuteNotifications;

  /// No description provided for @viewProfile.
  ///
  /// In en, this message translates to:
  /// **'View profile'**
  String get viewProfile;

  /// No description provided for @voiceCall.
  ///
  /// In en, this message translates to:
  /// **'Voice call'**
  String get voiceCall;

  /// No description provided for @videoCall.
  ///
  /// In en, this message translates to:
  /// **'Video call'**
  String get videoCall;

  /// No description provided for @archiveChat.
  ///
  /// In en, this message translates to:
  /// **'Archive chat'**
  String get archiveChat;

  /// No description provided for @unarchiveChat.
  ///
  /// In en, this message translates to:
  /// **'Unarchive chat'**
  String get unarchiveChat;

  /// No description provided for @mutedLabel.
  ///
  /// In en, this message translates to:
  /// **'Muted'**
  String get mutedLabel;

  /// No description provided for @newNotificationTitle.
  ///
  /// In en, this message translates to:
  /// **'New message'**
  String get newNotificationTitle;

  /// No description provided for @newNotificationBody.
  ///
  /// In en, this message translates to:
  /// **'{name} sent you a message'**
  String newNotificationBody(String name);

  /// No description provided for @archivedChats.
  ///
  /// In en, this message translates to:
  /// **'Archived chats'**
  String get archivedChats;

  /// No description provided for @archivedChatsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'View archived conversations'**
  String get archivedChatsSubtitle;

  /// No description provided for @emptyArchivedChats.
  ///
  /// In en, this message translates to:
  /// **'No archived chats'**
  String get emptyArchivedChats;

  /// No description provided for @webNoChatSelected.
  ///
  /// In en, this message translates to:
  /// **'Select a conversation to start chatting'**
  String get webNoChatSelected;

  /// No description provided for @endToEndEncrypted.
  ///
  /// In en, this message translates to:
  /// **'End-to-end encrypted'**
  String get endToEndEncrypted;

  /// No description provided for @chatInfoCategory.
  ///
  /// In en, this message translates to:
  /// **'Chat Details'**
  String get chatInfoCategory;

  /// No description provided for @customizeChatCategory.
  ///
  /// In en, this message translates to:
  /// **'Customize Chat'**
  String get customizeChatCategory;

  /// No description provided for @filesAndMediaCategory.
  ///
  /// In en, this message translates to:
  /// **'Media, files and links'**
  String get filesAndMediaCategory;

  /// No description provided for @privacyAndSupportCategory.
  ///
  /// In en, this message translates to:
  /// **'Privacy & support'**
  String get privacyAndSupportCategory;

  /// No description provided for @callSelectMember.
  ///
  /// In en, this message translates to:
  /// **'Select a member to call'**
  String get callSelectMember;

  /// No description provided for @profileHideInfo.
  ///
  /// In en, this message translates to:
  /// **'Hide personal info'**
  String get profileHideInfo;

  /// No description provided for @profileInfoHidden.
  ///
  /// In en, this message translates to:
  /// **'Personal information is hidden'**
  String get profileInfoHidden;

  /// No description provided for @profileGender.
  ///
  /// In en, this message translates to:
  /// **'Gender'**
  String get profileGender;

  /// No description provided for @profilePhone.
  ///
  /// In en, this message translates to:
  /// **'Phone number'**
  String get profilePhone;

  /// No description provided for @profileBio.
  ///
  /// In en, this message translates to:
  /// **'Bio'**
  String get profileBio;

  /// No description provided for @profileDateOfBirth.
  ///
  /// In en, this message translates to:
  /// **'Date of birth'**
  String get profileDateOfBirth;

  /// No description provided for @profileShowDateOfBirth.
  ///
  /// In en, this message translates to:
  /// **'Show date of birth to others'**
  String get profileShowDateOfBirth;

  /// No description provided for @profileShowPhone.
  ///
  /// In en, this message translates to:
  /// **'Show phone number to others'**
  String get profileShowPhone;

  /// No description provided for @profileShowGender.
  ///
  /// In en, this message translates to:
  /// **'Show gender to others'**
  String get profileShowGender;

  /// No description provided for @profilePrivacySection.
  ///
  /// In en, this message translates to:
  /// **'Privacy'**
  String get profilePrivacySection;

  /// No description provided for @profileEditMode.
  ///
  /// In en, this message translates to:
  /// **'Edit Profile'**
  String get profileEditMode;

  /// No description provided for @profileSave.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get profileSave;

  /// No description provided for @actionMessage.
  ///
  /// In en, this message translates to:
  /// **'Message'**
  String get actionMessage;

  /// No description provided for @actionAddFriend.
  ///
  /// In en, this message translates to:
  /// **'Add Friend'**
  String get actionAddFriend;

  /// No description provided for @actionBlock.
  ///
  /// In en, this message translates to:
  /// **'Block'**
  String get actionBlock;

  /// No description provided for @readDetails.
  ///
  /// In en, this message translates to:
  /// **'Read details'**
  String get readDetails;

  /// No description provided for @seenStatus.
  ///
  /// In en, this message translates to:
  /// **'Seen'**
  String get seenStatus;

  /// No description provided for @noReadsYet.
  ///
  /// In en, this message translates to:
  /// **'No one has read this yet'**
  String get noReadsYet;

  /// No description provided for @voiceMicTooltip.
  ///
  /// In en, this message translates to:
  /// **'Voice message'**
  String get voiceMicTooltip;

  /// No description provided for @recording.
  ///
  /// In en, this message translates to:
  /// **'Recording...'**
  String get recording;

  /// No description provided for @stickerLabel.
  ///
  /// In en, this message translates to:
  /// **'Stickers'**
  String get stickerLabel;

  /// No description provided for @emojiTab.
  ///
  /// In en, this message translates to:
  /// **'Emoji'**
  String get emojiTab;

  /// No description provided for @aiAssistant.
  ///
  /// In en, this message translates to:
  /// **'AI Assistant'**
  String get aiAssistant;

  /// No description provided for @startChatWithAI.
  ///
  /// In en, this message translates to:
  /// **'Chat with PON AI'**
  String get startChatWithAI;

  /// No description provided for @aiThinking.
  ///
  /// In en, this message translates to:
  /// **'AI is thinking...'**
  String get aiThinking;

  /// No description provided for @aiError.
  ///
  /// In en, this message translates to:
  /// **'AI is temporarily unavailable. Please try again.'**
  String get aiError;

  /// No description provided for @aiErrStreamInterrupted.
  ///
  /// In en, this message translates to:
  /// **'AI stream was interrupted. Please try again.'**
  String get aiErrStreamInterrupted;

  /// No description provided for @aiErrUnavailable.
  ///
  /// In en, this message translates to:
  /// **'AI is temporarily unavailable.'**
  String get aiErrUnavailable;

  /// No description provided for @aiErrRateLimited.
  ///
  /// In en, this message translates to:
  /// **'Too many AI requests. Please slow down and try again shortly.'**
  String get aiErrRateLimited;

  /// No description provided for @feedbackHelpful.
  ///
  /// In en, this message translates to:
  /// **'Helpful'**
  String get feedbackHelpful;

  /// No description provided for @feedbackNotHelpful.
  ///
  /// In en, this message translates to:
  /// **'Not helpful'**
  String get feedbackNotHelpful;

  /// No description provided for @feedbackCommentHint.
  ///
  /// In en, this message translates to:
  /// **'Tell us what went wrong (optional)'**
  String get feedbackCommentHint;

  /// No description provided for @feedbackThanks.
  ///
  /// In en, this message translates to:
  /// **'Thanks for your feedback'**
  String get feedbackThanks;

  /// No description provided for @feedbackSend.
  ///
  /// In en, this message translates to:
  /// **'Send'**
  String get feedbackSend;

  /// No description provided for @feedbackError.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t submit feedback. Please try again.'**
  String get feedbackError;

  /// No description provided for @aiSensitiveAction.
  ///
  /// In en, this message translates to:
  /// **'sensitive action'**
  String get aiSensitiveAction;

  /// No description provided for @aiErrorRetry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get aiErrorRetry;

  /// No description provided for @aiMessageDeleted.
  ///
  /// In en, this message translates to:
  /// **'Message deleted'**
  String get aiMessageDeleted;

  /// No description provided for @aiMemoryTitle.
  ///
  /// In en, this message translates to:
  /// **'AI Memory'**
  String get aiMemoryTitle;

  /// No description provided for @aiMemoryEmptyState.
  ///
  /// In en, this message translates to:
  /// **'No memories yet. Chat with PON AI to start building memories.'**
  String get aiMemoryEmptyState;

  /// No description provided for @aiMemoryDeleteConfirm.
  ///
  /// In en, this message translates to:
  /// **'Delete this memory? The AI will no longer remember this conversation\'s context.'**
  String get aiMemoryDeleteConfirm;

  /// No description provided for @aiMemoryDeleted.
  ///
  /// In en, this message translates to:
  /// **'Memory deleted'**
  String get aiMemoryDeleted;

  /// No description provided for @aiMemoryUpdated.
  ///
  /// In en, this message translates to:
  /// **'Updated {date}'**
  String aiMemoryUpdated(String date);

  /// No description provided for @aiMemoryFacts.
  ///
  /// In en, this message translates to:
  /// **'Key facts:'**
  String get aiMemoryFacts;

  /// No description provided for @viewAiMemory.
  ///
  /// In en, this message translates to:
  /// **'View Memory'**
  String get viewAiMemory;

  /// No description provided for @kbTitle.
  ///
  /// In en, this message translates to:
  /// **'Knowledge Base'**
  String get kbTitle;

  /// No description provided for @kbEmptyState.
  ///
  /// In en, this message translates to:
  /// **'No documents yet.\nTap the upload button to add a PDF, DOCX, or TXT file.'**
  String get kbEmptyState;

  /// No description provided for @kbUploadButton.
  ///
  /// In en, this message translates to:
  /// **'Upload Document'**
  String get kbUploadButton;

  /// No description provided for @kbDeleteConfirm.
  ///
  /// In en, this message translates to:
  /// **'Delete this document?'**
  String get kbDeleteConfirm;

  /// No description provided for @kbProcessing.
  ///
  /// In en, this message translates to:
  /// **'Processing'**
  String get kbProcessing;

  /// No description provided for @kbReady.
  ///
  /// In en, this message translates to:
  /// **'Ready'**
  String get kbReady;

  /// No description provided for @kbError.
  ///
  /// In en, this message translates to:
  /// **'Error'**
  String get kbError;

  /// No description provided for @kbManage.
  ///
  /// In en, this message translates to:
  /// **'Knowledge Base'**
  String get kbManage;

  /// No description provided for @kbSources.
  ///
  /// In en, this message translates to:
  /// **'source(s)'**
  String get kbSources;

  /// No description provided for @kbChunks.
  ///
  /// In en, this message translates to:
  /// **'chunks'**
  String get kbChunks;

  /// No description provided for @aiToolCalling.
  ///
  /// In en, this message translates to:
  /// **'Using tool: {toolName}'**
  String aiToolCalling(String toolName);

  /// No description provided for @aiToolTrace.
  ///
  /// In en, this message translates to:
  /// **'Tool trace'**
  String get aiToolTrace;

  /// No description provided for @toolSearchMessages.
  ///
  /// In en, this message translates to:
  /// **'Searching messages...'**
  String get toolSearchMessages;

  /// No description provided for @toolGetUserInfo.
  ///
  /// In en, this message translates to:
  /// **'Looking up user info...'**
  String get toolGetUserInfo;

  /// No description provided for @toolSearchKnowledgeBase.
  ///
  /// In en, this message translates to:
  /// **'Searching knowledge base...'**
  String get toolSearchKnowledgeBase;

  /// No description provided for @toolSummarizeConversation.
  ///
  /// In en, this message translates to:
  /// **'Summarizing conversation...'**
  String get toolSummarizeConversation;

  /// No description provided for @toolCreateReminder.
  ///
  /// In en, this message translates to:
  /// **'Creating reminder...'**
  String get toolCreateReminder;

  /// No description provided for @reminders.
  ///
  /// In en, this message translates to:
  /// **'Reminders'**
  String get reminders;

  /// No description provided for @remindersEmpty.
  ///
  /// In en, this message translates to:
  /// **'No pending reminders.\nAsk PON AI to set a reminder for you.'**
  String get remindersEmpty;

  /// No description provided for @reminderDone.
  ///
  /// In en, this message translates to:
  /// **'Mark as done'**
  String get reminderDone;

  /// No description provided for @tokenUsage.
  ///
  /// In en, this message translates to:
  /// **'Token Usage'**
  String get tokenUsage;

  /// No description provided for @tokenUsageTitle.
  ///
  /// In en, this message translates to:
  /// **'Token Usage Dashboard'**
  String get tokenUsageTitle;

  /// No description provided for @tokenUsageThisMonth.
  ///
  /// In en, this message translates to:
  /// **'Total tokens this month'**
  String get tokenUsageThisMonth;

  /// No description provided for @tokenUsageRequests.
  ///
  /// In en, this message translates to:
  /// **'AI requests'**
  String get tokenUsageRequests;

  /// No description provided for @tokenUsageEstCost.
  ///
  /// In en, this message translates to:
  /// **'Estimated cost (USD)'**
  String get tokenUsageEstCost;

  /// No description provided for @tokenUsageDailyChart.
  ///
  /// In en, this message translates to:
  /// **'Daily token usage (last 30 days)'**
  String get tokenUsageDailyChart;

  /// No description provided for @aiTraceTitle.
  ///
  /// In en, this message translates to:
  /// **'Agent trace'**
  String get aiTraceTitle;

  /// No description provided for @aiTraceThinking.
  ///
  /// In en, this message translates to:
  /// **'Thinking'**
  String get aiTraceThinking;

  /// No description provided for @aiTraceTools.
  ///
  /// In en, this message translates to:
  /// **'Tool calls'**
  String get aiTraceTools;

  /// No description provided for @aiTraceStats.
  ///
  /// In en, this message translates to:
  /// **'Stats'**
  String get aiTraceStats;

  /// No description provided for @aiPersonaTitle.
  ///
  /// In en, this message translates to:
  /// **'AI Persona'**
  String get aiPersonaTitle;

  /// No description provided for @avatarUploadLabel.
  ///
  /// In en, this message translates to:
  /// **'Change avatar'**
  String get avatarUploadLabel;

  /// No description provided for @aiPersonaNameHint.
  ///
  /// In en, this message translates to:
  /// **'Bot name (e.g. DevBot)'**
  String get aiPersonaNameHint;

  /// No description provided for @aiPersonaInstructionsHint.
  ///
  /// In en, this message translates to:
  /// **'Custom instructions (e.g. Always respond with bullet points)'**
  String get aiPersonaInstructionsHint;

  /// No description provided for @aiPersonaAdminOnly.
  ///
  /// In en, this message translates to:
  /// **'Only group admins can configure the AI persona.'**
  String get aiPersonaAdminOnly;

  /// No description provided for @configureAiPersona.
  ///
  /// In en, this message translates to:
  /// **'Configure AI Persona'**
  String get configureAiPersona;

  /// No description provided for @aiPersonaToneFriendly.
  ///
  /// In en, this message translates to:
  /// **'Friendly'**
  String get aiPersonaToneFriendly;

  /// No description provided for @aiPersonaToneProfessional.
  ///
  /// In en, this message translates to:
  /// **'Professional'**
  String get aiPersonaToneProfessional;

  /// No description provided for @aiPersonaToneConcise.
  ///
  /// In en, this message translates to:
  /// **'Concise'**
  String get aiPersonaToneConcise;

  /// No description provided for @aiPersonaToneCreative.
  ///
  /// In en, this message translates to:
  /// **'Creative'**
  String get aiPersonaToneCreative;

  /// No description provided for @aiQuotaExceeded.
  ///
  /// In en, this message translates to:
  /// **'Monthly AI usage quota exceeded. Please contact your admin.'**
  String get aiQuotaExceeded;

  /// No description provided for @viewUsage.
  ///
  /// In en, this message translates to:
  /// **'View usage'**
  String get viewUsage;

  /// No description provided for @tokenUsageQuota.
  ///
  /// In en, this message translates to:
  /// **'Monthly quota'**
  String get tokenUsageQuota;

  /// No description provided for @errEmailDomainInvalid.
  ///
  /// In en, this message translates to:
  /// **'This email address does not exist'**
  String get errEmailDomainInvalid;

  /// No description provided for @valPasswordMin8.
  ///
  /// In en, this message translates to:
  /// **'Password must be at least 8 characters'**
  String get valPasswordMin8;

  /// No description provided for @valPasswordUppercase.
  ///
  /// In en, this message translates to:
  /// **'Must contain an uppercase letter (A-Z)'**
  String get valPasswordUppercase;

  /// No description provided for @valPasswordLowercase.
  ///
  /// In en, this message translates to:
  /// **'Must contain a lowercase letter (a-z)'**
  String get valPasswordLowercase;

  /// No description provided for @valPasswordDigit.
  ///
  /// In en, this message translates to:
  /// **'Must contain a digit (0-9)'**
  String get valPasswordDigit;

  /// No description provided for @valPasswordSpecial.
  ///
  /// In en, this message translates to:
  /// **'Must contain a special character (!@#\$%^&*)'**
  String get valPasswordSpecial;

  /// No description provided for @pwStrengthWeak.
  ///
  /// In en, this message translates to:
  /// **'Weak'**
  String get pwStrengthWeak;

  /// No description provided for @pwStrengthMedium.
  ///
  /// In en, this message translates to:
  /// **'Medium'**
  String get pwStrengthMedium;

  /// No description provided for @pwStrengthStrong.
  ///
  /// In en, this message translates to:
  /// **'Strong'**
  String get pwStrengthStrong;

  /// No description provided for @pwStrengthVeryStrong.
  ///
  /// In en, this message translates to:
  /// **'Very Strong'**
  String get pwStrengthVeryStrong;

  /// No description provided for @pwReqLength.
  ///
  /// In en, this message translates to:
  /// **'≥8 characters'**
  String get pwReqLength;

  /// No description provided for @pwReqUppercase.
  ///
  /// In en, this message translates to:
  /// **'Uppercase (A-Z)'**
  String get pwReqUppercase;

  /// No description provided for @pwReqLowercase.
  ///
  /// In en, this message translates to:
  /// **'Lowercase (a-z)'**
  String get pwReqLowercase;

  /// No description provided for @pwReqDigit.
  ///
  /// In en, this message translates to:
  /// **'Digit (0-9)'**
  String get pwReqDigit;

  /// No description provided for @pwReqSpecial.
  ///
  /// In en, this message translates to:
  /// **'Special char (!@#\$...)'**
  String get pwReqSpecial;

  /// No description provided for @loginWithGoogle.
  ///
  /// In en, this message translates to:
  /// **'Sign in with Google'**
  String get loginWithGoogle;

  /// No description provided for @registerWithGoogle.
  ///
  /// In en, this message translates to:
  /// **'Sign up with Google'**
  String get registerWithGoogle;

  /// No description provided for @orContinueWith.
  ///
  /// In en, this message translates to:
  /// **'Or continue with'**
  String get orContinueWith;

  /// No description provided for @agreeToTerms.
  ///
  /// In en, this message translates to:
  /// **'I agree to the {privacyPolicy} and {termsOfService}'**
  String agreeToTerms(String privacyPolicy, String termsOfService);

  /// No description provided for @privacyPolicy.
  ///
  /// In en, this message translates to:
  /// **'Privacy Policy'**
  String get privacyPolicy;

  /// No description provided for @termsOfService.
  ///
  /// In en, this message translates to:
  /// **'Terms of Service'**
  String get termsOfService;

  /// No description provided for @valMustAgreeTerms.
  ///
  /// In en, this message translates to:
  /// **'You must agree to the Terms of Service to register'**
  String get valMustAgreeTerms;

  /// No description provided for @youColon.
  ///
  /// In en, this message translates to:
  /// **'You:'**
  String get youColon;

  /// No description provided for @systemNicknameChanged.
  ///
  /// In en, this message translates to:
  /// **'Nickname was changed'**
  String get systemNicknameChanged;

  /// No description provided for @systemThemeChanged.
  ///
  /// In en, this message translates to:
  /// **'Chat theme changed'**
  String get systemThemeChanged;

  /// No description provided for @systemQuickReactionChanged.
  ///
  /// In en, this message translates to:
  /// **'Quick reaction changed'**
  String get systemQuickReactionChanged;

  /// No description provided for @wallpaperUploadError.
  ///
  /// In en, this message translates to:
  /// **'Failed to upload image'**
  String get wallpaperUploadError;

  /// No description provided for @wallpaperScale.
  ///
  /// In en, this message translates to:
  /// **'Scale'**
  String get wallpaperScale;

  /// No description provided for @wallpaperPreviewHint.
  ///
  /// In en, this message translates to:
  /// **'Pinch or drag to adjust'**
  String get wallpaperPreviewHint;

  /// No description provided for @wallpaperPreviewIncoming.
  ///
  /// In en, this message translates to:
  /// **'Hi! How does this look?'**
  String get wallpaperPreviewIncoming;

  /// No description provided for @wallpaperPreviewOutgoing.
  ///
  /// In en, this message translates to:
  /// **'Looks great 🎉'**
  String get wallpaperPreviewOutgoing;

  /// No description provided for @errCannotOpenLink.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t open the link'**
  String get errCannotOpenLink;

  /// No description provided for @sysNicknameClearedSelf.
  ///
  /// In en, this message translates to:
  /// **'{actorName} cleared their own nickname'**
  String sysNicknameClearedSelf(String actorName);

  /// No description provided for @sysNicknameClearedOther.
  ///
  /// In en, this message translates to:
  /// **'{actorName} cleared the nickname of {targetName}'**
  String sysNicknameClearedOther(String actorName, String targetName);

  /// No description provided for @sysNicknameSetSelf.
  ///
  /// In en, this message translates to:
  /// **'{actorName} set their nickname to {nickname}'**
  String sysNicknameSetSelf(String actorName, String nickname);

  /// No description provided for @sysNicknameSetOther.
  ///
  /// In en, this message translates to:
  /// **'{actorName} set the nickname of {targetName} to {nickname}'**
  String sysNicknameSetOther(
      String actorName, String targetName, String nickname);

  /// No description provided for @sysThemeChanged.
  ///
  /// In en, this message translates to:
  /// **'{actorName} changed the chat theme'**
  String sysThemeChanged(String actorName);

  /// No description provided for @sysQuickReactionChanged.
  ///
  /// In en, this message translates to:
  /// **'{actorName} changed the quick reaction to {emoji}'**
  String sysQuickReactionChanged(String actorName, String emoji);

  /// No description provided for @sysGroupCreated.
  ///
  /// In en, this message translates to:
  /// **'{actorName} created the group'**
  String sysGroupCreated(String actorName);

  /// No description provided for @sysMembersAdded.
  ///
  /// In en, this message translates to:
  /// **'{actorName} added new members'**
  String sysMembersAdded(String actorName);

  /// No description provided for @sysMemberLeft.
  ///
  /// In en, this message translates to:
  /// **'{actorName} left the group'**
  String sysMemberLeft(String actorName);

  /// No description provided for @sysMemberRemoved.
  ///
  /// In en, this message translates to:
  /// **'{actorName} removed a member'**
  String sysMemberRemoved(String actorName);

  /// No description provided for @sysMemberJoined.
  ///
  /// In en, this message translates to:
  /// **'{actorName} joined the group'**
  String sysMemberJoined(String actorName);

  /// No description provided for @sysPinnedMessage.
  ///
  /// In en, this message translates to:
  /// **'{actorName} pinned a message'**
  String sysPinnedMessage(String actorName);

  /// No description provided for @sysUnpinnedMessage.
  ///
  /// In en, this message translates to:
  /// **'{actorName} unpinned a message'**
  String sysUnpinnedMessage(String actorName);

  /// No description provided for @systemVideoCallEnded.
  ///
  /// In en, this message translates to:
  /// **'Video call ended · {duration}'**
  String systemVideoCallEnded(String duration);

  /// No description provided for @systemVoiceCallEnded.
  ///
  /// In en, this message translates to:
  /// **'Voice call ended · {duration}'**
  String systemVoiceCallEnded(String duration);

  /// No description provided for @systemVideoCallMissed.
  ///
  /// In en, this message translates to:
  /// **'Missed video call'**
  String get systemVideoCallMissed;

  /// No description provided for @systemVoiceCallMissed.
  ///
  /// In en, this message translates to:
  /// **'Missed voice call'**
  String get systemVoiceCallMissed;

  /// No description provided for @errActionFailed.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Please try again.'**
  String get errActionFailed;

  /// No description provided for @kbDeleteFailed.
  ///
  /// In en, this message translates to:
  /// **'Delete failed, please try again'**
  String get kbDeleteFailed;

  /// No description provided for @exploreJoinFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to join channel'**
  String get exploreJoinFailed;

  /// No description provided for @unnamedChannel.
  ///
  /// In en, this message translates to:
  /// **'Unnamed'**
  String get unnamedChannel;

  /// No description provided for @actionOk.
  ///
  /// In en, this message translates to:
  /// **'OK'**
  String get actionOk;

  /// No description provided for @reminderDeleteConfirm.
  ///
  /// In en, this message translates to:
  /// **'Delete this reminder?'**
  String get reminderDeleteConfirm;

  /// No description provided for @profileNameLabel.
  ///
  /// In en, this message translates to:
  /// **'Name'**
  String get profileNameLabel;

  /// No description provided for @genderMale.
  ///
  /// In en, this message translates to:
  /// **'Male'**
  String get genderMale;

  /// No description provided for @genderFemale.
  ///
  /// In en, this message translates to:
  /// **'Female'**
  String get genderFemale;

  /// No description provided for @genderOther.
  ///
  /// In en, this message translates to:
  /// **'Other'**
  String get genderOther;

  /// No description provided for @aiPersonaSaved.
  ///
  /// In en, this message translates to:
  /// **'Saved'**
  String get aiPersonaSaved;

  /// No description provided for @aiPersonaResetTitle.
  ///
  /// In en, this message translates to:
  /// **'Reset AI persona'**
  String get aiPersonaResetTitle;

  /// No description provided for @aiPersonaResetConfirm.
  ///
  /// In en, this message translates to:
  /// **'Reset the AI persona to its default settings?'**
  String get aiPersonaResetConfirm;

  /// No description provided for @aiPersonaToneLabel.
  ///
  /// In en, this message translates to:
  /// **'Tone'**
  String get aiPersonaToneLabel;

  /// No description provided for @aiPersonaResetToDefault.
  ///
  /// In en, this message translates to:
  /// **'Reset to Default'**
  String get aiPersonaResetToDefault;

  /// No description provided for @tokenUsagePercentUsed.
  ///
  /// In en, this message translates to:
  /// **'{percent}% used this month'**
  String tokenUsagePercentUsed(String percent);

  /// No description provided for @tokenUsageCostUsd.
  ///
  /// In en, this message translates to:
  /// **'\${amount}'**
  String tokenUsageCostUsd(String amount);

  /// No description provided for @notifications.
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get notifications;

  /// No description provided for @notificationsEnabled.
  ///
  /// In en, this message translates to:
  /// **'Notifications are enabled'**
  String get notificationsEnabled;

  /// No description provided for @notificationsDisabled.
  ///
  /// In en, this message translates to:
  /// **'Notifications are disabled'**
  String get notificationsDisabled;

  /// No description provided for @legalScreenTitle.
  ///
  /// In en, this message translates to:
  /// **'Privacy & Terms'**
  String get legalScreenTitle;

  /// No description provided for @legalLastUpdated.
  ///
  /// In en, this message translates to:
  /// **'Last updated: June 15, 2026'**
  String get legalLastUpdated;

  /// No description provided for @legalDataCollectionTitle.
  ///
  /// In en, this message translates to:
  /// **'1. Data Collection'**
  String get legalDataCollectionTitle;

  /// No description provided for @legalDataCollectionContent.
  ///
  /// In en, this message translates to:
  /// **'We collect information you provide directly to us, such as when you create or modify your account, use our services, or communicate with us. This includes your name, email address, profile picture, and the messages you send.'**
  String get legalDataCollectionContent;

  /// No description provided for @legalDataUsageTitle.
  ///
  /// In en, this message translates to:
  /// **'2. How We Use Your Data'**
  String get legalDataUsageTitle;

  /// No description provided for @legalDataUsageContent.
  ///
  /// In en, this message translates to:
  /// **'Your data is used to provide, maintain, and improve our services, including facilitating communication between users, ensuring security, and personalizing your experience.'**
  String get legalDataUsageContent;

  /// No description provided for @legalSecurityTitle.
  ///
  /// In en, this message translates to:
  /// **'3. Security'**
  String get legalSecurityTitle;

  /// No description provided for @legalSecurityContent.
  ///
  /// In en, this message translates to:
  /// **'We implement industry-standard security measures to protect your personal information and messages. Access to data is strictly controlled and we use encryption to secure sensitive information.'**
  String get legalSecurityContent;

  /// No description provided for @legalUserRightsTitle.
  ///
  /// In en, this message translates to:
  /// **'4. Your Rights'**
  String get legalUserRightsTitle;

  /// No description provided for @legalUserRightsContent.
  ///
  /// In en, this message translates to:
  /// **'You have the right to access, correct, or delete your personal data. You can delete your account at any time through the application settings.'**
  String get legalUserRightsContent;

  /// No description provided for @legalTermsTitle.
  ///
  /// In en, this message translates to:
  /// **'5. Terms of Service'**
  String get legalTermsTitle;

  /// No description provided for @legalTermsContent.
  ///
  /// In en, this message translates to:
  /// **'By using our platform, you agree not to engage in any abusive, harassing, or illegal activities. We reserve the right to suspend or terminate accounts that violate these terms.'**
  String get legalTermsContent;

  /// No description provided for @authMsgLoginSuccess.
  ///
  /// In en, this message translates to:
  /// **'Login successful.'**
  String get authMsgLoginSuccess;

  /// No description provided for @authMsgLogoutSuccess.
  ///
  /// In en, this message translates to:
  /// **'Logout successful.'**
  String get authMsgLogoutSuccess;

  /// No description provided for @authMsgOtpSent.
  ///
  /// In en, this message translates to:
  /// **'OTP has been sent to your email.'**
  String get authMsgOtpSent;

  /// No description provided for @authMsgOtpValid.
  ///
  /// In en, this message translates to:
  /// **'OTP verified successfully.'**
  String get authMsgOtpValid;

  /// No description provided for @authMsgOtpResent.
  ///
  /// In en, this message translates to:
  /// **'A new OTP has been sent.'**
  String get authMsgOtpResent;

  /// No description provided for @authMsgPasswordUpdated.
  ///
  /// In en, this message translates to:
  /// **'Password updated successfully. Please log in again.'**
  String get authMsgPasswordUpdated;

  /// No description provided for @authMsgRegisterSuccess.
  ///
  /// In en, this message translates to:
  /// **'Registration successful. OTP has been sent to your email.'**
  String get authMsgRegisterSuccess;

  /// No description provided for @authMsgAccountUnverifiedOtpSent.
  ///
  /// In en, this message translates to:
  /// **'Account not yet verified. A new OTP has been sent to your email.'**
  String get authMsgAccountUnverifiedOtpSent;

  /// No description provided for @authErrOtpInvalid.
  ///
  /// In en, this message translates to:
  /// **'Invalid OTP code.'**
  String get authErrOtpInvalid;

  /// No description provided for @authErrOtpExpired.
  ///
  /// In en, this message translates to:
  /// **'OTP has expired.'**
  String get authErrOtpExpired;

  /// No description provided for @authErrOtpAttemptsExceeded.
  ///
  /// In en, this message translates to:
  /// **'Too many incorrect attempts. Please request a new OTP.'**
  String get authErrOtpAttemptsExceeded;

  /// No description provided for @authErrOtpWrongWithRemaining.
  ///
  /// In en, this message translates to:
  /// **'Incorrect OTP. {remaining} attempt(s) remaining.'**
  String authErrOtpWrongWithRemaining(int remaining);

  /// No description provided for @authErrOtpResendCooldown.
  ///
  /// In en, this message translates to:
  /// **'Please wait {ttl} seconds before requesting a new OTP.'**
  String authErrOtpResendCooldown(int ttl);

  /// No description provided for @authErrEmailDomainInvalid.
  ///
  /// In en, this message translates to:
  /// **'Email domain does not exist or has no MX records.'**
  String get authErrEmailDomainInvalid;

  /// No description provided for @authErrEmailNotFound.
  ///
  /// In en, this message translates to:
  /// **'Email does not exist in the system.'**
  String get authErrEmailNotFound;

  /// No description provided for @authErrEmailInUse.
  ///
  /// In en, this message translates to:
  /// **'This email is already in use.'**
  String get authErrEmailInUse;

  /// No description provided for @authErrValEmailInvalid.
  ///
  /// In en, this message translates to:
  /// **'Invalid email format.'**
  String get authErrValEmailInvalid;

  /// No description provided for @authErrValEmailRequired.
  ///
  /// In en, this message translates to:
  /// **'Email is required.'**
  String get authErrValEmailRequired;

  /// No description provided for @authErrValDisplaynameRequired.
  ///
  /// In en, this message translates to:
  /// **'Display name is required.'**
  String get authErrValDisplaynameRequired;

  /// No description provided for @authErrValDisplaynameTooShort.
  ///
  /// In en, this message translates to:
  /// **'Display name is too short (minimum 2 characters).'**
  String get authErrValDisplaynameTooShort;

  /// No description provided for @authErrValPasswordTooShort.
  ///
  /// In en, this message translates to:
  /// **'Password must be at least 8 characters.'**
  String get authErrValPasswordTooShort;

  /// No description provided for @authErrAccountLocked.
  ///
  /// In en, this message translates to:
  /// **'Account temporarily locked for {minutes} minute(s) due to too many failed attempts.'**
  String authErrAccountLocked(int minutes);

  /// No description provided for @authErrLoginFailedWithRemaining.
  ///
  /// In en, this message translates to:
  /// **'Incorrect email or password. {remaining} attempt(s) remaining.'**
  String authErrLoginFailedWithRemaining(int remaining);

  /// No description provided for @authErrLoginFailedLocked.
  ///
  /// In en, this message translates to:
  /// **'Too many failed attempts. Account locked for {minutes} minute(s).'**
  String authErrLoginFailedLocked(int minutes);

  /// No description provided for @authErrTokenInvalid.
  ///
  /// In en, this message translates to:
  /// **'Invalid token.'**
  String get authErrTokenInvalid;

  /// No description provided for @authErrSessionNotFound.
  ///
  /// In en, this message translates to:
  /// **'Session not found or has expired.'**
  String get authErrSessionNotFound;

  /// No description provided for @authErrSessionInvalid.
  ///
  /// In en, this message translates to:
  /// **'Session does not exist or has expired.'**
  String get authErrSessionInvalid;

  /// No description provided for @authErrSessionRevoked.
  ///
  /// In en, this message translates to:
  /// **'Session has been revoked.'**
  String get authErrSessionRevoked;

  /// No description provided for @authErrRefreshTokenReuse.
  ///
  /// In en, this message translates to:
  /// **'Security alert: refresh token reuse detected. All sessions revoked.'**
  String get authErrRefreshTokenReuse;

  /// No description provided for @authErrRefreshTokenInvalid.
  ///
  /// In en, this message translates to:
  /// **'Invalid refresh token.'**
  String get authErrRefreshTokenInvalid;

  /// No description provided for @authErrRefreshTokenRotated.
  ///
  /// In en, this message translates to:
  /// **'Refresh token has already been rotated.'**
  String get authErrRefreshTokenRotated;

  /// No description provided for @authErrTokenSessionMismatch.
  ///
  /// In en, this message translates to:
  /// **'Token does not match the session.'**
  String get authErrTokenSessionMismatch;

  /// No description provided for @authErrSocialEmailUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Unable to retrieve email from social account.'**
  String get authErrSocialEmailUnavailable;

  /// No description provided for @authErrLoginCodeInvalid.
  ///
  /// In en, this message translates to:
  /// **'Login code is invalid or has expired.'**
  String get authErrLoginCodeInvalid;

  /// No description provided for @authErrUserNotFound.
  ///
  /// In en, this message translates to:
  /// **'User not found.'**
  String get authErrUserNotFound;

  /// No description provided for @integrationsTitle.
  ///
  /// In en, this message translates to:
  /// **'Integrations'**
  String get integrationsTitle;

  /// No description provided for @integrationsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Connect an account once. From then on, just message your assistant — it acts on your behalf, with your permissions and nothing more.'**
  String get integrationsSubtitle;

  /// No description provided for @integrationsSettingsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Connect tools your assistant can use'**
  String get integrationsSettingsSubtitle;

  /// No description provided for @connectorStatusConnected.
  ///
  /// In en, this message translates to:
  /// **'Connected'**
  String get connectorStatusConnected;

  /// No description provided for @connectorStatusAvailable.
  ///
  /// In en, this message translates to:
  /// **'Available'**
  String get connectorStatusAvailable;

  /// No description provided for @connectorStatusComingSoon.
  ///
  /// In en, this message translates to:
  /// **'Coming soon'**
  String get connectorStatusComingSoon;

  /// No description provided for @connectorConnect.
  ///
  /// In en, this message translates to:
  /// **'Connect'**
  String get connectorConnect;

  /// No description provided for @connectorManage.
  ///
  /// In en, this message translates to:
  /// **'Manage'**
  String get connectorManage;

  /// No description provided for @connectorDisconnect.
  ///
  /// In en, this message translates to:
  /// **'Disconnect'**
  String get connectorDisconnect;

  /// No description provided for @connectorDisconnectConfirm.
  ///
  /// In en, this message translates to:
  /// **'Disconnect this account? Your assistant will lose access to its tools.'**
  String get connectorDisconnectConfirm;

  /// No description provided for @connectorOpenFailed.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t open the authorization page.'**
  String get connectorOpenFailed;

  /// No description provided for @customMcpTitle.
  ///
  /// In en, this message translates to:
  /// **'Add a custom MCP server'**
  String get customMcpTitle;

  /// No description provided for @customMcpSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Point your assistant at any MCP server. We\'ll discover its tools and your assistant can use them.'**
  String get customMcpSubtitle;

  /// No description provided for @customMcpName.
  ///
  /// In en, this message translates to:
  /// **'Name'**
  String get customMcpName;

  /// No description provided for @customMcpUrl.
  ///
  /// In en, this message translates to:
  /// **'Server URL'**
  String get customMcpUrl;

  /// No description provided for @customMcpAuth.
  ///
  /// In en, this message translates to:
  /// **'AUTH'**
  String get customMcpAuth;

  /// No description provided for @customMcpAuthNone.
  ///
  /// In en, this message translates to:
  /// **'None'**
  String get customMcpAuthNone;

  /// No description provided for @customMcpAuthApiKey.
  ///
  /// In en, this message translates to:
  /// **'API key'**
  String get customMcpAuthApiKey;

  /// No description provided for @customMcpAuthOauth.
  ///
  /// In en, this message translates to:
  /// **'OAuth'**
  String get customMcpAuthOauth;

  /// No description provided for @customMcpCredential.
  ///
  /// In en, this message translates to:
  /// **'Credential'**
  String get customMcpCredential;

  /// No description provided for @customMcpDiscover.
  ///
  /// In en, this message translates to:
  /// **'Discover tools'**
  String get customMcpDiscover;

  /// No description provided for @customMcpSave.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get customMcpSave;

  /// No description provided for @customMcpSaved.
  ///
  /// In en, this message translates to:
  /// **'Custom MCP server added.'**
  String get customMcpSaved;

  /// No description provided for @customMcpToolsFound.
  ///
  /// In en, this message translates to:
  /// **'{count} tools discovered'**
  String customMcpToolsFound(int count);

  /// No description provided for @permissionsTitle.
  ///
  /// In en, this message translates to:
  /// **'AI permissions'**
  String get permissionsTitle;

  /// No description provided for @permissionsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Choose which actions your assistant may take through this connector.'**
  String get permissionsSubtitle;

  /// No description provided for @permView.
  ///
  /// In en, this message translates to:
  /// **'View'**
  String get permView;

  /// No description provided for @permCreate.
  ///
  /// In en, this message translates to:
  /// **'Create'**
  String get permCreate;

  /// No description provided for @permEdit.
  ///
  /// In en, this message translates to:
  /// **'Edit'**
  String get permEdit;

  /// No description provided for @permDelete.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get permDelete;

  /// No description provided for @permViewDesc.
  ///
  /// In en, this message translates to:
  /// **'Read data, search, and summarize (read-only).'**
  String get permViewDesc;

  /// No description provided for @permCreateDesc.
  ///
  /// In en, this message translates to:
  /// **'Add new items such as files, events, or records.'**
  String get permCreateDesc;

  /// No description provided for @permEditDesc.
  ///
  /// In en, this message translates to:
  /// **'Modify existing items and their content.'**
  String get permEditDesc;

  /// No description provided for @permDeleteDesc.
  ///
  /// In en, this message translates to:
  /// **'Remove items permanently.'**
  String get permDeleteDesc;

  /// No description provided for @permManage.
  ///
  /// In en, this message translates to:
  /// **'Permissions'**
  String get permManage;

  /// No description provided for @permSaved.
  ///
  /// In en, this message translates to:
  /// **'Permissions updated.'**
  String get permSaved;

  /// No description provided for @skillsTitle.
  ///
  /// In en, this message translates to:
  /// **'Skills'**
  String get skillsTitle;

  /// No description provided for @skillsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Skills bundle a set of tools and a way of working. Turn on only what you need — each one tells you what it requires.'**
  String get skillsSubtitle;

  /// No description provided for @skillsSettingsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Choose what your assistant is good at'**
  String get skillsSettingsSubtitle;

  /// No description provided for @skillNeeds.
  ///
  /// In en, this message translates to:
  /// **'Needs {requirements}'**
  String skillNeeds(String requirements);

  /// No description provided for @skillSchedulerName.
  ///
  /// In en, this message translates to:
  /// **'Scheduler'**
  String get skillSchedulerName;

  /// No description provided for @skillSchedulerDesc.
  ///
  /// In en, this message translates to:
  /// **'Books meetings, finds slots, sends invites and reminders.'**
  String get skillSchedulerDesc;

  /// No description provided for @skillMailWriterName.
  ///
  /// In en, this message translates to:
  /// **'Mail writer'**
  String get skillMailWriterName;

  /// No description provided for @skillMailWriterDesc.
  ///
  /// In en, this message translates to:
  /// **'Drafts replies in your voice, summarizes long threads.'**
  String get skillMailWriterDesc;

  /// No description provided for @skillResearcherName.
  ///
  /// In en, this message translates to:
  /// **'Researcher'**
  String get skillResearcherName;

  /// No description provided for @skillResearcherDesc.
  ///
  /// In en, this message translates to:
  /// **'Searches the web and your Drive, returns cited answers.'**
  String get skillResearcherDesc;

  /// No description provided for @skillProjectKeeperName.
  ///
  /// In en, this message translates to:
  /// **'Project keeper'**
  String get skillProjectKeeperName;

  /// No description provided for @skillProjectKeeperDesc.
  ///
  /// In en, this message translates to:
  /// **'Files notes and tasks into Notion, keeps databases tidy.'**
  String get skillProjectKeeperDesc;

  /// No description provided for @skillMeetingNotesName.
  ///
  /// In en, this message translates to:
  /// **'Meeting notes'**
  String get skillMeetingNotesName;

  /// No description provided for @skillMeetingNotesDesc.
  ///
  /// In en, this message translates to:
  /// **'Summarize meetings and pull out decisions and action items.'**
  String get skillMeetingNotesDesc;

  /// No description provided for @skillInboxTriageName.
  ///
  /// In en, this message translates to:
  /// **'Inbox triage'**
  String get skillInboxTriageName;

  /// No description provided for @skillInboxTriageDesc.
  ///
  /// In en, this message translates to:
  /// **'Prioritize messages and suggest quick replies.'**
  String get skillInboxTriageDesc;

  /// No description provided for @skillDataAnalystName.
  ///
  /// In en, this message translates to:
  /// **'Data analyst'**
  String get skillDataAnalystName;

  /// No description provided for @skillDataAnalystDesc.
  ///
  /// In en, this message translates to:
  /// **'Analyze tables and numbers; surface trends and outliers.'**
  String get skillDataAnalystDesc;

  /// No description provided for @skillDocDrafterName.
  ///
  /// In en, this message translates to:
  /// **'Document drafter'**
  String get skillDocDrafterName;

  /// No description provided for @skillDocDrafterDesc.
  ///
  /// In en, this message translates to:
  /// **'Draft structured proposals, specs and reports.'**
  String get skillDocDrafterDesc;

  /// No description provided for @skillTranslatorName.
  ///
  /// In en, this message translates to:
  /// **'Translator'**
  String get skillTranslatorName;

  /// No description provided for @skillTranslatorDesc.
  ///
  /// In en, this message translates to:
  /// **'Translate and localize text naturally across languages.'**
  String get skillTranslatorDesc;

  /// No description provided for @adminTitle.
  ///
  /// In en, this message translates to:
  /// **'Admin Console'**
  String get adminTitle;

  /// No description provided for @adminSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Manage your workspace, departments, members and roles'**
  String get adminSubtitle;

  /// No description provided for @adminBack.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get adminBack;

  /// No description provided for @adminLoading.
  ///
  /// In en, this message translates to:
  /// **'Loading…'**
  String get adminLoading;

  /// No description provided for @adminSave.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get adminSave;

  /// No description provided for @adminSaving.
  ///
  /// In en, this message translates to:
  /// **'Saving…'**
  String get adminSaving;

  /// No description provided for @adminCancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get adminCancel;

  /// No description provided for @adminToastSaved.
  ///
  /// In en, this message translates to:
  /// **'Saved'**
  String get adminToastSaved;

  /// No description provided for @adminToastDeleted.
  ///
  /// In en, this message translates to:
  /// **'Deleted'**
  String get adminToastDeleted;

  /// No description provided for @adminToastError.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong'**
  String get adminToastError;

  /// No description provided for @adminMenu.
  ///
  /// In en, this message translates to:
  /// **'Admin'**
  String get adminMenu;

  /// No description provided for @adminSettingsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Workspace, departments, members & roles'**
  String get adminSettingsSubtitle;

  /// No description provided for @adminNavWorkspace.
  ///
  /// In en, this message translates to:
  /// **'Workspace'**
  String get adminNavWorkspace;

  /// No description provided for @adminNavDepartments.
  ///
  /// In en, this message translates to:
  /// **'Departments'**
  String get adminNavDepartments;

  /// No description provided for @adminNavMembers.
  ///
  /// In en, this message translates to:
  /// **'Members'**
  String get adminNavMembers;

  /// No description provided for @adminNavRoles.
  ///
  /// In en, this message translates to:
  /// **'Roles'**
  String get adminNavRoles;

  /// No description provided for @adminNavAudit.
  ///
  /// In en, this message translates to:
  /// **'Audit log'**
  String get adminNavAudit;

  /// No description provided for @adminWsIdentity.
  ///
  /// In en, this message translates to:
  /// **'Identity & branding'**
  String get adminWsIdentity;

  /// No description provided for @adminWsName.
  ///
  /// In en, this message translates to:
  /// **'Workspace name'**
  String get adminWsName;

  /// No description provided for @adminWsNamePlaceholder.
  ///
  /// In en, this message translates to:
  /// **'Acme Inc.'**
  String get adminWsNamePlaceholder;

  /// No description provided for @adminWsLogoUrl.
  ///
  /// In en, this message translates to:
  /// **'Logo URL'**
  String get adminWsLogoUrl;

  /// No description provided for @adminWsPrimaryColor.
  ///
  /// In en, this message translates to:
  /// **'Primary color'**
  String get adminWsPrimaryColor;

  /// No description provided for @adminWsFeatures.
  ///
  /// In en, this message translates to:
  /// **'Feature flags'**
  String get adminWsFeatures;

  /// No description provided for @adminWsNoFeatures.
  ///
  /// In en, this message translates to:
  /// **'No feature flags configured.'**
  String get adminWsNoFeatures;

  /// No description provided for @adminWsAllowList.
  ///
  /// In en, this message translates to:
  /// **'Connector allow-list'**
  String get adminWsAllowList;

  /// No description provided for @adminWsAllowListDesc.
  ///
  /// In en, this message translates to:
  /// **'Connectors members may personally connect.'**
  String get adminWsAllowListDesc;

  /// No description provided for @adminWsNoCatalog.
  ///
  /// In en, this message translates to:
  /// **'No connectors available.'**
  String get adminWsNoCatalog;

  /// No description provided for @adminDeptNew.
  ///
  /// In en, this message translates to:
  /// **'New department'**
  String get adminDeptNew;

  /// No description provided for @adminDeptEdit.
  ///
  /// In en, this message translates to:
  /// **'Edit department'**
  String get adminDeptEdit;

  /// No description provided for @adminDeptEmpty.
  ///
  /// In en, this message translates to:
  /// **'No departments yet.'**
  String get adminDeptEmpty;

  /// No description provided for @adminDeptLead.
  ///
  /// In en, this message translates to:
  /// **'Lead'**
  String get adminDeptLead;

  /// No description provided for @adminDeptLeadNone.
  ///
  /// In en, this message translates to:
  /// **'No lead'**
  String get adminDeptLeadNone;

  /// No description provided for @adminDeptName.
  ///
  /// In en, this message translates to:
  /// **'Name'**
  String get adminDeptName;

  /// No description provided for @adminDeptDescription.
  ///
  /// In en, this message translates to:
  /// **'Description'**
  String get adminDeptDescription;

  /// No description provided for @adminDeptDialogDesc.
  ///
  /// In en, this message translates to:
  /// **'Departments group members and own department chats.'**
  String get adminDeptDialogDesc;

  /// No description provided for @adminDeptDeleteConfirm.
  ///
  /// In en, this message translates to:
  /// **'Delete department \"{name}\"?'**
  String adminDeptDeleteConfirm(String name);

  /// No description provided for @adminMemberHint.
  ///
  /// In en, this message translates to:
  /// **'Assign a role and departments to each member.'**
  String get adminMemberHint;

  /// No description provided for @adminMemberEdit.
  ///
  /// In en, this message translates to:
  /// **'Edit member'**
  String get adminMemberEdit;

  /// No description provided for @adminMemberRevokeNote.
  ///
  /// In en, this message translates to:
  /// **'Saving revokes the member\'s active sessions.'**
  String get adminMemberRevokeNote;

  /// No description provided for @adminMemberRole.
  ///
  /// In en, this message translates to:
  /// **'Role'**
  String get adminMemberRole;

  /// No description provided for @adminMemberRoleNone.
  ///
  /// In en, this message translates to:
  /// **'No role'**
  String get adminMemberRoleNone;

  /// No description provided for @adminMemberDepartments.
  ///
  /// In en, this message translates to:
  /// **'Departments'**
  String get adminMemberDepartments;

  /// No description provided for @adminRoleHint.
  ///
  /// In en, this message translates to:
  /// **'Toggle each role\'s permissions. The Owner role is read-only.'**
  String get adminRoleHint;

  /// No description provided for @adminRoleCapability.
  ///
  /// In en, this message translates to:
  /// **'Capability'**
  String get adminRoleCapability;

  /// No description provided for @adminRolePreset.
  ///
  /// In en, this message translates to:
  /// **'Preset'**
  String get adminRolePreset;

  /// No description provided for @adminRoleClone.
  ///
  /// In en, this message translates to:
  /// **'Clone'**
  String get adminRoleClone;

  /// No description provided for @adminRoleCloneTitle.
  ///
  /// In en, this message translates to:
  /// **'Clone {name}'**
  String adminRoleCloneTitle(String name);

  /// No description provided for @adminRoleName.
  ///
  /// In en, this message translates to:
  /// **'Role name'**
  String get adminRoleName;

  /// No description provided for @adminAuditTitle.
  ///
  /// In en, this message translates to:
  /// **'Audit log'**
  String get adminAuditTitle;

  /// No description provided for @adminAuditComingSoon.
  ///
  /// In en, this message translates to:
  /// **'The audit log will be available in a future update.'**
  String get adminAuditComingSoon;

  /// No description provided for @adminCapManageWorkspace.
  ///
  /// In en, this message translates to:
  /// **'Manage workspace'**
  String get adminCapManageWorkspace;

  /// No description provided for @adminCapManageDepartments.
  ///
  /// In en, this message translates to:
  /// **'Manage departments'**
  String get adminCapManageDepartments;

  /// No description provided for @adminCapManageMembers.
  ///
  /// In en, this message translates to:
  /// **'Manage members'**
  String get adminCapManageMembers;

  /// No description provided for @adminCapManageRoles.
  ///
  /// In en, this message translates to:
  /// **'Manage roles'**
  String get adminCapManageRoles;

  /// No description provided for @adminCapConnectWorkspaceConnector.
  ///
  /// In en, this message translates to:
  /// **'Connect workspace connectors'**
  String get adminCapConnectWorkspaceConnector;

  /// No description provided for @adminCapAddCustomMcp.
  ///
  /// In en, this message translates to:
  /// **'Add custom MCP'**
  String get adminCapAddCustomMcp;

  /// No description provided for @adminCapConnectPersonalConnector.
  ///
  /// In en, this message translates to:
  /// **'Connect personal connectors'**
  String get adminCapConnectPersonalConnector;

  /// No description provided for @adminCapUsePersonalAssistant.
  ///
  /// In en, this message translates to:
  /// **'Use personal assistant'**
  String get adminCapUsePersonalAssistant;

  /// No description provided for @adminCapUseGroupBot.
  ///
  /// In en, this message translates to:
  /// **'Use group bot'**
  String get adminCapUseGroupBot;

  /// No description provided for @adminCapRunSensitiveSkill.
  ///
  /// In en, this message translates to:
  /// **'Run sensitive skills'**
  String get adminCapRunSensitiveSkill;

  /// No description provided for @adminCapViewAuditLog.
  ///
  /// In en, this message translates to:
  /// **'View audit log'**
  String get adminCapViewAuditLog;

  /// No description provided for @adminAuditEmpty.
  ///
  /// In en, this message translates to:
  /// **'No audit entries yet.'**
  String get adminAuditEmpty;

  /// No description provided for @adminAuditPrev.
  ///
  /// In en, this message translates to:
  /// **'Previous'**
  String get adminAuditPrev;

  /// No description provided for @adminAuditNext.
  ///
  /// In en, this message translates to:
  /// **'Next'**
  String get adminAuditNext;

  /// No description provided for @newConvDepartment.
  ///
  /// In en, this message translates to:
  /// **'Department (optional)'**
  String get newConvDepartment;

  /// No description provided for @newConvNoDepartment.
  ///
  /// In en, this message translates to:
  /// **'No department'**
  String get newConvNoDepartment;

  /// No description provided for @loginWithSso.
  ///
  /// In en, this message translates to:
  /// **'Sign in with SSO'**
  String get loginWithSso;

  /// No description provided for @adminNavSso.
  ///
  /// In en, this message translates to:
  /// **'SSO'**
  String get adminNavSso;

  /// No description provided for @adminSsoTitle.
  ///
  /// In en, this message translates to:
  /// **'Single Sign-On (SSO)'**
  String get adminSsoTitle;

  /// No description provided for @adminSsoHint.
  ///
  /// In en, this message translates to:
  /// **'Configure OIDC login. Provider credentials are set in the deployment .env; here you map IdP groups to roles and departments.'**
  String get adminSsoHint;

  /// No description provided for @adminSsoEnabled.
  ///
  /// In en, this message translates to:
  /// **'Enable SSO'**
  String get adminSsoEnabled;

  /// No description provided for @adminSsoAllowedDomains.
  ///
  /// In en, this message translates to:
  /// **'Allowed email domains'**
  String get adminSsoAllowedDomains;

  /// No description provided for @adminSsoAllowedDomainsHint.
  ///
  /// In en, this message translates to:
  /// **'Comma-separated. Leave empty to allow any verified email.'**
  String get adminSsoAllowedDomainsHint;

  /// No description provided for @adminSsoDefaultRole.
  ///
  /// In en, this message translates to:
  /// **'Default role'**
  String get adminSsoDefaultRole;

  /// No description provided for @adminSsoNone.
  ///
  /// In en, this message translates to:
  /// **'None'**
  String get adminSsoNone;

  /// No description provided for @adminSsoGroupRoleMap.
  ///
  /// In en, this message translates to:
  /// **'Group → Role'**
  String get adminSsoGroupRoleMap;

  /// No description provided for @adminSsoGroupDeptMap.
  ///
  /// In en, this message translates to:
  /// **'Group → Department'**
  String get adminSsoGroupDeptMap;

  /// No description provided for @adminSsoGroupPlaceholder.
  ///
  /// In en, this message translates to:
  /// **'IdP group name'**
  String get adminSsoGroupPlaceholder;

  /// No description provided for @adminSsoAddMapping.
  ///
  /// In en, this message translates to:
  /// **'Add mapping'**
  String get adminSsoAddMapping;

  /// No description provided for @sectionDirectoryTitle.
  ///
  /// In en, this message translates to:
  /// **'MCP directory'**
  String get sectionDirectoryTitle;

  /// No description provided for @sectionDirectoryDesc.
  ///
  /// In en, this message translates to:
  /// **'Browse MCP servers and connect with one click — OAuth runs automatically.'**
  String get sectionDirectoryDesc;

  /// No description provided for @directoryAdd.
  ///
  /// In en, this message translates to:
  /// **'Add entry'**
  String get directoryAdd;

  /// No description provided for @directorySearch.
  ///
  /// In en, this message translates to:
  /// **'Search the directory…'**
  String get directorySearch;

  /// No description provided for @directoryEmpty.
  ///
  /// In en, this message translates to:
  /// **'No directory entries match your search.'**
  String get directoryEmpty;

  /// No description provided for @directoryEdit.
  ///
  /// In en, this message translates to:
  /// **'Edit entry'**
  String get directoryEdit;

  /// No description provided for @directoryDelete.
  ///
  /// In en, this message translates to:
  /// **'Delete entry'**
  String get directoryDelete;

  /// No description provided for @tierWorkspace.
  ///
  /// In en, this message translates to:
  /// **'Workspace'**
  String get tierWorkspace;

  /// No description provided for @tierPersonal.
  ///
  /// In en, this message translates to:
  /// **'Personal'**
  String get tierPersonal;

  /// No description provided for @tierBoth.
  ///
  /// In en, this message translates to:
  /// **'Personal / Workspace'**
  String get tierBoth;

  /// No description provided for @directorySaveSuccess.
  ///
  /// In en, this message translates to:
  /// **'Directory entry saved.'**
  String get directorySaveSuccess;

  /// No description provided for @directoryDeleteSuccess.
  ///
  /// In en, this message translates to:
  /// **'Directory entry deleted.'**
  String get directoryDeleteSuccess;

  /// No description provided for @directoryAddTitle.
  ///
  /// In en, this message translates to:
  /// **'Add directory entry'**
  String get directoryAddTitle;

  /// No description provided for @directoryEditTitle.
  ///
  /// In en, this message translates to:
  /// **'Edit directory entry'**
  String get directoryEditTitle;

  /// No description provided for @directoryDialogDesc.
  ///
  /// In en, this message translates to:
  /// **'Add a public MCP server members can connect with one click.'**
  String get directoryDialogDesc;

  /// No description provided for @directorySlug.
  ///
  /// In en, this message translates to:
  /// **'Slug'**
  String get directorySlug;

  /// No description provided for @directoryName.
  ///
  /// In en, this message translates to:
  /// **'Name'**
  String get directoryName;

  /// No description provided for @directoryDescription.
  ///
  /// In en, this message translates to:
  /// **'Description'**
  String get directoryDescription;

  /// No description provided for @directoryMcpUrl.
  ///
  /// In en, this message translates to:
  /// **'MCP URL'**
  String get directoryMcpUrl;

  /// No description provided for @directoryAuthMode.
  ///
  /// In en, this message translates to:
  /// **'Auth mode'**
  String get directoryAuthMode;

  /// No description provided for @directoryTier.
  ///
  /// In en, this message translates to:
  /// **'Tier'**
  String get directoryTier;

  /// No description provided for @directoryEnvHint.
  ///
  /// In en, this message translates to:
  /// **'For env-oauth: reference the env vars holding the OAuth client credentials.'**
  String get directoryEnvHint;

  /// No description provided for @directoryEnvClientId.
  ///
  /// In en, this message translates to:
  /// **'Client ID env'**
  String get directoryEnvClientId;

  /// No description provided for @directoryEnvClientSecret.
  ///
  /// In en, this message translates to:
  /// **'Client secret env'**
  String get directoryEnvClientSecret;

  /// No description provided for @directoryAuthorizeUrl.
  ///
  /// In en, this message translates to:
  /// **'Authorize URL'**
  String get directoryAuthorizeUrl;

  /// No description provided for @directoryTokenUrl.
  ///
  /// In en, this message translates to:
  /// **'Token URL'**
  String get directoryTokenUrl;

  /// No description provided for @directoryCancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get directoryCancel;

  /// No description provided for @directorySave.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get directorySave;

  /// No description provided for @directoryKeyTitle.
  ///
  /// In en, this message translates to:
  /// **'Connect {provider}'**
  String directoryKeyTitle(String provider);

  /// No description provided for @directoryKeyLabel.
  ///
  /// In en, this message translates to:
  /// **'API key'**
  String get directoryKeyLabel;

  /// No description provided for @directoryConnected.
  ///
  /// In en, this message translates to:
  /// **'Connected {provider}.'**
  String directoryConnected(String provider);

  /// No description provided for @editNicknames.
  ///
  /// In en, this message translates to:
  /// **'Edit nicknames'**
  String get editNicknames;

  /// No description provided for @nicknameModalTitle.
  ///
  /// In en, this message translates to:
  /// **'Nicknames'**
  String get nicknameModalTitle;

  /// No description provided for @nicknameNonePlaceholder.
  ///
  /// In en, this message translates to:
  /// **'No nickname'**
  String get nicknameNonePlaceholder;

  /// No description provided for @nicknameYouSuffix.
  ///
  /// In en, this message translates to:
  /// **'(you)'**
  String get nicknameYouSuffix;
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
