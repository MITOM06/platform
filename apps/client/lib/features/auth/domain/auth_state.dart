import 'package:flutter/foundation.dart';

import 'mfa_models.dart';

@immutable
class UserModel {
  final String id;
  final String email;
  final String displayName;
  final String? avatarUrl;
  final String? bio;
  final String? coverPhoto;
  final int? friendsCount;
  final DateTime? dateOfBirth;
  final String? phoneNumber;

  /// Whether [phoneNumber] has been confirmed via SMS OTP. Only meaningful on
  /// the self response (`GET /api/users/me`). Drives the green verified badge.
  final bool phoneVerified;
  final String? gender;
  final bool hideInfo;

  /// Per-field visibility flags. `null` = not set by the server (legacy doc) →
  /// callers fall back to `!hideInfo`. Only present on the self response.
  final bool? showDateOfBirth;
  final bool? showPhoneNumber;
  final bool? showGender;

  /// Whether the account has a local password set (vs. OAuth-only). Only
  /// meaningful on the self response (`GET /api/users/me`). Drives the
  /// Password & Security screen: set-first-password vs. change-password.
  final bool hasPassword;

  /// `true` only for an account created by accepting an invitation with
  /// "Continue with Google": the member must create a PON password before
  /// using the app (router gate → `/set-password`). Cleared server-side by a
  /// successful `POST /api/users/me/change-password` or password reset. Sent on
  /// `/api/users/me` and the login / exchange / accept-password `user` payloads.
  final bool mustSetPassword;

  /// Two-factor authentication (contract 15). Only on the self response
  /// (`GET /api/users/me`); all default to `false`.
  /// - [mfaRequired]: the role makes 2FA mandatory (Owner, Admin or a role
  ///   that manages the workspace / members / roles) — it can't be turned off.
  /// - [mfaAvailable]: the member may use / turn on 2FA at all; `false` for a
  ///   member covered by an enforced SSO policy (their IdP does MFA) and bots.
  ///   Available but not required = optional: the member turns it on and off
  ///   in Settings → Security, and once on every password / Google sign-in
  ///   asks for a code.
  /// - [mfaEnabled]: enrollment is done.
  final bool mfaEnabled;
  final bool mfaRequired;
  final bool mfaAvailable;

  /// Workspace role name (Owner/Admin/Member or custom). `null` = the
  /// user has no assigned role → UI renders the default "Member". Always public
  /// (no privacy gate); omitted on blocked-by-owner minimal profiles.
  final String? roleName;

  /// How a user-search result was matched: `'phone'` | `'name_email'`. Only
  /// present on `/api/users/search` results matched by exact phone number;
  /// drives the highlighted phone badge in friend search. Null otherwise.
  final String? matchedBy;

  /// When `true`, the profile owner has blocked the current viewer. The server
  /// returns only minimal info (name, avatar, email) and hides bio, friend
  /// count, and action buttons. See auth-service `GET /api/users/:id`.
  final bool isBlockedByOwner;

