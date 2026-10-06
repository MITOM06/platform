import 'dart:async';

import 'package:collection/collection.dart';

import 'chat_state.dart';

/// One AI reply being streamed into the conversation.
class AiReplySlot {
  AiReplySlot({required this.localId, required this.mine, this.replyId});

  /// Id of the message currently standing for this reply in the list: the
  /// local `ai-pending-…` placeholder, later the persisted message's id.
  String localId;

  /// ai-service correlation id — every AI event carries it. Null until the
  /// first event for this reply arrives.
  String? replyId;

  /// Created by this device's own send (vs. another member's `@AI`, or the
  /// same user on another device).
  final bool mine;

  bool receivedChunk = false;

  /// `AI_STREAM_DONE` arrived.
  bool done = false;

  /// The persisted AI message replaced the placeholder.
  bool persisted = false;

  Timer? timer;
}

/// Routes AI_STREAM_CHUNK / AI_TOOL_CALL / AI_STREAM_DONE / AI_STREAM_ERROR
/// onto the right streaming bubble and swaps the persisted AI message in.
///
/// Every AI event carries `replyId` + `requesterId`, so a reply is correlated
/// by id rather than by guessing "the streaming one". chat-service delivers
/// the persisted message BEFORE `AI_STREAM_DONE` (one ordered batch); older
/// servers sent DONE first. Both orders end with exactly one bubble per
/// reply — the old heuristics duplicated the answer and dropped the next one
/// into the previous answer's place.
///
/// Extracted from ChatNotifier (clean-code limit); state is read/written
/// through the callbacks so the notifier stays the single owner of `state`.
class ChatAiStreamHandler {
  ChatAiStreamHandler({
    required ChatState? Function() readState,
    required void Function(List<MessageModel> messages) writeMessages,
    String? Function()? currentUserId,
    String conversationId = '',
  })  : _readState = readState,
        _writeMessages = writeMessages,
        _currentUserId = currentUserId ?? (() => null),
        _conversationId = conversationId;

  final ChatState? Function() _readState;
  final void Function(List<MessageModel> messages) _writeMessages;
  final String? Function() _currentUserId;
  final String _conversationId;

  final List<AiReplySlot> _slots = [];

  /// Replies already completed — a late duplicate event for one of them must
  /// not bind to (and corrupt) a newer pending request.
  final Set<String> _finished = {};

  /// Fires if a reply sends nothing within the window, so a stuck bubble
  /// can't spin forever (ai-service down / Redis hiccup).
  static const Duration responseTimeout = Duration(seconds: 30);

  /// How long a persisted reply waits for its trailing AI_STREAM_DONE (which
  /// only adds sources + trace) before the slot is dropped.
  static const Duration _doneGrace = Duration(seconds: 10);

  /// Replies in flight (test/diagnostic view).
  List<AiReplySlot> get slots => List.unmodifiable(_slots);

  /// Called by sendMessage after inserting a thinking placeholder for an
  /// `@AI` mention or a message in a 1-1 AI chat.
  void beginPending(String placeholderId) {
    final slot = AiReplySlot(localId: placeholderId, mine: true);
    _slots.add(slot);
    _arm(slot);
  }

  /// Forgets the pending reply for [placeholderId] (its send failed / was
  /// rejected, so no answer will come). The caller removes the bubble.
  void cancelPending(String placeholderId) {
    final slot = _slots.firstWhereOrNull((s) => s.localId == placeholderId);
    if (slot != null) _drop(slot);
  }

  void dispose() {
    for (final s in _slots) {
      s.timer?.cancel();
    }
    _slots.clear();
  }

  void _arm(AiReplySlot slot, [Duration timeout = responseTimeout]) {
    slot.timer?.cancel();
    slot.timer = Timer(timeout, () => _onTimeout(slot));
  }

  void _drop(AiReplySlot slot) {
    slot.timer?.cancel();
    _slots.remove(slot);
    final replyId = slot.replyId;
    if (replyId != null) {
      _finished.add(replyId);
      if (_finished.length > 64) _finished.remove(_finished.first);
    }
  }

  void _onTimeout(AiReplySlot slot) {
    if (!_slots.contains(slot)) return;
    _drop(slot);
    if (slot.persisted || slot.done) return; // the answer is already shown
    final current = _readState();
    if (current == null) return;
    final idx = current.messages.indexWhere((m) => m.id == slot.localId);
    if (idx == -1) return;
    final updated = List<MessageModel>.from(current.messages);
    if (slot.mine) {
      updated[idx] = current.messages[idx].copyWith(
        content: kAiErrorSentinel,
        isStreaming: false,
        isThinking: false,
        activeTools: [],
        sensitiveTools: [],
      );
    } else {
      // Someone else's request went silent — drop the live bubble; their
      // persisted answer (if any) still arrives as a normal message.
      updated.removeAt(idx);
    }
    _writeMessages(updated);
  }

