import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/domain/ai_action_card_logic.dart';
import 'package:platform_client/features/chat/domain/ai_pending_action.dart';

DioException _http(int status, [Object? body]) {
  final o = RequestOptions(path: '/x');
  return DioException(
      requestOptions: o,
      type: DioExceptionType.badResponse,
      response: Response(requestOptions: o, statusCode: status, data: body));
}

void main() {
  final now = DateTime.utc(2026, 5, 1, 12);

  group('actionCardKind', () {
    AiPendingAction a({
      AiActionStatus status = AiActionStatus.pending,
      DateTime? expiresAt,
      String? requesterId = 'me',
    }) =>
        AiPendingAction(
            id: 'x',
            status: status,
            expiresAt: expiresAt,
            requesterId: requesterId);

    test('a resolved server status always wins over local', () {
      expect(
          actionCardKind(a(status: AiActionStatus.confirmed),
              me: 'me', now: now, local: ActionCardKind.cancelled),
          ActionCardKind.confirmed);
      expect(actionCardKind(a(status: AiActionStatus.cancelled), me: 'me', now: now),
          ActionCardKind.cancelled);
      expect(actionCardKind(a(status: AiActionStatus.failed), me: 'me', now: now),
          ActionCardKind.failed);
      expect(actionCardKind(a(status: AiActionStatus.expired), me: 'me', now: now),
          ActionCardKind.expired);
      expect(actionCardKind(a(status: AiActionStatus.unknown), me: 'me', now: now),
          ActionCardKind.expired);
    });

    test('pending: a local outcome is shown, unless it is actionable/waiting',
        () {
      expect(
          actionCardKind(a(), me: 'me', now: now, local: ActionCardKind.handled),
          ActionCardKind.handled);
      expect(
          actionCardKind(a(),
              me: 'me', now: now, local: ActionCardKind.waiting),
          ActionCardKind.actionable);
      expect(
          actionCardKind(a(),
              me: 'other', now: now, local: ActionCardKind.actionable),
          ActionCardKind.waiting);
    });

    test('pending: expiry at or before now → expired', () {
      expect(actionCardKind(a(expiresAt: now), me: 'me', now: now),
          ActionCardKind.expired);
      expect(
          actionCardKind(a(expiresAt: now.add(const Duration(minutes: 1))),
              me: 'me', now: now),
          ActionCardKind.actionable);
    });

    test('pending: only the requester gets buttons; unknown me waits', () {
      expect(actionCardKind(a(), me: 'someone', now: now),
          ActionCardKind.waiting);
      expect(actionCardKind(a(), me: null, now: now), ActionCardKind.waiting);
      expect(actionCardKind(a(requesterId: null), me: 'me', now: now),
          ActionCardKind.waiting);
    });
  });

  test('actionOutcomeFromResponse maps {status}', () {
    expect(actionOutcomeFromResponse({'status': 'confirmed'}),
        ActionCardKind.confirmed);
    expect(actionOutcomeFromResponse({'status': 'cancelled'}),
        ActionCardKind.cancelled);
    expect(
        actionOutcomeFromResponse({'status': 'failed'}), ActionCardKind.failed);
    expect(actionOutcomeFromResponse({'status': 'pending'}), isNull);
    expect(actionOutcomeFromResponse('confirmed'), isNull);
    expect(actionOutcomeFromResponse(null), isNull);
  });

  group('aiActionErrorOutcome', () {
    void check(Object e, AiActionError err, ActionCardKind? next) {
      final o = aiActionErrorOutcome(e);
      expect(o.error, err);
      expect(o.outcome, next);
    }

    test('codes and statuses', () {
      check(_http(400, {'code': 'ACTION_EXPIRED'}), AiActionError.expired,
          ActionCardKind.expired);
      check(_http(410), AiActionError.expired, ActionCardKind.expired);
      check(_http(400, {'code': 'ACTION_NOT_FOUND'}), AiActionError.notFound,
          ActionCardKind.expired);
      check(_http(404), AiActionError.notFound, ActionCardKind.expired);
      check(_http(400, {'code': 'ACTION_ALREADY_RESOLVED'}),
          AiActionError.alreadyResolved, ActionCardKind.handled);
      check(_http(409), AiActionError.alreadyResolved, ActionCardKind.handled);
      check(_http(400, {'code': 'ACTION_NOT_OWNER'}), AiActionError.notOwner,
          null);
      check(_http(403), AiActionError.notOwner, null);
      check(_http(500, 'html'), AiActionError.generic, null);
    });

    test('no response → network; non-Dio → generic', () {
      check(
          DioException(
              requestOptions: RequestOptions(path: '/x'),
              type: DioExceptionType.connectionTimeout),
          AiActionError.network,
          null);
      check(StateError('x'), AiActionError.generic, null);
    });
  });

  group('actionSummaryLines', () {
    AiPendingAction s(Map<String, dynamic> summary) =>
        AiPendingAction(id: 'x', summary: summary);

    test('email: to/cc/bcc/subject, never the body', () {
      final lines = actionSummaryLines(s({
        'kind': 'send_email',
        'to': 'a@x.io',
        'cc': '  ',
        'bcc': 'b@x.io',
        'subject': 'Hi\n  there',
        'body': 'secret',
      }));
      expect(lines.map((l) => l.field), [
        ActionSummaryField.to,
        ActionSummaryField.bcc,
        ActionSummaryField.subject,
      ]);
      expect(lines.last.value, 'Hi there');
      expect(lines.any((l) => l.value.contains('secret')), isFalse);
    });

    test('event: title, when (start + end) and attendees', () {
      final lines = actionSummaryLines(s({
        'kind': 'update_event',
        'title': 'Standup',
        'start': '2026-05-01T09:00:00Z',
        'end': '2026-05-01T09:15:00Z',
        'attendees': 'Ann, Bob',
      }));
      expect(lines.map((l) => l.field), [
        ActionSummaryField.title,
        ActionSummaryField.when,
        ActionSummaryField.attendees,
      ]);
      expect(lines[1].value, '2026-05-01T09:00:00Z');
      expect(lines[1].end, '2026-05-01T09:15:00Z');
    });

    test('event without start has no when row', () {
      final lines = actionSummaryLines(s({'kind': 'create_event', 'title': 'T'}));
      expect(lines.map((l) => l.field), [ActionSummaryField.title]);
    });

    test('page: title only', () {
      final lines =
          actionSummaryLines(s({'kind': 'create_page', 'title': 'Roadmap'}));
      expect(lines.single.field, ActionSummaryField.title);
      expect(lines.single.value, 'Roadmap');
    });

    test('generic: valid label/value rows, capped, raw ids dropped', () {
      final fields = [
        {'label': 'Channel', 'value': '#general'},
        'not a map',
        {'label': '', 'value': 'x'},
        {'label': 'Num', 'value': 3},
        {'label': 'Owner', 'value': '64b7f0c2a1b2c3d4e5f60718'},
        for (var i = 0; i < 10; i++) {'label': 'F$i', 'value': 'v$i'},
      ];
      final lines = actionSummaryLines(s({'kind': 'generic', 'fields': fields}));
      expect(lines.length, kMaxGenericActionFields);
      expect(lines.first.label, 'Channel');
      expect(lines.first.value, '#general');
      expect(lines.every((l) => l.field == ActionSummaryField.custom), isTrue);
      expect(lines.any((l) => l.label == 'Owner'), isFalse);
      // No `fields` (or not a list) → no rows.
      expect(actionSummaryLines(s({'fields': 'x'})), isEmpty);
    });
  });

  test('summaryText collapses whitespace and caps length', () {
    expect(summaryText(null), isNull);
    expect(summaryText(5), isNull);
    expect(summaryText('   '), isNull);
    expect(summaryText(' a \n b '), 'a b');
    expect(summaryText('abcdef', max: 4), 'abc…');
    expect(summaryText('abcd', max: 4), 'abcd');
  });
}
