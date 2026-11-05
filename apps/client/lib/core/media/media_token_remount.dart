import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'media_token_provider.dart';

/// Remounts [child] when the media token arrives late (none → value), so
/// images already rendered without `?t=` are rebuilt with it. Token refreshes
/// keep the same key (no remount).
///
/// Mirror of web `useMediaRemountKey` in `app/(main)/layout.tsx`.
class MediaTokenRemount extends ConsumerWidget {
  const MediaTokenRemount({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final epoch = ref.watch(mediaTokenEpochProvider);
    return KeyedSubtree(key: ValueKey('media-token-$epoch'), child: child);
  }
}
