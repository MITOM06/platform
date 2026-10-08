// Riverpod data layer for meetings — mirror of web `lib/hooks/use-meetings.ts`.
// Everything shared between screens lives in the normalized [MeetingsStore];
// providers read it, fetch what is missing and write back. STOMP events and
// mutations patch the store — nothing here refetches to stay current.
// Errors are mapped by the UI (`meetingErrorText`), never shown raw.

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../admin/data/models/admin_models.dart';
import '../../admin/state/admin_providers.dart';
import '../../admin/state/capabilities_provider.dart';
import '../data/meetings_repository.dart';
import '../data/my_departments_repository.dart';
import '../domain/cache_updates.dart';
import '../domain/meeting_errors.dart';
import '../domain/meeting_models.dart';
import 'meetings_store.dart';

export '../domain/cache_updates.dart' show ChatHistory, MeetingListData;

const _emptyList = MeetingListData(rows: [], hasNext: false);

/// One meeting list (Upcoming / Past), all loaded pages flattened.
class MeetingListNotifier
    extends AutoDisposeFamilyAsyncNotifier<MeetingListData, MeetingListScope> {
  bool _loadingMore = false;

  MeetingsApi get _api => ref.read(meetingsRepositoryProvider);
  MeetingsStore get _store => ref.read(meetingsStoreProvider.notifier);

  @override
  Future<MeetingListData> build(MeetingListScope scope) async {
    final cache = ref.read(meetingsStoreProvider);
    final cached = cache.list(scope);
    final stale = scope == MeetingListScope.past && cache.pastStale;
    final data = cached != null && !stale ? cached : await _fetchFirst(scope);
    // STOMP / mutation patches show at once.
    ref.listen<MeetingListData?>(
      meetingsStoreProvider.select((s) => s.list(scope)),
      (_, next) {
        if (next != null) state = AsyncData(next);
      },
    );
    return data;
  }

  Future<MeetingListData> _fetchFirst(MeetingListScope scope) async {
    final data = _emptyList.appendPage(await _api.list(scope));
    _store.updateCache((s) => s.setList(scope, data));
    return data;
  }

  /// Next page by cursor (= last row id). No-op without a next page. A
  /// failure keeps the loaded rows and is rethrown for the caller's banner.
  Future<void> loadMore() async {
    final data = state.valueOrNull;
    final cursor = data?.nextCursor;
    if (data == null || cursor == null || _loadingMore) return;
    _loadingMore = true;
    try {
      final page = await _api.list(arg, cursor: cursor);
      final current = ref.read(meetingsStoreProvider).list(arg) ?? data;
      final next = current.appendPage(page);
      _store.updateCache((s) => s.setList(arg, next));
      state = AsyncData(next);
    } finally {
      _loadingMore = false;
    }
  }

  /// Pull to refresh: the first page again, replacing what was loaded.
  Future<void> refresh() async {
    final data = await _fetchFirst(arg);
    state = AsyncData(data);
  }
}

final meetingListProvider = AsyncNotifierProvider.autoDispose
    .family<MeetingListNotifier, MeetingListData, MeetingListScope>(
        MeetingListNotifier.new);

/// One meeting (`GET /{id}`), kept current by store patches.
class MeetingDetailNotifier
    extends AutoDisposeFamilyAsyncNotifier<Meeting, String> {
  @override
  Future<Meeting> build(String id) async {
    final m = await ref.read(meetingsRepositoryProvider).get(id);
    ref.read(meetingsStoreProvider.notifier).updateCache((s) => s.put(m));
    ref.listen<Meeting?>(
      meetingsStoreProvider.select((s) => s.byId[id]),
      (_, next) {
        if (next != null) state = AsyncData(next);
      },
    );
    return m;
  }
}

final meetingDetailProvider = AsyncNotifierProvider.autoDispose
    .family<MeetingDetailNotifier, Meeting, String>(MeetingDetailNotifier.new);

