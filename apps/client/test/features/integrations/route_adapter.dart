import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

/// One recorded HTTP call.
class RecordedRequest {
  RecordedRequest(this.method, this.path, this.data, this.query, this.headers);
  final String method;
  final String path;
  final Object? data;
  final Map<String, dynamic> query;
  final Map<String, dynamic> headers;

  @override
  String toString() => '$method $path';
}

/// A canned response: status + JSON body.
class Reply {
  const Reply(this.status, [this.body]);
  final int status;
  final Object? body;
}

/// Dio adapter answering by `"METHOD /path"` (query string excluded). Unknown
/// routes answer 404. A route may be a function to vary by call.
class RouteAdapter implements HttpClientAdapter {
  RouteAdapter([Map<String, Object>? routes]) : routes = routes ?? {};

  final Map<String, Object> routes;
  final requests = <RecordedRequest>[];

  /// Calls recorded for [method] + [path].
  List<RecordedRequest> calls(String method, String path) => requests
      .where((r) => r.method == method && r.path == path)
      .toList();

  @override
  Future<ResponseBody> fetch(RequestOptions options,
      Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    final path = Uri.parse(options.path).path;
    final req = RecordedRequest(options.method, path, options.data,
        options.queryParameters, options.headers);
    requests.add(req);
    final route = routes['${options.method} $path'];
    final reply = switch (route) {
      Reply r => r,
      Reply Function(RecordedRequest) f => f(req),
      _ => const Reply(404, {'code': 'NOT_FOUND'}),
    };
    return ResponseBody.fromString(
      reply.body == null ? '' : jsonEncode(reply.body),
      reply.status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

Dio dioWith(RouteAdapter adapter) =>
    Dio(BaseOptions(baseUrl: 'http://test.local'))..httpClientAdapter = adapter;
