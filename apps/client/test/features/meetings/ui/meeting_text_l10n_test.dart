import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/meeting_text.dart';
import 'package:platform_client/features/meetings/ui/meeting_text_l10n.dart';
import 'package:platform_client/l10n/app_localizations.dart';

const sample = <String, Object>{'max': 25, 'count': 2, 'name': 'Lan', 'title': 'Weekly', 'time': '9:00'};

void main() {
  for (final locale in AppLocalizations.supportedLocales) {
    test('every MeetingText is translated in ${locale.languageCode}', () async {
      final l = await AppLocalizations.delegate.load(locale);
      for (final t in MeetingText.values) {
        final s = meetingText(l, MeetingNotice(t, sample));
        expect(s.trim(), isNotEmpty, reason: '$t');
        expect(s, isNot(contains('{')), reason: '$t');
        expect(s, isNot(contains('#')), reason: '$t');
        expect(s, isNot(contains(t.name)), reason: '$t');
      }
    });
  }
}
