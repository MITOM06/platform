import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_theme.dart';

// ---------------------------------------------------------------------------
// PON Logo
// ---------------------------------------------------------------------------
class PonLogo extends StatelessWidget {
  final double size;
  final bool showText;
  const PonLogo({super.key, this.size = 80, this.showText = true});

  @override
  Widget build(BuildContext context) {
    final imageWidget = Image.asset(
      'assets/images/logo.png',
      width: size,
      height: size,
      fit: BoxFit.contain,
    );

    if (!showText) return imageWidget;

    // Column layout matching web auth layout: icon → "PON" → "Connect & Chat"
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        imageWidget,
        const SizedBox(height: 8),
        ShaderMask(
          shaderCallback: (bounds) => const LinearGradient(
            colors: [AppTheme.ponCyan, AppTheme.ponPeach, AppTheme.ponPink],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ).createShader(bounds),
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
        duration: const Duration(milliseconds: 100),
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
