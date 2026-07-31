// Tests for ImageContent / VideoContent corner rounding.
//
// Regression guard for L3 batch 8: a single image sent in a chat had no
// ClipRRect at all (hard 90° corners inside a 14px-rounded bubble, because the
// bubble's decoration does not clip children), and VideoContent used
// radiusCard (12) instead of the bubble's 14.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:platform_client/features/chat/ui/widgets/image_content.dart';

/// Every [ClipRRect] radius found under [widgetType] in the current tree.
List<double> _clipRadii(WidgetTester tester, Type widgetType) {
  return tester
      .widgetList<ClipRRect>(find.descendant(
        of: find.byType(widgetType),
        matching: find.byType(ClipRRect),
        matchRoot: true,
      ))
      .map((c) => (c.borderRadius as BorderRadius).topLeft.x)
      .toList();
}

void main() {
  group('ImageContent — bubble-matching corners', () {
    testWidgets('a single image is clipped to the 14px bubble radius',
        (tester) async {
      await tester.pumpWidget(const MaterialApp(
        home: Scaffold(body: ImageContent(url: '/api/uploads/abc.png')),
      ));

      expect(_clipRadii(tester, ImageContent), contains(14.0));
    });

    testWidgets('a multi-image collage is clipped to the same radius',
        (tester) async {
      await tester.pumpWidget(const MaterialApp(
        home: Scaffold(
          body: ImageContent(url: '["/api/uploads/a.png","/api/uploads/b.png"]'),
        ),
      ));

      final radii = _clipRadii(tester, ImageContent);
      expect(radii, isNotEmpty);
      expect(radii.every((r) => r == 14.0), isTrue,
          reason: 'collage + cells must all use the bubble radius, got $radii');
    });
  });

  group('VideoContent — bubble-matching corners', () {
    testWidgets('video thumbnail uses 14, not radiusCard (12)', (tester) async {
      await tester.pumpWidget(const MaterialApp(
        home: Scaffold(body: VideoContent(url: '/api/uploads/clip.mp4')),
      ));

      expect(_clipRadii(tester, VideoContent), contains(14.0));
    });
  });
}
