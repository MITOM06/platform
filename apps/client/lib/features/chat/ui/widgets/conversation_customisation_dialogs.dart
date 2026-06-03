import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/chat_repository.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';

void showWallpaperDialog(BuildContext context, WidgetRef ref, String conversationId) {
  final isVi = Localizations.localeOf(context).languageCode == 'vi';

  final presets = [
    {'name': isVi ? 'Mặc định' : 'Default', 'value': ''},
    {'name': 'Midnight Glow', 'value': 'preset:midnight_glow', 'colors': [const Color(0xFF0F0C20), const Color(0xFF15102A), const Color(0xFF050211)]},
    {'name': 'Neon Teal', 'value': 'preset:neon_teal', 'colors': [const Color(0xFF0A1F1D), const Color(0xFF081215), const Color(0xFF02070A)]},
    {'name': 'Sunset', 'value': 'preset:sunset', 'colors': [const Color(0xFF2C1619), const Color(0xFF1C0D1A), const Color(0xFF0F0611)]},
    {'name': 'Sweet Pink', 'value': 'preset:sweet_pink', 'colors': [const Color(0xFF2A1020), const Color(0xFF160A18), const Color(0xFF0C020A)]},
    {'name': 'Dark Shadow', 'value': 'preset:dark_shadow', 'colors': [const Color(0xFF121214), const Color(0xFF121214)]},
  ];

  showDialog(
    context: context,
    builder: (ctx) => _WallpaperDialog(
      isVi: isVi,
      presets: presets,
      conversationId: conversationId,
      ref: ref,
    ),
  );
}

class _WallpaperDialog extends StatefulWidget {
  final bool isVi;
  final List<Map<String, Object>> presets;
  final String conversationId;
  final WidgetRef ref;

  const _WallpaperDialog({
    required this.isVi,
    required this.presets,
    required this.conversationId,
    required this.ref,
  });

  @override
  State<_WallpaperDialog> createState() => _WallpaperDialogState();
}

class _WallpaperDialogState extends State<_WallpaperDialog> {
  bool _uploading = false;

  void _applyPreset(String val) {
    widget.ref.read(chatWallpaperProvider(widget.conversationId).notifier).setWallpaper(val);
    widget.ref.read(chatNotifierProvider(widget.conversationId).notifier)
        .sendMessage('system.theme.changed:$val', type: 'system');
    Navigator.pop(context);
  }

  Future<void> _uploadImage() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (picked == null || !mounted) return;
    setState(() => _uploading = true);
    try {
      final url = await widget.ref.read(chatRepositoryProvider).uploadFile(picked);
      if (!mounted) return;
      widget.ref.read(chatWallpaperProvider(widget.conversationId).notifier).setWallpaper(url);
      widget.ref.read(chatNotifierProvider(widget.conversationId).notifier)
          .sendMessage('system.theme.changed:$url', type: 'system');
      if (mounted) Navigator.pop(context);
    } catch (_) {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: AppTheme.darkSurface,
      title: Text(
        widget.isVi ? 'Chọn chủ đề đoạn chat' : 'Choose Chat Theme',
        style: const TextStyle(color: Colors.white),
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: widget.presets.map((p) {
                final isDefault = p['value'] == '';
                final colors = p['colors'] as List<Color>?;
                return GestureDetector(
                  onTap: () => _applyPreset(p['value'] as String),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 50,
                        height: 50,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white24, width: 1.5),
                          gradient: colors != null
                              ? LinearGradient(
                                  colors: colors,
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter)
                              : null,
                          color: colors == null ? Colors.transparent : null,
                        ),
                        child: isDefault
                            ? const Icon(Icons.block, color: Colors.white54, size: 24)
                            : null,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        p['name'] as String,
                        style: const TextStyle(fontSize: 11, color: Colors.white70),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
            const Divider(color: Colors.white12, height: 24),
            _uploading
                ? const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation<Color>(AppTheme.ponCyan),
                    ),
                  )
                : OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppTheme.ponCyan,
                      side: const BorderSide(color: AppTheme.ponCyan),
                      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 20),
                    ),
                    icon: const Icon(Icons.add_photo_alternate_outlined),
                    label: Text(widget.isVi ? 'Tải ảnh lên' : 'Upload Image'),
                    onPressed: _uploadImage,
                  ),
          ],
        ),
      ),
    );
  }
}

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
