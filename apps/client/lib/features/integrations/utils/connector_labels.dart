import '../../../l10n/app_localizations.dart';
import '../data/models/connector_models.dart';

/// Brand names of the built-in catalog connectors — product names, the same
/// in every language.
const kCatalogConnectorNames = <String, String>{
  'gmail': 'Gmail',
  'calendar': 'Google Calendar',
  'notion': 'Notion',
  'drive': 'Google Drive',
};

/// Display name of a connector slug (`gmail`, a directory slug, or
/// `custom_<24hex>`). Never returns the raw slug: an unknown one becomes a
/// localized generic label. [names] is the slug → name map of loaded catalog /
/// directory data (`connectorNamesProvider`).
String connectorDisplayName(
  AppLocalizations l10n,
  String? slug, {
  Map<String, String> names = const {},
}) {
  if (slug == null || slug.isEmpty) return l10n.connectorGenericName;
  final known = names[slug] ?? kCatalogConnectorNames[slug];
  if (known != null && known.isNotEmpty) return known;
  if (slug.startsWith('custom_') || slug.startsWith('custom:')) {
    return l10n.connectorCustomName;
  }
  return l10n.connectorGenericName;
}

/// Localized label of one OAuth / MCP scope, or null for a scope this client
/// has no wording for (the caller shows [AppLocalizations.scopeOther] once
/// instead — a raw scope URL is never shown).
String? scopeLabel(AppLocalizations l10n, String scope) {
  // Google scopes are URLs: key on the last path segment.
  final key = scope.contains('/') ? scope.split('/').last : scope;
  switch (key) {
    case 'read_content':
      return l10n.scopeReadContent;
    case 'update_content':
      return l10n.scopeUpdateContent;
    case 'insert_content':
      return l10n.scopeInsertContent;
    case 'gmail.send':
      return l10n.scopeEmailSend;
    case 'gmail.compose':
      return l10n.scopeEmailDraft;
    case 'gmail.readonly':
      return l10n.scopeEmailRead;
    case 'gmail.modify':
      return l10n.scopeEmailManage;
    case 'calendar.events':
      return l10n.scopeCalendarEvents;
    case 'calendar.readonly':
      return l10n.scopeCalendarRead;
    case 'calendar':
      return l10n.scopeCalendarManage;
    case 'drive.readonly':
      return l10n.scopeFilesRead;
    case 'drive.file':
    case 'drive':
      return l10n.scopeFilesManage;
    default:
      return null;
  }
}

/// Localized, de-duplicated labels for [scopes]; unknown scopes collapse into
/// one "other access" label.
List<String> scopeLabels(AppLocalizations l10n, List<String> scopes) {
  final out = <String>[];
  var other = false;
  for (final s in scopes) {
    final label = scopeLabel(l10n, s);
    if (label == null) {
      other = true;
    } else if (!out.contains(label)) {
      out.add(label);
    }
  }
  if (other) out.add(l10n.scopeOther);
  return out;
}

String directoryAuthModeLabel(AppLocalizations l10n, DirectoryAuthMode mode) {
  switch (mode) {
    case DirectoryAuthMode.mcpOauth:
    case DirectoryAuthMode.envOauth:
      return l10n.directoryAuthOauth;
    case DirectoryAuthMode.apikey:
      return l10n.directoryAuthApiKey;
    case DirectoryAuthMode.none:
      return l10n.directoryAuthNone;
  }
}

/// Admin-facing label: distinguishes the two OAuth modes.
String directoryAuthModeAdminLabel(
    AppLocalizations l10n, DirectoryAuthMode mode) {
  switch (mode) {
    case DirectoryAuthMode.mcpOauth:
      return l10n.directoryAuthMcpOauth;
    case DirectoryAuthMode.envOauth:
      return l10n.directoryAuthEnvOauth;
    case DirectoryAuthMode.apikey:
      return l10n.directoryAuthApiKey;
    case DirectoryAuthMode.none:
      return l10n.directoryAuthNone;
  }
}

String directoryTierLabel(AppLocalizations l10n, DirectoryTier tier) {
  switch (tier) {
    case DirectoryTier.workspace:
      return l10n.tierWorkspace;
    case DirectoryTier.personal:
      return l10n.tierPersonal;
    case DirectoryTier.both:
      return l10n.tierBoth;
  }
}

/// Meta line under a connector card: the shared/personal scope of the
/// connection plus its account label (an email or workspace name).
String? connectionMetaLabel(AppLocalizations l10n, ConnectionView? conn) {
  if (conn == null) return null;
  final scope = conn.isWorkspace ? l10n.tierWorkspace : l10n.tierPersonal;
  final account = conn.accountLabel?.trim();
  return (account == null || account.isEmpty) ? scope : '$scope · $account';
}
