// File generated from the pon-dev-7aac2 Firebase configs (the same values
// `flutterfire configure` writes) for the DEVELOPMENT project, used by
// `--flavor dev` builds (lib/core/config/app_flavor.dart).
// Dev-only: lives on the `dev` branch, never on `main`
// (.claude/rules/dev-local-only.md). Regenerate:
//   flutterfire configure --project=pon-dev-7aac2 --out=lib/firebase_options_dev.dart \
//     --platforms=android,ios --android-package-name=com.platform.platform_client.dev \
//     --ios-bundle-id=com.tranphuckhang.platformClient.dev
// ignore_for_file: type=lint
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions? get currentPlatform {
    if (kIsWeb) return null; // no Flutter web app in the dev project
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        return null;
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyAgEjU4esWyW0w8qdzzl6Mty2MJaTGIEW4',
    appId: '1:663335929957:android:bd3bdf72641bea26471e8c',
    messagingSenderId: '663335929957',
    projectId: 'pon-dev-7aac2',
    storageBucket: 'pon-dev-7aac2.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyC2lPdutVP7W1WdxzfGw993AdOVRRRET-I',
    appId: '1:663335929957:ios:3ae680ba09ea8919471e8c',
    messagingSenderId: '663335929957',
    projectId: 'pon-dev-7aac2',
    storageBucket: 'pon-dev-7aac2.firebasestorage.app',
    iosBundleId: 'com.tranphuckhang.platformClient.dev',
  );
}