  /// Finds (or creates) the slot an event belongs to.
  AiReplySlot? _slotFor(Map<String, dynamic> event, String type) {
    final replyId = event['replyId'] as String?;
    if (replyId == null || replyId.isEmpty) {
      // Legacy payload: the oldest reply still streaming.
      return _slots.firstWhereOrNull((s) => !s.done && !s.persisted) ??
          _adoptStreamingMessage();
    }
    final bound = _slots.firstWhereOrNull((s) => s.replyId == replyId);
    if (bound != null) return bound;
    if (_finished.contains(replyId)) return null;

    final requesterId = event['requesterId'] as String?;
    final me = _currentUserId();
    final forMe = requesterId == null || (me != null && requesterId == me);
    if (forMe) {
      final free = _slots.firstWhereOrNull((s) => s.mine && s.replyId == null);
      if (free != null) {
        free.replyId = replyId;
        return free;
      }
    }
    // Another member's request (or mine from another device): open a live
    // bubble for it — but only for an event that starts a stream.
    if (type == 'AI_STREAM_CHUNK' || type == 'AI_TOOL_CALL') {
      return _openRemoteSlot(replyId);
    }
    return null;
  }

  /// Legacy fallback: a streaming AI bubble the handler does not track.
  AiReplySlot? _adoptStreamingMessage() {
    final current = _readState();
    final m = current?.messages.firstWhereOrNull(
      (m) => m.isAiMessage && m.isStreaming && m.senderId == kAiBotUserId,
    );
    if (m == null) return null;
    final slot = AiReplySlot(localId: m.id, mine: true);
    _slots.add(slot);
    return slot;
  }

  AiReplySlot? _openRemoteSlot(String replyId) {
    final current = _readState();
    if (current == null) return null;
    final id = 'ai-stream-$replyId';
    final placeholder = MessageModel(
      id: id,
      conversationId: _conversationId,
      senderId: kAiBotUserId,
      content: '',
      type: 'ai',
      readBy: const [],
      createdAt: DateTime.now(),
      isStreaming: true,
      isThinking: true,
    );
    _writeMessages([placeholder, ...current.messages]);
    final slot = AiReplySlot(localId: id, mine: false, replyId: replyId);
    _slots.add(slot);
    return slot;
  }

  void onStreamEvent(Map<String, dynamic> event) {
    final type = event['type'] as String?;
    if (type == null || _readState() == null) return;
    final slot = _slotFor(event, type);
    if (slot == null) return;
    final current = _readState();
    if (current == null) return;
    final idx = current.messages.indexWhere((m) => m.id == slot.localId);
    if (idx == -1) {
      _drop(slot);
      return;
    }
    final message = current.messages[idx];
    final updated = List<MessageModel>.from(current.messages);

    switch (type) {
      case 'AI_ACTION_PENDING':
        // A sensitive action held for confirmation: its card shows in this
        // bubble right away, while the reply is still streaming.
        _arm(slot);
        final action = AiPendingAction.tryParse(event['action'],
            requesterId: event['requesterId'] as String?);
        if (action == null) return;
        updated[idx] = message.copyWith(
            pendingActions:
                upsertPendingAction(message.pendingActions, action));
      case 'AI_TOOL_CALL':
        _arm(slot);
        final toolName = event['toolName'] as String? ?? '';
        if (toolName.isEmpty || slot.persisted) return;
        final tools = List<String>.from(message.activeTools)..add(toolName);
        final sensitive = List<String>.from(message.sensitiveTools);
        if (event['sensitive'] == true && !sensitive.contains(toolName)) {
          sensitive.add(toolName);
        }
        updated[idx] =
            message.copyWith(activeTools: tools, sensitiveTools: sensitive);
      case 'AI_STREAM_CHUNK':
        _arm(slot);
        if (slot.persisted) return; // the full text is already shown
        slot.receivedChunk = true;
        updated[idx] = message.copyWith(
          content: message.content + (event['chunk'] as String? ?? ''),
          isThinking: false,
        );
      case 'AI_STREAM_DONE':
        final sources = (event['sources'] as List?)
            ?.map(AiSource.tryParse)
            .whereType<AiSource>()
            .toList();
        final rawTrace = event['trace'];
        final trace =
            rawTrace is Map<String, dynamic> ? AiTrace.fromJson(rawTrace) : null;
        final actions = mergePendingActions(
          message.pendingActions,
          parsePendingActions(event['pendingActions'],
              requesterId: event['requesterId'] as String?),
        );
        if (slot.persisted) {
          // Persisted message first (current servers): DONE only adds
          // sources + trace (+ any confirmation cards) to it, then the reply
          // is complete.
          _drop(slot);
          updated[idx] = message.copyWith(
            sources: (sources != null && sources.isNotEmpty) ? sources : null,
            trace: trace,
            pendingActions: actions,
          );
        } else {
          // DONE first (older servers) or nothing to persist: finalize the
          // placeholder; the persisted message (if any) still swaps in.
          slot.done = true;
          _arm(slot, _doneGrace);
          final empty = message.content.trim().isEmpty;
          updated[idx] = message.copyWith(
            content: empty ? kAiEmptyResponseSentinel : null,
            isStreaming: false,
            isThinking: false,
            sources: sources,
            trace: trace,
            activeTools: [],
            sensitiveTools: [],
            pendingActions: actions,
          );
        }
      case 'AI_STREAM_ERROR':
        _drop(slot);
        if (slot.persisted) return;
        updated[idx] = message.copyWith(
          content: aiErrorSentinelFor(
            event['code'] as String?,
            event['error'] as String? ?? '',
          ),
          isStreaming: false,
          isThinking: false,
          activeTools: [],
          sensitiveTools: [],
        );
      default:
        return;
    }
    _writeMessages(updated);
  }

