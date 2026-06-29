import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/chat_repository.dart';
import '../../domain/chat_provider.dart';
import 'chat_wallpaper_data.dart' show WallpaperSectionHeader;
import 'chat_wallpaper_dialog.dart';
import 'chat_wallpaper_fit_scale_selector.dart';
import 'chat_wallpaper_preview.dart';

/// The wallpaper-picker dialog body. Public so it can live in its own file per
/// the clean-code split; only [showWallpaperDialog] should construct it.
class WallpaperDialog extends StatefulWidget {
  final List<WallpaperPreset> presets;
  final String conversationId;
  final WidgetRef ref;

  const WallpaperDialog({
    super.key,
    required this.presets,
    required this.conversationId,
    required this.ref,
  });

  @override
  State<WallpaperDialog> createState() => _WallpaperDialogState();
}

class _WallpaperDialogState extends State<WallpaperDialog> {
  bool _uploading = false;
  bool _colorsExpanded = false;
  // Currently *selected* (not yet applied) wallpaper base value + fit + scale.
  // [_scale] is an integer percentage (web-compatible); 100 = original size.
  late String _selected;
  late String _fit;
  late int _scale;

  /// Color presets hidden behind "show more" (index ≥ 5 in the colors category).
  /// Mirrors the web client so both platforms collapse the same set.
  static const _hiddenColorValues = [
    'preset:ocean_blue', 'preset:forest_green', 'preset:purple_haze',
    'preset:warm_amber', 'preset:rose_gold', 'preset:storm',
    'preset:cherry_blossom', 'preset:midnight_purple', 'preset:coral_reef',
    'preset:arctic_ice',
  ];

  @override
  void initState() {
    super.initState();
    final current = widget.ref.read(chatWallpaperProvider(widget.conversationId));
    final parsed = splitWallpaperLayout(current);
    _selected = parsed.value;
    _fit = parsed.fit;
    _scale = parsed.scale;
    // Auto-expand the collapsible colors section when the active selection is one
    // of the hidden colors, so the highlighted swatch stays visible.
    if (_hiddenColorValues.contains(_selected)) {
      _colorsExpanded = true;
    }
  }

  /// True when the selected value is an uploaded image. Covers both absolute
  /// (`http...`) and relative (`/api/uploads/...`) URLs; only empty/default
  /// and `preset:` values are non-images.
  bool get _isImage =>
      _selected.isNotEmpty && !_selected.startsWith('preset:');

