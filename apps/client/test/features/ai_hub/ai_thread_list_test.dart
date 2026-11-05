import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:platform_client/core/utils/global_messenger.dart';
import 'package:platform_client/features/ai_hub/domain/ai_threads_provider.dart';
import 'package:platform_client/features/ai_hub/ui/widgets/ai_new_chat_button.dart';
import 'package:platform_client/features/ai_hub/ui/widgets/ai_thread_list.dart';
import 'package:platform_client/features/chat/domain/chat_state.dart';
import 'package:platform_client/l10n/app_localizations.dart';

ConversationModel _t(String id, {String? name}) => ConversationModel.fromJson({
      'id': id,
      'type': 'direct',
      'name': name,
      'participants': const ['me', kAiBotUserId],
      'createdAt': '2026-01-01T00:00:00Z',
    });

class _Fake extends AiThreadsNotifier {
  _Fake(this.initial, this.log, this.router);
  final List<ConversationModel> initial;
  final List<String> log;
  final GoRouter Function() router;
  Object? renameError;
  Object? deleteError;
  Future<void>? createGate;

  @override
  Future<List<ConversationModel>> build() async => initial;

  @override
  Future<ConversationModel> create() async {
    await createGate;
    final c = _t('new');
    state = AsyncData([c, ...state.value!]);
    log.add('create');
    return c;
  }

  @override
  Future<ConversationModel> rename(String id, String name) async {
    log.add('rename:$id:$name');
    if (renameError != null) throw renameError!;
    final c = _t(id, name: name);
    state = AsyncData([for (final x in state.value!) x.id == id ? c : x]);
    return c;
  }

  @override
  Future<void> deleteOnServer(String id) async {
    log.add('server-delete:$id@${router().routeInformationProvider.value.uri.path}');
    if (deleteError != null) throw deleteError!;
  }

  @override
  void drop(String id) {
    log.add('drop:$id@${router().routeInformationProvider.value.uri.path}');
    state = AsyncData(state.value!.where((c) => c.id != id).toList());
  }
}

DioException _nameInvalid() => DioException(
      requestOptions: RequestOptions(path: '/x'),
      response: Response(
        requestOptions: RequestOptions(path: '/x'),
        statusCode: 400,
        data: {'code': 'AI_THREAD_NAME_INVALID'},
      ),
    );

