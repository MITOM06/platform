// Localization keys chat-service puts on message pushes (FCM title/body loc
// keys, MessageNotificationService). The OS resolves them from strings.xml /
// Localizable.strings; a push the app shows itself resolves them here.

import '../../l10n/app_localizations.dart';

/// The push text for [key] in the app's language, or null for a missing or
/// unknown key (callers fall back to a generic label — never the key).
String? pushTextForKey(AppLocalizations l10n, String? key) => switch (key) {
      'push_title_new_message' || 'push_body_new_message' =>
        l10n.newNotificationTitle,
      'push_body_photo' => '[${l10n.attachPhoto}]',
      'push_body_video' => '[${l10n.attachVideo}]',
      'push_body_file' => '[${l10n.attachFile}]',
      'push_body_voice' => '[${l10n.attachVoice}]',
      'push_body_sticker' => '[${l10n.attachSticker}]',
      _ => null,
    };
