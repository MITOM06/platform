import 'dart:io' show Platform;

import 'package:flutter/services.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart' as rtc;

import 'rtc_session.dart';

/// The platform side of presenting the screen. Android needs the user's
/// capture consent and a `mediaProjection` foreground service running before
/// LiveKit may publish the screen track (Android 14 order).
abstract interface class ScreenCaptureHost {
  bool get supported;

  /// Ask the system for capture consent, then start the foreground service.
  /// false = the user said no.
  Future<bool> begin(ScreenShareNotice notice);

  /// Stop the foreground service (best-effort, never throws).
  Future<void> end();
}

/// `Helper.requestCapturePermission()` + the app's own `ScreenShareService`
/// (MethodChannel `pon/screen_share`, see MainActivity.kt).
class AndroidScreenCapture implements ScreenCaptureHost {
  static const _channel = MethodChannel('pon/screen_share');

  @override
  bool get supported => Platform.isAndroid;

  @override
  Future<bool> begin(ScreenShareNotice notice) async {
    if (!await rtc.Helper.requestCapturePermission()) return false;
    await _channel.invokeMethod<void>(
        'start', {'title': notice.title, 'body': notice.body});
    return true;
  }

  @override
  Future<void> end() async {
    try {
      await _channel.invokeMethod<void>('stop');
    } catch (_) {
      // best-effort: the service may never have started
    }
  }
}

/// iOS (screen share comes in a later release — spec §7) and tests.
class NoScreenCapture implements ScreenCaptureHost {
  const NoScreenCapture();

  @override
  bool get supported => false;

  @override
  Future<bool> begin(ScreenShareNotice notice) async => false;

  @override
  Future<void> end() async {}
}

ScreenCaptureHost platformScreenCapture() =>
    Platform.isAndroid ? AndroidScreenCapture() : const NoScreenCapture();
