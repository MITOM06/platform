import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/services/push_text.dart';
import 'package:platform_client/l10n/app_localizations.dart';

/// A message push shown by the app itself (foreground, STOMP down) carries the
/// server's localization key instead of English text; it must be resolved here
/// in the app's language, never shown raw.
void main() {
  final en = lookupAppLocalizations(const Locale('en'));
  final vi = lookupAppLocalizations(const Locale('vi'));

  test('resolves the message-push keys in the app language', () {
    expect(pushTextForKey(vi, 'push_body_photo'), '[${vi.attachPhoto}]');
    expect(pushTextForKey(en, 'push_body_voice'), '[${en.attachVoice}]');
    expect(pushTextForKey(en, 'push_body_video'), '[${en.attachVideo}]');
    expect(pushTextForKey(en, 'push_body_file'), '[${en.attachFile}]');
    expect(pushTextForKey(en, 'push_body_sticker'), '[${en.attachSticker}]');
    expect(pushTextForKey(vi, 'push_title_new_message'), vi.newNotificationTitle);
    expect(pushTextForKey(vi, 'push_body_new_message'), vi.newNotificationTitle);
  });

  test('an unknown or missing key gives null, never the key itself', () {
    expect(pushTextForKey(en, 'push_body_hologram'), isNull);
    expect(pushTextForKey(en, null), isNull);
  });
}
