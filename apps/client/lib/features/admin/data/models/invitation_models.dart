import 'package:flutter/foundation.dart';

/// `GET /admin/invitations` item (`InvitationView`, API contract §1.1). Never
/// carries the token — the raw link only ever exists in the invitation email.
@immutable
class Invitation {
  final String id;
  final String email;
  final String roleId;

  /// Resolved role name; `null` if the role was deleted.
  final String? roleName;
  final List<String> departmentIds;
  final String invitedById;

  /// Inviter display name (workspace name for system/bootstrap invites).
  final String invitedByName;

  /// `pending` | `expired` | `accepted` | `revoked` (`expired` is derived
  /// server-side).
  final String status;
  final DateTime? expiresAt;
  final DateTime? createdAt;
  final DateTime? lastSentAt;
  final int sendCount;

  const Invitation({
    required this.id,
    required this.email,
    required this.roleId,
    this.roleName,
    required this.departmentIds,
    required this.invitedById,
    required this.invitedByName,
    required this.status,
    this.expiresAt,
    this.createdAt,
    this.lastSentAt,
    this.sendCount = 1,
  });

  bool get isExpired => status == 'expired';
  bool get isPending => status == 'pending';

  factory Invitation.fromJson(Map<String, dynamic> json) {
    final invitedBy = json['invitedBy'] as Map<String, dynamic>? ?? const {};
    return Invitation(
      id: json['_id'] as String? ?? json['id'] as String? ?? '',
      email: json['email'] as String? ?? '',
      roleId: json['roleId']?.toString() ?? '',
      roleName: json['roleName'] as String?,
      departmentIds: (json['departmentIds'] as List<dynamic>? ?? const [])
          .map((e) => e.toString())
          .toList(),
      invitedById: invitedBy['id']?.toString() ?? '',
      invitedByName: invitedBy['displayName'] as String? ?? '',
      status: json['status'] as String? ?? 'pending',
      expiresAt: _date(json['expiresAt']),
      createdAt: _date(json['createdAt']),
      lastSentAt: _date(json['lastSentAt']),
      sendCount: (json['sendCount'] as num?)?.toInt() ?? 1,
    );
  }
}

/// Body of `POST /admin/invitations` and `POST /admin/invitations/:id/resend`.
@immutable
class InvitationMutationResult {
  final Invitation invitation;

  /// `false` when the invitation was stored but the email failed to send —
  /// the UI warns the admin to fix mail settings and resend.
  final bool emailSent;

  const InvitationMutationResult({
    required this.invitation,
    required this.emailSent,
  });

  factory InvitationMutationResult.fromJson(Map<String, dynamic> json) =>
      InvitationMutationResult(
        invitation: Invitation.fromJson(
            json['invitation'] as Map<String, dynamic>? ?? const {}),
        emailSent: json['emailSent'] as bool? ?? false,
      );
}

DateTime? _date(dynamic raw) =>
    raw is String ? DateTime.tryParse(raw)?.toLocal() : null;
