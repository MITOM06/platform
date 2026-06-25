import 'package:flutter/material.dart';

/// Shared motion identity for the PON app — keep in sync with the web side
/// (`motion-spec.md`). Personality: soft, warm, controlled — a gentle settle on
/// entrances, a small playful overshoot only on confirmations. Never mechanical.
///
/// Reuse these tokens everywhere instead of inlining durations/curves so motion
/// stays consistent and is trivially tunable from one place.
class AppMotion {
  AppMotion._();

  // ── Durations ────────────────────────────────────────────────────────────
  /// Press / tap feedback.
  static const Duration instant = Duration(milliseconds: 100);

  /// Hover / simple state change (color, opacity).
  static const Duration fast = Duration(milliseconds: 180);

  /// Entrance of a single element.
  static const Duration base = Duration(milliseconds: 260);

  /// Orchestrated reveal / highlight fade.
  static const Duration slow = Duration(milliseconds: 420);

  /// The ONE signature shimmer loop (assistant avatar sheen).
  static const Duration ambient = Duration(milliseconds: 2800);

  // ── Curves ───────────────────────────────────────────────────────────────
  /// Entrances — `cubic-bezier(0.22, 1, 0.36, 1)` (easeOutQuint-like settle).
  static const Cubic settle = Cubic(0.22, 1, 0.36, 1);

  /// State changes.
  static const Curve standard = Curves.easeInOut;

  /// Confirmations only (reactions / send) — small overshoot.
  static const Curve pop = Curves.easeOutBack;

  // ── Stagger ──────────────────────────────────────────────────────────────
  /// Delay between staggered siblings (auth fields, list reveal).
  static const Duration staggerStep = Duration(milliseconds: 60);

  /// Cap a staggered group so later items don't drift too far.
  static const int staggerCap = 6;

  /// Whether the platform requests reduced motion. When true, callers must skip
  /// animation and render the final frame.
  static bool reduced(BuildContext context) =>
      MediaQuery.maybeDisableAnimationsOf(context) ?? false;
}
