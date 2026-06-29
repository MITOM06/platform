import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'chat_wallpaper_data.dart';
import 'chat_wallpaper_dialog_view.dart';

// Re-exported so existing importers of `chat_wallpaper_dialog.dart` keep getting
// the [WallpaperPreset] typedef without changing their imports.
export 'chat_wallpaper_data.dart' show WallpaperPreset;

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
  final presets = buildWallpaperPresets(context);
  showDialog(
    context: context,
    builder: (ctx) => WallpaperDialog(
      presets: presets,
      conversationId: conversationId,
      ref: ref,
    ),
  );
}
