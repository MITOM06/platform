// Pure-logic tests for MessageModel — the rich computed getters used all over
// the chat UI (MessageBubble branch selection, AI sentinel/error-code states,
// media-type detection, defensive file-meta JSON decoding) plus the defensive
// fromJson parsing. No Flutter/STOMP/Dio needed — these are pure Dart.

import 'package:flutter_test/flutter_test.dart';

import 'package:platform_client/features/chat/domain/chat_models.dart';

MessageModel _msg({
  String type = 'text',
  String content = 'hello',
  String senderId = 'user-1',
  String id = 'm-1',
}) =>
    MessageModel(
      id: id,
      conversationId: 'c-1',
      senderId: senderId,
      content: content,
      type: type,
      readBy: const [],
      createdAt: DateTime(2024, 1, 1),
    );

void main() {
  group('MessageModel — type getters', () {
    test('isSystem / isAiMessage / media types reflect the type field', () {
      expect(_msg(type: 'system').isSystem, isTrue);
      expect(_msg(type: 'ai').isAiMessage, isTrue);
      expect(_msg(type: 'image').isImage, isTrue);
      expect(_msg(type: 'video').isVideo, isTrue);
      expect(_msg(type: 'image').isMedia, isTrue);
      expect(_msg(type: 'video').isMedia, isTrue);
      expect(_msg(type: 'text').isMedia, isFalse);
      expect(_msg(type: 'file').isFile, isTrue);
      expect(_msg(type: 'voice').isVoice, isTrue);
      expect(_msg(type: 'sticker').isSticker, isTrue);
      expect(_msg(type: 'call_log').isCallLog, isTrue);
    });

    test('isAiBot is true only for the well-known AI bot user id', () {
      expect(_msg(senderId: kAiBotUserId).isAiBot, isTrue);
      expect(_msg(senderId: 'someone-else').isAiBot, isFalse);
    });

    test('isEdited reflects whether editedAt is set', () {
      expect(_msg().isEdited, isFalse);
      final edited = _msg().copyWith(editedAt: DateTime(2024, 2, 2));
      expect(edited.isEdited, isTrue);
    });
  });

  group('MessageModel — AI sentinel states', () {
    // These getters must be true ONLY when the message is an AI message whose
    // content equals the exact sentinel. A non-AI message carrying the same
    // text must not trip them (regression guard for the AI bubble branches).
    test('isAiError only when type==ai AND content==error sentinel', () {
      expect(_msg(type: 'ai', content: kAiErrorSentinel).isAiError, isTrue);
      expect(_msg(type: 'text', content: kAiErrorSentinel).isAiError, isFalse);
      expect(_msg(type: 'ai', content: 'normal reply').isAiError, isFalse);
    });

    test('isAiQuotaExceeded only for ai + quota sentinel', () {
      expect(
        _msg(type: 'ai', content: kAiQuotaExceededSentinel).isAiQuotaExceeded,
        isTrue,
      );
      expect(
        _msg(type: 'text', content: kAiQuotaExceededSentinel).isAiQuotaExceeded,
        isFalse,
      );
    });

    test('isAiStreamInterrupted only for ai + interrupted sentinel', () {
      expect(
        _msg(type: 'ai', content: kAiStreamInterruptedSentinel)
            .isAiStreamInterrupted,
        isTrue,
      );
      expect(
        _msg(type: 'ai', content: 'x').isAiStreamInterrupted,
        isFalse,
      );
    });

    test('isAiUnavailable only for ai + unavailable sentinel', () {
      expect(
        _msg(type: 'ai', content: kAiUnavailableSentinel).isAiUnavailable,
        isTrue,
      );
      expect(
        _msg(type: 'text', content: kAiUnavailableSentinel).isAiUnavailable,
        isFalse,
      );
    });

    test('the four sentinel states are mutually exclusive', () {
      final m = _msg(type: 'ai', content: kAiUnavailableSentinel);
      expect(m.isAiUnavailable, isTrue);
      expect(m.isAiError, isFalse);
      expect(m.isAiQuotaExceeded, isFalse);
      expect(m.isAiStreamInterrupted, isFalse);
    });
  });

  group('MessageModel — file meta decoding', () {
    test('decodes {url,name,size} JSON in content for file messages', () {
      final m = _msg(
        type: 'file',
        content: '{"url":"/api/uploads/a.pdf","name":"a.pdf","size":2048}',
      );
      expect(m.fileUrl, '/api/uploads/a.pdf');
      expect(m.fileName, 'a.pdf');
      expect(m.fileSize, 2048);
    });

    test('falls back to raw content as url when JSON is malformed', () {
      final m = _msg(type: 'file', content: 'https://x.test/raw.bin');
      expect(m.fileUrl, 'https://x.test/raw.bin');
      expect(m.fileName, 'file'); // default
      expect(m.fileSize, 0); // default
    });

    test('file meta getters are inert for non-file messages', () {
      final m = _msg(type: 'text', content: '{"url":"x","name":"y","size":1}');
      // _fileMeta returns null for non-file → falls back to content/defaults.
      expect(m.fileUrl, m.content);
      expect(m.fileName, 'file');
      expect(m.fileSize, 0);
    });
  });

  group('MessageModel.fromJson — defensive parsing', () {
    test('fills sensible defaults for a minimal payload', () {
      final m = MessageModel.fromJson(const {'content': 'hi'});
      expect(m.id, '');
      expect(m.conversationId, '');
      expect(m.senderId, '');
      expect(m.content, 'hi');
      expect(m.type, 'text'); // default type
      expect(m.readBy, isEmpty);
      expect(m.recalled, isFalse);
      expect(m.mentions, isEmpty);
    });

    test('parses readBy / mentions / reactions / editedAt', () {
      final m = MessageModel.fromJson(const {
        'id': 'x',
        'conversationId': 'c',
        'senderId': 's',
        'content': 'body',
        'type': 'text',
        'readBy': ['u1', 'u2'],
        'mentions': ['u3'],
        'reactions': [
          {'userId': 'u1', 'emoji': '👍'}
        ],
        'editedAt': '2024-05-01T10:00:00.000Z',
        'createdAt': '2024-05-01T09:00:00.000Z',
      });
      expect(m.readBy, ['u1', 'u2']);
      expect(m.mentions, ['u3']);
      expect(m.reactions, hasLength(1));
      expect(m.reactions.first.emoji, '👍');
      expect(m.isEdited, isTrue);
    });

    test('invalid createdAt string falls back to a non-null DateTime', () {
      final m = MessageModel.fromJson(const {'createdAt': 'not-a-date'});
      // tryParse returns null → fromJson substitutes DateTime.now().
      expect(m.createdAt, isNotNull);
    });
  });
}
