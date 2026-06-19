import 'dart:async';

import 'chat_state.dart';

/// Encapsulates AI streaming placeholder correlation and the
/// AI_STREAM_CHUNK / AI_TOOL_CALL / AI_STREAM_DONE / AI_STREAM_ERROR handling
/// plus the response watchdog timer.
///
/// Extracted from ChatNotifier (clean-code file limit). Behaviour is unchanged:
/// the handler owns the same correlation ids and timer the notifier used to
/// hold directly, and reads/writes state through the supplied callbacks so the
/// notifier stays the single owner of `state`.
class ChatAiStreamHandler {
  ChatAiStreamHandler({
    required ChatState? Function() readState,
    required void Function(List<MessageModel> messages) writeMessages,
  })  : _readState = readState,
        _writeMessages = writeMessages;

  final ChatState? Function() _readState;
  final void Function(List<MessageModel> messages) _writeMessages;

  /// The local id of the AI streaming placeholder currently awaiting a
  /// response, or null when no AI request is pending. Tracked explicitly (as a
  /// correlation id) so stream chunks and the final persisted message target
  /// the exact placeholder rather than guessing via the fragile
  /// `isStreaming`/senderId+content heuristics.
  String? _aiPlaceholderId;

  /// Id of the AI placeholder that has finished streaming (AI_STREAM_DONE) and
  /// is awaiting its real persisted message via _onNewMessage. Lets us replace
  /// the exact placeholder instead of guessing the wrong AI message. Exposed so
  /// _onNewMessage can swap the exact finished placeholder.
  String? finalizedAiPlaceholderId;

  /// Fires if the AI sends no chunk within the window, so a stuck placeholder
  /// can't spin forever (e.g. ai-service down / Redis hiccup).
  Timer? _aiTimeoutTimer;
  static const Duration _aiResponseTimeout = Duration(seconds: 30);

  /// Called by sendMessage when an @AI mention inserts a thinking placeholder.
  void beginPending(String placeholderId) {
    _aiPlaceholderId = placeholderId;
    startTimeout();
  }

  void dispose() {
    _aiTimeoutTimer?.cancel();
  }

  /// (Re)arm the AI response watchdog. If no chunk/done/error arrives in time
  /// the streaming placeholder is replaced with an error sentinel so it can't
  /// spin indefinitely.
  void startTimeout() {
    _aiTimeoutTimer?.cancel();
    _aiTimeoutTimer = Timer(_aiResponseTimeout, _onTimeout);
  }

  void _clearTimeout() {
    _aiTimeoutTimer?.cancel();
    _aiTimeoutTimer = null;
  }

  void _onTimeout() {
    final placeholderId = _aiPlaceholderId;
    final current = _readState();
    if (placeholderId == null || current == null) {
      _aiPlaceholderId = null;
      return;
    }
    final idx = current.messages.indexWhere((m) => m.id == placeholderId);
    if (idx != -1) {
      final updated = List<MessageModel>.from(current.messages);
      updated[idx] = current.messages[idx].copyWith(
        content: kAiErrorSentinel,
        isStreaming: false,
        isThinking: false,
        activeTools: [],
      );
      _writeMessages(updated);
    }
    _aiPlaceholderId = null;
  }

  void onStreamEvent(Map<String, dynamic> event) {
    final type = event['type'] as String?;
    final current = _readState();
    if (current == null || type == null) return;

    // Target the tracked placeholder by id (correlation), falling back to the
    // legacy streaming-flag heuristic for placeholders created before tracking.
    final placeholderId = _aiPlaceholderId;
    int idx = placeholderId != null
        ? current.messages.indexWhere((m) => m.id == placeholderId)
        : -1;
    if (idx == -1) {
      idx = current.messages.indexWhere(
        (m) => m.isAiMessage && m.isStreaming && m.senderId == kAiBotUserId,
      );
    }
    if (idx == -1) return;

    // A live event means the AI is responding — push the watchdog out (chunks)
    // or disarm it entirely (terminal events).
    if (type == 'AI_STREAM_CHUNK' || type == 'AI_TOOL_CALL') {
      startTimeout();
    } else if (type == 'AI_STREAM_DONE' || type == 'AI_STREAM_ERROR') {
      _clearTimeout();
      // Remember which placeholder finished so _onNewMessage swaps the exact
      // one for the persisted message (DONE only — an errored bubble stays).
      if (type == 'AI_STREAM_DONE') {
        finalizedAiPlaceholderId = current.messages[idx].id;
      }
      _aiPlaceholderId = null;
    }

    final updated = List<MessageModel>.from(current.messages);
    switch (type) {
      case 'AI_TOOL_CALL':
        final toolName = event['toolName'] as String? ?? '';
        if (toolName.isNotEmpty) {
          final current2 = current.messages[idx];
          final tools = List<String>.from(current2.activeTools)..add(toolName);
          updated[idx] = current2.copyWith(activeTools: tools);
        }
      case 'AI_STREAM_CHUNK':
        final chunk = event['chunk'] as String? ?? '';
        updated[idx] = current.messages[idx].copyWith(
          content: current.messages[idx].content + chunk,
          isThinking: false,
        );
      case 'AI_STREAM_DONE':
        final rawSources = event['sources'] as List?;
        final sources = rawSources
            ?.whereType<Map<String, dynamic>>()
            .map((s) => s['documentId'] as String? ?? '')
            .where((id) => id.isNotEmpty)
            .toList();
        final rawTrace = event['trace'] as Map<String, dynamic>?;
        final trace = rawTrace != null ? AiTrace.fromJson(rawTrace) : null;
        updated[idx] = current.messages[idx].copyWith(
          isStreaming: false,
          isThinking: false,
          sources: sources,
          trace: trace,
          activeTools: [],
        );
      case 'AI_STREAM_ERROR':
        final errorCode = event['code'] as String?;
        final errorMsg = event['error'] as String? ?? '';
        // Prefer stable code; fall back to heuristic for pre-code payloads.
        final isQuota = errorCode == kAiErrCodeQuotaExceeded ||
            (errorCode == null && errorMsg.toLowerCase().contains('quota'));
        final isInterrupted = errorCode == kAiErrCodeStreamInterrupted;
        final isUnavailable = errorCode == kAiErrCodeUnavailable;
        String errorContent;
        if (isQuota) {
          errorContent = kAiQuotaExceededSentinel;
        } else if (isInterrupted) {
          errorContent = kAiStreamInterruptedSentinel;
        } else if (isUnavailable) {
          errorContent = kAiUnavailableSentinel;
        } else {
          errorContent = kAiErrorSentinel;
        }
        updated[idx] = current.messages[idx].copyWith(
          content: errorContent,
          isStreaming: false,
          isThinking: false,
          activeTools: [],
        );
    }
    _writeMessages(updated);
  }
}
