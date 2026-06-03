import 'package:emoji_picker_flutter/emoji_picker_flutter.dart';
import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';

const List<String> kStickerList = [
  '😊', '😂', '🥰', '😎', '🤔', '😭',
  '🎉', '❤️', '🔥', '👍', '🙏', '💯',
  '🥲', '😴', '😡', '🤗',
];

class EmojiStickerPanel extends StatefulWidget {
  final void Function(String emoji) onEmojiSelected;
  final void Function(String sticker) onStickerSelected;
  final Color bgColor;
  final Color surfaceColor;

  const EmojiStickerPanel({
    super.key,
    required this.onEmojiSelected,
    required this.onStickerSelected,
    required this.bgColor,
    required this.surfaceColor,
  });

  @override
  State<EmojiStickerPanel> createState() => _EmojiStickerPanelState();
}

class _EmojiStickerPanelState extends State<EmojiStickerPanel>
    with SingleTickerProviderStateMixin {
  late final TabController _tabCtrl;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 280,
      child: Column(
        children: [
          Container(
            color: widget.surfaceColor,
            child: TabBar(
              controller: _tabCtrl,
              indicatorColor: AppTheme.ponCyan,
              labelColor: AppTheme.ponCyan,
              unselectedLabelColor: Colors.white38,
              labelStyle: const TextStyle(fontSize: 13),
              tabs: [
                Tab(text: context.l10n.emojiTab),
                Tab(text: context.l10n.stickerLabel),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              controller: _tabCtrl,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                EmojiPicker(
                  onEmojiSelected: (_, emoji) =>
                      widget.onEmojiSelected(emoji.emoji),
                  config: Config(
                    height: 240,
                    emojiViewConfig:
                        EmojiViewConfig(backgroundColor: widget.bgColor),
                    categoryViewConfig: CategoryViewConfig(
                      backgroundColor: widget.surfaceColor,
                    ),
                    bottomActionBarConfig: BottomActionBarConfig(
                      backgroundColor: widget.surfaceColor,
                      buttonColor: widget.surfaceColor,
                    ),
                    searchViewConfig:
                        SearchViewConfig(backgroundColor: widget.surfaceColor),
                  ),
                ),
                _StickerGrid(
                  stickers: kStickerList,
                  bgColor: widget.bgColor,
                  onSelected: widget.onStickerSelected,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StickerGrid extends StatelessWidget {
  final List<String> stickers;
  final Color bgColor;
  final void Function(String) onSelected;

  const _StickerGrid({
    required this.stickers,
    required this.bgColor,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: bgColor,
      child: GridView.count(
        crossAxisCount: 4,
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        children: stickers
            .map(
              (s) => InkWell(
                onTap: () => onSelected(s),
                borderRadius: BorderRadius.circular(12),
                splashColor: AppTheme.ponCyan.withValues(alpha: 0.15),
                child: Center(
                  child: Text(s, style: const TextStyle(fontSize: 46)),
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}
