import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/data/conversation_subscription_counter.dart';

void main() {
  test('only the first holder subscribes and only the last one unsubscribes', () {
    final c = ConversationSubscriptionCounter();
    expect(c.acquire('conv'), isTrue); // chat screen opens the thread
    expect(c.acquire('conv'), isFalse); // a call also needs it
    expect(c.release('conv'), isFalse); // chat screen closes: the call keeps it
    expect(c.release('conv'), isTrue); // the call ends: now unsubscribe
  });

  test('releasing something never acquired is a no-op', () {
    final c = ConversationSubscriptionCounter();
    expect(c.release('ghost'), isFalse);
    expect(c.acquire('ghost'), isTrue);
  });
}
