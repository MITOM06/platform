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

  /// How a user-search result was matched: `'phone'` | `'name_email'`. Only
  /// present on `/api/users/search` results matched by exact phone number;
  /// drives the highlighted phone badge in friend search. Null otherwise.
  final String? matchedBy;

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
    this.matchedBy,
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
      matchedBy: json['matchedBy'] as String?,
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

class AuthUnauthenticated extends AuthState {
  const AuthUnauthenticated();
}
