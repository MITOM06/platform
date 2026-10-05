import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/app_error.dart';
import '../../../core/utils/global_messenger.dart';
import '../data/models/connector_models.dart';
import '../utils/connector_error.dart';
import 'integrations_provider.dart';

/// A connector OAuth flow handed to the system browser.
@immutable
class OAuthFlow {
  /// Catalog id or directory slug.
  final String slug;

  /// Display name for the result message.
  final String name;
  final DateTime startedAt;

  const OAuthFlow({
    required this.slug,
    required this.name,
    required this.startedAt,
  });
}

/// How a flow ended, from what the app can observe.
enum OAuthReturnKind { connected, failed, notCompleted }

/// Result of a flow once the user is back in the app. Pure so it can be tested:
/// [connectedSlug] / [errorCode] come from a `platform://integrations` deep
/// link when there is one, else only the refreshed connections are known.
OAuthReturnKind oauthReturnKind({
  required String slug,
  required List<ConnectionView> connections,
  String? connectedSlug,
  String? errorCode,
}) {
  if (errorCode != null && errorCode.isNotEmpty) return OAuthReturnKind.failed;
  if (connectedSlug == slug) return OAuthReturnKind.connected;
  final active = connections.any((c) => c.provider == slug && c.isActive);
  return active ? OAuthReturnKind.connected : OAuthReturnKind.notCompleted;
}

/// Tracks the connector OAuth flow in progress and reports its result.
///
/// The connector-service callback redirects to the WEB `/integrations` page
/// (`?connected=<slug>` / `?error=<CODE>&provider=<slug>`), so a native app
/// usually gets no callback: when the app resumes it re-fetches the
/// connections and tells the user whether the connector is now connected. A
/// `platform://integrations?...` deep link (if the deployment redirects there)
/// carries the exact result and wins over the resume check.
class OAuthFlowNotifier extends Notifier<OAuthFlow?> {
  /// Flows older than this are not reported (the user moved on).
  static const _staleAfter = Duration(minutes: 15);

  /// Lets a deep link that arrives with the resume settle the flow first.
  static const _deepLinkGrace = Duration(milliseconds: 800);

  @override
  OAuthFlow? build() => null;

  void begin(String slug, String name) {
    state = OAuthFlow(slug: slug, name: name, startedAt: DateTime.now());
  }

  void clear() => state = null;

  /// App came back to the foreground.
  Future<void> onResume() async {
    final flow = state;
    if (flow == null) return;
    await Future<void>.delayed(_deepLinkGrace);
    if (state != flow) return; // settled by a deep link meanwhile
    state = null;
    final connections = await _refreshConnections();
    if (DateTime.now().difference(flow.startedAt) > _staleAfter) return;
    _report(
      flow.name,
      oauthReturnKind(slug: flow.slug, connections: connections),
      null,
    );
  }

  /// `platform://integrations?connected=<slug>` or `?error=<CODE>&provider=`.
  Future<void> onDeepLink(Uri uri) async {
    final flow = state;
    state = null;
    final params = uri.queryParameters;
    final slug = params['connected'] ?? params['provider'] ?? flow?.slug ?? '';
    final error = params['error'];
    final connections = await _refreshConnections();
    final names = ref.read(connectorNamesProvider);
    final name = names[slug] ??
        (flow?.slug == slug ? flow?.name : null) ??
        appL10n().connectorGenericName;
    _report(
      name,
      oauthReturnKind(
        slug: slug,
        connections: connections,
        connectedSlug: params['connected'],
        errorCode: error,
      ),
      error,
    );
  }

  Future<List<ConnectionView>> _refreshConnections() async {
    ref.invalidate(connectorCatalogProvider);
    ref.invalidate(directoryEntriesProvider);
    await ref.read(connectionsProvider.notifier).refresh();
    return ref.read(connectionsProvider).valueOrNull ?? const [];
  }

  void _report(String name, OAuthReturnKind kind, String? errorCode) {
    final l10n = appL10n();
    switch (kind) {
      case OAuthReturnKind.connected:
        showInfoSnackBar(l10n.oauthConnected(name));
      case OAuthReturnKind.failed:
        showErrorSnackBar(
            oauthCallbackErrorMessage(l10n, errorCode ?? '', name));
      case OAuthReturnKind.notCompleted:
        showInfoSnackBar(l10n.oauthNotCompleted(name));
    }
  }
}

final oauthFlowProvider = NotifierProvider<OAuthFlowNotifier, OAuthFlow?>(
  OAuthFlowNotifier.new,
);
