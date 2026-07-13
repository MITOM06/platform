import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../../chat/domain/ai_memory_provider.dart';

class LearnedFactsSection extends ConsumerWidget {
  const LearnedFactsSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final async = ref.watch(aiMemoriesProvider);
    return PonCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l.aiContextLearnedFactsTitle,
              style: const TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          async.when(
            loading: () => const Padding(
              padding: EdgeInsets.all(8),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (_, __) => Text(l.aiContextSaveError),
            data: (memory) {
              final hasContent = memory != null &&
                  (memory.summary.isNotEmpty || memory.keyFacts.isNotEmpty);
              if (!hasContent) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l.aiContextMemoryEmpty,
                        style: const TextStyle(color: Colors.grey)),
                    const SizedBox(height: 4),
                    Text(l.aiContextMemoryEmptyHint,
                        style: const TextStyle(fontSize: 12, color: Colors.grey)),
                  ],
                );
              }
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (memory.summary.isNotEmpty) Text(memory.summary),
                  if (memory.keyFacts.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(l.aiContextKeyFacts,
                        style: const TextStyle(
                            fontSize: 11, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 2),
                    ...memory.keyFacts.map(
                      (f) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 1),
                        child: Text('• $f',
                            style: const TextStyle(fontSize: 12)),
                      ),
                    ),
                  ],
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}
