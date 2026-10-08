import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/admin/data/models/admin_models.dart';
import 'package:platform_client/features/admin/state/admin_providers.dart';
import 'package:platform_client/features/admin/state/capabilities_provider.dart';
import 'package:platform_client/features/meetings/data/meetings_repository.dart';
import 'package:platform_client/features/meetings/data/my_departments_repository.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/state/meetings_providers.dart';
import 'package:platform_client/features/meetings/state/meetings_store.dart';

Meeting meeting(String id, {int day = 8}) => Meeting(
    id: id,
    code: 'abc-defg-hjk',
    title: 'M $id',
    host: const MeetingPerson(userId: 'h', displayName: 'Lan'),
    scheduledStart: DateTime.utc(2026, 10, day, 2),
    status: MeetingStatus.scheduled,
    viewerRole: MeetingViewerRole.host,
    createdAt: DateTime.utc(2026, 10, 7));

class _FakeApi implements MeetingsApi {
  final listCalls = <(MeetingListScope, String?)>[];
  final pages = <String?, MeetingPage>{};
  Object? createError;

  @override
  Future<MeetingPage> list(MeetingListScope scope,
      {String? cursor, int size = 20}) async {
    listCalls.add((scope, cursor));
    return pages[cursor] ?? const MeetingPage(content: [], hasNext: false);
  }

  @override
  Future<Meeting> create([MeetingInput input = const MeetingInput()]) async {
    final e = createError;
    if (e != null) throw e;
    return meeting('new');
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _FakeMyDepartments implements MyDepartmentsApi {
  @override
  Future<List<DepartmentOption>> list() async =>
      const [DepartmentOption(id: 'd2', name: 'Beta')];
}

class _FakeAdminDepartments extends DepartmentsNotifier {
  @override
  Future<List<Department>> build() async => const [
        Department(id: 'd2', name: 'Beta'),
        Department(id: 'd1', name: 'Alpha'),
      ];
}

class _RecordingCaps extends CapabilitiesNotifier {
  int silentRefreshes = 0;

  @override
  Future<MeCapabilities> build() async => const MeCapabilities(
        role: 'Member',
        perms: [],
        depts: [],
        workspace: WorkspacePublicConfig(
            name: 'Acme', features: {}, connectorAllowList: []),
      );

  @override
  Future<void> refreshSilently() async => silentRefreshes++;
}

DioException forbidden(String code) {
  final req = RequestOptions(path: '/api/meetings');
  return DioException(
    requestOptions: req,
    type: DioExceptionType.badResponse,
    response: Response(
        requestOptions: req, statusCode: 403, data: {'code': code}),
  );
}

void main() {
  late _FakeApi api;
  late ProviderContainer c;

  ProviderContainer make({bool canManage = false, _RecordingCaps? caps}) =>
      ProviderContainer(overrides: [
        meetingsRepositoryProvider.overrideWithValue(api),
        myDepartmentsRepositoryProvider.overrideWithValue(_FakeMyDepartments()),
        departmentsProvider.overrideWith(_FakeAdminDepartments.new),
        hasCapabilityProvider
            .overrideWith((ref, cap) => canManage && cap == Cap.manageDepartments),
        if (caps != null) capabilitiesProvider.overrideWith(() => caps),
      ]);

  setUp(() {
    api = _FakeApi()
      ..pages[null] = MeetingPage(content: [meeting('m1')], hasNext: true)
      ..pages['m1'] = MeetingPage(content: [meeting('m2', day: 9)], hasNext: false);
    c = make();
  });
  tearDown(() => c.dispose());

  test('loads the first page, then the next one by the last row id', () async {
    final sub = c.listen(meetingListProvider(MeetingListScope.upcoming), (_, __) {});
    final first = await c.read(meetingListProvider(MeetingListScope.upcoming).future);
    expect(first.rows.map((m) => m.id), ['m1']);

    await c.read(meetingListProvider(MeetingListScope.upcoming).notifier).loadMore();
    final next = c.read(meetingListProvider(MeetingListScope.upcoming)).requireValue;
    expect(next.rows.map((m) => m.id), ['m1', 'm2']);
    expect(api.listCalls, [
      (MeetingListScope.upcoming, null),
      (MeetingListScope.upcoming, 'm1'),
    ]);

    await c.read(meetingListProvider(MeetingListScope.upcoming).notifier).loadMore();
    expect(api.listCalls, hasLength(2)); // hasNext=false ⇒ no call
    sub.close();
  });

  test('a store patch shows in the list without refetching', () async {
    final sub = c.listen(meetingListProvider(MeetingListScope.upcoming), (_, __) {});
    await c.read(meetingListProvider(MeetingListScope.upcoming).future);
    c.read(meetingsStoreProvider.notifier).updateCache(
        (s) => s.markEnded('m1', DateTime.utc(2026, 10, 8), cancelled: true));
    final rows = c.read(meetingListProvider(MeetingListScope.upcoming)).requireValue.rows;
    expect(rows, isEmpty);
    expect(api.listCalls, hasLength(1));
    sub.close();
  });

  test('a stale past list is fetched again next time it is shown', () async {
    final scope = meetingListProvider(MeetingListScope.past);
    var sub = c.listen(scope, (_, __) {});
    await c.read(scope.future);
    sub.close();
    c.invalidate(scope);

    sub = c.listen(scope, (_, __) {});
    await c.read(scope.future);
    expect(api.listCalls, hasLength(1)); // cached and fresh ⇒ no call

    c.read(meetingsStoreProvider.notifier).updateCache(
        (s) => s.markEnded('m1', DateTime.utc(2026, 10, 8), cancelled: false));
    sub.close();
    c.invalidate(scope);
    sub = c.listen(scope, (_, __) {});
    await c.read(scope.future);
    expect(api.listCalls, hasLength(2));
    expect(c.read(meetingsStoreProvider).pastStale, isFalse);
    sub.close();
  });

  group('department options', () {
    Future<List<String>> names(ProviderContainer c) async {
      final sub = c.listen(meetingDepartmentOptionsProvider, (_, __) {});
      await c.read(myDepartmentsProvider.future);
      await c.read(departmentsProvider.future);
      final out = c.read(meetingDepartmentOptionsProvider).map((d) => d.name).toList();
      sub.close();
      return out;
    }

    test('MANAGE_DEPARTMENTS adds every department, unique and sorted', () async {
      final mc = make(canManage: true);
      addTearDown(mc.dispose);
      expect(await names(mc), ['Alpha', 'Beta']);
    });

    test('otherwise only mine', () async {
      expect(await names(c), ['Beta']);
    });
  });

  test('create forbidden ⇒ capabilities refreshed silently and the error rethrown', () async {
    final caps = _RecordingCaps();
    final mc = make(caps: caps);
    addTearDown(mc.dispose);
    api.createError = forbidden('MEETING_CREATE_FORBIDDEN');
    await expectLater(mc.read(meetingActionsProvider).create(const MeetingInput()),
        throwsA(isA<DioException>()));
    expect(caps.silentRefreshes, 1);
  });

  test('create stores the meeting', () async {
    final m = await c.read(meetingActionsProvider).create(const MeetingInput());
    expect(c.read(meetingsStoreProvider).byId[m.id], same(m));
  });
}
