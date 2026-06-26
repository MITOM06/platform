import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import 'chat_wallpaper_dialog.dart';

/// Controls how an uploaded wallpaper image is laid out behind the chat: a
/// segmented fit selector (`cover` / `contain` / `fill`) plus a scale slider.
///
/// Kept in lockstep with the web client's `WallpaperPickerModal.tsx`:
/// [scale] is an integer percentage (100 = original size) and the slider range
/// mirrors `<Slider min={50} max={200} step={5} />`. The scale slider is hidden
/// for `fill` (which always stretches to fill the frame).
class WallpaperFitScaleSelector extends StatelessWidget {
  final String fit;
  final int scale;
  final ValueChanged<String> onFitChanged;
  final ValueChanged<int> onScaleChanged;

  const WallpaperFitScaleSelector({
    super.key,
    required this.fit,
    required this.scale,
    required this.onFitChanged,
    required this.onScaleChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 16),
        Text(
          context.l10n.imageFitLabel,
          style: const TextStyle(color: Colors.white70, fontSize: 13),
        ),
        const SizedBox(height: 8),
        _buildFitSelector(context),
        // The scale slider is hidden for `fill` (which always stretches to
        // fill the frame), mirroring the web client.
        if (fit != 'fill') ...[
          const SizedBox(height: 16),
          Row(
            children: [
              Text(
                context.l10n.wallpaperScale,
                style: const TextStyle(color: Colors.white70, fontSize: 13),
              ),
              const Spacer(),
              Text(
                '$scale%',
                style: const TextStyle(color: AppTheme.ponCyan, fontSize: 13),
              ),
            ],
          ),
          Slider(
            value: scale.toDouble(),
            min: kWallpaperMinScale.toDouble(),
            max: kWallpaperMaxScale.toDouble(),
            divisions:
                (kWallpaperMaxScale - kWallpaperMinScale) ~/ kWallpaperScaleStep,
            activeColor: AppTheme.ponCyan,
            label: '$scale%',
            onChanged: (v) => onScaleChanged(v.round()),
          ),
        ],
      ],
    );
  }

  Widget _buildFitSelector(BuildContext context) {
    final options = <(String, String, String)>[
      ('cover', context.l10n.fitCoverLabel, 'cover'),
      ('contain', context.l10n.fitContainLabel, 'contain'),
      ('fill', context.l10n.fitFillLabel, 'fill'),
    ];
    return Row(
      children: [
        for (final opt in options)
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 3),
              child: GestureDetector(
                onTap: () => onFitChanged(opt.$1),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: fit == opt.$1
                        ? AppTheme.ponCyan.withValues(alpha: 0.18)
                        : Colors.white.withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: fit == opt.$1 ? AppTheme.ponCyan : Colors.white12,
                    ),
                  ),
                  child: Text(
                    opt.$2,
                    style: TextStyle(
                      fontSize: 12,
                      color: fit == opt.$1 ? AppTheme.ponCyan : Colors.white60,
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
