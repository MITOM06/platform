import '../../../l10n/app_localizations.dart';

/// Localized, pluralized length of [seconds] in the largest whole unit
/// ("7 days", "1 hour", "30 minutes"). Used for disappearing-message timers
/// (`system.autodelete.changed:<seconds>`) — never a hardcoded "7d".
String durationText(AppLocalizations l10n, int seconds) {
  if (seconds >= 86400 && seconds % 86400 == 0) {
    return l10n.durationDays(seconds ~/ 86400);
  }
  if (seconds >= 3600 && seconds % 3600 == 0) {
    return l10n.durationHours(seconds ~/ 3600);
  }
  if (seconds >= 60 && seconds % 60 == 0) {
    return l10n.durationMinutes(seconds ~/ 60);
  }
  return l10n.durationSeconds(seconds);
}

/// Disappearing-message timers offered in the picker (seconds; 0 = off).
/// Same choices as web's settings drawer.
const kAutoDeleteOptions = [0, 3600, 86400, 604800, 2592000];
