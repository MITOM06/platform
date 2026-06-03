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
  final String? gender;
  final bool hideInfo;

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
    this.gender,
    this.hideInfo = false,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['_id'] as String? ?? json['id'] as String,
      email: json['email'] as String? ?? '',
      displayName: json['displayName'] as String,
      avatarUrl: json['avatarUrl'] as String?,
      bio: json['bio'] as String?,
      coverPhoto: json['coverPhoto'] as String?,
      friendsCount: (json['friendsCount'] as num?)?.toInt(),
      dateOfBirth: json['dateOfBirth'] != null
          ? DateTime.tryParse(json['dateOfBirth'] as String)
          : null,
      phoneNumber: json['phoneNumber'] as String?,
      gender: json['gender'] as String?,
      hideInfo: json['hideInfo'] as bool? ?? false,
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
        if (gender != null) 'gender': gender,
        'hideInfo': hideInfo,
      };
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
