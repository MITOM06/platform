import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/chat_repository.dart';
import '../../domain/chat_provider.dart';

/// Splits a stored wallpaper value into its base value and the optional
/// `#fit=cover|contain|fill` suffix used to control how an uploaded image is
/// laid out behind the chat. Presets/empty have no fit. Default fit = cover.
({String value, String fit}) splitWallpaperFit(String? raw) {
  if (raw == null || raw.isEmpty) return (value: '', fit: 'cover');
  final idx = raw.indexOf('#fit=');
  if (idx == -1) return (value: raw, fit: 'cover');
  return (value: raw.substring(0, idx), fit: raw.substring(idx + 5));
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
  // Currently *selected* (not yet applied) wallpaper base value + fit mode.
  late String _selected;
  late String _fit;

  @override
  void initState() {
    super.initState();
    final current = widget.ref.read(chatWallpaperProvider(widget.conversationId));
    final parsed = splitWallpaperFit(current);
    _selected = parsed.value;
    _fit = parsed.fit;
  }

  bool get _isImage => _selected.startsWith('http');

  String _label(String vi, String en) => widget.isVi ? vi : en;

  void _confirm() {
    // Encode fit only for uploaded images; presets/default stay as-is.
    final value = _isImage && _fit != 'cover' ? '$_selected#fit=$_fit' : _selected;
    widget.ref
        .read(chatWallpaperProvider(widget.conversationId).notifier)
        .setWallpaper(value);
    widget.ref
        .read(chatNotifierProvider(widget.conversationId).notifier)
        .sendMessage('system.theme.changed:$value', type: 'system');
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
        _uploading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _uploading = false);
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
              if (_isImage) ...[
                const SizedBox(height: 16),
                Text(
                  _label('Căn chỉnh ảnh', 'Image fit'),
                  style: const TextStyle(color: Colors.white70, fontSize: 13),
                ),
                const SizedBox(height: 8),
                _buildFitSelector(),
              ],
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

  /// Live preview of the currently selected theme.
  Widget _buildPreview() {
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
        color: colors == null && !_isImage ? const Color(0xFF101014) : null,
      ),
      child: _isImage
          ? Image.network(
              _selected,
              fit: wallpaperBoxFit(_fit),
              width: double.infinity,
              errorBuilder: (_, __, ___) => const Center(
                child: Icon(Icons.broken_image_outlined, color: Colors.white38),
              ),
            )
          : (colors == null
              ? Center(
                  child: Text(
                    _label('Mặc định', 'Default'),
                    style: const TextStyle(color: Colors.white38),
                  ),
                )
              : null),
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

  Widget _buildFitSelector() {
    final options = <(String, String, String)>[
      ('cover', _label('Phủ kín', 'Cover'), 'cover'),
      ('contain', _label('Vừa khung', 'Contain'), 'contain'),
      ('fill', _label('Kéo giãn', 'Fill'), 'fill'),
    ];
    return Row(
      children: [
        for (final opt in options)
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 3),
              child: GestureDetector(
                onTap: () => setState(() => _fit = opt.$1),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: _fit == opt.$1
                        ? AppTheme.ponCyan.withValues(alpha: 0.18)
                        : Colors.white.withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: _fit == opt.$1 ? AppTheme.ponCyan : Colors.white12,
                    ),
                  ),
                  child: Text(
                    opt.$2,
                    style: TextStyle(
                      fontSize: 12,
                      color: _fit == opt.$1 ? AppTheme.ponCyan : Colors.white60,
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
