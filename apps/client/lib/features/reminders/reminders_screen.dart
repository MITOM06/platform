import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/l10n/l10n_ext.dart';
import '../../core/theme/app_theme.dart';
import 'reminder_provider.dart';

class RemindersScreen extends ConsumerWidget {
  const RemindersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final remindersAsync = ref.watch(remindersProvider);
    final l10n = context.l10n;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.reminders,
            style: const TextStyle(fontWeight: FontWeight.bold)),
      ),
      body: remindersAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Text('$e', style: const TextStyle(color: Colors.red)),
        ),
        data: (reminders) {
          if (reminders.isEmpty) {
            return _EmptyState();
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: reminders.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, i) {
              final r = reminders[i];
              return _ReminderTile(
                text: r.text,
                remindAt: r.remindAt,
                onDone: () => _confirm(
                  context,
                  message: l10n.reminderDone,
                  onConfirm: () => ref
                      .read(remindersProvider.notifier)
                      .markDone(r.id),
                ),
                onDelete: () => _confirm(
                  context,
                  message: l10n.reminderDeleteConfirm,
                  onConfirm: () => ref
                      .read(remindersProvider.notifier)
                      .deleteReminder(r.id),
                ),
              );
            },
          );
        },
      ),
    );
  }

  void _confirm(
    BuildContext context, {
    required String message,
    required VoidCallback onConfirm,
  }) {
    showDialog<void>(
      context: context,
      builder: (_) => AlertDialog(
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(context.l10n.actionCancel),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              onConfirm();
            },
            child: Text(context.l10n.actionOk,
                style: const TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.alarm_off, size: 64,
              color: muted.withValues(alpha: 0.4)),
          const SizedBox(height: 16),
          Text(
            context.l10n.remindersEmpty,
            style: TextStyle(
              color: muted,
              fontSize: 15,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

class _ReminderTile extends StatelessWidget {
  final String text;
  final DateTime remindAt;
  final VoidCallback onDone;
  final VoidCallback onDelete;

  const _ReminderTile({
    required this.text,
    required this.remindAt,
    required this.onDone,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context).languageCode;
    final dateStr = DateFormat.yMMMd(locale).add_jm().format(remindAt.toLocal());
    final colorScheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      decoration: BoxDecoration(
        color: colorScheme.surface.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: (isDark ? AppTheme.darkBorder : AppTheme.lightBorder)
              .withValues(alpha: 0.6),
        ),
      ),
      child: ListTile(
        leading: const Icon(Icons.alarm_outlined,
            color: AppTheme.ponCyan, size: 22),
        title: Text(text,
            style: TextStyle(color: colorScheme.onSurface, fontSize: 15)),
        subtitle: Text(dateStr,
            style: TextStyle(
                color: colorScheme.onSurfaceVariant, fontSize: 12)),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              icon: const Icon(Icons.check_circle_outline,
                  color: AppTheme.ponCyan, size: 20),
              tooltip: context.l10n.reminderDone,
              onPressed: onDone,
            ),
            IconButton(
              icon: Icon(Icons.delete_outline,
                  color: colorScheme.onSurfaceVariant, size: 20),
              onPressed: onDelete,
            ),
          ],
        ),
      ),
    );
  }
}
