import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/admin_repository.dart';
import '../data/models/admin_models.dart';
import 'capabilities_provider.dart';

/// Admin resource notifiers (workspace, departments, members, roles). Each loads
/// on build and exposes mutations that refresh on success. Mirrors the web
/// `use-admin` query/mutation hooks. Errors surface via AsyncValue so screens
/// render them with `.when(error: …)`.

// ── workspace ─────────────────────────────────────────────────────────────────
class WorkspaceNotifier extends AsyncNotifier<Workspace> {
  @override
  Future<Workspace> build() => ref.read(adminRepositoryProvider).getWorkspace();

  Future<void> save(Map<String, dynamic> patch) async {
    final updated =
        await ref.read(adminRepositoryProvider).updateWorkspace(patch);
    state = AsyncData(updated);
    // Workspace name/features feed capability gating — refresh it too.
    ref.invalidate(capabilitiesProvider);
  }
}

final workspaceProvider =
    AsyncNotifierProvider<WorkspaceNotifier, Workspace>(WorkspaceNotifier.new);

// ── departments ───────────────────────────────────────────────────────────────
class DepartmentsNotifier extends AsyncNotifier<List<Department>> {
  @override
  Future<List<Department>> build() =>
      ref.read(adminRepositoryProvider).listDepartments();

  Future<void> _reload() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(adminRepositoryProvider).listDepartments(),
    );
  }

  Future<void> create(Map<String, dynamic> body) async {
    await ref.read(adminRepositoryProvider).createDepartment(body);
    await _reload();
  }

  Future<void> edit(String id, Map<String, dynamic> body) async {
    await ref.read(adminRepositoryProvider).updateDepartment(id, body);
    await _reload();
  }

  Future<void> remove(String id) async {
    await ref.read(adminRepositoryProvider).deleteDepartment(id);
    await _reload();
  }
}

final departmentsProvider =
    AsyncNotifierProvider<DepartmentsNotifier, List<Department>>(
  DepartmentsNotifier.new,
);

// ── members ───────────────────────────────────────────────────────────────────
class MembersNotifier extends AsyncNotifier<List<Member>> {
  @override
  Future<List<Member>> build() =>
      ref.read(adminRepositoryProvider).listMembers();

  Future<void> updateMember(String id, Map<String, dynamic> body) async {
    await ref.read(adminRepositoryProvider).updateMember(id, body);
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(adminRepositoryProvider).listMembers(),
    );
  }
}

final membersProvider =
    AsyncNotifierProvider<MembersNotifier, List<Member>>(MembersNotifier.new);

// ── roles ─────────────────────────────────────────────────────────────────────
class RolesNotifier extends AsyncNotifier<List<Role>> {
  @override
  Future<List<Role>> build() => ref.read(adminRepositoryProvider).listRoles();

  Future<void> _reload() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(adminRepositoryProvider).listRoles(),
    );
  }

  Future<void> create(Map<String, dynamic> body) async {
    await ref.read(adminRepositoryProvider).createRole(body);
    await _reload();
  }

  Future<void> edit(String id, Map<String, dynamic> body) async {
    await ref.read(adminRepositoryProvider).updateRole(id, body);
    await _reload();
  }
}

final rolesProvider =
    AsyncNotifierProvider<RolesNotifier, List<Role>>(RolesNotifier.new);

// ── audit ─────────────────────────────────────────────────────────────────────
/// Paginated audit trail, keyed by page (20 per page). Mirrors the web
/// `useAuditLog` hook.
final auditLogProvider =
    FutureProvider.family<AuditListResult, int>((ref, page) {
  return ref.read(adminRepositoryProvider).listAudit(page: page, limit: 20);
});
