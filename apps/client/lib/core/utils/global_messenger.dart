import 'package:flutter/material.dart';

import 'global_messenger_overlays.dart';

/// Messenger key used by the root [MaterialApp.router] for SnackBars.
final scaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>();

/// Root navigator key — wired into GoRouter so we can reach the overlay from
/// anywhere (notifications) without a [BuildContext].
final rootNavigatorKey = GlobalKey<NavigatorState>();

void showErrorSnackBar(String message) {
  showTopBanner(message, isError: true);
}

void showInfoSnackBar(String message) {
  showTopBanner(message, isError: false);
}

OverlayEntry? _activeBanner;

/// Shows a professional top-sliding banner for errors and info messages.
void showTopBanner(String message, {bool isError = false}) {
  final overlay = rootNavigatorKey.currentState?.overlay;
  if (overlay == null) return;

  _activeBanner?.remove();
  _activeBanner = null;

  late OverlayEntry entry;
  void dismiss() {
    if (_activeBanner == entry) {
      entry.remove();
      _activeBanner = null;
    }
  }

  entry = OverlayEntry(
    builder: (context) => TopSlideBannerWidget(
      message: message,
      isError: isError,
      onDismiss: dismiss,
    ),
  );
  _activeBanner = entry;
  overlay.insert(entry);
}

/// The notification currently on screen (if any). Keeping a reference lets a
/// newer notification replace an older one instead of stacking them.
OverlayEntry? _activeNotification;

/// Shows a professional top-sliding in-app notification using an [OverlayEntry].
///
/// Unlike a SnackBar, this sits above all routes, auto-dismisses after 4s, and
/// only intercepts pointer events on the banner itself — content below stays
/// fully interactive.
void showInAppNotification(String title, String body, {VoidCallback? onTap}) {
  final overlay = rootNavigatorKey.currentState?.overlay;
  if (overlay == null) return;

  // Replace any banner already on screen.
  _activeNotification?.remove();
  _activeNotification = null;

  late OverlayEntry entry;
  void dismiss() {
    if (_activeNotification == entry) {
      entry.remove();
      _activeNotification = null;
    }
  }

  entry = OverlayEntry(
    builder: (context) => TopSlideNotification(
      title: title,
      body: body,
      onTap: onTap,
      onDismiss: dismiss,
    ),
  );
  _activeNotification = entry;
  overlay.insert(entry);
}
