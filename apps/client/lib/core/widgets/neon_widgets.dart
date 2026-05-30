import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_theme.dart';

// ---------------------------------------------------------------------------
// PON Logo with Neon Pulsing Animation
// ---------------------------------------------------------------------------
class PonLogo extends StatefulWidget {
  final double size;
  final bool showText;
  const PonLogo({super.key, this.size = 80, this.showText = true});

  @override
  State<PonLogo> createState() => _PonLogoState();
}

class _PonLogoState extends State<PonLogo> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _glowAnimation;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);

    _glowAnimation = Tween<double>(begin: 8.0, end: 24.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );

    _scaleAnimation = Tween<double>(begin: 0.95, end: 1.05).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Glowing circular logo icon
            Transform.scale(
              scale: _scaleAnimation.value,
              child: Container(
                width: widget.size,
                height: widget.size,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: const LinearGradient(
                    colors: [AppTheme.neonCyan, AppTheme.neonPink],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: AppTheme.neonCyan.withValues(alpha: 0.4),
                      blurRadius: _glowAnimation.value,
                      spreadRadius: 2,
                    ),
                    BoxShadow(
                      color: AppTheme.neonPink.withValues(alpha: 0.3),
                      blurRadius: _glowAnimation.value * 1.5,
                      spreadRadius: -2,
                    ),
                  ],
                ),
                child: Center(
                  child: Container(
                    width: widget.size * 0.82,
                    height: widget.size * 0.82,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Theme.of(context).brightness == Brightness.dark
                          ? AppTheme.obsidianBackground
                          : Colors.white,
                    ),
                    child: Center(
                      child: Icon(
                        Icons.bolt_rounded,
                        size: widget.size * 0.5,
                        color: Theme.of(context).brightness == Brightness.dark
                            ? Colors.white
                            : Theme.of(context).colorScheme.primary,
                      ),
                    ),
                  ),
                ),
              ),
            ),
            if (widget.showText) ...[
              const SizedBox(height: 16),
              // Glowing Brand Name "PON"
              ShaderMask(
                shaderCallback: (bounds) {
                  final isDark = Theme.of(context).brightness == Brightness.dark;
                  return LinearGradient(
                    colors: isDark
                        ? const [AppTheme.neonCyan, Colors.white, AppTheme.neonPink]
                        : [Theme.of(context).colorScheme.primary, Theme.of(context).colorScheme.secondary],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ).createShader(bounds);
                },
                child: Text(
                  'PON',
                  style: TextStyle(
                    fontSize: widget.size * 0.45,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    letterSpacing: 4,
                    shadows: Theme.of(context).brightness == Brightness.dark
                        ? [
                            Shadow(
                              color: AppTheme.neonCyan.withValues(alpha: 0.8),
                              blurRadius: _glowAnimation.value / 2,
                            ),
                            Shadow(
                              color: AppTheme.neonPink.withValues(alpha: 0.6),
                              blurRadius: _glowAnimation.value,
                            ),
                          ]
                        : null,
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'CONNECTING MINDS',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: Theme.of(context).brightness == Brightness.dark
                      ? Colors.white.withValues(alpha: 0.4)
                      : Colors.black.withValues(alpha: 0.4),
                  letterSpacing: 2,
                ),
              ),
            ],
          ],
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Frosted Glass Neon Card (Glassmorphism)
// ---------------------------------------------------------------------------
class NeonCard extends StatelessWidget {
  final Widget child;
  final double borderRadius;
  final double blur;
  final double borderOpacity;
  final double bgOpacity;
  final Color glowColor;
  final double glowStrength;

  const NeonCard({
    super.key,
    required this.child,
    this.borderRadius = 24.0,
    this.blur = 15.0,
    this.borderOpacity = 0.25,
    this.bgOpacity = 0.6,
    this.glowColor = AppTheme.neonPurple,
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
class NeonButton extends StatefulWidget {
  final VoidCallback? onPressed;
  final Widget child;
  final List<Color> gradientColors;
  final Color glowColor;
  final bool isLoading;

  const NeonButton({
    super.key,
    required this.onPressed,
    required this.child,
    this.gradientColors = const [AppTheme.neonCyan, AppTheme.neonPink],
    this.glowColor = AppTheme.neonCyan,
    this.isLoading = false,
  });

  @override
  State<NeonButton> createState() => _NeonButtonState();
}

class _NeonButtonState extends State<NeonButton> {
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
class NeonTextField extends StatefulWidget {
  final TextEditingController controller;
  final String labelText;
  final IconData prefixIcon;
  final Widget? suffixIcon;
  final bool obscureText;
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

  const NeonTextField({
    super.key,
    required this.controller,
    required this.labelText,
    required this.prefixIcon,
    this.suffixIcon,
    this.obscureText = false,
    this.keyboardType = TextInputType.text,
    this.textInputAction = TextInputAction.next,
    this.onFieldSubmitted,
    this.validator,
    this.focusNode,
    this.focusColor = AppTheme.neonCyan,
    this.maxLength,
    this.counterText,
    this.style,
    this.inputFormatters,
    this.onChanged,
  });

  @override
  State<NeonTextField> createState() => _NeonTextFieldState();
}

class _NeonTextFieldState extends State<NeonTextField> {
  late FocusNode _internalFocusNode;
  bool _isFocused = false;

  @override
  void initState() {
    super.initState();
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
        obscureText: widget.obscureText,
        keyboardType: widget.keyboardType,
        textInputAction: widget.textInputAction,
        onFieldSubmitted: widget.onFieldSubmitted,
        validator: widget.validator,
        maxLength: widget.maxLength,
        style: widget.style,
        onChanged: widget.onChanged,
        inputFormatters: widget.inputFormatters != null
            ? List<TextInputFormatter>.from(widget.inputFormatters!)
            : null,
        decoration: InputDecoration(
          labelText: widget.labelText,
          prefixIcon: Icon(widget.prefixIcon),
          suffixIcon: widget.suffixIcon,
          counterText: widget.counterText,
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Bouncing Dots for Typing Indicator
// ---------------------------------------------------------------------------
class BouncingDots extends StatefulWidget {
  final Color color;
  final double size;
  const BouncingDots({
    super.key,
    this.color = AppTheme.neonCyan,
    this.size = 6.0,
  });

  @override
  State<BouncingDots> createState() => _BouncingDotsState();
}

class _BouncingDotsState extends State<BouncingDots>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(3, (index) {
        return AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            final double offset = index * 0.25;
            double animValue = _controller.value - offset;
            if (animValue < 0) animValue += 1.0;
            
            // Map values to standard bounce
            double translateY = 0.0;
            if (animValue < 0.5) {
              translateY = -6 * (animValue * 2); // Going up
            } else {
              translateY = -6 * ((1.0 - animValue) * 2); // Going down
            }

            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2.0),
              child: Transform.translate(
                offset: Offset(0, translateY),
                child: Container(
                  width: widget.size,
                  height: widget.size,
                  decoration: BoxDecoration(
                    color: widget.color.withValues(alpha: 0.8),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: widget.color.withValues(alpha: 0.4),
                        blurRadius: 4,
                        spreadRadius: 0.5,
                      )
                    ],
                  ),
                ),
              ),
            );
          },
        );
      }),
    );
  }
}