  void _confirm() {
    // Encode fit/scale only for uploaded images and only when non-default — this
    // matches the web client exactly (`fit !== 'cover' || scale !== 100`), so the
    // stored value round-trips identically between platforms. [_scale] is encoded
    // as an integer percentage (e.g. `&scale=150`).
    var value = _selected;
    if (_isImage && (_fit != 'cover' || _scale != kWallpaperDefaultScale)) {
      value = '$_selected#fit=$_fit&scale=$_scale';
    }
    // Issue 6: wallpaper is now server-shared. setWallpaper applies the value
    // optimistically AND persists it via PUT /conversations/{id}/wallpaper,
    // which broadcasts CONVERSATION_UPDATED to every member. The legacy
    // `system.theme.changed:` send is dropped — the server is authoritative.
    widget.ref
        .read(chatWallpaperProvider(widget.conversationId).notifier)
        .setWallpaper(value);
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
      setState(() {
        _selected = url;
        _fit = 'cover';
        _scale = kWallpaperDefaultScale;
        _uploading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _uploading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.wallpaperUploadError)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: AppTheme.darkSurface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 360, maxHeight: 600),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Title bar
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 8, 0),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      context.l10n.changeChatThemeTitle,
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w600),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white54),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),

            // Preview
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: _buildPreview(),
            ),

            const Divider(color: Colors.white12, height: 1),

            // Scrollable theme list
            Expanded(
              child: ListView(
                padding: const EdgeInsets.only(bottom: 8),
                children: [
                  // Default
                  _buildThemeTile(
                    preset: widget.presets.first,
                    icon: const Icon(Icons.block, color: Colors.white54, size: 20),
                  ),
                  const Divider(color: Colors.white12, height: 1),

                  // Colors section
                  WallpaperSectionHeader(
                      label: context.l10n.wallpaperCategoryColors, emoji: '🎨'),
                  ..._buildColorItems(),
                  _buildShowMoreButton(),

                  const Divider(color: Colors.white12, height: 1),

                  // Vibrant section
                  WallpaperSectionHeader(
                      label: context.l10n.wallpaperCategoryVibrant, emoji: '✨'),
                  ...widget.presets
                      .where((p) => p['category'] == 'vibrant')
                      .map((p) => _buildThemeTile(preset: p)),

                  const Divider(color: Colors.white12, height: 1),

                  // Minimal section
                  WallpaperSectionHeader(
                      label: context.l10n.wallpaperCategoryMinimal, emoji: '⬛'),
                  ...widget.presets
                      .where((p) => p['category'] == 'minimal')
                      .map((p) => _buildThemeTile(preset: p)),

                  const Divider(color: Colors.white12, height: 1),

                  // Themes section (image-based photo wallpapers)
                  WallpaperSectionHeader(
                      label: context.l10n.wallpaperCategoryThemes, emoji: '🌄'),
                  ...widget.presets
                      .where((p) => p['category'] == 'themes')
                      .map((p) => _buildThemeTile(preset: p)),

                  const Divider(color: Colors.white12, height: 1),

                  // Upload
                  Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    child: _uploading
                        ? const Center(
                            child: CircularProgressIndicator(
                              valueColor:
                                  AlwaysStoppedAnimation<Color>(AppTheme.ponCyan),
                            ),
                          )
                        : OutlinedButton.icon(
                            style: OutlinedButton.styleFrom(
                              foregroundColor: AppTheme.ponCyan,
                              side: const BorderSide(color: AppTheme.ponCyan),
                            ),
                            icon: const Icon(Icons.add_photo_alternate_outlined),
                            label: Text(context.l10n.uploadImageButton),
                            onPressed: _uploadImage,
                          ),
                  ),

                  if (_isImage)
                    WallpaperFitScaleSelector(
                      fit: _fit,
                      scale: _scale,
                      onFitChanged: (v) => setState(() => _fit = v),
                      onScaleChanged: (v) => setState(() => _scale = v),
                    ),
                ],
              ),
            ),

            // Actions
            const Divider(color: Colors.white12, height: 1),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: Text(context.l10n.actionCancel,
                        style: const TextStyle(color: Colors.white54)),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
                    style:
                        FilledButton.styleFrom(backgroundColor: AppTheme.ponCyan),
                    onPressed: _confirm,
                    child: Text(context.l10n.actionConfirm,
                        style: const TextStyle(color: Colors.white)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Single theme list tile.
  Widget _buildThemeTile({required WallpaperPreset preset, Widget? icon}) {
    final val = preset['value'] as String;
    final name = preset['name'] as String;
    final colors = preset['colors'] as List<Color>?;
    final imageUrl = preset['imageUrl'] as String?;
    // Themed presets are image URLs, so `_isImage` is true while one is active;
    // match them by exact value. Color/default tiles must NOT highlight when an
    // (uploaded or themed) image is selected, hence the `!_isImage` guard there.
    final isSel = imageUrl != null
        ? _selected == val
        : (!_isImage && _selected == val);

    final decoImage = imageUrl != null
        ? DecorationImage(image: NetworkImage(imageUrl), fit: BoxFit.cover)
        : null;

    return InkWell(
      onTap: () => setState(() => _selected = val),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: isSel ? AppTheme.ponCyan : Colors.white24,
                  width: isSel ? 2.5 : 1.5,
                ),
                gradient: colors != null
                    ? LinearGradient(
                        colors: colors,
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter)
                    : null,
                image: decoImage,
                color: (colors == null && decoImage == null)
                    ? Colors.transparent
                    : null,
              ),
              child: icon ??
                  (isSel
                      ? const Icon(Icons.check, color: Colors.white, size: 18)
                      : null),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(name,
                  style: TextStyle(
                      color: isSel ? Colors.white : Colors.white70,
                      fontSize: 14)),
            ),
            if (isSel)
              const Icon(Icons.check_circle, color: AppTheme.ponCyan, size: 18),
          ],
        ),
      ),
    );
  }

  /// Color items with collapsible "show more".
  List<Widget> _buildColorItems() {
    final colorItems =
        widget.presets.where((p) => p['category'] == 'colors').toList();
    final visible = _colorsExpanded ? colorItems : colorItems.take(5).toList();
    return visible.map((p) => _buildThemeTile(preset: p)).toList();
  }

  /// "Xem thêm / Ẩn bớt" toggle button.
  Widget _buildShowMoreButton() {
    return TextButton(
      style: TextButton.styleFrom(foregroundColor: AppTheme.ponCyan),
      onPressed: () => setState(() => _colorsExpanded = !_colorsExpanded),
      child: Text(_colorsExpanded
          ? context.l10n.wallpaperShowLess
          : context.l10n.wallpaperShowMore),
    );
  }

  /// Live preview of the currently selected theme. For uploaded images this
  /// renders a mock chat (dummy bubbles over the image) so the user can judge
  /// the real look and adjust scale/fit before applying.
  Widget _buildPreview() {
    if (_isImage) {
      return WallpaperMockPreview(
        imageUrl: _selected,
        fit: wallpaperBoxFit(_fit),
        scalePercent: _scale,
      );
    }
    final colors = _previewColors();
    return Container(
      height: 120,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white24),
        gradient: colors != null
            ? LinearGradient(
                colors: colors,
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter)
            : null,
        color: colors == null ? const Color(0xFF101014) : null,
      ),
      child: colors == null
          ? Center(
              child: Text(
                context.l10n.wallpaperDefaultName,
                style: const TextStyle(color: Colors.white38),
              ),
            )
          : null,
    );
  }

  List<Color>? _previewColors() {
    if (_isImage) return null;
    final match = widget.presets.firstWhere(
      (p) => p['value'] == _selected,
      orElse: () => const {},
    );
    return match['colors'] as List<Color>?;
  }
}
