import 'package:platform_client/core/media/media_token_provider.dart';

/// Widget tests run on a fake clock: the real controller's 5s bootstrap bound
/// and retry timers would hang or leak. Tests that drive sign-in through the
/// real `AuthNotifier` add [noopMediaTokenOverride] next to their repo override.
class NoopMediaTokenController extends MediaTokenController {
  NoopMediaTokenController()
      : super(fetch: () async => throw UnimplementedError());

  @override
  void activate() {}

  @override
  Future<void> ensure() async {}

  @override
  Future<void> ensureBounded([Duration wait = mediaTokenBootstrapWait]) async {}

  @override
  void clear() {}
}

final noopMediaTokenOverride =
    mediaTokenControllerProvider.overrideWithValue(NoopMediaTokenController());
