// Meeting screens for the DESIGN_SHOTS run (see design_shots_test.dart):
// the list and detail with fake data, the pre-join and a status screen inside
// a real room scope (`pumpRoom`), the room itself. Light + dark, Vietnamese,
// 390 dp. Captured from the render view so sheets/overlays are included.
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/admin/state/capabilities_provider.dart';
import 'package:platform_client/features/meetings/data/meetings_repository.dart';
import 'package:platform_client/features/meetings/data/my_departments_repository.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';
import 'package:platform_client/features/meetings/domain/room_phase.dart';
import 'package:platform_client/features/meetings/ui/meeting_detail_screen.dart';
import 'package:platform_client/features/meetings/ui/meetings_screen.dart';
import 'package:platform_client/features/meetings/ui/room/meeting_room_view.dart';
import 'package:platform_client/features/meetings/ui/room/prejoin_screen.dart';
import 'package:platform_client/features/meetings/ui/room/room_status_screen.dart';

import '../features/meetings/ui/meeting_test_harness.dart';
import '../features/meetings/ui/room_test_harness.dart';

const _size = Size(390, 844);

Meeting _meeting(String id, MeetingStatus status, {DateTime? start}) => Meeting(
      id: id,
      code: 'abc-defg-hjk',
      title: status == MeetingStatus.live ? 'Họp giao ban tuần' : 'Kế hoạch Q4',
      description: 'Rà soát tiến độ và việc tuần tới.',
      host: const MeetingPerson(userId: 'h', displayName: 'Lan'),
      invitees: const [
        MeetingPerson(userId: 'u2', displayName: 'Minh'),
        MeetingPerson(userId: 'u3', displayName: 'Dũng'),
      ],
      status: status,
      scheduledStart: start,
      scheduledEnd: start?.add(const Duration(hours: 1)),
      viewerRole: MeetingViewerRole.host,
      createdAt: DateTime.utc(2026, 10, 7),
    );

class _ShotsApi implements MeetingsApi {
  final live = _meeting('m1', MeetingStatus.live);
  final later = _meeting('m2', MeetingStatus.scheduled,
      start: DateTime.now().add(const Duration(days: 1)));

  @override
  Future<MeetingPage> list(MeetingListScope scope,
          {String? cursor, int size = 20}) async =>
      MeetingPage(
          content: scope == MeetingListScope.upcoming ? [live, later] : [],
          hasNext: false);

  @override
  Future<Meeting> get(String id) async => live;

  @override
  Future<MeetingMessagePage> messages(String id,
          {String? before, int size = 50}) async =>
      MeetingMessagePage(content: [
        MeetingChatMessage(
            id: 'x1',
            sender: const MeetingPerson(userId: 'u2', displayName: 'Minh'),
            content: 'Mình gửi slide sau buổi họp nhé',
            createdAt: DateTime.now()),
      ], hasNext: false);

  @override
  Future<MeetingNote> getNote(String id, NoteScope scope) async => MeetingNote(
      scope: scope,
      content: '- Chốt lịch phát hành\n- Phân công QA',
      version: 1);

  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

class _NoDepts implements MyDepartmentsApi {
  @override
  Future<List<DepartmentOption>> list() async => const [];
}

Future<void> _capture(WidgetTester tester, Directory out, String name) =>
    tester.runAsync(() async {
      final view = tester.binding.renderViews.first;
      final layer = view.debugLayer! as OffsetLayer;
      final image = await layer.toImage(Offset.zero & (view.size * 2));
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      File('${out.path}/$name.png')
          .writeAsBytesSync(bytes!.buffer.asUint8List());
    });

/// Registers the meeting shots (skipped unless [enabled]).
void meetingShots(
    {required bool enabled, String? only, required Directory out}) {
  final shots = <String, Future<void> Function(WidgetTester, bool dark)>{
    '50_meetings': (t, dark) => pumpMeetingWidget(t, const MeetingsScreen(),
        wrapInScaffold: false,
        dark: dark,
        locale: const Locale('vi'),
        overrides: _dataOverrides()),
    '51_meeting_detail': (t, dark) => pumpMeetingWidget(
        t, const MeetingDetailScreen(meetingId: 'm1'),
        wrapInScaffold: false,
        dark: dark,
        locale: const Locale('vi'),
        overrides: _dataOverrides()),
    '52_meeting_prejoin': (t, dark) => pumpRoom(t,
        child: const PrejoinScreen(busy: false),
        phase: RoomPhase.prejoin,
        settings: const MeetingSettings(muteOnEntry: true),
        locale: const Locale('vi'),
        dark: dark),
    '53_meeting_removed': (t, dark) => pumpRoom(t,
        child: const RoomStatusScreen(kind: RoomPhase.removed, meetingId: 'm1'),
        phase: RoomPhase.prejoin,
        locale: const Locale('vi'),
        dark: dark),
    '54_meeting_room': (t, dark) => pumpRoom(t,
        child: const MeetingRoomView(),
        role: MeetingRoomRole.host,
        peers: [fakePeer('bob', 'Minh'), fakePeer('c', 'Dũng', micMuted: true)],
        locale: const Locale('vi'),
        dark: dark),
  };
  for (final entry in shots.entries) {
    if (only != null && !entry.key.contains(only)) continue;
    for (final dark in [false, true]) {
      final name = '${entry.key}_${dark ? 'dark' : 'light'}';
      testWidgets(name, skip: !enabled, (tester) async {
        tester.view.physicalSize = _size * 2;
        tester.view.devicePixelRatio = 2;
        addTearDown(tester.view.reset);
        await entry.value(tester, dark);
        await tester.pump(const Duration(milliseconds: 400));
        await _capture(tester, out, name);
        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pump(const Duration(seconds: 5));
      });
    }
  }
}

List<Override> _dataOverrides() => [
      meetingsRepositoryProvider.overrideWithValue(_ShotsApi()),
      myDepartmentsRepositoryProvider.overrideWithValue(_NoDepts()),
      hasCapabilityProvider.overrideWith((ref, cap) => true),
    ];
