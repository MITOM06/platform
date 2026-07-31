import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:go_router/go_router.dart';

import '../theme/motion.dart';

/// Directional page motion for the whole app.
///
/// Going **forward** (push / navigating deeper): the new page slides in from the
/// right, the page underneath parallaxes slightly to the left.
/// Going **back** (pop / returning to a previous step): the leaving page slides
/// out to the right and the page revealed underneath comes back from the left.
///
/// The tricky part is that `go_router`'s `go()` *replaces* the stack instead of
/// pushing/popping: the new page is always stacked on top and the old one is
/// dropped, so Flutter animates "back to the conversation list" exactly like
/// "deeper into a screen". [PageNavDirection] works out which one a given
/// navigation is, and both the arriving page and the one it covers read that
/// same answer so they move together.

// ---------------------------------------------------------------------------
// Direction tracking
// ---------------------------------------------------------------------------

/// Steps of the pre-auth flow. Moving to a *lower* step is a back navigation
/// (e.g. "verify OTP" → "login"). Paths outside this map are handled by the
/// generic rule in [PageNavDirection.resolve].
const Map<String, int> _flowSteps = <String, int>{
  '/login': 0,
  '/theme-onboarding': 0,
  '/register': 1,
  '/forgot-password': 1,
  '/verify-otp': 2,
  '/new-password': 3,
};

/// Holds the direction of the navigation currently in flight.
///
/// Written from two places:
/// * `GoRouter.redirect` — every declarative navigation (`go`, `push`,
///   redirects) resolves its direction there, before the pages are rebuilt.
/// * [NavDirectionObserver] — imperative pushes/pops (back button, back
///   swipe, `context.pop()`, `Navigator.push`) never go through `redirect`,
///   so the observer marks them.
class PageNavDirection {
  PageNavDirection._();

  /// `true` while the navigation in flight is a "back" step.
  static bool isBack = false;

  /// Set by `redirect` so the observer knows the push/pop it is about to see
  /// belongs to a declarative navigation whose direction is already resolved.
  static bool _declarative = false;

  /// Location currently on screen — the reference point for the next
  /// navigation. Kept in sync from `GoRouter.redirect`.
  static String _location = '/login';

  /// Resolves the direction of a declarative navigation to [to].
  static void resolve(String to) {
    if (to == _location) return;
    isBack = _isBackward(_location, to);
    _location = to;
    _markDeclarative();
  }

  static bool _isBackward(String from, String to) {
    final int? fromStep = _flowSteps[from];
    final int? toStep = _flowSteps[to];
    // Inside the auth flow: compare steps.
    if (fromStep != null && toStep != null) return toStep < fromStep;
    // Entering or leaving the auth flow (login → home, logout → login) always
    // reads as a fresh forward step.
    if (fromStep != null || toStep != null) return false;
    // Everything else: only "return to the conversation list" is a back step.
    // Deep links and `push()` targets stay forward — a push is never backwards.
    return to == '/' && from != '/';
  }

  static void _markDeclarative() {
    _declarative = true;
    // Cleared once the frame that applies the new page list is done, so the
    // next imperative push/pop is detected as such.
    SchedulerBinding.instance.addPostFrameCallback((_) => _declarative = false);
  }

  /// An imperative push (`Navigator.push`, dialogs) — forward, unless the
  /// direction was already resolved for this navigation.
  static void markImperativePush() {
    if (!_declarative) isBack = false;
  }

  /// An imperative pop (back button, back swipe, `context.pop()`) — back,
  /// unless the direction was already resolved for this navigation.
  static void markImperativePop() {
    if (!_declarative) isBack = true;
  }
}

/// Feeds imperative pushes/pops into [PageNavDirection].
class NavDirectionObserver extends NavigatorObserver {
  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) =>
      PageNavDirection.markImperativePush();

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) =>
      PageNavDirection.markImperativePop();

  @override
  void didRemove(Route<dynamic> route, Route<dynamic>? previousRoute) =>
      PageNavDirection.markImperativePop();
}

// ---------------------------------------------------------------------------
// Transition
// ---------------------------------------------------------------------------

/// Forward push duration.
const Duration kPageTransitionDuration = Duration(milliseconds: 280);

/// Pop duration — a touch quicker, backwards motion should feel immediate.
const Duration kPageTransitionReverseDuration = Duration(milliseconds: 240);

/// How far the page underneath drifts while it is being covered.
const double _kParallax = 0.25;

