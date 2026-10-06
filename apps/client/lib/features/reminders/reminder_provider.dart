import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/utils/app_error.dart';
import '../../core/utils/global_messenger.dart';
import 'reminder_model.dart';
import 'reminder_repository.dart';

class RemindersNotifier extends AsyncNotifier<List<ReminderModel>> {
  @override
  Future<List<ReminderModel>> build() async {
    return ref.read(reminderRepositoryProvider).getReminders();
  }

  Future<void> markDone(String id) =>
      _removeAfter(id, () => ref.read(reminderRepositoryProvider).markDone(id));

  Future<void> deleteReminder(String id) => _removeAfter(
      id, () => ref.read(reminderRepositoryProvider).deleteReminder(id));

  /// Runs [action] and drops [id] from the list on success. A failure is
  /// shown (localized) instead of escaping as an unhandled async error from
  /// the dialog callback.
  Future<void> _removeAfter(String id, Future<Object?> Function() action) async {
    try {
      await action();
    } catch (e) {
      showErrorSnackBar(friendlyError(e));
      return;
    }
    final current = state.valueOrNull ?? [];
    state = AsyncData(current.where((r) => r.id != id).toList());
  }
}

final remindersProvider =
    AsyncNotifierProvider<RemindersNotifier, List<ReminderModel>>(
  RemindersNotifier.new,
);
