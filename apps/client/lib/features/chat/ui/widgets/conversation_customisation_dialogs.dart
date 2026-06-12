import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';

void showQuickReactionDialog(BuildContext context, WidgetRef ref, String conversationId) {
  final isVi = Localizations.localeOf(context).languageCode == 'vi';
  final emojis = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉', '💯', '👏', '👀', '✨'];

  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      backgroundColor: AppTheme.darkSurface,
      title: Text(isVi ? 'Biểu tượng cảm xúc nhanh' : 'Quick Reaction', style: const TextStyle(color: Colors.white)),
      content: SizedBox(
        width: 250,
        child: GridView.builder(
          shrinkWrap: true,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 4,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
          ),
          itemCount: emojis.length,
          itemBuilder: (context, idx) {
            final emoji = emojis[idx];
            return GestureDetector(
              onTap: () {
                ref.read(quickReactionProvider(conversationId).notifier).setQuickReaction(emoji);
                ref.read(chatNotifierProvider(conversationId).notifier).sendMessage('system.quick_reaction.changed:$emoji', type: 'system');
                Navigator.pop(context);
              },
              child: Container(
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(emoji, style: const TextStyle(fontSize: 28)),
              ),
            );
          },
        ),
      ),
    ),
  );
}

void showNicknamesDialog(BuildContext context, WidgetRef ref, String conversationId, ConversationModel? conv) {
  if (conv == null) return;
  final isVi = Localizations.localeOf(context).languageCode == 'vi';

  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      backgroundColor: AppTheme.darkSurface,
      title: Text(isVi ? 'Biệt danh thành viên' : 'Member Nicknames', style: const TextStyle(color: Colors.white)),
      content: SizedBox(
        width: 300,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: conv.participants.map((userId) {
              return Consumer(
                builder: (context, ref, child) {
                  final profile = ref.watch(userProfileProvider(userId)).valueOrNull;
                  final name = profile?.displayName ?? '...';
                  final nicknames = ref.watch(nicknamesProvider(conversationId));
                  final nickname = nicknames[userId] ?? '';

                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    subtitle: Text(
                      nickname.isNotEmpty ? nickname : (isVi ? 'Chưa thiết lập biệt danh' : 'No nickname set'),
                      style: TextStyle(color: nickname.isNotEmpty ? AppTheme.ponCyan : Colors.white38, fontSize: 13),
                    ),
                    trailing: const Icon(Icons.edit_outlined, color: Colors.white54, size: 18),
                    onTap: () {
                      Navigator.pop(context); // close nicknames list
                      _showEditNicknameField(context, ref, conversationId, userId, name, nickname);
                    },
                  );
                },
              );
            }).toList(),
          ),
        ),
      ),
    ),
  );
}

void _showEditNicknameField(
  BuildContext context,
  WidgetRef ref,
  String conversationId,
  String userId,
  String originalName,
  String currentNickname,
) {
  final isVi = Localizations.localeOf(context).languageCode == 'vi';
  final controller = TextEditingController(text: currentNickname);

  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      backgroundColor: AppTheme.darkSurface,
      title: Text(
        isVi ? 'Biệt danh của $originalName' : 'Nickname for $originalName',
        style: const TextStyle(color: Colors.white, fontSize: 16),
      ),
      content: TextField(
        controller: controller,
        style: const TextStyle(color: Colors.white),
        decoration: InputDecoration(
          hintText: isVi ? 'Nhập biệt danh...' : 'Enter nickname...',
          hintStyle: const TextStyle(color: Colors.white30),
          enabledBorder: const UnderlineInputBorder(borderSide: BorderSide(color: Colors.white24)),
          focusedBorder: const UnderlineInputBorder(borderSide: BorderSide(color: AppTheme.ponCyan)),
        ),
        autofocus: true,
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(isVi ? 'Hủy' : 'Cancel', style: const TextStyle(color: Colors.white54)),
        ),
        TextButton(
          onPressed: () {
            final val = controller.text.trim();
            ref.read(nicknamesProvider(conversationId).notifier).setNickname(userId, val);
            ref.read(chatNotifierProvider(conversationId).notifier).sendMessage('system.nickname.changed:$userId:$val', type: 'system');
            Navigator.pop(context);
          },
          child: Text(isVi ? 'Lưu' : 'Save', style: const TextStyle(color: AppTheme.ponCyan)),
        ),
      ],
    ),
  );
}
