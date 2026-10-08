import 'dart:convert';

import '../data/stomp_service.dart';

/// The STOMP side a LiveKit call needs, so the engine runs without a socket
/// in tests. [holdConversation] keeps the conversation topic subscribed for
/// the call's lifetime (ref-counted with the chat screen).
abstract class CallSignalPort {
  void send(String destination, Map<String, dynamic> body);
  void holdConversation(String conversationId);
  void releaseConversation(String conversationId);
  Stream<Map<String, dynamic>> get callEvents;
}

class StompCallSignalPort implements CallSignalPort {
  final StompService _stomp;
  StompCallSignalPort(this._stomp);

  @override
  void send(String destination, Map<String, dynamic> body) =>
      _stomp.sendRawMessage(destination: destination, body: jsonEncode(body));
  @override
  void holdConversation(String conversationId) =>
      _stomp.subscribeConversation(conversationId);
  @override
  void releaseConversation(String conversationId) =>
      _stomp.unsubscribeConversation(conversationId);
  @override
  Stream<Map<String, dynamic>> get callEvents => _stomp.callEvents;
}
