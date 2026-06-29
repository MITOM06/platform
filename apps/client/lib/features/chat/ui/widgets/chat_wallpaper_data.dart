import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';

/// Section header row (emoji + uppercase label) used inside the wallpaper
/// picker to separate preset categories.
class WallpaperSectionHeader extends StatelessWidget {
  final String label;
  final String emoji;

  const WallpaperSectionHeader({super.key, required this.label, required this.emoji});

  @override
  Widget build(BuildContext context) {
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
}

/// A single wallpaper preset entry. `colors` is absent for the default option
/// and image-based themes; `imageUrl` is present only for the `'themes'` category.
/// `category` is one of `'default'`, `'colors'`, `'vibrant'`, `'minimal'`, `'themes'`.
typedef WallpaperPreset = Map<String, Object?>;

/// Unsplash CDN base for the image-based themed wallpapers. Kept in lockstep with
/// `UNSPLASH_BASE` in the web client (`WallpaperPickerModal.tsx`).
const String _unsplashBase = 'https://images.unsplash.com';

/// Builds the full ordered list of wallpaper presets, localized via [context].
/// Kept in lockstep with the web client (`WallpaperPickerModal.tsx`).
List<WallpaperPreset> buildWallpaperPresets(BuildContext context) {
  return <WallpaperPreset>[
    // ── Default ──
    {'name': context.l10n.wallpaperDefaultName, 'value': '', 'category': 'default'},

    // ── Màu sắc đơn giản ──
    {'name': context.l10n.wallpaperPresetMidnightGlow, 'value': 'preset:midnight_glow', 'category': 'colors',
     'colors': [const Color(0xFF0F0C20), const Color(0xFF15102A), const Color(0xFF050211)]},
    {'name': context.l10n.wallpaperPresetNeonTeal, 'value': 'preset:neon_teal', 'category': 'colors',
     'colors': [const Color(0xFF0A1F1D), const Color(0xFF081215), const Color(0xFF02070A)]},
    {'name': context.l10n.wallpaperPresetSunset, 'value': 'preset:sunset', 'category': 'colors',
     'colors': [const Color(0xFF2C1619), const Color(0xFF1C0D1A), const Color(0xFF0F0611)]},
    {'name': context.l10n.wallpaperPresetSweetPink, 'value': 'preset:sweet_pink', 'category': 'colors',
     'colors': [const Color(0xFF2A1020), const Color(0xFF160A18), const Color(0xFF0C020A)]},
    {'name': context.l10n.wallpaperPresetDarkShadow, 'value': 'preset:dark_shadow', 'category': 'colors',
     'colors': [const Color(0xFF121214), const Color(0xFF121214)]},
    {'name': context.l10n.wallpaperPresetOceanBlue, 'value': 'preset:ocean_blue', 'category': 'colors',
     'colors': [const Color(0xFF0A1A35), const Color(0xFF051228), const Color(0xFF020A1A)]},
    {'name': context.l10n.wallpaperPresetForestGreen, 'value': 'preset:forest_green', 'category': 'colors',
     'colors': [const Color(0xFF0A1F0F), const Color(0xFF061408), const Color(0xFF020A04)]},
    {'name': context.l10n.wallpaperPresetPurpleHaze, 'value': 'preset:purple_haze', 'category': 'colors',
     'colors': [const Color(0xFF1A0A2E), const Color(0xFF120620), const Color(0xFF0A0216)]},
    {'name': context.l10n.wallpaperPresetWarmAmber, 'value': 'preset:warm_amber', 'category': 'colors',
     'colors': [const Color(0xFF2A1A05), const Color(0xFF1A0F02), const Color(0xFF0F0801)]},
    {'name': context.l10n.wallpaperPresetRoseGold, 'value': 'preset:rose_gold', 'category': 'colors',
     'colors': [const Color(0xFF2A0D1A), const Color(0xFF1A0810), const Color(0xFF2A1A08)]},
    {'name': context.l10n.wallpaperPresetStorm, 'value': 'preset:storm', 'category': 'colors',
     'colors': [const Color(0xFF0D1520), const Color(0xFF080E18), const Color(0xFF04080F)]},
    {'name': context.l10n.wallpaperPresetCherryBlossom, 'value': 'preset:cherry_blossom', 'category': 'colors',
     'colors': [const Color(0xFF2A1020), const Color(0xFF200C18), const Color(0xFF180812)]},
    {'name': context.l10n.wallpaperPresetMidnightPurple, 'value': 'preset:midnight_purple', 'category': 'colors',
     'colors': [const Color(0xFF180528), const Color(0xFF100320), const Color(0xFF060118)]},
    {'name': context.l10n.wallpaperPresetCoralReef, 'value': 'preset:coral_reef', 'category': 'colors',
     'colors': [const Color(0xFF2A0A0A), const Color(0xFF1A0605), const Color(0xFF180410)]},
    {'name': context.l10n.wallpaperPresetArcticIce, 'value': 'preset:arctic_ice', 'category': 'colors',
     'colors': [const Color(0xFF0A1A28), const Color(0xFF061220), const Color(0xFF040E1A)]},

    // ── Gradient sống động ──
    {'name': context.l10n.wallpaperPresetAurora, 'value': 'preset:aurora', 'category': 'vibrant',
     'colors': [const Color(0xFF051A1A), const Color(0xFF061408), const Color(0xFF150820)]},
    {'name': context.l10n.wallpaperPresetGalaxy, 'value': 'preset:galaxy', 'category': 'vibrant',
     'colors': [const Color(0xFF0A0A28), const Color(0xFF100820), const Color(0xFF060610)]},
    {'name': context.l10n.wallpaperPresetFireIce, 'value': 'preset:fire_ice', 'category': 'vibrant',
     'colors': [const Color(0xFF280A08), const Color(0xFF0F0F18), const Color(0xFF080A28)]},
    {'name': context.l10n.wallpaperPresetTropical, 'value': 'preset:tropical', 'category': 'vibrant',
     'colors': [const Color(0xFF051A10), const Color(0xFF04141A), const Color(0xFF101205)]},
    {'name': context.l10n.wallpaperPresetCandy, 'value': 'preset:candy', 'category': 'vibrant',
     'colors': [const Color(0xFF200A20), const Color(0xFF180820), const Color(0xFF081820)]},

    // ── Tối giản ──
    {'name': context.l10n.wallpaperPresetPureDark, 'value': 'preset:pure_dark', 'category': 'minimal',
     'colors': [const Color(0xFF050507), const Color(0xFF030303)]},
    {'name': context.l10n.wallpaperPresetSoftGray, 'value': 'preset:soft_gray', 'category': 'minimal',
     'colors': [const Color(0xFF2A2A2E), const Color(0xFF1E1E22), const Color(0xFF2A2A2E)]},
    {'name': context.l10n.wallpaperPresetWarmNight, 'value': 'preset:warm_night', 'category': 'minimal',
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
}
