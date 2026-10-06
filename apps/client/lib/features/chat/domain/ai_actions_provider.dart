import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/ai_actions_repository.dart';
import 'ai_action_card_logic.dart';

/// This client's view of the confirm/cancel requests it made: which ones are in
/// flight (buttons disabled) and the outcome each one got, shown until the
/// server's `MESSAGE_UPDATED` carries the authoritative status.
@immutable
class AiActionsState {
  final Map<String, ActionCardKind> local;
  final Set<String> inFlight;

  const AiActionsState({this.local = const {}, this.inFlight = const {}});

  AiActionsState copyWith({
    Map<String, ActionCardKind>? local,
    Set<String>? inFlight,
  }) =>
      AiActionsState(
        local: local ?? this.local,
        inFlight: inFlight ?? this.inFlight,
      );
}

class AiActionsNotifier extends Notifier<AiActionsState> {
  @override
  AiActionsState build() => const AiActionsState();

  /// Confirms action [id]; returns the failure (null on success).
  Future<AiActionError?> confirm(String id) => _run(id, confirm: true);

  /// Cancels action [id]; returns the failure (null on success).
  Future<AiActionError?> cancel(String id) => _run(id, confirm: false);

  Future<AiActionError?> _run(String id, {required bool confirm}) async {
    // One request per action: a double tap must not send a second claim.
    if (state.inFlight.contains(id)) return null;
    state = state.copyWith(inFlight: {...state.inFlight, id});
    try {
      final repo = ref.read(aiActionsRepositoryProvider);
      final outcome =
          confirm ? await repo.confirm(id) : await repo.cancel(id);
      _record(id,
          outcome ?? (confirm ? ActionCardKind.confirmed : ActionCardKind.cancelled));
      return null;
    } catch (e) {
      final failure = aiActionErrorOutcome(e);
      final next = failure.outcome;
      if (next != null) _record(id, next);
      return failure.error;
    } finally {
      state = state.copyWith(
        inFlight: {...state.inFlight}..remove(id),
      );
    }
  }

  void _record(String id, ActionCardKind kind) {
    state = state.copyWith(local: {...state.local, id: kind});
  }
}

final aiActionsProvider = NotifierProvider<AiActionsNotifier, AiActionsState>(
  AiActionsNotifier.new,
);