  /// Swaps a persisted AI [message] into the reply it answers. Returns the new
  /// list, or null when no tracked reply matches (the caller then treats it
  /// as an ordinary new message).
  ///
  /// A persisted message carrying `aiReplyId` swaps exactly the reply with
  /// that `replyId`. Without it (older servers) — or when no tracked reply
  /// is bound to that id yet — it is matched to, in order: a reply whose DONE
  /// already arrived; a streaming reply whose text it continues; the oldest
  /// reply that streamed text; this device's oldest pending request (e.g. a
  /// cached answer that streamed nothing). A reply already bound to a
  /// DIFFERENT `replyId` is never taken.
  List<MessageModel>? reconcilePersisted(
    List<MessageModel> messages,
    MessageModel message,
  ) {
    if (!message.isAiMessage || _slots.isEmpty) return null;
    if (messages.any((m) => m.id == message.id)) return null;
    final replyId = message.aiReplyId;
    if (replyId != null && _finished.contains(replyId)) return null;
    final open = _slots.where((s) => !s.persisted).toList();
    final exact = replyId == null
        ? null
        : open.firstWhereOrNull((s) => s.replyId == replyId);
    final candidates = replyId == null
        ? open
        : open.where((s) => s.replyId == null).toList();
    String textOf(AiReplySlot s) =>
        messages.firstWhereOrNull((m) => m.id == s.localId)?.content.trim() ??
        '';
    final slot = exact ??
        candidates.firstWhereOrNull((s) => s.done) ??
        candidates.firstWhereOrNull((s) =>
            s.receivedChunk &&
            textOf(s).isNotEmpty &&
            message.content.trim().startsWith(textOf(s))) ??
        candidates.firstWhereOrNull((s) => s.receivedChunk) ??
        candidates.firstWhereOrNull((s) => s.mine);
    if (slot == null) return null;
    if (replyId != null) slot.replyId ??= replyId;
    final idx = messages.indexWhere((m) => m.id == slot.localId);
    if (idx == -1) {
      _drop(slot);
      return null;
    }
    final placeholder = messages[idx];
    final updated = List<MessageModel>.from(messages);
    updated[idx] = message.copyWith(
      sources: message.sources ?? placeholder.sources,
      trace: message.trace ?? placeholder.trace,
      pendingActions: mergePendingActions(
          placeholder.pendingActions, message.pendingActions),
    );
    if (slot.done) {
      _drop(slot);
    } else {
      slot.persisted = true;
      slot.localId = message.id;
      _arm(slot, _doneGrace);
    }
    return updated;
  }
}

/// Maps an `AI_STREAM_ERROR` to the sentinel the bubble renders as a
/// localized message (never the raw backend error text).
String aiErrorSentinelFor(String? code, String error) {
  switch (code) {
    case kAiErrCodeQuotaExceeded:
      return kAiQuotaExceededSentinel;
    case kAiErrCodeRateLimited:
      return kAiRateLimitedSentinel;
    case kAiErrCodeStreamInterrupted:
      return kAiStreamInterruptedSentinel;
    case kAiErrCodeUnavailable:
      return kAiUnavailableSentinel;
    case kAiErrCodeEmptyResponse:
      return kAiEmptyResponseSentinel;
    case null:
      // Pre-code payloads: heuristic on the text.
      return error.toLowerCase().contains('quota')
          ? kAiQuotaExceededSentinel
          : kAiErrorSentinel;
    default:
      return kAiErrorSentinel;
  }
}
