// A Dio HttpClientAdapter that records every request and answers from a
// route table — lets repository tests assert the exact method/path/query/body
// sent to chat-service and drive error statuses.

import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

class RecordedRequest {
  RecordedRequest(this.method, this.path, this.query, this.body);
  final String method;
  final String path;
  final Map<String, dynamic> query;
  final Object? body;
}

class StubResponse {
  const StubResponse(this.status, this.body);
  final int status;
  final Object? body;
}

class RecordingAdapter implements HttpClientAdapter {
  final requests = <RecordedRequest>[];

  /// `'GET /api/x'` → response. Missing route → 200 with `{}`.
  final routes = <String, StubResponse>{};

  void on(String method, String path, Object? body, {int status = 200}) =>
      routes['$method $path'] = StubResponse(status, body);

  RecordedRequest get last => requests.last;

  @override
  Future<ResponseBody> fetch(RequestOptions options,
      Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    requests.add(RecordedRequest(
      options.method,
      options.uri.path,
      Map<String, dynamic>.from(options.queryParameters),
      options.data,
    ));
    final stub = routes['${options.method} ${options.uri.path}'] ??
        const StubResponse(200, <String, dynamic>{});
    return ResponseBody.fromString(
      jsonEncode(stub.body),
      stub.status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

Dio recordingDio(RecordingAdapter adapter) =>
    Dio(BaseOptions(baseUrl: 'http://chat.test'))..httpClientAdapter = adapter;

Map<String, dynamic> messageJson(String id,
        {String content = 'hi', String conversationId = 'c1'}) =>
    {
      'id': id,
      'conversationId': conversationId,
      'senderId': 'u1',
      'content': content,
      'type': 'text',
      'readBy': ['u1'],
      'createdAt': '2024-01-01T00:00:00Z',
    };

Map<String, dynamic> conversationJson(String id, {String type = 'direct'}) => {
      'id': id,
      'type': type,
      'participants': ['u1', 'u2'],
      'unreadCount': 0,
      'createdAt': '2024-01-01T00:00:00Z',
    };
