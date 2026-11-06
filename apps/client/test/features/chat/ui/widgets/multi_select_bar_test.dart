// Widget tests for MultiSelectBar: localized count, disabled state when
// empty, recall only for own messages, bulk delete/recall calls + snackbars,
// forward restricted to a single message, cancel exits select mode.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:platform_client/features/chat/domain/chat_state.dart';
import 'package:platform_client/features/chat/domain/message_selection_provider.dart';
import 'package:platform_client/features/chat/ui/widgets/multi_select_bar.dart';

import 'chat_widget_harness.dart';

final _mine1 = msg(id: 'a', senderId: kMe, content: 'one');
final _mine2 = msg(id: 'b', senderId: kMe, content: 'two');
final _theirs = msg(id: 'c', senderId: kBob, content: 'three');
final _mineRecalled =
    msg(id: 'd', senderId: kMe, content: '', recalled: true);

Future<(ProviderContainer, FakeChatNotifier)> _pump(
  WidgetTester tester,
  List<String> selectedIds,
) async {
  final chat = FakeChatNotifier(ChatState(
      messages: [_mine1, _mine2, _theirs, _mineRecalled], hasMore: false));
  final container =
      ProviderContainer(overrides: await baseOverrides(chat: chat));
  addTearDown(container.dispose);
  final sel = container.read(messageSelectionProvider(kConv).notifier);
  sel.enter();
  for (final id in selectedIds) {
    sel.toggle(id, 'text');
  }
  await tester.pumpWidget(UncontrolledProviderScope(
    container: container,
    child: wrapWidget(
        const MultiSelectBar(conversationId: kConv, currentUserId: kMe)),
  ));
  await tester.pumpAndSettle();
  return (container, chat);
}

OutlinedButton _button(WidgetTester tester, String label) =>
    tester.widget<OutlinedButton>(find.ancestor(
        of: find.text(label), matching: find.byWidgetPredicate((w) => w is OutlinedButton)));

void main() {
  testWidgets('nothing selected: empty label, forward/delete disabled',
      (tester) async {
    await _pump(tester, const []);

    expect(find.text(en.multiSelectEmpty), findsOneWidget);
    expect(_button(tester, en.forwardMessage).onPressed, isNull);
    expect(_button(tester, en.actionDeleteForMe).onPressed, isNull);
    expect(find.text(en.actionRecall), findsNothing);
  });

  testWidgets('own messages selected: count + recall offered',
      (tester) async {
    await _pump(tester, const ['a', 'b']);

    expect(find.text(en.multiSelectCount(2)), findsOneWidget);
    expect(find.text(en.actionRecall), findsOneWidget);
  });

  testWidgets("someone else's message selected → no recall", (tester) async {
    await _pump(tester, const ['a', 'c']);
    expect(find.text(en.actionRecall), findsNothing);
  });

  testWidgets('an already-recalled message → no recall', (tester) async {
    await _pump(tester, const ['a', 'd']);
    expect(find.text(en.actionRecall), findsNothing);
  });

  testWidgets('recall recalls each own message, exits, shows snackbar',
      (tester) async {
    final (container, chat) = await _pump(tester, const ['a', 'b']);

    await tester.tap(find.text(en.actionRecall));
    await tester.pump();

    expect(chat.calls, unorderedEquals(['recall:a', 'recall:b']));
    expect(container.read(messageSelectionProvider(kConv)).active, isFalse);
    expect(find.text(en.multiRecalled(2)), findsOneWidget);
  });

  testWidgets('delete-for-me deletes every selected message', (tester) async {
    final (container, chat) = await _pump(tester, const ['a', 'c']);

    await tester.tap(find.text(en.actionDeleteForMe));
    await tester.pump();

    expect(chat.calls, unorderedEquals(['delete:a', 'delete:c']));
    expect(container.read(messageSelectionProvider(kConv)).active, isFalse);
    expect(find.text(en.multiDeleted(2)), findsOneWidget);
  });

  testWidgets('forwarding several messages is refused with a hint',
      (tester) async {
    final (container, chat) = await _pump(tester, const ['a', 'b']);

    await tester.tap(find.text(en.forwardMessage));
    await tester.pump();

    expect(find.text(en.multiForwardHint), findsOneWidget);
    expect(chat.calls, isEmpty);
    // Selection kept so the user can narrow it down.
    expect(container.read(messageSelectionProvider(kConv)).selectedIds,
        {'a', 'b'});
  });

  testWidgets('cancel exits select mode', (tester) async {
    final (container, _) = await _pump(tester, const ['a']);

    await tester.tap(find.text(en.multiSelectCancel));
    await tester.pump();

    expect(container.read(messageSelectionProvider(kConv)).active, isFalse);
    expect(find.text(en.multiSelectEmpty), findsOneWidget);
  });
}
