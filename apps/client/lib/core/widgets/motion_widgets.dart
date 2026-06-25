import 'package:flutter/material.dart';
import '../theme/motion.dart';

/// Fade + slide-up entrance for a single element, played once on first mount.
///
/// Used to orchestrate auth-screen reveals: give each sibling an increasing
/// [index] and they enter with [AppMotion.staggerStep] spacing (capped at
/// [AppMotion.staggerCap]). Respects reduced-motion — renders the final frame
/// instantly when animations are disabled.
class StaggeredEntrance extends StatefulWidget {
  final Widget child;
  final int index;
  final double offset;

  const StaggeredEntrance({
    super.key,
    required this.child,
    this.index = 0,
    this.offset = 12,
  });

  @override
  State<StaggeredEntrance> createState() => _StaggeredEntranceState();
}

class _StaggeredEntranceState extends State<StaggeredEntrance>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller =
      AnimationController(vsync: this, duration: AppMotion.base);
  late final Animation<double> _curved =
      CurvedAnimation(parent: _controller, curve: AppMotion.settle);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (AppMotion.reduced(context)) {
        _controller.value = 1.0;
        return;
      }
      final steps = widget.index.clamp(0, AppMotion.staggerCap);
      Future<void>.delayed(AppMotion.staggerStep * steps, () {
        if (mounted) _controller.forward();
      });
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _curved,
      builder: (context, child) => Opacity(
        opacity: _curved.value,
        child: Transform.translate(
          offset: Offset(0, widget.offset * (1 - _curved.value)),
          child: child,
        ),
      ),
      child: widget.child,
    );
  }
}

/// Wraps any surface with the shared 0.96 press-scale feedback used by
/// [PonButton]. Uses a [Listener] for the visual press so it does NOT compete
/// in the gesture arena — the child's own tap/ink handling (ListTile, InkWell)
/// keeps working untouched. Reduced-motion → no scale.
class PressScale extends StatefulWidget {
  final Widget child;
  final double scale;

  const PressScale({
    super.key,
    required this.child,
    this.scale = 0.96,
  });

  @override
  State<PressScale> createState() => _PressScaleState();
}

class _PressScaleState extends State<PressScale> {
  bool _pressed = false;

  void _set(bool v) {
    if (_pressed != v) setState(() => _pressed = v);
  }

  @override
  Widget build(BuildContext context) {
    final reduced = AppMotion.reduced(context);
    return Listener(
      onPointerDown: (_) => _set(true),
      onPointerUp: (_) => _set(false),
      onPointerCancel: (_) => _set(false),
      child: AnimatedScale(
        scale: (_pressed && !reduced) ? widget.scale : 1.0,
        duration: AppMotion.instant,
        child: widget.child,
      ),
    );
  }
}
