import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_theme.dart';
import '../theme/motion.dart';

// ---------------------------------------------------------------------------
// PON Logo — mirrors the web SVG (same paths). The neon 3-stop gradient was
// retired in the redesign: the mark is a single flat accent shape on both
// platforms, so it inherits the theme's one accent colour.
// ---------------------------------------------------------------------------
class PonLogo extends StatelessWidget {
  final double size;
  final bool showText;
  const PonLogo({super.key, this.size = 80, this.showText = true});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final iconWidget = CustomPaint(
      size: Size(size, size),
      painter: _PonLogoPainter(scheme.primary),
    );

    if (!showText) return iconWidget;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        iconWidget,
        const SizedBox(height: 8),
        Text(
          'PON',
          style: TextStyle(
            fontSize: size * 0.48,
            fontWeight: FontWeight.w900,
            color: scheme.primary,
            letterSpacing: 2,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Connect & Chat',
          style: TextStyle(
            fontSize: size * 0.15,
            color: scheme.onSurface.withValues(alpha: 0.6),
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }
}

class _PonLogoPainter extends CustomPainter {
  final Color color;
  const _PonLogoPainter(this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final sx = size.width / 24;
    final sy = size.height / 24;

    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    // Outer speech-bubble + inner ring hole — evenOdd makes the inner area transparent
    final path = Path()..fillType = PathFillType.evenOdd;

    // Outer speech-bubble (web path 1, first sub-path)
    path.moveTo(12 * sx, 2 * sy);
    path.cubicTo(6.48 * sx, 2 * sy, 2 * sx, 6.48 * sy, 2 * sx, 12 * sy);
    path.cubicTo(2 * sx, 14.52 * sy, 2.93 * sx, 16.82 * sy, 4.46 * sx, 18.6 * sy);
    path.lineTo(3 * sx, 21 * sy);
    path.lineTo(5.8 * sx, 20.3 * sy);
    path.cubicTo(7.54 * sx, 21.37 * sy, 9.6 * sx, 22 * sy, 12 * sx, 22 * sy);
    path.cubicTo(17.52 * sx, 22 * sy, 22 * sx, 17.52 * sy, 22 * sx, 12 * sy);
    path.cubicTo(22 * sx, 6.48 * sy, 17.52 * sx, 2 * sy, 12 * sx, 2 * sy);
    path.close();

    // Inner ring boundary — second sub-path punches a transparent hole
    path.moveTo(12 * sx, 18 * sy);
    path.cubicTo(8.69 * sx, 18 * sy, 6 * sx, 15.31 * sy, 6 * sx, 12 * sy);
    path.cubicTo(6 * sx, 8.69 * sy, 8.69 * sx, 6 * sy, 12 * sx, 6 * sy);
    path.cubicTo(15.31 * sx, 6 * sy, 18 * sx, 8.69 * sy, 18 * sx, 12 * sy);
    path.cubicTo(18 * sx, 15.31 * sy, 15.31 * sx, 18 * sy, 12 * sx, 18 * sy);
    path.close();

    canvas.drawPath(path, paint);

    // Center dot (web <circle cx="12" cy="12" r="3">)
    canvas.drawCircle(Offset(12 * sx, 12 * sy), 3 * sx, paint);
  }

  @override
  bool shouldRepaint(covariant _PonLogoPainter oldDelegate) =>
      oldDelegate.color != color;
}

// ---------------------------------------------------------------------------
// Surface card — an opaque surface + 1px hairline border. No glass, no glow.
// Elevation is expressed as a background-shade step (background -> surface),
// per UI-REDESIGN-DIRECTION.md §2 rule 3.
// ---------------------------------------------------------------------------
class PonCard extends StatelessWidget {
  final Widget child;
  final double borderRadius;

  /// Kept only so the ~70 existing call sites keep compiling. The frosted-glass
  /// and neon-glow look they configured no longer exists, so these are ignored.
  /// TODO(ui-redesign-L3): drop these params and clean up every call site.
  final double blur;
  final double borderOpacity;
  final double bgOpacity;
  final Color glowColor;
  final double glowStrength;

  const PonCard({
    super.key,
    required this.child,
    this.borderRadius = AppTheme.radiusCard,
    this.blur = 0,
    this.borderOpacity = 1,
    this.bgOpacity = 1,
    this.glowColor = AppTheme.ponAccent,
    this.glowStrength = 0,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(
          color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
          width: 1,
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(borderRadius),
        child: child,
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Primary action button — flat accent fill, 10px radius, press-scale only.
// No gradient, no glow (UI-REDESIGN-DIRECTION.md §2 rules 2-4).
// ---------------------------------------------------------------------------
class PonButton extends StatefulWidget {
  final VoidCallback? onPressed;
  final Widget child;

  /// Kept for call-site compatibility. The button is a flat single-accent fill
  /// now; if a non-null list is passed, only its FIRST colour is honoured so a
  /// deliberately-coloured button (e.g. destructive) still reads correctly.
  /// TODO(ui-redesign-L3): replace with an explicit `variant` enum.
  final List<Color>? gradientColors;
  final Color glowColor;
  final bool isLoading;

  const PonButton({
    super.key,
    required this.onPressed,
    required this.child,
    this.gradientColors,
    this.glowColor = AppTheme.ponAccent,
    this.isLoading = false,
  });

  @override
  State<PonButton> createState() => _PonButtonState();
}

class _PonButtonState extends State<PonButton> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    final isDisabled = widget.onPressed == null || widget.isLoading;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GestureDetector(
      onTapDown: (_) => setState(() => _isPressed = true),
      onTapUp: (_) => setState(() => _isPressed = false),
      onTapCancel: () => setState(() => _isPressed = false),
      onTap: isDisabled ? null : widget.onPressed,
      child: AnimatedScale(
        scale: _isPressed ? 0.96 : 1.0,
        duration: AppMotion.instant,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppTheme.radiusControl),
            color: isDisabled
                ? (isDark ? AppTheme.darkBorder : AppTheme.lightBorder)
                : (widget.gradientColors?.first ??
                    Theme.of(context).colorScheme.primary),
          ),
          padding: const EdgeInsets.symmetric(vertical: 16),
          alignment: Alignment.center,
          child: widget.isLoading
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                  ),
                )
              : DefaultTextStyle(
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                    letterSpacing: 0.5,
                  ),
                  child: widget.child,
                ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Text field — focus is shown by the 2px accent border from
// `inputDecorationTheme`, not by a neon glow.
// ---------------------------------------------------------------------------
class PonTextField extends StatefulWidget {
  final TextEditingController controller;
  final String labelText;
  final IconData prefixIcon;
  final Widget? suffixIcon;
  final bool obscureText;

  /// When true (and [obscureText] is true), renders a trailing eye icon that
  /// toggles the field between obscured and plain text. (Task 75)
  final bool enableVisibilityToggle;
  final TextInputType keyboardType;
  final TextInputAction textInputAction;
  final ValueChanged<String>? onFieldSubmitted;
  final String? Function(String?)? validator;
  final FocusNode? focusNode;
  final Color focusColor;
  final int? maxLength;
  final String? counterText;
  final TextStyle? style;
  final List<dynamic>? inputFormatters;
  final ValueChanged<String>? onChanged;
  final bool? enabled;

  /// Autofill hints for the platform autofill service. Pass `const []` to
  /// explicitly opt OUT of OS/browser autofill (e.g. a current-password field
  /// that must start empty — Issue 4). Null = framework default behaviour.
  final Iterable<String>? autofillHints;

  const PonTextField({
    super.key,
    required this.controller,
    required this.labelText,
    required this.prefixIcon,
    this.suffixIcon,
    this.obscureText = false,
    this.enableVisibilityToggle = false,
    this.keyboardType = TextInputType.text,
    this.textInputAction = TextInputAction.next,
    this.onFieldSubmitted,
    this.validator,
    this.focusNode,
    this.focusColor = AppTheme.ponAccent,
    this.maxLength,
    this.counterText,
    this.style,
    this.inputFormatters,
    this.onChanged,
    this.enabled,
    this.autofillHints,
  });

  @override
  State<PonTextField> createState() => _PonTextFieldState();
}

class _PonTextFieldState extends State<PonTextField> {
  late FocusNode _internalFocusNode;
  late bool _obscured;

  @override
  void initState() {
    super.initState();
    _obscured = widget.obscureText;
    _internalFocusNode = widget.focusNode ?? FocusNode();
  }

  @override
  void dispose() {
    // Only dispose if it was created internally.
    // No focus listener any more: the focused state is drawn by
    // `inputDecorationTheme.focusedBorder`, so no rebuild is needed on focus.
    if (widget.focusNode == null) {
      _internalFocusNode.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return TextFormField(
        controller: widget.controller,
        focusNode: _internalFocusNode,
        obscureText: widget.enableVisibilityToggle
            ? _obscured
            : widget.obscureText,
        keyboardType: widget.keyboardType,
        textInputAction: widget.textInputAction,
        onFieldSubmitted: widget.onFieldSubmitted,
        validator: widget.validator,
        maxLength: widget.maxLength,
        style: widget.style,
        onChanged: widget.onChanged,
        enabled: widget.enabled,
        autofillHints: widget.autofillHints,
        inputFormatters: widget.inputFormatters != null
            ? List<TextInputFormatter>.from(widget.inputFormatters!)
            : null,
        decoration: InputDecoration(
          labelText: widget.labelText,
          prefixIcon: Icon(widget.prefixIcon),
          suffixIcon: widget.enableVisibilityToggle
              ? IconButton(
                  icon: Icon(
                    _obscured
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined,
                  ),
                  onPressed: () => setState(() => _obscured = !_obscured),
                )
              : widget.suffixIcon,
          counterText: widget.counterText,
        ),
    );
  }
}

// NOTE: BouncingDots was extracted to `bouncing_dots.dart` to keep this file
// within the 400-line clean-code limit.
