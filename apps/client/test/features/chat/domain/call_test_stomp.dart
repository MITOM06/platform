import 'dart:convert';

import 'package:platform_client/features/chat/data/stomp_service.dart';

/// A STOMP service that records what the call code sends (no socket).
class RecordingStomp extends StompService {
  final sent = <({String destination, Map<String, dynamic> body})>[];
  final subscribed = <String>[];
  final unsubscribed = <String>[];
  bool connected = true;

  @override
  void build() {}

  @override
  bool get isConnected => connected;

  @override
  void sendRawMessage({required String destination, required String body}) =>
      sent.add((
        destination: destination,
        body: jsonDecode(body) as Map<String, dynamic>
      ));

  @override
  void subscribeConversation(String conversationId) =>
      subscribed.add(conversationId);

  @override
  void unsubscribeConversation(String conversationId) =>
      unsubscribed.add(conversationId);

  List<Map<String, dynamic>> to(String destination) => [
        for (final s in sent)
          if (s.destination == destination) s.body
      ];
}
