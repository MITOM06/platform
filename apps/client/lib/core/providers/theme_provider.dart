import 'package:flutter/material.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:shared_preferences/shared_preferences.dart';

part 'theme_provider.g.dart';

/// Provides access to the pre-initialized [SharedPreferences] instance.
@riverpod
SharedPreferences sharedPreferences(SharedPreferencesRef ref) {
  // Overridden in main.dart
  throw UnimplementedError();
}

/// Manages and persists the application's [ThemeMode].
@riverpod
class ThemeModeNotifier extends _$ThemeModeNotifier {
  static const _key = 'theme_mode';

  @override
  ThemeMode build() {
    final prefs = ref.watch(sharedPreferencesProvider);
    final savedMode = prefs.getString(_key);
    switch (savedMode) {
      case 'light':
        return ThemeMode.light;
      case 'dark':
        return ThemeMode.dark;
      case 'system':
      default:
        return ThemeMode.system;
    }
  }

  /// Updates the theme mode and persists it to local storage.
  Future<void> setThemeMode(ThemeMode mode) async {
    final prefs = ref.read(sharedPreferencesProvider);
    state = mode;
    await prefs.setString(_key, mode.name);
  }
}

/// Tracks whether the user has completed the onboarding theme selection choice.
@riverpod
class ThemeOnboardingNotifier extends _$ThemeOnboardingNotifier {
  static const _key = 'theme_onboarding_completed';

  @override
  bool build() {
    final prefs = ref.watch(sharedPreferencesProvider);
    return prefs.getBool(_key) ?? false;
  }

  /// Marks the theme onboarding choice as completed and persists it locally.
  Future<void> completeOnboarding() async {
    final prefs = ref.read(sharedPreferencesProvider);
    state = true;
    await prefs.setBool(_key, true);
  }
}
