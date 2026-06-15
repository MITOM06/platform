import 'dart:ui';

import 'package:riverpod_annotation/riverpod_annotation.dart';

import 'theme_provider.dart';

part 'locale_provider.g.dart';

/// Languages the app ships translations for. Order = display order in pickers.
/// Keep in sync with the `app_*.arb` files in `lib/l10n/`.
const List<Locale> kSupportedLocales = [
  Locale('en'),
  Locale('vi'),
  Locale('zh'),
  Locale('ja'),
  Locale('ko'),
  Locale('es'),
  Locale('fr'),
];

/// Native display name for each supported language (shown in the language
/// picker so users recognize their own language regardless of current locale).
const Map<String, String> kLanguageNames = {
  'en': 'English',
  'vi': 'Tiếng Việt',
  'zh': '中文',
  'ja': '日本語',
  'ko': '한국어',
  'es': 'Español',
  'fr': 'Français',
};

/// Manages and persists the application's [Locale].
///
/// `null` state means "follow the system language" (falling back to English
/// when the device locale is not one we translate). Mirrors the persistence
/// pattern of [ThemeModeNotifier].
@riverpod
class LocaleNotifier extends _$LocaleNotifier {
  static const _key = 'app_locale';

  @override
  Locale? build() {
    final prefs = ref.watch(sharedPreferencesProvider);
    final saved = prefs.getString(_key);
    if (saved == null || saved.isEmpty) return null; // system default
    return Locale(saved);
  }

  /// Persists the chosen [locale]. Pass `null` to follow the system language.
  Future<void> setLocale(Locale? locale) async {
    final prefs = ref.read(sharedPreferencesProvider);
    state = locale;
    if (locale == null) {
      await prefs.remove(_key);
    } else {
      await prefs.setString(_key, locale.languageCode);
    }
  }
}

/// Resolves the [Locale] that should actually be rendered, taking the saved
/// preference (or the system language) and falling back to English.
Locale resolveActiveLocale(Locale? preferred) {
  return preferred ?? const Locale('en');
}
