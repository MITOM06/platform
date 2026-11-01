import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/domain/ai_models.dart';
import 'package:platform_client/features/chat/domain/ai_pending_action.dart';
import 'package:platform_client/features/chat/ui/widgets/tool_trace_panel.dart';

const _awaiting = 'Awaiting user confirmation';

ToolCallEntry _call(String tool, String result) =>
    ToolCallEntry(toolName: tool, inputSummary: '', resultSummary: result);

AiPendingAction _card(String tool, AiActionStatus status) =>
    AiPendingAction(id: tool, toolName: tool, status: status);

void main() {
  test('a held call takes the outcome of its confirmation card', () {
    final calls = [
      _call('mcp__notion__search_pages', '3 pages'),
      _call('mcp__notion__create_page', _awaiting),
    ];
    expect(
      resolveTraceStatuses(calls, [_card('mcp__notion__create_page', AiActionStatus.cancelled)]),
      [TraceToolStatus.done, TraceToolStatus.cancelled],
    );
    expect(
      resolveTraceStatuses(calls, [_card('mcp__notion__create_page', AiActionStatus.confirmed)]),
      [TraceToolStatus.done, TraceToolStatus.done],
    );
    expect(
      resolveTraceStatuses(calls, [_card('mcp__notion__create_page', AiActionStatus.expired)]),
      [TraceToolStatus.done, TraceToolStatus.expired],
    );
  });

  test('a still-pending, unmatched or card-less call stays awaiting', () {
    final calls = [_call('mcp__calendar__create_event', _awaiting)];
    expect(
      resolveTraceStatuses(calls, [_card('mcp__calendar__create_event', AiActionStatus.pending)]),
      [TraceToolStatus.awaitingConfirmation],
    );
    expect(
      resolveTraceStatuses(calls, [_card('mcp__gmail__send_email', AiActionStatus.cancelled)]),
      [TraceToolStatus.awaitingConfirmation],
    );
    expect(resolveTraceStatuses(calls, null), [TraceToolStatus.awaitingConfirmation]);
  });

  test('two held calls of the same tool match their cards in order', () {
    final calls = [
      _call('mcp__gmail__send_email', _awaiting),
      _call('mcp__gmail__send_email', _awaiting),
    ];
    expect(
      resolveTraceStatuses(calls, [
        _card('mcp__gmail__send_email', AiActionStatus.confirmed),
        _card('mcp__gmail__send_email', AiActionStatus.cancelled),
      ]),
      [TraceToolStatus.done, TraceToolStatus.cancelled],
    );
  });
}
