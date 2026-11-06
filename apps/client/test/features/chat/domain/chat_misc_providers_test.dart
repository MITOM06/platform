// chat_misc_providers.dart: lookup providers (status/profile/conversation),
// server-shared wallpaper with optimistic override, per-conversation
// nicknames and quick reaction persisted in SharedPreferences.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:platform_client/core/providers/theme_provider.dart';
import 'package:platform_client/features/ai_hub/domain/ai_threads_provider.dart';
import 'package:platform_client/features/auth/data/auth_repository.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/chat/data/chat_repository.dart';
import 'package:platform_client/features/chat/domain/chat_misc_providers.dart';
import 'package:platform_client/features/chat/domain/chat_state.dart';
import 'package:platform_client/features/chat/domain/conversations_notifier.dart';

class _MockChatRepo extends Mock implements ChatRepository {}

class _MockAuthRepo extends Mock implements AuthRepository {}

class _Convs extends ConversationsNotifier {
  _Convs(this.initial);
  final List<ConversationModel> initial;
  @override
  Future<List<ConversationModel>> build() async => initial;
  void set(List<ConversationModel> list) => state = AsyncData(list);
}

class _Threads extends AiThreadsNotifier {
  _Threads(this.initial);
  final List<ConversationModel> initial;
  @override
  Future<List<ConversationModel>> build() async => initial;
}

ConversationModel _conv(String id, {String? wallpaper, List<String>? parts}) =>
    ConversationModel(
      id: id,
      participants: parts ?? const ['me', 'u2'],
      unreadCount: 0,
      createdAt: DateTime(2024),
      wallpaper: wallpaper,
    );

/// Riverpod flushes dependent providers on its scheduler.
Future<void> _tick() => Future<void>.delayed(Duration.zero);

