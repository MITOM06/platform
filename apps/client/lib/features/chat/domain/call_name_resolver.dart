import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'chat_misc_providers.dart';

/// chat-service is userId-only by design: `call.started`/`call.roster`
/// broadcasts and the `call-ring` signal carry the raw userId (a Mongo
/// ObjectId) in their `displayName`/`startedByName` fields. This resolver maps
/// such a userId to a human name CLIENT-SIDE using the SAME mechanism the chat
/// UI uses for sender names (see `GroupSenderHeader`): the per-conversation
/// nickname wins, otherwise the cached user profile's display name.
///
/// [fallback] is returned while the profile is still loading or unresolved, so
/// the UI never flashes a raw ObjectId.
String resolveCallDisplayName(
  WidgetRef ref, {
  required String userId,
  required String conversationId,
  required String fallback,
}) {
  if (userId.isEmpty) return fallback;

  final nickname = ref.watch(nicknamesProvider(conversationId))[userId];
  if (nickname != null && nickname.isNotEmpty) return nickname;

  final profile = ref.watch(userProfileProvider(userId)).valueOrNull;
  final name = profile?.displayName;
  if (name != null && name.isNotEmpty) return name;

  return fallback;
}