void main() {
  late List<String> log;
  late GoRouter router;
  late _Fake fake;

  Future<void> pumpList(WidgetTester tester, List<ConversationModel> threads,
      {String? openId, String start = '/'}) async {
    log = [];
    router = GoRouter(navigatorKey: rootNavigatorKey, initialLocation: start, routes: [
      GoRoute(
          path: '/',
          builder: (_, __) =>
              Scaffold(body: AiThreadList(openId: openId))),
      GoRoute(
          path: '/chat/:id',
          builder: (_, s) => Scaffold(
              body: AiThreadList(openId: s.pathParameters['id']))),
      GoRoute(
          path: '/ai-hub', builder: (_, __) => const Scaffold(body: Text('HUB'))),
    ]);
    fake = _Fake(threads, log, () => router);
    await tester.pumpWidget(ProviderScope(
      overrides: [aiThreadsProvider.overrideWith(() => fake)],
      child: MaterialApp.router(
        routerConfig: router,
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
      ),
    ));
    await tester.pumpAndSettle();
  }

  String path() => router.routeInformationProvider.value.uri.path;

  testWidgets('renders titles in order, untitled fallback, active highlighted',
      (tester) async {
    await pumpList(tester,
        [_t('a', name: '  Alpha '), _t('b'), _t('c', name: '   ')],
        openId: 'a');
    expect(find.text('Alpha'), findsOneWidget);
    expect(find.text('Chat with AI'), findsNWidgets(2));
    expect(tester.getTopLeft(find.text('Alpha')).dy,
        lessThan(tester.getTopLeft(find.text('Chat with AI').first).dy));
    expect(find.byKey(const ValueKey('ai-thread-active-a')), findsOneWidget);
    expect(find.byKey(const ValueKey('ai-thread-active-b')), findsNothing);
  });

  testWidgets('empty state', (tester) async {
    await pumpList(tester, []);
    expect(find.text('No conversations yet. Start a new one.'), findsOneWidget);
  });

  testWidgets('new chat creates and navigates', (tester) async {
    await pumpList(tester, [_t('a')]);
    await tester.tap(find.text('New conversation'));
    await tester.pumpAndSettle();
    expect(log, ['create']);
    expect(path(), '/chat/new');
  });

  testWidgets('tap thread navigates', (tester) async {
    await pumpList(tester, [_t('a', name: 'Alpha')]);
    await tester.tap(find.text('Alpha'));
    await tester.pumpAndSettle();
    expect(path(), '/chat/a');
  });

  testWidgets('rename submit saves trimmed', (tester) async {
    await pumpList(tester, [_t('a', name: 'Alpha')]);
    await tester.tap(find.byTooltip('Rename'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '  Beta  ');
    await tester.tap(find.byTooltip('Save'));
    await tester.pumpAndSettle();
    expect(log, ['rename:a:Beta']);
    expect(find.text('Beta'), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
  });

  testWidgets('rename cancel restores', (tester) async {
    await pumpList(tester, [_t('a', name: 'Alpha')]);
    await tester.tap(find.byTooltip('Rename'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Zzz');
    await tester.tap(find.byTooltip('Cancel'));
    await tester.pumpAndSettle();
    expect(log, isEmpty);
    expect(find.text('Alpha'), findsOneWidget);
  });

  testWidgets('invalid name shows localized error and keeps editor',
      (tester) async {
    await pumpList(tester, [_t('a', name: 'Alpha')]);
    fake.renameError = _nameInvalid();
    await tester.tap(find.byTooltip('Rename'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'x');
    await tester.tap(find.byTooltip('Save'));
    await tester.pumpAndSettle();
    expect(find.text('Name must be 1 to 80 characters.'), findsOneWidget);
    expect(find.byType(TextField), findsOneWidget);
  });

  testWidgets('delete confirm removes thread', (tester) async {
    await pumpList(tester, [_t('a', name: 'Alpha'), _t('b', name: 'Bravo')]);
    await tester.tap(find.byTooltip('Delete').last);
    await tester.pumpAndSettle();
    expect(find.text('Delete this conversation?'), findsOneWidget);
    await tester.tap(find.text('Confirm'));
    await tester.pumpAndSettle();
    expect(log, ['server-delete:b@/', 'drop:b@/']);
    expect(find.text('Bravo'), findsNothing);
  });

  testWidgets('delete cancel keeps thread', (tester) async {
    await pumpList(tester, [_t('a', name: 'Alpha')]);
    await tester.tap(find.byTooltip('Delete'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(log, isEmpty);
    expect(find.text('Alpha'), findsOneWidget);
  });

  testWidgets('deleting the open thread server-deletes, navigates to next, then drops',
      (tester) async {
    await pumpList(
        tester, [_t('a', name: 'A'), _t('b', name: 'B'), _t('c', name: 'C')],
        openId: 'b', start: '/chat/b');
    await tester.tap(find.byTooltip('Delete').at(1));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirm'));
    await tester.pumpAndSettle();
    expect(log, ['server-delete:b@/chat/b', 'drop:b@/chat/c']);
  });

  testWidgets('deleting the last open thread goes to previous',
      (tester) async {
    await pumpList(tester, [_t('a', name: 'A'), _t('b', name: 'B')],
        openId: 'b', start: '/chat/b');
    await tester.tap(find.byTooltip('Delete').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirm'));
    await tester.pumpAndSettle();
    expect(log, ['server-delete:b@/chat/b', 'drop:b@/chat/a']);
  });

  testWidgets('deleting the only open thread goes to the AI hub',
      (tester) async {
    await pumpList(tester, [_t('a', name: 'A')],
        openId: 'a', start: '/chat/a');
    await tester.tap(find.byTooltip('Delete'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirm'));
    await tester.pumpAndSettle();
    expect(log, ['server-delete:a@/chat/a', 'drop:a@/ai-hub']);
  });

  testWidgets('delete failure: error banner, stays on thread, still listed',
      (tester) async {
    await pumpList(tester, [_t('a', name: 'Alpha'), _t('b', name: 'Bravo')],
        openId: 'a', start: '/chat/a');
    fake.deleteError = Exception('boom');
    await tester.tap(find.byTooltip('Delete').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirm'));
    await tester.pumpAndSettle();
    expect(find.textContaining('boom'), findsNothing);
    expect(find.text("Couldn't delete the conversation. Please try again."),
        findsOneWidget);
    expect(path(), '/chat/a');
    expect(log, ['server-delete:a@/chat/a']);
    expect(find.text('Alpha'), findsOneWidget);
    await tester.pump(const Duration(seconds: 10));
  });

  testWidgets('header new-chat button disables while create is pending',
      (tester) async {
    final gate = Completer<void>();
    log = [];
    router = GoRouter(navigatorKey: rootNavigatorKey, routes: [
      GoRoute(
          path: '/',
          builder: (_, __) => const Scaffold(body: AiNewChatButton())),
      GoRoute(path: '/chat/:id', builder: (_, __) => const Scaffold()),
    ]);
    fake = _Fake([_t('a')], log, () => router)..createGate = gate.future;
    await tester.pumpWidget(ProviderScope(
      overrides: [aiThreadsProvider.overrideWith(() => fake)],
      child: MaterialApp.router(
        routerConfig: router,
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
      ),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(IconButton));
    await tester.pump();
    await tester.tap(find.byType(IconButton), warnIfMissed: false);
    await tester.pump();
    gate.complete();
    await tester.pumpAndSettle();
    expect(log.where((e) => e == 'create'), hasLength(1));
    expect(path(), '/chat/new');
  });
}
