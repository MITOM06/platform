// Mirror of web lib/hooks/__tests__/use-media-token-session.test.tsx
// (useMediaRemountKey): late token arrival remounts once, refresh doesn't.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:platform_client/core/media/media_token_holder.dart';
import 'package:platform_client/core/media/media_token_remount.dart';

class _Probe extends StatefulWidget {
  const _Probe(this.mounts);
  final List<int> mounts;
  @override
  State<_Probe> createState() => _ProbeState();
}

class _ProbeState extends State<_Probe> {
  @override
  void initState() {
    super.initState();
    widget.mounts.add(1);
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}

void main() {
  setUp(MediaTokenHolder.clear);
  tearDown(MediaTokenHolder.clear);

  testWidgets('late_token_arrival_remounts_once_and_refresh_does_not',
      (tester) async {
    final mounts = <int>[];
    await tester.pumpWidget(ProviderScope(
      child: MediaTokenRemount(child: _Probe(mounts)),
    ));
    expect(mounts.length, 1);

    final later = DateTime.now().add(const Duration(hours: 6));
    MediaTokenHolder.set('T1', later);
    await tester.pump();
    expect(mounts.length, 2);

    MediaTokenHolder.set('T2', later); // refresh
    await tester.pump();
    expect(mounts.length, 2);

    MediaTokenHolder.clear(); // sign-out: no remount by itself
    await tester.pump();
    expect(mounts.length, 2);
  });
}
