import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/meeting_summary.dart';

void main() {
  group('normalizeSummary', () {
    test('non-object is null', () {
      for (final v in [null, 'x', 3, <Object?>[], true]) {
        expect(normalizeSummary(v), isNull);
      }
    });

    test('reads the old group-call shape (actionItems: string[])', () {
      final s = normalizeSummary({
        'attendees': ['An', 'Binh'],
        'durationSec': 125,
        'overview': 'Talked',
        'keyPoints': ['a', 'b'],
        'actionItems': ['do x', 'do y'],
      })!;
      expect(s.attendees, ['An', 'Binh']);
      expect(s.durationSec, 125);
      expect(s.overview, 'Talked');
      expect(s.keyPoints, ['a', 'b']);
      expect(s.actionItems.map((a) => (a.text, a.assigneeName)),
          [('do x', null), ('do y', null)]);
      expect(s.decisions, isEmpty);
      expect(s.fromMaterials, isEmpty);
      expect(s.title, isNull);
    });

    test('reads the new meeting shape', () {
      final s = normalizeSummary({
        'title': ' Weekly ',
        'overview': 'o',
        'decisions': ['d1'],
        'fromMaterials': ['m1'],
        'actionItems': [
          {'text': 'ship', 'assigneeName': 'Lan'},
          {'text': 'test', 'assigneeName': '  '},
          {'text': 'plain'},
        ],
        'durationSec': 60,
      })!;
      expect(s.title, 'Weekly');
      expect(s.decisions, ['d1']);
      expect(s.fromMaterials, ['m1']);
      expect(s.actionItems.map((a) => (a.text, a.assigneeName)),
          [('ship', 'Lan'), ('test', null), ('plain', null)]);
    });

    test('trims strings, drops blanks and wrong-typed elements', () {
      final s = normalizeSummary({
        'keyPoints': [' a ', '', '   ', 3, null, 'b'],
        'actionItems': [
          {'text': '  '},
          {'text': 5},
          '  ',
          7,
          {'text': ' ok ', 'assigneeName': ' Lan '},
        ],
      })!;
      expect(s.keyPoints, ['a', 'b']);
      expect(s.actionItems.map((a) => (a.text, a.assigneeName)),
          [('ok', 'Lan')]);
    });

    test('overview is kept raw (not trimmed), like web', () {
      expect(normalizeSummary({'overview': '  hi \n'})!.overview, '  hi \n');
    });

    test('wrong-typed fields get empty defaults', () {
      final s = normalizeSummary({
        'overview': 3,
        'keyPoints': 'x',
        'decisions': {'a': 1},
        'actionItems': 'x',
        'attendees': 4,
        'title': '  ',
      })!;
      expect(s.overview, '');
      expect(s.keyPoints, isEmpty);
      expect(s.decisions, isEmpty);
      expect(s.actionItems, isEmpty);
      expect(s.attendees, isEmpty);
      expect(s.title, isNull);
    });

    test('durationSec must be a finite number >= 0, else 0', () {
      int d(Object? v) => normalizeSummary({'durationSec': v})!.durationSec;
      expect(d(90), 90);
      expect(d(90.7), 90);
      expect(d(-1), 0);
      expect(d(double.nan), 0);
      expect(d(double.infinity), 0);
      expect(d('5'), 0);
      expect(d(null), 0);
    });
  });

  group('MeetingSummaryResponse.fromJson', () {
    test('parses state, summary, group and inGroup', () {
      final r = MeetingSummaryResponse.fromJson({
        'state': 'DONE',
        'summary': {'overview': 'x'},
        'groupConversationId': 'g1',
        'inGroup': true,
      })!;
      expect(r.state, MeetingSummaryState.done);
      expect(r.summary?.overview, 'x');
      expect(r.groupConversationId, 'g1');
      expect(r.inGroup, isTrue);
    });

    test('null / unknown state => state null; inGroup defaults false', () {
      expect(MeetingSummaryResponse.fromJson({'state': null})!.state, isNull);
      final r = MeetingSummaryResponse.fromJson({'state': 'WAT'})!;
      expect(r.state, isNull);
      expect(r.inGroup, isFalse);
      expect(r.summary, isNull);
    });

    test('non-object body is null', () {
      expect(MeetingSummaryResponse.fromJson('x'), isNull);
    });
  });
}
