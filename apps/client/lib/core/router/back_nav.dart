import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

/// Back from a page that may be the only one on the stack (opened by
/// `context.go`, a deep link or a push notification): pop when there is a
/// page to return to, otherwise go to [fallback] so the user is never stuck.
void popOrGo(BuildContext context, String fallback) {
  if (context.canPop()) {
    context.pop();
  } else {
    context.go(fallback);
  }
}
