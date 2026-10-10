// Firebase options for the DEVELOPMENT project — used by `--flavor dev`
// builds, the default (see lib/core/config/app_flavor.dart).
//
// No development project is wired yet: this stub keeps dev builds running
// without Firebase (no push, no phone verification) instead of falling back
// to production. To wire one, run from apps/client:
//
//   flutterfire configure --project=<dev-project-id> \
//     --out=lib/firebase_options_dev.dart \
//     --android-package-name=com.platform.platform_client.dev \
//     --ios-bundle-id=com.tranphuckhang.platformClient.dev \
//     --platforms=android,ios,web
//
// which replaces this file with the generated `DefaultFirebaseOptions`.
// Keep the generated file on the `dev` branch (.claude/rules/dev-local-only.md).
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;

class DefaultFirebaseOptions {
  /// Null: no development Firebase project is configured.
  static FirebaseOptions? get currentPlatform => null;
}
