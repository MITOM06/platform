import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../domain/ai_memory_model.dart';
import '../domain/ai_memory_provider.dart';

class AiMemoryScreen extends ConsumerWidget {
  const AiMemoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final memoriesAsync = ref.watch(aiMemoriesProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.aiMemoryTitle),
      ),
      body: memoriesAsync.when(
        data: (memory) {
          // P2b: single aggregate. Task 3 replaces this screen with the AI Context
          // layout; this keeps the interim screen compiling.
          final memories = memory == null ? <AiMemoryModel>[] : [memory];
          if (memories.isEmpty) {
            return _EmptyState();
          }
          return ListView.separated(
            padding: const EdgeInsets.symmetric(vertical: 8),
            itemCount: memories.length,
            separatorBuilder: (_, __) => Divider(
              color: AppTheme.darkBorder.withValues(alpha: 0.3),
              height: 1,
            ),
            itemBuilder: (context, index) {
              return _MemoryTile(
                memory: memories[index],
                onDelete: () =>
                    _confirmDelete(context, ref, memories[index].conversationId ?? ''),
              );
            },
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, __) => Center(
          child: Text(
            context.l10n.listGenericError,
            style: const TextStyle(color: Colors.redAccent),
          ),
        ),
      ),
    );
  }

  Future<void> _confirmDelete(
    BuildContext context,
    WidgetRef ref,
    String conversationId,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(context.l10n.aiMemoryTitle),
        content: Text(context.l10n.aiMemoryDeleteConfirm),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(context.l10n.actionCancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(
              context.l10n.actionDelete,
              style: const TextStyle(color: Colors.redAccent),
            ),
          ),
        ],
      ),
    );

    if (confirmed == true && context.mounted) {
      await ref.read(aiMemoriesProvider.notifier).deleteMemory(conversationId);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.aiMemoryDeleted)),
        );
      }
    }
  }
}

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.psychology_outlined,
            size: 72,
            color: Colors.white.withValues(alpha: 0.2),
          ),
          const SizedBox(height: 16),
          Text(
            context.l10n.aiMemoryEmptyState,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.4),
              fontSize: 15,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

class _MemoryTile extends StatelessWidget {
  final AiMemoryModel memory;
  final VoidCallback onDelete;

  const _MemoryTile({required this.memory, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final dateStr = DateFormat.yMMMd().format(memory.updatedAt.toLocal());

    return InkWell(
      onLongPress: onDelete,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: const Color(0xFF2D1B69),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.smart_toy, color: Color(0xFFB47FFF), size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    memory.summary.isNotEmpty ? memory.summary : '…',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 14, color: Colors.white),
                  ),
                  const SizedBox(height: 6),
                  if (memory.keyFacts.isNotEmpty) ...[
                    Text(
                      context.l10n.aiMemoryFacts,
                      style: TextStyle(
                        fontSize: 11,
                        color: const Color(0xFFB47FFF).withValues(alpha: 0.8),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    ...memory.keyFacts.take(3).map(
                          (f) => Text(
                            '• $f',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.white.withValues(alpha: 0.55),
                            ),
                          ),
                        ),
                  ],
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFB47FFF).withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: const Color(0xFFB47FFF).withValues(alpha: 0.3),
                          ),
                        ),
                        child: Text(
                          '${memory.messageCount} turns',
                          style: TextStyle(
                            fontSize: 10,
                            color: const Color(0xFFB47FFF).withValues(alpha: 0.9),
                          ),
                        ),
                      ),
                      const Spacer(),
                      Text(
                        context.l10n.aiMemoryUpdated(dateStr),
                        style: TextStyle(
                          fontSize: 11,
                          color: Colors.white.withValues(alpha: 0.35),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            IconButton(
              icon: const Icon(Icons.delete_outline, size: 18),
              color: Colors.white.withValues(alpha: 0.3),
              onPressed: onDelete,
            ),
          ],
        ),
      ),
    );
  }
}
