/// Shared fixtures for the MFA tests.
library;

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

/// 1x1 transparent PNG as a data URL (stands in for the server QR code).
const kTinyPngDataUrl = 'data:image/png;base64,'
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA'
    '60e6kgAAAABJRU5ErkJggg==';

/// Answers clipboard writes on the platform channel, so `Clipboard.setData`
/// completes inside the test's fake clock. [written] collects what was copied;
/// [failWith] makes the write fail the way a real device can.
void mockClipboard(
  WidgetTester tester, {
  List<String>? written,
  Object? failWith,
}) {
  final messenger = tester.binding.defaultBinaryMessenger;
  messenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
    if (call.method == 'Clipboard.setData') {
      if (failWith != null) throw failWith;
      written?.add((call.arguments as Map)['text'] as String);
    }
    return null;
  });
  addTearDown(
      () => messenger.setMockMethodCallHandler(SystemChannels.platform, null));
}

/// A successful Copy: the step that unlocks "I saved my backup codes".
Future<void> copyBackupCodes(WidgetTester tester) async {
  mockClipboard(tester);
  final copy = find.byKey(const ValueKey('mfa-copy-codes'));
  await tester.ensureVisible(copy);
  await tester.pumpAndSettle();
  await tester.tap(copy);
  await tester.pumpAndSettle();
}
