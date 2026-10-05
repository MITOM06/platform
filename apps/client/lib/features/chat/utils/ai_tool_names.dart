import '../../../l10n/app_localizations.dart';
import '../../integrations/utils/connector_labels.dart';

/// `mcp__<provider>__<tool>` split into its parts; null for a built-in tool.
({String provider, String tool})? parseConnectorToolName(String name) {
  if (!name.startsWith('mcp__')) return null;
  final rest = name.substring(5);
  final sep = rest.indexOf('__');
  if (sep <= 0 || sep + 2 >= rest.length) return null;
  return (provider: rest.substring(0, sep), tool: rest.substring(sep + 2));
}

/// A tool identifier made readable: `search_threads` → `Search threads`. Used
/// for connector / custom-server tools, whose names are provider-defined (not
/// translatable) — never shown with the `mcp__provider__` prefix.
String humanizeToolName(String raw) {
  final parsed = parseConnectorToolName(raw);
  final base = parsed?.tool ?? raw;
  final words = base
      .replaceAllMapped(RegExp(r'([a-z0-9])([A-Z])'), (m) => '${m[1]} ${m[2]}')
      .replaceAll(RegExp(r'[_\-.:]+'), ' ')
      .trim()
      .toLowerCase();
  if (words.isEmpty) return raw;
  return words[0].toUpperCase() + words.substring(1);
}

/// Localized display name of a tool the assistant used. Built-in tools get
/// their own wording; connector tools read "<Tool> (<Connector>)" with the
/// connector's display name — never the raw `mcp__…` / `custom_<hex>` name.
String aiToolDisplayName(
  AppLocalizations l10n,
  String toolName, {
  Map<String, String> connectorNames = const {},
}) {
  switch (toolName) {
    case 'search_messages':
      return l10n.aiToolSearchMessages;
    case 'get_user_info':
      return l10n.aiToolGetUserInfo;
    case 'search_knowledge_base':
      return l10n.aiToolSearchKnowledgeBase;
    case 'summarize_conversation':
      return l10n.aiToolSummarizeConversation;
    case 'create_reminder':
      return l10n.aiToolCreateReminder;
    case 'remember_fact':
      return l10n.aiToolRememberFact;
    case 'web_search':
      return l10n.aiToolWebSearch;
  }
  final parsed = parseConnectorToolName(toolName);
  if (parsed == null) return humanizeToolName(toolName);
  return l10n.aiToolOnConnector(
    humanizeToolName(parsed.tool),
    connectorDisplayName(l10n, parsed.provider, names: connectorNames),
  );
}
