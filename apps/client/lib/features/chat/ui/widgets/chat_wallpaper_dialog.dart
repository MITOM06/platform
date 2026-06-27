import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/chat_repository.dart';
import '../../domain/chat_provider.dart';
import 'chat_wallpaper_fit_scale_selector.dart';
import 'chat_wallpaper_preview.dart';

/// A single wallpaper preset entry. `colors` is absent for the default option
/// and image-based themes; `imageUrl` is present only for the `'themes'` category.
/// `category` is one of `'default'`, `'colors'`, `'vibrant'`, `'minimal'`, `'themes'`.
typedef WallpaperPreset = Map<String, Object?>;

/// Unsplash CDN base for the image-based themed wallpapers. Kept in lockstep with
/// `UNSPLASH_BASE` in the web client (`WallpaperPickerModal.tsx`).
const String _unsplashBase = 'https://images.unsplash.com';

/// Default wallpaper scale, expressed as an integer percentage to match the web
/// client (`apps/web/.../WallpaperPickerModal.tsx`). 100 = original size.
const int kWallpaperDefaultScale = 100;

/// Minimum / maximum scale percentage for the wallpaper slider — kept in lockstep
/// with the web client's `<Slider min={50} max={200} step={5} />`.
const int kWallpaperMinScale = 50;
const int kWallpaperMaxScale = 200;
const int kWallpaperScaleStep = 5;

/// Splits a stored wallpaper value into its base value and the optional
/// `#fit=cover|contain|fill` suffix used to control how an uploaded image is
/// laid out behind the chat. Presets/empty have no fit. Default fit = cover.
///
/// Kept for backward compatibility; new code should use
/// [splitWallpaperLayout] which also parses the `&scale=` suffix.
({String value, String fit}) splitWallpaperFit(String? raw) {
  final parsed = splitWallpaperLayout(raw);
  return (value: parsed.value, fit: parsed.fit);
}

/// Splits a stored wallpaper value into its base value, the optional
/// `#fit=cover|contain|fill` suffix and the optional `&scale=<int>` suffix.
///
/// [scale] is an **integer percentage** (100 = original size) and is wire-compatible
/// with the web client, which encodes/decodes `scale` the same way (CSS `${scale}%`).
/// Convert to a [Transform.scale] multiplier with `scale / 100.0` only at render time.
///
/// Backward compatible: bare URLs/presets parse with fit=cover, scale=100;
/// `<value>#fit=contain` parses scale=100; web-saved `<value>#fit=cover&scale=150`
/// round-trips. Any legacy multiplier values (e.g. `scale=1.5`) are normalised to a
/// sane percentage so old data never produces a runaway zoom.
({String value, String fit, int scale}) splitWallpaperLayout(String? raw) {
  if (raw == null || raw.isEmpty) {
    return (value: '', fit: 'cover', scale: kWallpaperDefaultScale);
  }
  final idx = raw.indexOf('#fit=');
  if (idx == -1) {
    return (value: raw, fit: 'cover', scale: kWallpaperDefaultScale);
  }
  final value = raw.substring(0, idx);
  var rest = raw.substring(idx + 5);
  var fit = rest;
  var scale = kWallpaperDefaultScale;
  final scaleIdx = rest.indexOf('&scale=');
  if (scaleIdx != -1) {
    fit = rest.substring(0, scaleIdx);
    scale = _parseScalePercent(rest.substring(scaleIdx + 7));
  }
  return (value: value, fit: fit, scale: scale);
}

/// Parses a stored `scale` token into a percentage. Accepts the canonical integer
/// percentage form (`150`) and, defensively, any legacy multiplier form (`1.5`) by
/// upscaling it to a percentage. Clamps to the supported slider range.
int _parseScalePercent(String raw) {
  final parsed = double.tryParse(raw);
  if (parsed == null || parsed <= 0) return kWallpaperDefaultScale;
  // Legacy multiplier values were < ~5 (slider was 1.0–3.0); treat those as
  // multipliers and convert to a percentage. Everything else is a percentage.
  final percent = parsed < 5 ? (parsed * 100).round() : parsed.round();
  return percent.clamp(kWallpaperMinScale, kWallpaperMaxScale);
}

/// Maps a stored fit token to a [BoxFit] for rendering the wallpaper image.
BoxFit wallpaperBoxFit(String fit) {
  switch (fit) {
    case 'contain':
      return BoxFit.contain;
    case 'fill':
      return BoxFit.fill;
    default:
      return BoxFit.cover;
  }
}

