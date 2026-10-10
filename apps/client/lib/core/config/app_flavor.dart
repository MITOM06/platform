import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/services.dart' show appFlavor;

import '../../firebase_options_dev.dart' as dev;
import '../../firebase_options_prod.dart' as prod;

/// Which deployment a build belongs to, from `--flavor` (`pubspec.yaml` sets
/// `dev` as the default). Each flavor has its own app id and its own Firebase
/// project, so a development build can never register push tokens or phone
/// sign-ins in production. See docs/environments.md § Mobile flavors.
enum AppFlavor {
  dev,
  prod;

  /// Anything but an explicit `prod` is development: a build that forgot its
  /// flavor stays out of production.
  static AppFlavor fromName(String? name) => name == 'prod' ? prod : dev;
}

/// The flavor this binary was built with.
final AppFlavor currentFlavor = AppFlavor.fromName(appFlavor);

/// Firebase for [flavor]; null when that flavor has no project configured
/// (the app then runs without push or phone verification).
FirebaseOptions? firebaseOptionsFor(AppFlavor flavor) => switch (flavor) {
      AppFlavor.prod => prod.DefaultFirebaseOptions.currentPlatform,
      AppFlavor.dev => dev.DefaultFirebaseOptions.currentPlatform,
    };
