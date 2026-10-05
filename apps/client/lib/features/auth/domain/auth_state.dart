import 'package:flutter/foundation.dart';

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

  /// Workspace role name (Owner/Admin/Manager/Member or custom). `null` = the
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
    this.roleName,
    this.matchedBy,
    this.isBlockedByOwner = false,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
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
        if (roleName != null) 'roleName': roleName,
      };

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
const kLogoutReasons = {'ACCOUNT_BLOCKED'};

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
  'SSO_EMAIL_UNVERIFIED',
  'SOCIAL_ACCOUNT_CONFLICT',
  'GENERIC_ERROR',
};

class AuthUnauthenticated extends AuthState {
  /// Why the session ended when it was not the user's choice (e.g.
  /// `ACCOUNT_BLOCKED`); `null` for a normal logout / fresh start.
  final String? reason;
  const AuthUnauthenticated({this.reason});
}