void showWallpaperDialog(BuildContext context, WidgetRef ref, String conversationId) {
  final presets = <WallpaperPreset>[
    // ── Default ──
    {'name': context.l10n.wallpaperDefaultName, 'value': '', 'category': 'default'},

    // ── Màu sắc đơn giản ──
    {'name': 'Midnight Glow', 'value': 'preset:midnight_glow', 'category': 'colors',
     'colors': [const Color(0xFF0F0C20), const Color(0xFF15102A), const Color(0xFF050211)]},
    {'name': 'Neon Teal', 'value': 'preset:neon_teal', 'category': 'colors',
     'colors': [const Color(0xFF0A1F1D), const Color(0xFF081215), const Color(0xFF02070A)]},
    {'name': 'Sunset', 'value': 'preset:sunset', 'category': 'colors',
     'colors': [const Color(0xFF2C1619), const Color(0xFF1C0D1A), const Color(0xFF0F0611)]},
    {'name': 'Sweet Pink', 'value': 'preset:sweet_pink', 'category': 'colors',
     'colors': [const Color(0xFF2A1020), const Color(0xFF160A18), const Color(0xFF0C020A)]},
    {'name': 'Dark Shadow', 'value': 'preset:dark_shadow', 'category': 'colors',
     'colors': [const Color(0xFF121214), const Color(0xFF121214)]},
    {'name': 'Ocean Blue', 'value': 'preset:ocean_blue', 'category': 'colors',
     'colors': [const Color(0xFF0A1A35), const Color(0xFF051228), const Color(0xFF020A1A)]},
    {'name': 'Forest Green', 'value': 'preset:forest_green', 'category': 'colors',
     'colors': [const Color(0xFF0A1F0F), const Color(0xFF061408), const Color(0xFF020A04)]},
    {'name': 'Purple Haze', 'value': 'preset:purple_haze', 'category': 'colors',
     'colors': [const Color(0xFF1A0A2E), const Color(0xFF120620), const Color(0xFF0A0216)]},
    {'name': 'Warm Amber', 'value': 'preset:warm_amber', 'category': 'colors',
     'colors': [const Color(0xFF2A1A05), const Color(0xFF1A0F02), const Color(0xFF0F0801)]},
    {'name': 'Rose Gold', 'value': 'preset:rose_gold', 'category': 'colors',
     'colors': [const Color(0xFF2A0D1A), const Color(0xFF1A0810), const Color(0xFF2A1A08)]},
    {'name': 'Storm', 'value': 'preset:storm', 'category': 'colors',
     'colors': [const Color(0xFF0D1520), const Color(0xFF080E18), const Color(0xFF04080F)]},
    {'name': 'Cherry Blossom', 'value': 'preset:cherry_blossom', 'category': 'colors',
     'colors': [const Color(0xFF2A1020), const Color(0xFF200C18), const Color(0xFF180812)]},
    {'name': 'Midnight Purple', 'value': 'preset:midnight_purple', 'category': 'colors',
     'colors': [const Color(0xFF180528), const Color(0xFF100320), const Color(0xFF060118)]},
    {'name': 'Coral Reef', 'value': 'preset:coral_reef', 'category': 'colors',
     'colors': [const Color(0xFF2A0A0A), const Color(0xFF1A0605), const Color(0xFF180410)]},
    {'name': 'Arctic Ice', 'value': 'preset:arctic_ice', 'category': 'colors',
     'colors': [const Color(0xFF0A1A28), const Color(0xFF061220), const Color(0xFF040E1A)]},

    // ── Gradient sống động ──
    {'name': 'Aurora', 'value': 'preset:aurora', 'category': 'vibrant',
     'colors': [const Color(0xFF051A1A), const Color(0xFF061408), const Color(0xFF150820)]},
    {'name': 'Galaxy', 'value': 'preset:galaxy', 'category': 'vibrant',
     'colors': [const Color(0xFF0A0A28), const Color(0xFF100820), const Color(0xFF060610)]},
    {'name': 'Fire & Ice', 'value': 'preset:fire_ice', 'category': 'vibrant',
     'colors': [const Color(0xFF280A08), const Color(0xFF0F0F18), const Color(0xFF080A28)]},
    {'name': 'Tropical', 'value': 'preset:tropical', 'category': 'vibrant',
     'colors': [const Color(0xFF051A10), const Color(0xFF04141A), const Color(0xFF101205)]},
    {'name': 'Candy', 'value': 'preset:candy', 'category': 'vibrant',
     'colors': [const Color(0xFF200A20), const Color(0xFF180820), const Color(0xFF081820)]},

    // ── Tối giản ──
    {'name': 'Pure Dark', 'value': 'preset:pure_dark', 'category': 'minimal',
     'colors': [const Color(0xFF050507), const Color(0xFF030303)]},
    {'name': 'Soft Gray', 'value': 'preset:soft_gray', 'category': 'minimal',
     'colors': [const Color(0xFF2A2A2E), const Color(0xFF1E1E22), const Color(0xFF2A2A2E)]},
    {'name': 'Warm Night', 'value': 'preset:warm_night', 'category': 'minimal',
     'colors': [const Color(0xFF0F0F14), const Color(0xFF100518), const Color(0xFF0F0F14)]},

    // ── Chủ đề (themed photos) ──
    // Stored as the RAW Unsplash URL (no `#fit=` suffix) so it round-trips
    // identically with the web client (`THEMED_PRESETS` in WallpaperPickerModal.tsx)
    // and stays highlighted on reopen — `splitWallpaperLayout` strips `#fit=` and
    // defaults a hash-less image URL to cover.
    {'name': context.l10n.wallpaperThemeForest, 'category': 'themes',
     'value': '$_unsplashBase/photo-1448375240586-882707db888b?w=1920&q=85&auto=format&fit=crop',
     'imageUrl': '$_unsplashBase/photo-1448375240586-882707db888b?w=80&h=80&auto=format&fit=crop&crop=center'},
    {'name': context.l10n.wallpaperThemeOcean, 'category': 'themes',
     'value': '$_unsplashBase/photo-1505118380757-91f5f5632de0?w=1920&q=85&auto=format&fit=crop',
     'imageUrl': '$_unsplashBase/photo-1505118380757-91f5f5632de0?w=80&h=80&auto=format&fit=crop&crop=center'},
    {'name': context.l10n.wallpaperThemeMountain, 'category': 'themes',
     'value': '$_unsplashBase/photo-1464822759023-fed622ff2c3b?w=1920&q=85&auto=format&fit=crop',
     'imageUrl': '$_unsplashBase/photo-1464822759023-fed622ff2c3b?w=80&h=80&auto=format&fit=crop&crop=center'},
    {'name': context.l10n.wallpaperThemeCherryBlossom, 'category': 'themes',
     'value': '$_unsplashBase/photo-1522383225653-ed111181a951?w=1920&q=85&auto=format&fit=crop',
     'imageUrl': '$_unsplashBase/photo-1522383225653-ed111181a951?w=80&h=80&auto=format&fit=crop&crop=center'},
    {'name': context.l10n.wallpaperThemeSpace, 'category': 'themes',
     'value': '$_unsplashBase/photo-1462331940025-496dfbfc7564?w=1920&q=85&auto=format&fit=crop',
     'imageUrl': '$_unsplashBase/photo-1462331940025-496dfbfc7564?w=80&h=80&auto=format&fit=crop&crop=center'},
    {'name': context.l10n.wallpaperThemeAurora, 'category': 'themes',
     'value': '$_unsplashBase/photo-1531366936337-7c912a4589a7?w=1920&q=85&auto=format&fit=crop',
     'imageUrl': '$_unsplashBase/photo-1531366936337-7c912a4589a7?w=80&h=80&auto=format&fit=crop&crop=center'},
    {'name': context.l10n.wallpaperThemeCityNight, 'category': 'themes',
     'value': '$_unsplashBase/photo-1477959858617-67f85cf4f1df?w=1920&q=85&auto=format&fit=crop',
     'imageUrl': '$_unsplashBase/photo-1477959858617-67f85cf4f1df?w=80&h=80&auto=format&fit=crop&crop=center'},
    {'name': context.l10n.wallpaperThemeDesert, 'category': 'themes',
     'value': '$_unsplashBase/photo-1509316785289-025f5b846b35?w=1920&q=85&auto=format&fit=crop',
     'imageUrl': '$_unsplashBase/photo-1509316785289-025f5b846b35?w=80&h=80&auto=format&fit=crop&crop=center'},
  ];

  showDialog(
    context: context,
    builder: (ctx) => _WallpaperDialog(
      presets: presets,
      conversationId: conversationId,
      ref: ref,
    ),
  );
}

