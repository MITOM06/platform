import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

const locales = {'en': ('values', 'en'), 'vi': ('values-vi', 'vi'), 'zh': ('values-zh', 'zh-Hans'),
    'ja': ('values-ja', 'ja'), 'ko': ('values-ko', 'ko'), 'es': ('values-es', 'es'), 'fr': ('values-fr', 'fr')};

String? androidString(String xml, String name) => RegExp('<string name="$name">(.*?)</string>')
    .firstMatch(xml)?.group(1)?.replaceAll(r"\'", "'").replaceAll('&amp;', '&');
String? iosString(String strings, String name) => RegExp('"$name"\\s*=\\s*"(.*?)";').firstMatch(strings)?.group(1);

void main() {
  locales.forEach((loc, dirs) {
    test('push strings for $loc match the ARB', () {
      final arb = jsonDecode(File('lib/l10n/app_$loc.arb').readAsStringSync()) as Map<String, dynamic>;
      final xml = File('android/app/src/main/res/${dirs.$1}/strings.xml').readAsStringSync();
      final ios = File('ios/Runner/${dirs.$2}.lproj/Localizable.strings').readAsStringSync();
      for (final (native, key) in [('meeting_push_invited', 'meetingPushInvited'), ('meeting_push_starting', 'meetingPushStarting')]) {
        final expected = arb[key] as String;
        expect(expected.trim(), isNotEmpty);
        expect(androidString(xml, native), expected, reason: 'android $loc $native');
        expect(iosString(ios, native), expected, reason: 'ios $loc $native');
      }
    });
  });

  test('the Xcode project knows every region', () {
    final pbx = File('ios/Runner.xcodeproj/project.pbxproj').readAsStringSync();
    for (final r in ['en', 'vi', '"zh-Hans"', 'ja', 'ko', 'es', 'fr']) {
      expect(pbx, contains(r));
    }
    expect(pbx, contains('Localizable.strings'));
  });
}
