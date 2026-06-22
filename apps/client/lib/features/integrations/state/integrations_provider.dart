import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../data/connector_repository.dart';
import '../data/models/connector_models.dart';

/// Resolves the current authenticated user's id, or throws if unauthenticated.
String _requireUserId(Ref ref) {
  final auth = ref.read(authNotifierProvider).valueOrNull;
  if (auth is AuthAuthenticated) return auth.user.id;
  throw StateError('not-authenticated');
}

/// Loads the connector catalog and merges in this user's connections so the UI
/// can render each catalog entry with its live status. Provides connect /
/// disconnect / custom-MCP actions that refresh the merged list.
class IntegrationsNotifier extends AsyncNotifier<List<ConnectorItem>> {
  @override
  Future<List<ConnectorItem>> build() => _load();

  Future<List<ConnectorItem>> _load() async {
    final repo = ref.read(connectorRepositoryProvider);
    _requireUserId(ref); // fail fast if unauthenticated; identity comes from JWT
    final results = await Future.wait([
      repo.catalog(),
      repo.connections(),
    ]);
    final catalog = results[0] as List<CatalogEntry>;
    final connections = results[1] as List<ConnectionView>;

    final byProvider = <String, ConnectionView>{
      for (final c in connections) c.provider: c,
    };

    return [
      for (final entry in catalog)
        ConnectorItem(entry: entry, connection: byProvider[entry.id]),
    ];
  }

  /// Re-fetch catalog + connections (e.g. after returning from the OAuth flow).
  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(_load);
  }

  /// Returns the authorize URL to open in the browser for [provider].
  Future<String> startOAuth(String provider) {
    final repo = ref.read(connectorRepositoryProvider);
    _requireUserId(ref); // fail fast if unauthenticated; identity comes from JWT
    return repo.startOAuth(provider);
  }

  Future<void> disconnect(String connectionId) async {
    await ref.read(connectorRepositoryProvider).disconnect(connectionId);
    await refresh();
  }

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
    await refresh();
  }
}

final integrationsProvider =
    AsyncNotifierProvider<IntegrationsNotifier, List<ConnectorItem>>(
  IntegrationsNotifier.new,
);

/// Loads the dynamic MCP directory and merges in this user's connections so each
/// entry renders with live status. Provides connect (OAuth / apikey / none),
/// disconnect, and admin CRUD — all refresh the merged list. Mirrors the web
/// `useDirectory` hook + `DirectorySection`.
class DirectoryNotifier extends AsyncNotifier<List<DirectoryItem>> {
  @override
  Future<List<DirectoryItem>> build() => _load();

  Future<List<DirectoryItem>> _load() async {
    final repo = ref.read(connectorRepositoryProvider);
    _requireUserId(ref); // fail fast if unauthenticated; identity comes from JWT
    final results = await Future.wait([
      repo.directory(),
      repo.connections(),
    ]);
    final directory = results[0] as List<DirectoryEntry>;
    final connections = results[1] as List<ConnectionView>;

    final byProvider = <String, ConnectionView>{
      for (final c in connections) c.provider: c,
    };

    return [
      for (final entry in directory)
        DirectoryItem(entry: entry, connection: byProvider[entry.slug]),
    ];
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(_load);
  }

  /// Begin a directory connect; the caller branches on [DirectoryStartResult].
  Future<DirectoryStartResult> startOAuth(String slug) {
    final repo = ref.read(connectorRepositoryProvider);
    _requireUserId(ref);
    return repo.startDirectoryOAuth(slug);
  }

  Future<void> connectKey(String slug, String credential) async {
    await ref
        .read(connectorRepositoryProvider)
        .connectDirectoryKey(slug, credential);
    await refresh();
  }

  Future<void> disconnect(String connectionId) async {
    await ref.read(connectorRepositoryProvider).disconnect(connectionId);
    await refresh();
  }

  Future<void> createEntry(Map<String, dynamic> body) async {
    await ref.read(connectorRepositoryProvider).createDirectoryEntry(body);
    await refresh();
  }

  Future<void> updateEntry(String id, Map<String, dynamic> body) async {
    await ref.read(connectorRepositoryProvider).updateDirectoryEntry(id, body);
    await refresh();
  }

  Future<void> deleteEntry(String id) async {
    await ref.read(connectorRepositoryProvider).deleteDirectoryEntry(id);
    await refresh();
  }
}

final directoryProvider =
    AsyncNotifierProvider<DirectoryNotifier, List<DirectoryItem>>(
  DirectoryNotifier.new,
);
