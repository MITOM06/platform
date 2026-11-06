// Minimal in-process STOMP 1.2 server over a real WebSocket (dart:io) for
// StompService tests, plus the auth-service `/auth/refresh` endpoint the
// STOMP beforeConnect hook calls. Records CONNECT headers, SUBSCRIBE /
// UNSUBSCRIBE / SEND frames and lets the test push MESSAGE / ERROR frames or
// drop the socket.

import 'dart:async';
import 'dart:convert';
import 'dart:io';

class StompFrameIn {
  StompFrameIn(this.command, this.headers, this.body, this.socketIndex);
  final String command;
  final Map<String, String> headers;
  final String body;
  final int socketIndex;
}

class FakeStompServer {
  late final HttpServer _http;
  final frames = <StompFrameIn>[];
  final upgradeAuth = <String?>[];
  final refreshBodies = <Map<String, dynamic>>[];

  /// Answer of `POST …/auth/refresh`.
  int refreshStatus = 200;
  Map<String, dynamic> refreshBody = const {};

  /// When false, CONNECT is answered with an ERROR frame + close.
  bool acceptConnect = true;

  WebSocket? _socket;
  int _sockets = 0;
  int _msgSeq = 0;

  int get port => _http.port;
  int get socketCount => _sockets;

  /// Value for `AppConfig.useDevHost` so ws/auth URLs hit this server.
  String get devHost => '127.0.0.1:$port/h';

  Future<void> start() async {
    _http = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    _http.listen(_onRequest);
  }

  Future<void> close() async {
    await _socket?.close();
    await _http.close(force: true);
  }

  Future<void> _onRequest(HttpRequest req) async {
    if (WebSocketTransformer.isUpgradeRequest(req)) {
      upgradeAuth.add(req.headers.value('authorization'));
      final ws = await WebSocketTransformer.upgrade(req);
      final index = _sockets++;
      _socket = ws;
      ws.listen((data) => _onData(ws, index, data as String),
          onDone: () {}, onError: (_) {});
      return;
    }
    if (req.uri.toString().contains('auth/refresh')) {
      final body = await utf8.decoder.bind(req).join();
      refreshBodies.add(jsonDecode(body) as Map<String, dynamic>);
      req.response
        ..statusCode = refreshStatus
        ..headers.contentType = ContentType.json
        ..write(jsonEncode(refreshBody));
      await req.response.close();
      return;
    }
    req.response.statusCode = 404;
    await req.response.close();
  }

  void _onData(WebSocket ws, int index, String text) {
    for (final raw in text.split('\x00')) {
      final chunk = raw.replaceFirst(RegExp(r'^\n+'), '');
      if (chunk.isEmpty) continue;
      final sep = chunk.indexOf('\n\n');
      final head = sep < 0 ? chunk : chunk.substring(0, sep);
      final body = sep < 0 ? '' : chunk.substring(sep + 2);
      final lines = head.split('\n');
      final headers = <String, String>{};
      for (final l in lines.skip(1)) {
        final i = l.indexOf(':');
        if (i > 0) headers[l.substring(0, i)] = l.substring(i + 1);
      }
      final frame = StompFrameIn(lines.first, headers, body, index);
      frames.add(frame);
      if (frame.command == 'CONNECT' || frame.command == 'STOMP') {
        if (acceptConnect) {
          ws.add('CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\x00');
        } else {
          ws.add('ERROR\nmessage:Unauthorized\n\nbad token\x00');
          ws.close();
        }
      }
    }
  }

  List<StompFrameIn> of(String command, {int? socket}) => frames
      .where((f) =>
          f.command == command && (socket == null || f.socketIndex == socket))
      .toList();

  List<String> subscribedDestinations({int? socket}) =>
      of('SUBSCRIBE', socket: socket)
          .map((f) => f.headers['destination']!)
          .toList();

  /// Pushes a MESSAGE to the live subscription for [destination].
  void push(String destination, Object body) {
    final sub = of('SUBSCRIBE', socket: _sockets - 1).lastWhere(
        (f) => f.headers['destination'] == destination);
    final payload = body is String ? body : jsonEncode(body);
    _socket!.add('MESSAGE\nsubscription:${sub.headers['id']}\n'
        'destination:$destination\nmessage-id:${_msgSeq++}\n'
        'content-type:application/json\n\n$payload\x00');
  }

  void sendError() => _socket!.add('ERROR\nmessage:session revoked\n\n\x00');

  Future<void> dropSocket() async => _socket?.close();
}

/// Polls [cond] until true (real time) or fails after [timeout].
Future<void> waitUntil(bool Function() cond,
    {Duration timeout = const Duration(seconds: 8)}) async {
  final end = DateTime.now().add(timeout);
  while (!cond()) {
    if (DateTime.now().isAfter(end)) {
      throw TimeoutException('condition not met in $timeout');
    }
    await Future<void>.delayed(const Duration(milliseconds: 20));
  }
}
