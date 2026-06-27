import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_theme.dart';

/// 6-box OTP input widget. Uses an invisible [TextField] overlay on top of 6
/// styled digit boxes so that paste / backspace work seamlessly.
class Otp6BoxInput extends StatefulWidget {
  final TextEditingController controller;
  final ValueChanged<String>? onCompleted;
  final Color accentColor;

  const Otp6BoxInput({
    super.key,
    required this.controller,
    this.onCompleted,
    this.accentColor = AppTheme.ponCyan,
  });

  @override
  State<Otp6BoxInput> createState() => _Otp6BoxInputState();
}

class _Otp6BoxInputState extends State<Otp6BoxInput> {
  final FocusNode _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onChanged);
    _focusNode.addListener(_onFocusChange);
  }

  void _onChanged() {
    if (mounted) setState(() {});
    if (widget.controller.text.length == 6) {
      widget.onCompleted?.call(widget.controller.text);
    }
  }

  void _onFocusChange() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onChanged);
    _focusNode.removeListener(_onFocusChange);
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final text = widget.controller.text;
    final isFocused = _focusNode.hasFocus;

    // Compute a responsive box width so the 6 boxes + gaps always fit the
    // available width — fixed 44px boxes overflow on narrow screens (e.g. the
    // 320px-wide iPhone SE). The height stays fixed for a consistent look.
    return LayoutBuilder(
      builder: (context, constraints) {
        const int count = 6;
        const double gap = 8.0;
        const double maxBoxWidth = 48.0;
        const double minBoxWidth = 36.0;

        final double available = constraints.maxWidth.isFinite
            ? constraints.maxWidth
            : maxBoxWidth * count + gap * (count - 1);
        // Width left for the boxes after subtracting the inter-box gaps.
        final double usable = available - gap * (count - 1);
        final double boxWidth =
            (usable / count).clamp(minBoxWidth, maxBoxWidth);

        return GestureDetector(
          onTap: () => _focusNode.requestFocus(),
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Visual boxes rendered first (below the transparent overlay)
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(count, (i) {
                  return Padding(
                    padding: EdgeInsets.only(right: i == count - 1 ? 0 : gap),
                    child: _OtpBox(
                      width: boxWidth,
                      char: i < text.length ? text[i] : '',
                      isActive:
                          isFocused && i == text.length && text.length < 6,
                      isFilled: i < text.length,
                      accentColor: widget.accentColor,
                    ),
                  );
                }),
              ),
              // Invisible TextField on top intercepts taps and keyboard input
              Positioned.fill(
                child: Opacity(
                  opacity: 0.0,
                  child: TextField(
                    controller: widget.controller,
                    focusNode: _focusNode,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    decoration: const InputDecoration(counterText: ''),
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    autofocus: false,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _OtpBox extends StatelessWidget {
  final double width;
  final String char;
  final bool isActive;
  final bool isFilled;
  final Color accentColor;

  const _OtpBox({
    required this.width,
    required this.char,
    required this.isActive,
    required this.isFilled,
    required this.accentColor,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final baseColor = isDark ? Colors.white : Colors.black;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      width: width,
      height: 54,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: baseColor.withValues(alpha: isActive ? 0.08 : 0.04),
        border: Border.all(
          color: isActive
              ? accentColor
              : isFilled
                  ? accentColor.withValues(alpha: 0.6)
                  : baseColor.withValues(alpha: isDark ? 0.2 : 0.25),
          width: isActive ? 2.0 : 1.5,
        ),
        boxShadow: isActive
            ? [
                BoxShadow(
                  color: accentColor.withValues(alpha: 0.25),
                  blurRadius: 10,
                  spreadRadius: 1,
                )
              ]
            : null,
      ),
      alignment: Alignment.center,
      child: char.isEmpty
          ? null
          : Text(
              char,
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
    );
  }
}
