import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/chat_repository.dart';
import '../../domain/chat_provider.dart';
import 'chat_wallpaper_fit_scale_selector.dart';
import 'chat_wallpaper_preview.dart';

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
  // Currently *selected* (not yet applied) wallpaper base value + fit + scale.
  // [_scale] is an integer percentage (web-compatible); 100 = original size.
  late String _selected;
  late String _fit;
  late int _scale;

  @override
  void initState() {
    super.initState();
    final current = widget.ref.read(chatWallpaperProvider(widget.conversationId));
    final parsed = splitWallpaperLayout(current);
    _selected = parsed.value;
    _fit = parsed.fit;
    _scale = parsed.scale;
  }

  /// True when the selected value is an uploaded image. Covers both absolute
  /// (`http...`) and relative (`/api/uploads/...`) URLs; only empty/default
  /// and `preset:` values are non-images.
  bool get _isImage =>
      _selected.isNotEmpty && !_selected.startsWith('preset:');

  String _label(String vi, String en) => widget.isVi ? vi : en;

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
    return AlertDialog(
      backgroundColor: AppTheme.darkSurface,
      title: Text(
        _label('Đổi chủ đề đoạn chat', 'Change Chat Theme'),
        style: const TextStyle(color: Colors.white),
      ),
      content: SizedBox(
        width: 320,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildPreview(),
              const SizedBox(height: 16),
              Wrap(
                spacing: 12,
                runSpacing: 12,
                children: widget.presets.map((p) {
                  final val = p['value'] as String;
                  final isDefault = val == '';
                  final colors = p['colors'] as List<Color>?;
                  final isSelected = !_isImage && _selected == val;
                  return GestureDetector(
                    onTap: () => setState(() => _selected = val),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 50,
                          height: 50,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: isSelected ? AppTheme.ponCyan : Colors.white24,
                              width: isSelected ? 2.5 : 1.5,
                            ),
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
                              : (isSelected
                                  ? const Icon(Icons.check, color: Colors.white, size: 22)
                                  : null),
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
                        padding:
                            const EdgeInsets.symmetric(vertical: 12, horizontal: 20),
                      ),
                      icon: const Icon(Icons.add_photo_alternate_outlined),
                      label: Text(_label('Tải ảnh lên', 'Upload image')),
                      onPressed: _uploadImage,
                    ),
              if (_isImage)
                WallpaperFitScaleSelector(
                  fit: _fit,
                  scale: _scale,
                  isVi: widget.isVi,
                  onFitChanged: (v) => setState(() => _fit = v),
                  onScaleChanged: (v) => setState(() => _scale = v),
                ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(_label('Hủy', 'Cancel'),
              style: const TextStyle(color: Colors.white54)),
        ),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: AppTheme.ponCyan),
          onPressed: _confirm,
          child: Text(_label('Xác nhận đổi', 'Confirm'),
              style: const TextStyle(color: Colors.white)),
        ),
      ],
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
                _label('Mặc định', 'Default'),
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
