import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/api/dio_client.dart';
import '../../auth/domain/auth_provider.dart';

/// One active bridge session for a (user, bot) pair, as returned by
/// `GET /api/bot/sessions`. The token itself is NEVER returned here — only the
/// one-time issue response carries it.
class BotSessionSummary {
  final String botUserId;
  final DateTime? createdAt;
  final DateTime? lastUsedAt;

  const BotSessionSummary({
    required this.botUserId,
    this.createdAt,
    this.lastUsedAt,
  });

  factory BotSessionSummary.fromJson(Map<String, dynamic> json) {
    DateTime? parse(dynamic v) =>
        v is String && v.isNotEmpty ? DateTime.tryParse(v) : null;
    return BotSessionSummary(
      botUserId: json['botUserId'] as String? ?? '',
      createdAt: parse(json['createdAt']),
      lastUsedAt: parse(json['lastUsedAt']),
    );
  }
}

/// A one-time integration token + the MCP URL the external bot uses to reach
/// PON. Shown once in a dialog and never persisted client-side.
class IssuedToken {
  final String token;
  final String mcpUrl;

  const IssuedToken({required this.token, required this.mcpUrl});

  factory IssuedToken.fromJson(Map<String, dynamic> json) => IssuedToken(
        token: json['token'] as String? ?? '',
        mcpUrl: json['mcpUrl'] as String? ?? '',
      );
}

/// A registered external (Bot Factory) bot, mirrored from the chat-service
/// `GET /api/admin/external-bots` response.
class ExternalBot {
  final String id;
  final String botUserId;
  final String? factoryBotId;
  final String ownerUserId;
  final String name;
  final String? avatarUrl;
  final bool enabled;

  const ExternalBot({
    required this.id,
    required this.botUserId,
    this.factoryBotId,
    required this.ownerUserId,
    required this.name,
    this.avatarUrl,
    this.enabled = true,
  });

  factory ExternalBot.fromJson(Map<String, dynamic> json) => ExternalBot(
        id: json['id'] as String? ?? json['_id'] as String? ?? '',
        botUserId: json['botUserId'] as String? ?? '',
        factoryBotId: json['factoryBotId'] as String?,
        ownerUserId: json['ownerUserId'] as String? ?? '',
        name: json['name'] as String? ?? '',
        avatarUrl: json['avatarUrl'] as String?,
        enabled: json['enabled'] as bool? ?? true,
      );
}

/// Admin-side bot integration operations. Token ops live on the
/// connector-service (:3003); the registered-bot list lives on the chat-service
/// (:8080). Both Dio instances are admin-gated by `MANAGE_WORKSPACE` server
/// side. NEVER mix the two base URLs — they are distinct services.
class BotAdminRepository {
  final Dio _connectorDio;
  final Dio _chatDio;

  const BotAdminRepository(this._connectorDio, this._chatDio);

  /// `POST /api/bot/sessions` → one-time `{token, mcpUrl}`.
  Future<IssuedToken> issue(String userId, String botUserId) async {
    final res = await _connectorDio.post(
      '/api/bot/sessions',
      data: {'userId': userId, 'botUserId': botUserId},
    );
    return IssuedToken.fromJson(res.data as Map<String, dynamic>);
  }

  /// `DELETE /api/bot/sessions` → 204.
  Future<void> revoke(String userId, String botUserId) async {
    await _connectorDio.delete(
      '/api/bot/sessions',
      data: {'userId': userId, 'botUserId': botUserId},
    );
  }

  /// `GET /api/bot/sessions?userId=` → active sessions for the owner.
  Future<List<BotSessionSummary>> listSessions(String userId) async {
    final res = await _connectorDio.get(
      '/api/bot/sessions',
      queryParameters: {'userId': userId},
    );
    final data = res.data as Map<String, dynamic>;
    final sessions = data['sessions'] as List<dynamic>? ?? const [];
    return sessions
        .map((e) => BotSessionSummary.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// `GET /api/admin/external-bots` → workspace-wide registered bots.
  Future<List<ExternalBot>> listExternalBots() async {
    final res = await _chatDio.get('/api/admin/external-bots');
    final data = res.data;
    if (data is! List) return const [];
    return data
        .map((e) => ExternalBot.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}

final botAdminRepositoryProvider = Provider<BotAdminRepository>((ref) {
  const storage = FlutterSecureStorage();
  void onForceLogout() =>
      ref.read(authNotifierProvider.notifier).forceLogout();
  return BotAdminRepository(
    DioClient.createConnectorDio(storage, onForceLogout: onForceLogout),
    DioClient.createChatDio(storage, onForceLogout: onForceLogout),
  );
});

/// Workspace-wide registered external bots. Refreshable via `ref.invalidate`.
final externalBotsProvider = FutureProvider<List<ExternalBot>>((ref) {
  return ref.read(botAdminRepositoryProvider).listExternalBots();
});

/// Active bridge sessions for one owner, keyed by ownerUserId. The panel watches
/// this per registered bot to show `lastUsedAt` and gate the Revoke action.
final botSessionsProvider =
    FutureProvider.family<List<BotSessionSummary>, String>((ref, userId) {
  return ref.read(botAdminRepositoryProvider).listSessions(userId);
});
