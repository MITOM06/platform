import 'package:flutter/foundation.dart';

/// Public invitation preview — `GET /auth/invitations/:token` (API contract
/// §1.3). Never contains the token itself or any internal id.
@immutable
class InvitationPreview {
  final String email;
  final String workspaceName;
  final String inviterName;

  /// `null` when the invited role was deleted — render the role-less subtitle.
  final String? roleName;
  final DateTime? expiresAt;

  const InvitationPreview({
    required this.email,
    required this.workspaceName,
    required this.inviterName,
    this.roleName,
    this.expiresAt,
  });

  factory InvitationPreview.fromJson(Map<String, dynamic> json) =>
      InvitationPreview(
        email: json['email'] as String? ?? '',
        workspaceName: json['workspaceName'] as String? ?? '',
        inviterName: json['inviterName'] as String? ?? '',
        roleName: _nonEmpty(json['roleName']),
        expiresAt: DateTime.tryParse(json['expiresAt'] as String? ?? ''),
      );
}

String? _nonEmpty(Object? v) => v is String && v.trim().isNotEmpty ? v : null;

/// Invitation tokens are 32 random bytes in base64url (43 chars). Accept any
/// base64url string of a plausible length so a future token size change does
/// not break the client, while rejecting obvious garbage / path injection.
final RegExp _inviteTokenPattern = RegExp(r'^[A-Za-z0-9_-]{20,128}$');

bool isValidInviteToken(String token) => _inviteTokenPattern.hasMatch(token);

/// Extracts an invitation token from user input: a full invite URL
/// (`https://host/invite/<token>`), an app deep link
/// (`platform://invite?token=<token>`), or the bare token. Returns `null` when
/// nothing token-shaped is found.
String? extractInviteToken(String input) {
  final raw = input.trim();
  if (raw.isEmpty) return null;
  if (isValidInviteToken(raw)) return raw;
  final uri = Uri.tryParse(raw);
  if (uri == null) return null;
  final queryToken = uri.queryParameters['token'];
  if (queryToken != null && isValidInviteToken(queryToken)) return queryToken;
  final segments = uri.pathSegments.where((s) => s.isNotEmpty).toList();
  final idx = segments.lastIndexOf('invite');
  if (idx != -1 && idx + 1 < segments.length) {
    final candidate = segments[idx + 1];
    if (isValidInviteToken(candidate)) return candidate;
  }
  return null;
}
