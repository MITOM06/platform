import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_theme.dart';
import '../theme/motion.dart';

// ---------------------------------------------------------------------------
// PON Logo — mirrors the web SVG exactly (same paths, same gradient)
// ---------------------------------------------------------------------------
class PonLogo extends StatelessWidget {
  final double size;
  final bool showText;
  const PonLogo({super.key, this.size = 80, this.showText = true});

  @override
  Widget build(BuildContext context) {
    final iconWidget = CustomPaint(
      size: Size(size, size),
      painter: _PonLogoPainter(),
    );

    if (!showText) return iconWidget;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        iconWidget,
        const SizedBox(height: 8),
        ShaderMask(
          shaderCallback: (bounds) =>
              AppTheme.ponGradient.createShader(bounds),
          child: Text(
            'PON',
            style: TextStyle(
              fontSize: size * 0.48,
              fontWeight: FontWeight.w900,
              color: Colors.white,
              letterSpacing: 2,
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Connect & Chat',
          style: TextStyle(
            fontSize: size * 0.15,
            color: Colors.white54,
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }
}

class _PonLogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final sx = size.width / 24;
    final sy = size.height / 24;

    final paint = Paint()
      ..shader = AppTheme.ponGradient.createShader(
        Rect.fromLTWH(0, 0, size.width, size.height),
      )
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
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ---------------------------------------------------------------------------
// Frosted Glass Neon Card (Glassmorphism)
// ---------------------------------------------------------------------------
class PonCard extends StatelessWidget {
  final Widget child;
  final double borderRadius;
  final double blur;
  final double borderOpacity;
  final double bgOpacity;
  final Color glowColor;
  final double glowStrength;

  const PonCard({
    super.key,
    required this.child,
    this.borderRadius = 24.0,
    this.blur = 15.0,
    this.borderOpacity = 0.25,
    this.bgOpacity = 0.6,
    this.glowColor = AppTheme.ponPeach,
    this.glowStrength = 6.0,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(borderRadius),
        boxShadow: glowStrength > 0 && isDark
            ? [
                BoxShadow(
                  color: glowColor.withValues(alpha: 0.08),
                  blurRadius: glowStrength * 3,
                  spreadRadius: 1,
                )
              ]
            : null,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(borderRadius),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
          child: Container(
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface.withValues(alpha: bgOpacity),
              borderRadius: BorderRadius.circular(borderRadius),
              border: Border.all(
                color: (isDark
                        ? AppTheme.darkBorder
                        : Theme.of(context).colorScheme.primary.withValues(alpha: 0.15))
                    .withValues(alpha: borderOpacity),
                width: 1.5,
              ),
            ),
            child: child,
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Neon Gradient Button with Glow & Scale animation
// ---------------------------------------------------------------------------
class PonButton extends StatefulWidget {
  final VoidCallback? onPressed;
  final Widget child;
  final List<Color> gradientColors;
  final Color glowColor;
  final bool isLoading;

  const PonButton({
    super.key,
    required this.onPressed,
    required this.child,
    this.gradientColors = const [AppTheme.ponCyan, AppTheme.ponPink],
    this.glowColor = AppTheme.ponCyan,
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
            borderRadius: BorderRadius.circular(18),
            gradient: LinearGradient(
              colors: isDisabled
                  ? (isDark
                      ? [Colors.grey.shade800, Colors.grey.shade900]
                      : [Colors.grey.shade300, Colors.grey.shade400])
                  : widget.gradientColors,
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            boxShadow: isDisabled || !isDark
                ? null
                : [
                    BoxShadow(
                      color: widget.glowColor.withValues(alpha: 0.35),
                      blurRadius: _isPressed ? 8 : 16,
                      spreadRadius: 1,
                      offset: const Offset(0, 4),
                    ),
                  ],
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
// Glowing Text Field (Glows neon when focused)
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
    this.focusColor = AppTheme.ponCyan,
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
  bool _isFocused = false;
  late bool _obscured;

  @override
  void initState() {
    super.initState();
    _obscured = widget.obscureText;
    _internalFocusNode = widget.focusNode ?? FocusNode();
    _internalFocusNode.addListener(_handleFocusChange);
  }

  void _handleFocusChange() {
    if (mounted) {
      setState(() {
        _isFocused = _internalFocusNode.hasFocus;
      });
    }
  }

  @override
  void dispose() {
    // Only dispose if it was created internally
    if (widget.focusNode == null) {
      _internalFocusNode.dispose();
    } else {
      _internalFocusNode.removeListener(_handleFocusChange);
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 250),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: _isFocused
                ? widget.focusColor.withValues(alpha: 0.15)
                : Colors.transparent,
            blurRadius: 10,
            spreadRadius: 1,
          )
        ],
      ),
      child: TextFormField(
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
      ),
    );
  }
}

// NOTE: BouncingDots was extracted to `bouncing_dots.dart` to keep this file
// within the 400-line clean-code limit.
