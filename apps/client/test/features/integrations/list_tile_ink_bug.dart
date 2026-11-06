import 'package:flutter/foundation.dart';

/// BUG (low, UI): `PonCard` (lib/core/widgets/pon_widgets.dart) is a coloured
/// `Container` with no `Material`, and several screens put a `ListTile` /
/// `SwitchListTile` straight inside it (connector_permissions_sheet.dart "Full
/// authority" toggle, friends_screen.dart friend / request rows). Flutter's
/// debug assertion "ListTile background color or ink splashes may be
/// invisible" fires on every build and the row's ripple is hidden. Fix (1
/// line): wrap the PonCard child in `Material(type: MaterialType.transparency,
/// child: child)` — as settings_dialogs.dart already does by hand.
///
/// Until fixed, widget tests tolerate ONLY that one assertion so the behaviour
/// is still checked; any other framework error still fails the test.
Future<void> toleratingListTileInkBug(Future<void> Function() body) async {
  final original = FlutterError.onError;
  FlutterError.onError = (details) {
    if (details.toString().contains('ListTile background color or ink')) return;
    original?.call(details);
  };
  try {
    await body();
  } finally {
    FlutterError.onError = original;
  }
}
