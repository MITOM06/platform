import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../data/connector_repository.dart';
import '../data/models/connector_models.dart';
import '../data/models/custom_mcp_models.dart';

/// Resolves the current authenticated user's id, or throws if unauthenticated.
String _requireUserId(Ref ref) {
  final auth = ref.read(authNotifierProvider).valueOrNull;
  if (auth is AuthAuthenticated) return auth.user.id;
  throw StateError('not-authenticated');
}

// ── Shared sources ──────────────────────────────────────────────────────────

/// The caller's connections (`GET /connections`: their own personal ones plus
/// every workspace one) — the SINGLE source both the catalog cards and the
/// directory cards derive their status from, so the two can never disagree.
class ConnectionsNotifier extends AsyncNotifier<List<ConnectionView>> {
  @override
  Future<List<ConnectionView>> build() {
    _requireUserId(ref); // identity comes from the JWT
    return ref.read(connectorRepositoryProvider).connections();
  }

  /// Re-fetch without flashing a spinner (keeps the previous list visible).
  Future<void> refresh() async {
    state = await AsyncValue.guard(
      () => ref.read(connectorRepositoryProvider).connections(),
    );
  }

  /// `DELETE /connections/:id`. Errors propagate (403 INSUFFICIENT_PERMISSION
  /// for a workspace connection without CONNECT_WORKSPACE_CONNECTOR).
  Future<void> disconnect(String connectionId) async {
    await ref.read(connectorRepositoryProvider).disconnect(connectionId);
    await refresh();
  }

  Future<void> updatePermissions(
    String connectionId,
    List<String> actionGroups,
  ) async {
    await ref
        .read(connectorRepositoryProvider)
        .updateConnectionPermissions(connectionId, actionGroups);
    await refresh();
  }
}

final connectionsProvider =
    AsyncNotifierProvider<ConnectionsNotifier, List<ConnectionView>>(
  ConnectionsNotifier.new,
);

/// Built-in connector catalog (`GET /catalog`) — shared by the integrations
/// screen and the admin allow-list editors.
final connectorCatalogProvider = FutureProvider<List<CatalogEntry>>((ref) {
  return ref.read(connectorRepositoryProvider).catalog();
});

/// Raw MCP directory entries (`GET /directory`).
final directoryEntriesProvider = FutureProvider<List<DirectoryEntry>>((ref) {
  return ref.read(connectorRepositoryProvider).directory();
});

/// Connector slug → display name, from whatever catalog / directory data is
/// already loaded. Used to label AI actions and audit rows without showing a
/// raw slug.
final connectorNamesProvider = Provider<Map<String, String>>((ref) {
  final catalog = ref.watch(connectorCatalogProvider).valueOrNull ?? const [];
  final directory =
      ref.watch(directoryEntriesProvider).valueOrNull ?? const [];
  return {
    for (final d in directory)
      if (d.name.isNotEmpty) d.slug: d.name,
    for (final c in catalog)
      if (c.name.isNotEmpty) c.id: c.name,
  };
});

/// The connection a card should reflect for [provider]: an active one over an
/// expired one, and the caller's personal one over the shared workspace one.
ConnectionView? pickConnection(
  List<ConnectionView> connections,
  String provider,
) {
  final mine = connections.where((c) => c.provider == provider).toList();
  if (mine.isEmpty) return null;
  int rank(ConnectionView c) =>
      (c.isActive ? 0 : (c.needsReconnect ? 2 : 4)) + (c.isWorkspace ? 1 : 0);
  mine.sort((a, b) => rank(a).compareTo(rank(b)));
  return mine.first;
}

// ── Catalog cards ───────────────────────────────────────────────────────────

/// Catalog entries merged with the caller's connections. Rebuilds whenever
/// [connectionsProvider] changes (render with `skipLoadingOnReload`).
class IntegrationsNotifier extends AsyncNotifier<List<ConnectorItem>> {
  @override
  Future<List<ConnectorItem>> build() async {
    final catalog = await ref.watch(connectorCatalogProvider.future);
    final connections = await ref.watch(connectionsProvider.future);
    return [
      for (final entry in catalog)
        ConnectorItem(
          entry: entry,
          connection: pickConnection(connections, entry.id),
        ),
    ];
  }

  /// Re-fetch catalog + connections (pull to refresh, after an OAuth return).
  Future<void> refresh() async {
    ref.invalidate(connectorCatalogProvider);
    await ref.read(connectionsProvider.notifier).refresh();
  }

