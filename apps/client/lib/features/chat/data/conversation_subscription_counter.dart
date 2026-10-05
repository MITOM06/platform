/// Counts who needs a conversation's STOMP topic. The chat screen holds it
/// while the thread is open; a call holds it for the call's lifetime (so a
/// `call.ended` still arrives with the thread closed). Only the first holder
/// subscribes and only the last one unsubscribes.
class ConversationSubscriptionCounter {
  final Map<String, int> _holders = {};

  /// True when this is the first holder — the caller must subscribe.
  bool acquire(String conversationId) {
    final n = (_holders[conversationId] ?? 0) + 1;
    _holders[conversationId] = n;
    return n == 1;
  }

  /// True when this was the last holder — the caller must unsubscribe.
  bool release(String conversationId) {
    final n = _holders[conversationId];
    if (n == null) return false;
    if (n <= 1) {
      _holders.remove(conversationId);
      return true;
    }
    _holders[conversationId] = n - 1;
    return false;
  }
}
