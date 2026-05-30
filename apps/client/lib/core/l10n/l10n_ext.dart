import 'package:flutter/widgets.dart';
import 'package:platform_client/l10n/app_localizations.dart';

/// Convenience accessor for localized strings: `context.l10n.loginTitle`.
///
/// PROJECT RULE: every user-facing string must come from here. Never hardcode
/// display text in widgets — add the key to `lib/l10n/app_en.arb` (template)
/// and translate it in every other `app_*.arb`. See `.claude/rules/i18n.md`.
extension L10nX on BuildContext {
  AppLocalizations get l10n => AppLocalizations.of(this);
}
