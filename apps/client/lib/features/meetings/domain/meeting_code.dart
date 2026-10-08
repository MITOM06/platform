// Meeting codes look like `abc-defg-hjk`: 10 lowercase letters without i, l,
// o, grouped 3-4-3 — mirror of web `lib/meetings/meeting-code.ts`. People
// paste codes in any case, with spaces or without dashes, or a whole link.

final meetingCodePattern =
    RegExp(r'^[a-hjkmnp-z]{3}-[a-hjkmnp-z]{4}-[a-hjkmnp-z]{3}$');
final _letters = RegExp(r'^[a-hjkmnp-z]{10}$');
final _separators = RegExp(r'[\s-]+');

/// Code, pasted https link, `/meet/…` path or `platform://meet/…` deep link
/// → canonical "abc-defg-hjk", or null.
String? parseMeetingCodeInput(String raw) {
  var value = raw.trim();
  final deepLink = Uri.tryParse(value);
  final at = value.indexOf('/meet/');
  if (deepLink != null &&
      deepLink.scheme == 'platform' &&
      deepLink.host == 'meet') {
    value = deepLink.pathSegments.isEmpty ? '' : deepLink.pathSegments.first;
  } else if (at >= 0) {
    value = value.substring(at + '/meet/'.length).split(RegExp('[?#/]')).first;
  } else if (value.contains('://')) {
    return null;
  }
  final letters = value.toLowerCase().replaceAll(_separators, '');
  if (!_letters.hasMatch(letters)) return null;
  return '${letters.substring(0, 3)}-${letters.substring(3, 7)}-'
      '${letters.substring(7)}';
}

String meetingPath(String code) => '/meet/$code';

/// The shareable web link; null [webBase] (origin not configured) ⇒ null and
/// the caller copies the code instead.
String? meetingLink(String code, String? webBase) {
  if (webBase == null || webBase.trim().isEmpty) return null;
  return '${webBase.trim().replaceAll(RegExp(r'/+$'), '')}${meetingPath(code)}';
}