class _WallpaperDialog extends StatefulWidget {
  final List<WallpaperPreset> presets;
  final String conversationId;
  final WidgetRef ref;

  const _WallpaperDialog({
    required this.presets,
    required this.conversationId,
    required this.ref,
  });

  @override
  State<_WallpaperDialog> createState() => _WallpaperDialogState();
}

class _WallpaperDialogState extends State<_WallpaperDialog> {
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
                  _buildSectionHeader(context.l10n.wallpaperCategoryColors, '🎨'),
                  ..._buildColorItems(),
                  _buildShowMoreButton(),

                  const Divider(color: Colors.white12, height: 1),

                  // Vibrant section
                  _buildSectionHeader(context.l10n.wallpaperCategoryVibrant, '✨'),
                  ...widget.presets
                      .where((p) => p['category'] == 'vibrant')
                      .map((p) => _buildThemeTile(preset: p)),

                  const Divider(color: Colors.white12, height: 1),

                  // Minimal section
                  _buildSectionHeader(context.l10n.wallpaperCategoryMinimal, '⬛'),
                  ...widget.presets
                      .where((p) => p['category'] == 'minimal')
                      .map((p) => _buildThemeTile(preset: p)),

                  const Divider(color: Colors.white12, height: 1),

                  // Themes section (image-based photo wallpapers)
                  _buildSectionHeader(context.l10n.wallpaperCategoryThemes, '🌄'),
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

  /// Section header row (emoji + label).
  Widget _buildSectionHeader(String label, String emoji) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 2),
      child: Row(
        children: [
          Text(emoji, style: const TextStyle(fontSize: 13)),
          const SizedBox(width: 6),
          Text(label.toUpperCase(),
              style: const TextStyle(
                  fontSize: 10,
                  color: Colors.white38,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.8)),
        ],
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
