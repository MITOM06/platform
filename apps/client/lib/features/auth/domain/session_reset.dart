import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../admin/data/bot_admin_repository.dart';
import '../../admin/state/admin_providers.dart';
import '../../admin/state/capabilities_provider.dart';
import '../../admin/state/usage_dashboard_provider.dart';
import '../../ai_context/domain/ai_context_providers.dart';
import '../../assistant/state/assistant_provider.dart';
import '../../chat/data/stomp_service.dart';
import '../../chat/domain/active_call_provider.dart';
import '../../chat/domain/ai_memory_provider.dart';
import '../../chat/domain/ai_persona_provider.dart';
import '../../chat/domain/ai_session_provider.dart';
import '../../chat/domain/chat_provider.dart';
import '../../chat/domain/group_call_signaling.dart';
import '../../chat/domain/kb_provider.dart';
import '../../friends/domain/friends_provider.dart';
import '../../home/domain/home_providers.dart';
import '../../integrations/state/integrations_provider.dart';
import '../../notifications/domain/notifications_provider.dart';
import '../../reminders/reminder_provider.dart';
import '../../skills/state/skills_provider.dart';

/// Drops every piece of state that belongs to the signed-in account.
///
/// Called on logout / forced logout AND before a new sign-in commits, so the
/// next account can never see the previous one's conversations, notifications,
/// reminders, capabilities, admin data or AI context — most of these providers
/// are process-wide (not auto-disposed) and used to survive a logout.
///
/// [ref] is any provider ref (the auth notifier's).
void resetSessionState(Ref ref) {
  // Realtime: close the socket and forget every subscription, so the next
  // session never re-subscribes the previous user's conversation topics.
  ref.read(stompServiceProvider.notifier).resetSession();

  for (final invalidate in <void Function()>[
    // Chat & people.
    () => ref.invalidate(conversationsNotifierProvider),
    () => ref.invalidate(archivedConversationsProvider),
    () => ref.invalidate(blockedConversationsProvider),
    () => ref.invalidate(chatNotifierProvider),
    () => ref.invalidate(userProfileProvider),
    () => ref.invalidate(userStatusProvider),
    () => ref.invalidate(relationshipProvider),
    () => ref.invalidate(friendsListProvider),
    () => ref.invalidate(friendRequestsProvider),
    () => ref.invalidate(onlineFriendsNotifierProvider),
    () => ref.invalidate(activeCallsProvider),
    () => ref.invalidate(incomingGroupCallNotifierProvider),
    () => ref.invalidate(notificationsProvider),
    () => ref.invalidate(remindersProvider),
    () => ref.invalidate(selectedConversationIdProvider),
    // Capabilities & admin console.
    () => ref.invalidate(capabilitiesProvider),
    () => ref.invalidate(workspaceProvider),
    () => ref.invalidate(departmentsProvider),
    () => ref.invalidate(membersProvider),
    () => ref.invalidate(invitationsProvider),
    () => ref.invalidate(rolesProvider),
    () => ref.invalidate(auditLogProvider),
    () => ref.invalidate(usageDashboardProvider),
    () => ref.invalidate(botSessionsProvider),
    // Assistant / AI / integrations.
    () => ref.invalidate(assistantProvider),
    () => ref.invalidate(assistantProvidersProvider),
    () => ref.invalidate(aiMemoriesProvider),
    () => ref.invalidate(aiPersonaProvider),
    () => ref.invalidate(aiSessionsProvider),
    () => ref.invalidate(myAiContextProvider),
    () => ref.invalidate(kbDocumentsProvider),
    () => ref.invalidate(integrationsProvider),
    () => ref.invalidate(directoryProvider),
    () => ref.invalidate(skillsProvider),
  ]) {
    invalidate();
  }
}

/// Refreshes everything that depends on the caller's role / departments /
/// permission matrix after `CLAIMS_CHANGED` — menus show or hide right away
/// without a new sign-in.
void invalidateClaimsDependentState(Ref ref) {
  ref.invalidate(capabilitiesProvider);
  ref.invalidate(workspaceProvider);
  ref.invalidate(departmentsProvider);
  ref.invalidate(membersProvider);
  ref.invalidate(invitationsProvider);
  ref.invalidate(rolesProvider);
  ref.invalidate(auditLogProvider);
  ref.invalidate(usageDashboardProvider);
  ref.invalidate(myAiContextProvider);
  ref.invalidate(integrationsProvider);
  ref.invalidate(directoryProvider);
  ref.invalidate(skillsProvider);
}