/// Horizontal slide used by every route of the app.
class PonPageTransition extends StatefulWidget {
  const PonPageTransition({
    super.key,
    required this.animation,
    required this.secondaryAnimation,
    required this.child,
  });

  final Animation<double> animation;
  final Animation<double> secondaryAnimation;
  final Widget child;

  @override
  State<PonPageTransition> createState() => _PonPageTransitionState();
}

class _PonPageTransitionState extends State<PonPageTransition> {
  // Held in state rather than rebuilt every tick: a CurvedAnimation attaches a
  // status listener to its parent, and the route rebuilds its transition on
  // every frame of the animation.
  late CurvedAnimation _enter;
  late CurvedAnimation _cover;

  @override
  void initState() {
    super.initState();
    _enter = _curve(widget.animation);
    _cover = _curve(widget.secondaryAnimation);
  }

  @override
  void didUpdateWidget(PonPageTransition oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.animation != oldWidget.animation) {
      _enter.dispose();
      _enter = _curve(widget.animation);
    }
    if (widget.secondaryAnimation != oldWidget.secondaryAnimation) {
      _cover.dispose();
      _cover = _curve(widget.secondaryAnimation);
    }
  }

  @override
  void dispose() {
    _enter.dispose();
    _cover.dispose();
    super.dispose();
  }

  CurvedAnimation _curve(Animation<double> parent) => CurvedAnimation(
        parent: parent,
        curve: AppMotion.settle,
        reverseCurve: Curves.easeInCubic,
      );

  @override
  Widget build(BuildContext context) {
    final Animation<double> animation = widget.animation;
    final Animation<double> secondaryAnimation = widget.secondaryAnimation;
    final Widget child = widget.child;

    if (AppMotion.reduced(context)) return child;

    // Direction of the navigation in flight: forward → the page arrives from
    // the right, back → from the left. A `go()` replacement arrives the same
    // way a push does (the new page is stacked on top, the old one is dropped
    // once it is covered), so this single sign drives both.
    final double sign = PageNavDirection.isBack ? -1.0 : 1.0;

    // A page whose own animation is running backwards is being popped, and a
    // pop always leaves towards the right — regardless of how the page arrived.
    final bool leaving = animation.status == AnimationStatus.reverse;
    final double dx = leaving ? 1.0 : sign;

    // The page underneath drifts *against* the page covering it, so both move
    // as one: left while a page slides in from the right, right while a page
    // slides in from the left. On a pop the covering page is on its way out, so
    // the drift simply unwinds the way it came.
    final bool coveredFromTheLeft = PageNavDirection.isBack &&
        secondaryAnimation.status == AnimationStatus.forward;
    final double coverDx = coveredFromTheLeft ? _kParallax : -_kParallax;

    return SlideTransition(
      position: Tween<Offset>(
        begin: Offset(dx, 0),
        end: Offset.zero,
      ).animate(_enter),
      child: SlideTransition(
        position: Tween<Offset>(
          begin: Offset.zero,
          end: Offset(coverDx, 0),
        ).animate(_cover),
        child: child,
      ),
    );
  }
}

/// Wraps [child] in a page that uses the shared directional slide.
///
/// Every route in `app_router.dart` goes through this so navigation reads the
/// same way everywhere.
CustomTransitionPage<void> slidePage(GoRouterState state, Widget child) {
  return CustomTransitionPage<void>(
    key: state.pageKey,
    name: state.name ?? state.uri.path,
    child: child,
    transitionDuration: kPageTransitionDuration,
    reverseTransitionDuration: kPageTransitionReverseDuration,
    transitionsBuilder: (context, animation, secondaryAnimation, child) =>
        PonPageTransition(
      animation: animation,
      secondaryAnimation: secondaryAnimation,
      child: child,
    ),
  );
}

/// Same motion for the few pages pushed outside `go_router` with a
/// `MaterialPageRoute`. Wired into `ThemeData.pageTransitionsTheme` so those
/// move with the rest of the app instead of falling back to Material's
/// platform-dependent zoom/fade. (Dialogs and bottom sheets are unaffected —
/// they build their own transitions.)
class PonPageTransitionsBuilder extends PageTransitionsBuilder {
  const PonPageTransitionsBuilder();

  @override
  Duration get transitionDuration => kPageTransitionDuration;

  @override
  Duration get reverseTransitionDuration => kPageTransitionReverseDuration;

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    return PonPageTransition(
      animation: animation,
      secondaryAnimation: secondaryAnimation,
      child: child,
    );
  }
}
