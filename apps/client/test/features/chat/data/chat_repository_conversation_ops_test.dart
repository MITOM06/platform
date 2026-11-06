// ChatRepositoryConversationOps: exact chat-service contract + parsing, the
// 409 "already exists" recovery of getOrCreateConversation, and error
// propagation.

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:platform_client/features/chat/data/chat_repository.dart';

import 'recording_adapter.dart';

void main() {
  late RecordingAdapter http;
  late ChatRepository repo;

  setUp(() {
    http = RecordingAdapter();
    repo = ChatRepository(recordingDio(http));
  });

  group('lists', () {
    test('main list excludes AI threads, one 100-item page', () async {
      http.on('GET', '/api/conversations', {
        'content': [conversationJson('c1'), conversationJson('c2')],
      });
      final res = await repo.listConversations();
      expect(http.last.query, {'size': 100, 'excludeAi': true});
      expect(res.map((c) => c.id), ['c1', 'c2']);
    });

    test('archived and blocked lists use their flags', () async {
      http.on('GET', '/api/conversations', {
        'content': [conversationJson('a1')],
      });
      expect((await repo.listArchivedConversations()).single.id, 'a1');
      expect(http.last.query,
          {'archived': true, 'size': 100, 'excludeAi': true});
      await repo.listBlockedConversations();
      expect(http.last.query, {'blocked': true, 'size': 100});
    });

    test('public channels: q only when non-empty', () async {
      http.on('GET', '/api/conversations/public', {
        'content': [conversationJson('p1', type: 'group')],
      });
      await repo.listPublicChannels();
      expect(http.last.query, isEmpty);
      await repo.listPublicChannels(query: '');
      expect(http.last.query, isEmpty);
      final res = await repo.listPublicChannels(query: 'eng');
      expect(http.last.query, {'q': 'eng'});
      expect(res.single.isGroup, isTrue);
    });

    test('shared attachments paging params', () async {
      http.on('GET', '/api/conversations/c1/attachments', {
        'content': [messageJson('m1')],
      });
      final res = await repo.getSharedAttachments('c1', 'media', page: 2);
      expect(http.last.query, {'type': 'media', 'page': 2, 'size': 30});
      expect(res.single.id, 'm1');
    });

    test('a list error propagates (no silent empty list)', () async {
      http.on('GET', '/api/conversations', {'error': 'x'}, status: 500);
      await expectLater(
          repo.listConversations(), throwsA(isA<DioException>()));
    });
  });

  group('group management', () {
    test('createGroup sends members, department only when set, public flag',
        () async {
      http.on('POST', '/api/conversations/group',
          conversationJson('g1', type: 'group'));
      final g = await repo.createGroup('Team', ['u2', 'u3']);
      expect(http.last.body, {
        'name': 'Team',
        'avatarUrl': null,
        'participantIds': ['u2', 'u3'],
        'publicChannel': false,
      });
      expect(g.id, 'g1');

      await repo.createGroup('Eng', ['u2'],
          departmentId: 'd1', publicChannel: true, avatarUrl: '/a.png');
      expect(http.last.body, {
        'name': 'Eng',
        'avatarUrl': '/a.png',
        'participantIds': ['u2'],
        'departmentId': 'd1',
        'publicChannel': true,
      });
    });

    test('updateConversation sends only the provided fields', () async {
      http.on('PUT', '/api/conversations/g1', conversationJson('g1'));
      await repo.updateConversation('g1', name: 'New');
      expect(http.last.body, {'name': 'New'});
      await repo.updateConversation('g1', publicChannel: false);
      expect(http.last.body, {'publicChannel': false});
    });

    test('members and admins endpoints', () async {
      for (final r in [
        ('POST', '/api/conversations/g1/members'),
        ('POST', '/api/conversations/g1/admins/u2'),
        ('DELETE', '/api/conversations/g1/admins/u2'),
        ('DELETE', '/api/conversations/g1/members/u3'),
      ]) {
        http.on(r.$1, r.$2, conversationJson('g1', type: 'group'));
      }
      await repo.addMembers('g1', ['u4']);
      expect(http.last.body, {'userIds': ['u4']});
      await repo.promoteAdmin('g1', 'u2');
      expect((http.last.method, http.last.path),
          ('POST', '/api/conversations/g1/admins/u2'));
      await repo.demoteAdmin('g1', 'u2');
      expect((http.last.method, http.last.path),
          ('DELETE', '/api/conversations/g1/admins/u2'));
      await repo.removeMember('g1', 'u3');
      expect((http.last.method, http.last.path),
          ('DELETE', '/api/conversations/g1/members/u3'));
    });

    test('demoting the last admin (409) propagates', () async {
      http.on('DELETE', '/api/conversations/g1/admins/u1',
          {'code': 'LAST_ADMIN_CANNOT_BE_REMOVED'},
          status: 409);
      await expectLater(
        repo.demoteAdmin('g1', 'u1'),
        throwsA(isA<DioException>()
            .having((e) => e.response?.statusCode, 'status', 409)),
      );
    });

    test('wallpaper + auto-delete settings bodies', () async {
      http.on('PUT', '/api/conversations/c1/wallpaper', conversationJson('c1'));
      await repo.setWallpaper('c1', '');
      expect(http.last.body, {'wallpaper': ''});
      http.on('PUT', '/api/conversations/c1/settings', conversationJson('c1'));
      await repo.setAutoDelete('c1', null);
      expect(http.last.body, {'autoDeleteSeconds': null});
      await repo.setAutoDelete('c1', 3600);
      expect(http.last.body, {'autoDeleteSeconds': 3600});
    });
  });

  group('lifecycle and per-user state', () {
    test('every POST action hits its endpoint and parses the conversation',
        () async {
      final actions = <String, Future<Object?> Function()>{
        'block-archive': () => repo.blockArchiveConversation('c1'),
        'block-restore': () => repo.blockRestoreConversation('c1'),
        'accept': () => repo.acceptConversation('c1'),
        'unmute': () => repo.unmuteConversation('c1'),
        'archive': () => repo.archiveConversation('c1'),
        'unarchive': () => repo.unarchiveConversation('c1'),
        'unread': () => repo.markConversationUnread('c1'),
        'read': () => repo.markConversationRead('c1'),
        'join': () => repo.joinChannel('c1'),
      };
      for (final e in actions.entries) {
        http.on('POST', '/api/conversations/c1/${e.key}', conversationJson('c1'));
        await e.value();
        expect((http.last.method, http.last.path),
            ('POST', '/api/conversations/c1/${e.key}'),
            reason: e.key);
      }
    });

    test('mute sends duration (default forever = -1)', () async {
      http.on('POST', '/api/conversations/c1/mute', conversationJson('c1'));
      await repo.muteConversation('c1');
      expect(http.last.body, {'durationSeconds': -1});
      await repo.muteConversation('c1', durationSeconds: 900);
      expect(http.last.body, {'durationSeconds': 900});
    });

    test('delete / clear history', () async {
      await repo.deleteConversation('c1');
      expect((http.last.method, http.last.path),
          ('DELETE', '/api/conversations/c1'));
      await repo.clearHistory('c1');
      expect((http.last.method, http.last.path),
          ('POST', '/api/conversations/c1/clear'));
    });

    test('getConversation + user status parsing', () async {
      http.on('GET', '/api/conversations/c1', conversationJson('c1'));
      expect((await repo.getConversation('c1')).participants, ['u1', 'u2']);
      http.on('GET', '/api/users/u2/status',
          {'userId': 'u2', 'online': true});
      final s = await repo.getUserStatus('u2');
      expect(s.userId, 'u2');
      expect(s.online, isTrue);
    });
  });

  group('getOrCreateConversation', () {
    test('creates a direct conversation', () async {
      http.on('POST', '/api/conversations', conversationJson('new'));
      final c = await repo.getOrCreateConversation('u2');
      expect(http.last.body, {'participantId': 'u2'});
      expect(c.id, 'new');
    });

    test('409 → fetches and returns the existing conversation', () async {
      http.on('POST', '/api/conversations', {'conversationId': 'existing'},
          status: 409);
      http.on('GET', '/api/conversations/existing', conversationJson('existing'));
      final c = await repo.getOrCreateConversation('u2');
      expect(c.id, 'existing');
      expect(http.requests.map((r) => '${r.method} ${r.path}'),
          ['POST /api/conversations', 'GET /api/conversations/existing']);
    });

    test('other errors (blocked 403) are rethrown, no follow-up GET', () async {
      http.on('POST', '/api/conversations', {'code': 'USER_BLOCKED'},
          status: 403);
      await expectLater(repo.getOrCreateConversation('u2'),
          throwsA(isA<DioException>()));
      expect(http.requests, hasLength(1));
    });
  });
}
