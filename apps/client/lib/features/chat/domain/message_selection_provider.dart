import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The three groups a message can be multi-selected into. Mirrors the web
/// `classifyType` in `apps/web/lib/hooks/use-multi-select.ts`: image/video →
/// image; file → file; everything else (text, ai, sticker, call_log, system) →
/// text. Only messages of the same group can be selected together.
enum SelectionGroup { text, image, file }

SelectionGroup classifyMessageType(String type) {
  if (type == 'image' || type == 'video') return SelectionGroup.image;
  if (type == 'file') return SelectionGroup.file;
  return SelectionGroup.text;
}

/// Immutable multi-select state for one conversation thread.
class MessageSelectionState {
  final bool active;
  final Set<String> selectedIds;
  final SelectionGroup? baseType;

  const MessageSelectionState({
    this.active = false,
    this.selectedIds = const {},
    this.baseType,
  });

  MessageSelectionState copyWith({
    bool? active,
    Set<String>? selectedIds,
    SelectionGroup? baseType,
    bool clearBaseType = false,
  }) {
    return MessageSelectionState(
      active: active ?? this.active,
      selectedIds: selectedIds ?? this.selectedIds,
      baseType: clearBaseType ? null : (baseType ?? this.baseType),
    );
  }
}

/// Multi-select state + type-locking for a conversation thread. Enforces a
/// single selection group: once the first message is picked, mismatched groups
/// are rejected (the caller surfaces a localized warning). Mirrors the web
/// `useMultiSelect` hook.
class MessageSelectionNotifier extends StateNotifier<MessageSelectionState> {
  MessageSelectionNotifier() : super(const MessageSelectionState());

  void enter() {
    if (!state.active) state = state.copyWith(active: true);
  }

  void exit() => state = const MessageSelectionState();

  bool isSelected(String messageId) => state.selectedIds.contains(messageId);

  /// Toggle a message's selection. Returns the currently-locked [SelectionGroup]
  /// when the toggle is rejected because the message's group doesn't match the
  /// already-selected one; returns null when the toggle succeeds (select or
  /// deselect).
  SelectionGroup? toggle(String messageId, String messageType) {
    final group = classifyMessageType(messageType);

    if (state.selectedIds.contains(messageId)) {
      final next = Set<String>.from(state.selectedIds)..remove(messageId);
      state = next.isEmpty
          ? state.copyWith(selectedIds: next, clearBaseType: true)
          : state.copyWith(selectedIds: next);
      return null;
    }

    if (state.baseType != null && group != state.baseType) {
      return state.baseType;
    }

    final next = Set<String>.from(state.selectedIds)..add(messageId);
    state = state.copyWith(
      selectedIds: next,
      baseType: state.baseType ?? group,
    );
    return null;
  }
}

final messageSelectionProvider = StateNotifierProvider.family<
    MessageSelectionNotifier, MessageSelectionState, String>(
  (ref, conversationId) => MessageSelectionNotifier(),
);
