import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';

/// Search input shown above the conversation list. Mirrors the web client's
/// `ConversationList.tsx` search bar (filters by group name or DM peer
/// nickname/display name) — see [filterConversationsBySearch].
class ConversationSearchBar extends StatelessWidget {
  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  const ConversationSearchBar({
    super.key,
    required this.controller,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
      child: TextField(
        controller: controller,
        onChanged: onChanged,
        style: TextStyle(color: isDark ? Colors.white : Colors.black87),
        decoration: InputDecoration(
          isDense: true,
          hintText: context.l10n.searchConversationsHint,
          hintStyle: TextStyle(color: isDark ? Colors.white38 : Colors.black38),
          prefixIcon: Icon(Icons.search,
              size: 20, color: isDark ? Colors.white38 : Colors.black38),
          suffixIcon: controller.text.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.close, size: 18),
                  onPressed: () {
                    controller.clear();
                    onChanged('');
                  },
                )
              : null,
          filled: true,
          fillColor: isDark
              ? Colors.white.withValues(alpha: 0.05)
              : Colors.black.withValues(alpha: 0.04),
          contentPadding: const EdgeInsets.symmetric(vertical: 10),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(20),
            borderSide: BorderSide.none,
          ),
        ),
      ),
    );
  }
}

/// Resolve the searchable terms for a conversation — mirrors web's
/// `resolveSearchTerms()`: group name, or (for 1:1, non-AI) the peer's
/// nickname / cached display name.
List<String> _searchTerms(
  WidgetRef ref,
  ConversationModel conv,
  String currentUserId,
) {
  final terms = <String>[];
  if (conv.name != null && conv.name!.isNotEmpty) terms.add(conv.name!);
  if (!conv.isGroup) {
    final others = conv.participants.where((p) => p != currentUserId);
    final otherId = others.isEmpty ? null : others.first;
    if (otherId != null && otherId != kAiBotUserId) {
      final nick = ref.watch(nicknamesProvider(conv.id))[otherId];
      if (nick != null && nick.isNotEmpty) terms.add(nick);
      final profile = ref.watch(userProfileProvider(otherId)).valueOrNull;
      if (profile != null && profile.displayName.isNotEmpty) {
        terms.add(profile.displayName);
      }
    }
  }
  return terms;
}

/// Filter [conversations] by [query] against group name / peer nickname /
/// peer display name (case-insensitive substring match). Empty query returns
/// the list unchanged.
List<ConversationModel> filterConversationsBySearch(
  WidgetRef ref,
  List<ConversationModel> conversations,
  String currentUserId,
  String query,
) {
  if (query.isEmpty) return conversations;
  final q = query.toLowerCase();
  return conversations
      .where((conv) => _searchTerms(ref, conv, currentUserId)
          .any((term) => term.toLowerCase().contains(q)))
      .toList();
}
