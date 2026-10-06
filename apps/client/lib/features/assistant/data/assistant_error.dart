import '../../../l10n/app_localizations.dart';
import '../../chat/utils/chat_error.dart';

/// Localized message for a failed personal-assistant call (chat-service
/// `/api/assistant/*`): the assistant-specific codes first, then the shared
/// chat-service mapping. Never the raw server text.
String assistantErrorMessage(AppLocalizations l10n, Object error) {
  switch (chatErrorCode(error)) {
    case 'ASSISTANT_SETUP_INCOMPLETE':
      return l10n.errAssistantSetupIncomplete;
    case 'ASSISTANT_NOT_CONFIGURED':
      return l10n.errAssistantNotConfigured;
    case 'ASSISTANT_UPSTREAM_FAILED':
      return l10n.errAssistantUpstreamFailed;
  }
  return chatErrorMessage(l10n, error);
}
