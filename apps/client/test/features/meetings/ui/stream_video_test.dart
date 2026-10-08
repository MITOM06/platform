import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:platform_client/features/meetings/ui/room/stream_video.dart';

class _FakeStream extends Fake implements MediaStream {}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const method = MethodChannel('FlutterWebRTC.Method');
  final messenger =
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
  late Completer<Map<String, Object?>> created;
  late List<Object?> disposed;

  setUp(() {
    created = Completer();
    disposed = [];
    messenger.setMockMethodCallHandler(method, (call) async {
      switch (call.method) {
        case 'createVideoRenderer':
          return created.future;
        case 'videoRendererDispose':
          disposed.add((call.arguments as Map)['textureId']);
          return null;
      }
      return null;
    });
    // The renderer's per-texture event channel.
    messenger.setMockMethodCallHandler(
        const MethodChannel('FlutterWebRTC/Texture7'), (_) async => null);
  });
  tearDown(() {
    messenger.setMockMethodCallHandler(method, null);
    messenger.setMockMethodCallHandler(
        const MethodChannel('FlutterWebRTC/Texture7'), null);
  });

  testWidgets(
      'a tile gone while its renderer initializes still frees the texture '
      '(QA P3-4)', (tester) async {
    await tester.pumpWidget(StreamVideo(stream: _FakeStream()));
    await tester.pumpWidget(const SizedBox());
    created.complete({'textureId': 7});
    for (var i = 0; i < 5; i++) {
      await tester.runAsync(() => Future<void>.delayed(Duration.zero));
      await tester.pump();
    }
    expect(disposed, [7]);
  });
}