void main() {
  late _MockChatRepo chat;
  late _MockAuthRepo auth;
  late ProviderContainer c;
  late SharedPreferences prefs;

  Future<void> make({
    List<ConversationModel> convs = const [],
    List<ConversationModel> threads = const [],
    Map<String, Object> stored = const {},
  }) async {
    SharedPreferences.setMockInitialValues(stored);
    prefs = await SharedPreferences.getInstance();
    chat = _MockChatRepo();
    auth = _MockAuthRepo();
    c = ProviderContainer(overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      chatRepositoryProvider.overrideWithValue(chat),
      authRepositoryProvider.overrideWithValue(auth),
      conversationsNotifierProvider.overrideWith(() => _Convs(convs)),
      aiThreadsProvider.overrideWith(() => _Threads(threads)),
    ]);
    addTearDown(c.dispose);
    c.listen(conversationsNotifierProvider, (_, __) {});
    await c.read(conversationsNotifierProvider.future);
    c.listen(aiThreadsProvider, (_, __) {});
    await c.read(aiThreadsProvider.future);
  }

  group('lookup providers', () {
    test('userStatus / userProfile / link preview read through the repos',
        () async {
      await make();
      when(() => chat.getUserStatus('u2')).thenAnswer(
          (_) async => const UserStatus(userId: 'u2', online: true));
      when(() => auth.getUserProfile('u2')).thenAnswer((_) async =>
          const UserModel(id: 'u2', email: 'b@x.io', displayName: 'Bob'));
      when(() => chat.fetchLinkPreview('https://a.io')).thenAnswer(
          (_) async => const LinkPreviewData(url: 'https://a.io', title: 'A'));

      expect((await c.read(userStatusProvider('u2').future)).online, isTrue);
      expect(
          (await c.read(userProfileProvider('u2').future)).displayName, 'Bob');
      expect((await c.read(linkPreviewProvider('https://a.io').future)).title,
          'A');
    });

    test('profile is cached (keepAlive) — a second read does not refetch',
        () async {
      await make();
      when(() => auth.getUserProfile('u2')).thenAnswer((_) async =>
          const UserModel(id: 'u2', email: 'b@x.io', displayName: 'Bob'));
      await c.read(userProfileProvider('u2').future);
      await c.read(userProfileProvider('u2').future);
      verify(() => auth.getUserProfile('u2')).called(1);
    });

    test('archived / blocked lists come from their repo calls', () async {
      await make();
      when(() => chat.listArchivedConversations())
          .thenAnswer((_) async => [_conv('a1')]);
      when(() => chat.listBlockedConversations())
          .thenAnswer((_) async => [_conv('b1')]);
      expect(
          (await c.read(archivedConversationsProvider.future)).single.id, 'a1');
      expect(
          (await c.read(blockedConversationsProvider.future)).single.id, 'b1');
    });

    test('conversationProvider: main list first, then AI threads, else null',
        () async {
      await make(
        convs: [_conv('c1')],
        threads: [
          _conv('ai1', parts: const ['me', 'ai-bot'])
        ],
      );
      expect(c.read(conversationProvider('c1'))?.id, 'c1');
      expect(c.read(conversationProvider('ai1'))?.id, 'ai1');
      expect(c.read(conversationProvider('nope')), isNull);
    });
  });

  group('ChatWallpaperNotifier', () {
    test('starts from the server-shared conversation value', () async {
      await make(convs: [_conv('c1', wallpaper: 'w1')]);
      expect(c.read(chatWallpaperProvider('c1')), 'w1');
      expect(c.read(chatWallpaperProvider('unknown')), isNull);
    });

    test(
        'optimistic value holds until the server reports it, then follows server',
        () async {
      await make(convs: [_conv('c1', wallpaper: 'w1')]);
      when(() => chat.setWallpaper('c1', 'w2'))
          .thenAnswer((_) async => _conv('c1', wallpaper: 'w2'));
      final n = c.read(chatWallpaperProvider('c1').notifier);
      await n.setWallpaper('w2');
      expect(c.read(chatWallpaperProvider('c1')), 'w2');

      final convs = c.read(conversationsNotifierProvider.notifier) as _Convs;
      // An unrelated stale server value must not overwrite the optimistic pick.
      convs.set([_conv('c1', wallpaper: 'w1')]);
      await _tick();
      expect(c.read(chatWallpaperProvider('c1')), 'w2');
      // Server catches up → optimistic cleared → later server changes apply.
      convs.set([_conv('c1', wallpaper: 'w2')]);
      await _tick();
      convs.set([_conv('c1', wallpaper: 'w3')]);
      await _tick();
      expect(c.read(chatWallpaperProvider('c1')), 'w3');
    });

    test('empty / null resets for everyone (sends "")', () async {
      await make(convs: [_conv('c1', wallpaper: 'w1')]);
      when(() => chat.setWallpaper('c1', ''))
          .thenAnswer((_) async => _conv('c1'));
      await c.read(chatWallpaperProvider('c1').notifier).setWallpaper('');
      expect(c.read(chatWallpaperProvider('c1')), isNull);
      verify(() => chat.setWallpaper('c1', '')).called(1);
    });

    test('server failure falls back to the server-shared value', () async {
      await make(convs: [_conv('c1', wallpaper: 'w1')]);
      when(() => chat.setWallpaper('c1', 'w2')).thenThrow(Exception('403'));
      await c.read(chatWallpaperProvider('c1').notifier).setWallpaper('w2');
      expect(c.read(chatWallpaperProvider('c1')), 'w1');
    });

    test('applyRemote (legacy system message) sets locally without a PUT',
        () async {
      await make(convs: [_conv('c1')]);
      c.read(chatWallpaperProvider('c1').notifier).applyRemote('legacy');
      expect(c.read(chatWallpaperProvider('c1')), 'legacy');
      c.read(chatWallpaperProvider('c1').notifier).applyRemote('');
      expect(c.read(chatWallpaperProvider('c1')), isNull);
      verifyNever(() => chat.setWallpaper(any(), any()));
    });
  });

  group('NicknamesNotifier', () {
    test('parses stored "id:nick" pairs (nick may contain ":"), skips junk',
        () async {
      await make(stored: {
        'chat_nicknames_c1': ['u1:Bobby', 'u2:Dr: Who', 'garbage'],
      });
      expect(c.read(nicknamesProvider('c1')), {'u1': 'Bobby', 'u2': 'Dr: Who'});
      expect(c.read(nicknamesProvider('c2')), isEmpty);
    });

    test('set persists per conversation; empty nickname removes it', () async {
      await make();
      final n = c.read(nicknamesProvider('c1').notifier);
      await n.setNickname('u1', 'Bob');
      await n.setNickname('u2', 'Al');
      expect(prefs.getStringList('chat_nicknames_c1'), ['u1:Bob', 'u2:Al']);
      await n.setNickname('u1', '');
      expect(c.read(nicknamesProvider('c1')), {'u2': 'Al'});
      expect(prefs.getStringList('chat_nicknames_c1'), ['u2:Al']);
      expect(prefs.getStringList('chat_nicknames_c2'), isNull);
    });
  });

  group('QuickReactionNotifier', () {
    test('defaults to 👍, loads stored, persists a change', () async {
      await make(stored: {'chat_quick_reaction_c2': '🔥'});
      expect(c.read(quickReactionProvider('c1')), '👍');
      expect(c.read(quickReactionProvider('c2')), '🔥');
      await c.read(quickReactionProvider('c1').notifier).setQuickReaction('❤️');
      expect(c.read(quickReactionProvider('c1')), '❤️');
      expect(prefs.getString('chat_quick_reaction_c1'), '❤️');
    });
  });
}
