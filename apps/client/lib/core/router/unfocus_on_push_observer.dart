import 'package:flutter/widgets.dart';

/// Drops the current focus whenever a new route is pushed.
///
/// A route's focus scope remembers its last focused field and hands focus back
/// to it when the route on top is popped. Opening a chat from the conversation
/// list while its search field was focused therefore brought the keyboard back
/// on leaving the chat, with no text field the user had chosen to type in.
/// Unfocusing on push leaves nothing to restore, so the keyboard only shows
/// while the user is actually in a text field.
class UnfocusOnPushObserver extends NavigatorObserver {
  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    FocusManager.instance.primaryFocus?.unfocus();
  }
}
