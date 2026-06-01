import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/chat_provider.dart';

class MentionList extends ConsumerWidget {
  final List<String> participantIds;
  final String query;
  final ValueChanged<String> onSelected;

  const MentionList({
    super.key,
    required this.participantIds,
    required this.query,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final q = query.toLowerCase();
    final matches = <MapEntry<String, String>>[];
    for (final id in participantIds) {
      final name = ref.watch(userProfileProvider(id)).valueOrNull?.displayName;
      if (name == null || name.isEmpty) continue;
      if (q.isEmpty || name.toLowerCase().contains(q)) {
        matches.add(MapEntry(id, name));
      }
    }
    if (matches.isEmpty) return const SizedBox.shrink();

    return Container(
      constraints: const BoxConstraints(maxHeight: 180),
      decoration: BoxDecoration(
        color: AppTheme.darkSurface,
        border: Border(
          top: BorderSide(color: AppTheme.darkBorder.withValues(alpha: 0.4)),
        ),
      ),
      child: ListView.builder(
        shrinkWrap: true,
        padding: EdgeInsets.zero,
        itemCount: matches.length,
        itemBuilder: (ctx, i) {
          final entry = matches[i];
          final letter =
              entry.value.isNotEmpty ? entry.value[0].toUpperCase() : '?';
          return ListTile(
            dense: true,
            leading: CircleAvatar(
              radius: 16,
              backgroundColor: AppTheme.ponCyan.withValues(alpha: 0.2),
              child: Text(
                letter,
                style: const TextStyle(
                  color: AppTheme.ponCyan,
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            title: Text(
              entry.value,
              style: const TextStyle(color: Colors.white, fontSize: 14),
            ),
            onTap: () => onSelected(entry.value),
          );
        },
      ),
    );
  }
}