/// `GET /by-code/{code}` (also ENDED meetings) → stored.
final meetingByCodeProvider =
    FutureProvider.autoDispose.family<Meeting, String>((ref, code) async {
  final m = await ref.read(meetingsRepositoryProvider).byCode(code);
  ref.read(meetingsStoreProvider.notifier).updateCache((s) => s.put(m));
  return m;
});

/// Chat history of a meeting (detail screen): newest page first, then older.
class ChatHistoryNotifier
    extends AutoDisposeFamilyAsyncNotifier<ChatHistory, String> {
  bool _loadingOlder = false;

  @override
  Future<ChatHistory> build(String id) async => ChatHistory.fromNewestPage(
      await ref.read(meetingsRepositoryProvider).messages(id));

  /// Rethrows a failure (the loaded lines stay).
  Future<void> loadOlder() async {
    final data = state.valueOrNull;
    final before = data?.oldestId;
    if (data == null || !data.hasOlder || before == null || _loadingOlder) {
      return;
    }
    _loadingOlder = true;
    try {
      final page = await ref
          .read(meetingsRepositoryProvider)
          .messages(arg, before: before);
      state = AsyncData(data.prependOlder(page));
    } finally {
      _loadingOlder = false;
    }
  }
}

final meetingChatHistoryProvider = AsyncNotifierProvider.autoDispose
    .family<ChatHistoryNotifier, ChatHistory, String>(ChatHistoryNotifier.new);

/// Departments the caller belongs to (auth-service).
final myDepartmentsProvider =
    FutureProvider.autoDispose<List<DepartmentOption>>(
        (ref) => ref.read(myDepartmentsRepositoryProvider).list());

/// Mine ∪ (MANAGE_DEPARTMENTS ⇒ every department), unique by id, sorted by
/// name — mirror of `useMeetingDepartmentOptions`. Empty while loading.
final meetingDepartmentOptionsProvider =
    Provider.autoDispose<List<DepartmentOption>>((ref) {
  final canManage = ref.watch(hasCapabilityProvider(Cap.manageDepartments));
  final mine = ref.watch(myDepartmentsProvider).valueOrNull ?? const [];
  final byId = <String, DepartmentOption>{for (final d in mine) d.id: d};
  if (canManage) {
    final all = ref.watch(departmentsProvider).valueOrNull ?? const [];
    for (final d in all) {
      if (d.name.isNotEmpty) {
        byId[d.id] = DepartmentOption(id: d.id, name: d.name);
      }
    }
  }
  return List.unmodifiable(byId.values.toList()
    ..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase())));
});

/// Meeting mutations; each patches the store on success.
class MeetingActions {
  MeetingActions(this._ref);

  final Ref _ref;

  MeetingsApi get _api => _ref.read(meetingsRepositoryProvider);

  void _store(Meeting m) =>
      _ref.read(meetingsStoreProvider.notifier).updateCache((s) => s.put(m));

  void _ended(String id, {required bool cancelled}) =>
      _ref.read(meetingsStoreProvider.notifier).updateCache((s) =>
          s.markEnded(id, DateTime.now().toUtc(), cancelled: cancelled));

  /// MEETING_CREATE_FORBIDDEN ⇒ the HOST_MEETING capability changed under us:
  /// refresh it so the create buttons disappear, then rethrow.
  Future<Meeting> create([MeetingInput input = const MeetingInput()]) async {
    try {
      final m = await _api.create(input);
      _store(m);
      return m;
    } catch (e) {
      if (parseMeetingError(e).code == 'MEETING_CREATE_FORBIDDEN') {
        unawaited(_ref.read(capabilitiesProvider.notifier).refreshSilently());
      }
      rethrow;
    }
  }

  Future<Meeting> update(String id, MeetingInput input) async {
    final m = await _api.update(id, input);
    _store(m);
    return m;
  }

  Future<void> cancel(String id) async {
    await _api.cancel(id);
    _ended(id, cancelled: true);
  }

  Future<void> end(String id) async {
    await _api.end(id);
    _ended(id, cancelled: false);
  }
}

final meetingActionsProvider =
    Provider<MeetingActions>((ref) => MeetingActions(ref));
