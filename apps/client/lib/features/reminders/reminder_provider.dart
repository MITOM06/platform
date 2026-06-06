import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'reminder_model.dart';
import 'reminder_repository.dart';

class RemindersNotifier extends AsyncNotifier<List<ReminderModel>> {
  @override
  Future<List<ReminderModel>> build() async {
    return ref.read(reminderRepositoryProvider).getReminders();
  }

  Future<void> markDone(String id) async {
    final repo = ref.read(reminderRepositoryProvider);
    await repo.markDone(id);
    final current = state.valueOrNull ?? [];
    state = AsyncData(current.where((r) => r.id != id).toList());
  }

  Future<void> deleteReminder(String id) async {
    final repo = ref.read(reminderRepositoryProvider);
    await repo.deleteReminder(id);
    final current = state.valueOrNull ?? [];
    state = AsyncData(current.where((r) => r.id != id).toList());
  }
}

final remindersProvider =
    AsyncNotifierProvider<RemindersNotifier, List<ReminderModel>>(
  RemindersNotifier.new,
);
