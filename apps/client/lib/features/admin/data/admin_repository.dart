import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/api/dio_client.dart';
import '../../auth/domain/auth_provider.dart';
import 'models/admin_models.dart';
import 'models/invitation_models.dart';

/// Talks to the auth-service (:3001) admin + capability endpoints over
/// [authDio]. Identity comes from the JWT; the backend authorizes each route by
/// the token's `perms` claim. Mirrors the web `adminService`.
class AdminRepository {
  final Dio _dio;

  const AdminRepository(this._dio);

  // ── caller capabilities ─────────────────────────────────────────────────
  Future<MeCapabilities> capabilities() async {
    final res = await _dio.get('/me/capabilities');
    return MeCapabilities.fromJson(res.data as Map<String, dynamic>);
  }

  // ── workspace ───────────────────────────────────────────────────────────
  Future<Workspace> getWorkspace() async {
    final res = await _dio.get('/admin/workspace');
    return Workspace.fromJson(res.data as Map<String, dynamic>);
  }

  Future<Workspace> updateWorkspace(Map<String, dynamic> patch) async {
    final res = await _dio.patch('/admin/workspace', data: patch);
    return Workspace.fromJson(res.data as Map<String, dynamic>);
  }

  // ── departments ─────────────────────────────────────────────────────────
  Future<List<Department>> listDepartments() async {
    final res = await _dio.get('/admin/departments');
    return (res.data as List<dynamic>)
        .map((e) => Department.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> createDepartment(Map<String, dynamic> body) async {
    await _dio.post('/admin/departments', data: body);
  }

  Future<void> updateDepartment(String id, Map<String, dynamic> body) async {
    await _dio.patch('/admin/departments/$id', data: body);
  }

  Future<void> deleteDepartment(String id) async {
    await _dio.delete('/admin/departments/$id');
  }

  // ── members ─────────────────────────────────────────────────────────────
  Future<List<Member>> listMembers() async {
    final res = await _dio.get('/admin/members');
    return (res.data as List<dynamic>)
        .map((e) => Member.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> updateMember(String id, Map<String, dynamic> body) async {
    await _dio.patch('/admin/members/$id', data: body);
  }

  /// Block (`blocked`) or unblock (`active`) a member. Blocking revokes all of
  /// the member's sessions server-side.
  Future<Member> setMemberStatus(String id, String status) async {
    final res =
        await _dio.patch('/admin/members/$id/status', data: {'status': status});
    return Member.fromJson(res.data as Map<String, dynamic>);
  }

  /// Owner-only: clears [id]'s 2FA enrollment + backup codes and revokes
  /// their sessions; they re-enroll at next sign-in (contract 09). Errors:
  /// `MFA_RESET_FORBIDDEN`, `MFA_RESET_SELF_FORBIDDEN`, `MEMBER_NOT_FOUND`.
  Future<void> resetMemberMfa(String id) async {
    await _dio.post('/admin/members/$id/mfa/reset');
  }

  // ── invitations ─────────────────────────────────────────────────────────
  /// No [status] → the actionable ones (pending + expired).
  Future<List<Invitation>> listInvitations({String? status}) async {
    final res = await _dio.get(
      '/admin/invitations',
      queryParameters: {if (status != null) 'status': status},
    );
    return (res.data as List<dynamic>)
        .map((e) => Invitation.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// [locale] is the invitation email's language (the admin's app locale).
  Future<InvitationMutationResult> createInvitation({
    required String email,
    String? roleId,
    List<String> departmentIds = const [],
    String? locale,
  }) async {
    final res = await _dio.post('/admin/invitations', data: {
      'email': email,
      if (roleId != null) 'roleId': roleId,
      if (departmentIds.isNotEmpty) 'departmentIds': departmentIds,
      if (locale != null) 'locale': locale,
    });
    return InvitationMutationResult.fromJson(res.data as Map<String, dynamic>);
  }

  Future<InvitationMutationResult> resendInvitation(String id) async {
    final res = await _dio.post('/admin/invitations/$id/resend');
    return InvitationMutationResult.fromJson(res.data as Map<String, dynamic>);
  }

  Future<void> revokeInvitation(String id) async {
    await _dio.delete('/admin/invitations/$id');
  }

  // ── roles ───────────────────────────────────────────────────────────────
  Future<List<Role>> listRoles() async {
    final res = await _dio.get('/admin/roles');
    return (res.data as List<dynamic>)
        .map((e) => Role.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> createRole(Map<String, dynamic> body) async {
    await _dio.post('/admin/roles', data: body);
  }

  Future<void> updateRole(String id, Map<String, dynamic> body) async {
    await _dio.patch('/admin/roles/$id', data: body);
  }

  // ── audit ─────────────────────────────────────────────────────────────────
  Future<AuditListResult> listAudit({int page = 0, int limit = 20}) async {
    final res = await _dio.get(
      '/admin/audit',
      queryParameters: {'page': page, 'limit': limit},
    );
    return AuditListResult.fromJson(res.data as Map<String, dynamic>);
  }
}

final adminRepositoryProvider = Provider<AdminRepository>((ref) {
  const storage = FlutterSecureStorage();
  return AdminRepository(
    DioClient.createAuthDio(
      storage,
      onForceLogout: () =>
          ref.read(authNotifierProvider.notifier).forceLogout(),
    ),
  );
});
