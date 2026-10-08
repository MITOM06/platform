import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/config/app_flavor.dart';

void main() {
  group('AppFlavor', () {
    test('only an explicit prod build is production', () {
      expect(AppFlavor.fromName('prod'), AppFlavor.prod);
      expect(AppFlavor.fromName('dev'), AppFlavor.dev);
      expect(AppFlavor.fromName(null),
          AppFlavor.dev); // no flavor: stay out of prod
      expect(AppFlavor.fromName('staging'), AppFlavor.dev);
    });

    test('a test run (no --flavor) is a development build', () {
      expect(currentFlavor, AppFlavor.dev);
    });
  });

  group('firebaseOptionsFor', () {
    tearDown(() => debugDefaultTargetPlatformOverride = null);

    for (final platform in [TargetPlatform.android, TargetPlatform.iOS]) {
      test('prod uses the production project on ${platform.name}', () {
        debugDefaultTargetPlatformOverride = platform;
        expect(firebaseOptionsFor(AppFlavor.prod)?.projectId, 'pon-c30fd');
      });

      test('dev never uses the production project on ${platform.name}', () {
        debugDefaultTargetPlatformOverride = platform;
        expect(
            firebaseOptionsFor(AppFlavor.dev)?.projectId, isNot('pon-c30fd'));
      });
    }
  });
}