  /// Returns the authorize URL to open in the browser for [provider].
  Future<String> startOAuth(String provider) {
    _requireUserId(ref);
    return ref.read(connectorRepositoryProvider).startOAuth(provider);
  }

  Future<void> disconnect(String connectionId) =>
      ref.read(connectionsProvider.notifier).disconnect(connectionId);

  Future<void> updatePermissions(
    String connectionId,
    List<String> actionGroups,
  ) =>
      ref
          .read(connectionsProvider.notifier)
          .updatePermissions(connectionId, actionGroups);

  Future<List<McpToolPreview>> discoverCustom({
    required String url,
    required ConnectorAuthType authType,
    String? credential,
  }) {
    return ref.read(connectorRepositoryProvider).discoverCustom(
          url: url,
          authType: authType,
          credential: credential,
        );
  }

  Future<void> saveCustom({
    required String name,
    required String url,
    required ConnectorAuthType authType,
    String? credential,
  }) async {
    await ref.read(connectorRepositoryProvider).saveCustom(
          name: name,
          url: url,
          authType: authType,
          credential: credential,
        );
    ref.invalidate(customMcpProvider);
  }
}

final integrationsProvider =
    AsyncNotifierProvider<IntegrationsNotifier, List<ConnectorItem>>(
  IntegrationsNotifier.new,
);

// ── Directory cards ─────────────────────────────────────────────────────────

/// Directory entries merged with the caller's connections (same source as the
/// catalog cards). Mirrors the web `useDirectory` hook + `DirectorySection`.
class DirectoryNotifier extends AsyncNotifier<List<DirectoryItem>> {
  @override
  Future<List<DirectoryItem>> build() async {
    _requireUserId(ref);
    final directory = await ref.watch(directoryEntriesProvider.future);
    final connections = await ref.watch(connectionsProvider.future);
    return [
      for (final entry in directory)
        DirectoryItem(
          entry: entry,
          connection: pickConnection(connections, entry.slug),
        ),
    ];
  }

  Future<void> refresh() async {
    ref.invalidate(directoryEntriesProvider);
    await ref.read(connectionsProvider.notifier).refresh();
  }

  /// Begin a directory connect; the caller branches on [DirectoryStartResult].
  Future<DirectoryStartResult> startOAuth(String slug) {
    _requireUserId(ref);
    return ref.read(connectorRepositoryProvider).startDirectoryOAuth(slug);
  }

  Future<void> connectKey(String slug, String credential) async {
    await ref
        .read(connectorRepositoryProvider)
        .connectDirectoryKey(slug, credential);
    await ref.read(connectionsProvider.notifier).refresh();
  }

  Future<void> disconnect(String connectionId) =>
      ref.read(connectionsProvider.notifier).disconnect(connectionId);

  Future<void> createEntry(Map<String, dynamic> body) async {
    await ref.read(connectorRepositoryProvider).createDirectoryEntry(body);
    ref.invalidate(directoryEntriesProvider);
  }

  Future<void> updateEntry(String id, Map<String, dynamic> body) async {
    await ref.read(connectorRepositoryProvider).updateDirectoryEntry(id, body);
    ref.invalidate(directoryEntriesProvider);
  }

  Future<void> deleteEntry(String id) async {
    await ref.read(connectorRepositoryProvider).deleteDirectoryEntry(id);
    ref.invalidate(directoryEntriesProvider);
  }
}

final directoryProvider =
    AsyncNotifierProvider<DirectoryNotifier, List<DirectoryItem>>(
  DirectoryNotifier.new,
);

// ── Custom MCP servers ──────────────────────────────────────────────────────

/// The caller's own custom MCP servers. Listing and deleting needs no
/// capability (a demoted member can still clean up); adding one needs
/// ADD_CUSTOM_MCP.
class CustomMcpNotifier extends AsyncNotifier<List<CustomMcpServer>> {
  @override
  Future<List<CustomMcpServer>> build() {
    _requireUserId(ref);
    return ref.read(connectorRepositoryProvider).listCustom();
  }

  Future<void> remove(String id) async {
    await ref.read(connectorRepositoryProvider).deleteCustom(id);
    final current = state.valueOrNull;
    state = AsyncData([
      for (final s in current ?? const <CustomMcpServer>[])
        if (s.id != id) s,
    ]);
  }
}

final customMcpProvider =
    AsyncNotifierProvider<CustomMcpNotifier, List<CustomMcpServer>>(
  CustomMcpNotifier.new,
);