  const UserModel({
    required this.id,
    required this.email,
    required this.displayName,
    this.avatarUrl,
    this.bio,
    this.coverPhoto,
    this.friendsCount,
    this.dateOfBirth,
    this.phoneNumber,
    this.phoneVerified = false,
    this.gender,
    this.hideInfo = false,
    this.showDateOfBirth,
    this.showPhoneNumber,
    this.showGender,
    this.hasPassword = false,
    this.mustSetPassword = false,
    this.mfaEnabled = false,
    this.mfaRequired = false,
    this.mfaAvailable = false,
    this.roleName,
    this.matchedBy,
    this.isBlockedByOwner = false,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    final mfaEnabled = json['mfaEnabled'] as bool? ?? false;
    final mfaRequired = json['mfaRequired'] as bool? ?? false;
    return UserModel(
      id: json['_id'] as String? ?? json['id'] as String,
      email: json['email'] as String? ?? '',
      displayName:
          json['displayName'] as String? ?? json['email'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String?,
      bio: json['bio'] as String?,
      coverPhoto: json['coverPhoto'] as String?,
      friendsCount: (json['friendsCount'] as num?)?.toInt(),
      dateOfBirth: json['dateOfBirth'] != null
          ? DateTime.tryParse(json['dateOfBirth'] as String)
          : null,
      phoneNumber: json['phoneNumber'] as String?,
      phoneVerified: json['phoneVerified'] as bool? ?? false,
      gender: json['gender'] as String?,
      hideInfo: json['hideInfo'] as bool? ?? false,
      showDateOfBirth: json['showDateOfBirth'] as bool?,
      showPhoneNumber: json['showPhoneNumber'] as bool?,
      showGender: json['showGender'] as bool?,
      hasPassword: json['hasPassword'] as bool? ?? false,
      mustSetPassword: json['mustSetPassword'] as bool? ?? false,
      mfaEnabled: mfaEnabled,
      mfaRequired: mfaRequired,
      // A session cached before contract 15 (or an older server) has no
      // `mfaAvailable`: whoever is required or enrolled can clearly use 2FA.
      // The Security screen re-syncs `/me` anyway.
      mfaAvailable:
          json['mfaAvailable'] as bool? ?? (mfaRequired || mfaEnabled),
      roleName: json['roleName'] as String?,
      matchedBy: json['matchedBy'] as String?,
      isBlockedByOwner: json['isBlockedByOwner'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'displayName': displayName,
        if (avatarUrl != null) 'avatarUrl': avatarUrl,
        if (bio != null) 'bio': bio,
        if (coverPhoto != null) 'coverPhoto': coverPhoto,
        if (friendsCount != null) 'friendsCount': friendsCount,
        if (dateOfBirth != null) 'dateOfBirth': dateOfBirth!.toIso8601String(),
        if (phoneNumber != null) 'phoneNumber': phoneNumber,
        'phoneVerified': phoneVerified,
        if (gender != null) 'gender': gender,
        'hideInfo': hideInfo,
        if (showDateOfBirth != null) 'showDateOfBirth': showDateOfBirth,
        if (showPhoneNumber != null) 'showPhoneNumber': showPhoneNumber,
        if (showGender != null) 'showGender': showGender,
        'hasPassword': hasPassword,
        'mustSetPassword': mustSetPassword,
        'mfaEnabled': mfaEnabled,
        'mfaRequired': mfaRequired,
        'mfaAvailable': mfaAvailable,
        if (roleName != null) 'roleName': roleName,
      };

  /// Copy of this user after a password was created: it now has one and is no
  /// longer gated. Used when the follow-up `/me` refresh fails although the
  /// server already accepted the password (see `AuthNotifier.setInitialPassword`).
  UserModel withPasswordSet() =>
      _copyWith(hasPassword: true, mustSetPassword: false);

  /// Copy of this user after they turned their own 2FA on / off in Settings →
  /// Security, for when the follow-up `/me` refresh fails although the server
  /// already made the change (see `AuthNotifier.resyncMfa`).
  UserModel withMfaEnabled(bool enabled) => _copyWith(mfaEnabled: enabled);

  UserModel _copyWith({
    bool? hasPassword,
    bool? mustSetPassword,
    bool? mfaEnabled,
  }) =>
      UserModel(
        id: id,
        email: email,
        displayName: displayName,
        avatarUrl: avatarUrl,
        bio: bio,
        coverPhoto: coverPhoto,
        friendsCount: friendsCount,
        dateOfBirth: dateOfBirth,
        phoneNumber: phoneNumber,
        phoneVerified: phoneVerified,
        gender: gender,
        hideInfo: hideInfo,
        showDateOfBirth: showDateOfBirth,
        showPhoneNumber: showPhoneNumber,
        showGender: showGender,
        hasPassword: hasPassword ?? this.hasPassword,
        mustSetPassword: mustSetPassword ?? this.mustSetPassword,
        mfaEnabled: mfaEnabled ?? this.mfaEnabled,
        mfaRequired: mfaRequired,
        mfaAvailable: mfaAvailable,
        roleName: roleName,
        matchedBy: matchedBy,
        isBlockedByOwner: isBlockedByOwner,
      );

  /// Effective per-field visibility for "view as another user" gating.
  /// Falls back to `!hideInfo` when the flag is absent (legacy docs).
  bool get effectiveShowDateOfBirth => showDateOfBirth ?? !hideInfo;
  bool get effectiveShowPhoneNumber => showPhoneNumber ?? !hideInfo;
  bool get effectiveShowGender => showGender ?? !hideInfo;
}

sealed class AuthState {
  const AuthState();
}

class AuthLoading extends AuthState {
  const AuthLoading();
}

class AuthAuthenticated extends AuthState {
  final UserModel user;
  const AuthAuthenticated(this.user);
}

/// Forced-logout reasons the login screen explains (allow-list — anything else
/// is a plain logout with no message, so raw server codes never reach the UI).
/// Mirror of web `LOGOUT_REASONS` (`lib/auth/force-logout.ts`).
///
/// `SSO_REQUIRED` (contract 13 §C): "Require SSO" was switched on for the
/// member's email domain and their non-SSO session was revoked — or a password
/// sign-in / Google redirect was refused for the same reason.
const kLogoutReasons = {'ACCOUNT_BLOCKED', kSsoRequired};

/// The member's email domain must sign in with the company IdP (contract 13).
const kSsoRequired = 'SSO_REQUIRED';

/// Codes the login screen may show as a persistent notice: the forced-logout
/// reasons plus every code a Google / SSO error deep link
/// (`platform://auth?error=CODE`) can carry. Mirror of web `LOGIN_NOTICES`.
const kLoginNotices = {
  ...kLogoutReasons,
  'ACCOUNT_NOT_PROVISIONED',
  'INVITATION_PENDING',
  'INVITATION_INVALID',
  'INVITATION_EXPIRED',
  'INVITATION_REVOKED',
  'INVITATION_ALREADY_ACCEPTED',
  'INVITATION_EMAIL_MISMATCH',
  'MEMBER_ALREADY_EXISTS',
  'SOCIAL_EMAIL_UNAVAILABLE',
  'SSO_DISABLED',
  'SSO_DOMAIN_NOT_ALLOWED',
  // "Sign in with SSO" while the company IdP is unreachable (auth-service 503).
  'SSO_UNAVAILABLE',
  'GENERIC_ERROR',
  // An MFA challenge that can't continue (expired / burned / wrong step).
  ...kMfaRestartCodes,
};

class AuthUnauthenticated extends AuthState {
  /// Why the session ended when it was not the user's choice (e.g.
  /// `ACCOUNT_BLOCKED`); `null` for a normal logout / fresh start.
  final String? reason;
  const AuthUnauthenticated({this.reason});
}

/// Credentials accepted, second factor pending (contract 09): no session or
/// tokens exist yet. The router allows only `/mfa` in this state.
class AuthMfaPending extends AuthState {
  final MfaChallenge challenge;
  const AuthMfaPending(this.challenge);
}

/// 2FA enrollment was just confirmed (the account is now enrolled) but NO
/// session exists yet (contract 11): the one-time backup codes must be
/// acknowledged ("I saved them") before `enroll/complete` issues the tokens.
/// The router keeps the member on `/mfa`. Lives only in memory: if the app is
/// killed here nothing is stored, and the next sign-in is a verify step.
class AuthMfaBackupCodes extends AuthState {
  /// The same pending challenge; its `mfaToken` completes the sign-in.
  final MfaChallenge challenge;
  final List<String> backupCodes;
  const AuthMfaBackupCodes(this.challenge, this.backupCodes);
}
