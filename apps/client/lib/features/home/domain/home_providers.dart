import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Width (logical px) at and above which the home screen switches from a single
/// stacked view (mobile) to a master-detail split view (web/tablet).
const double kWebBreakpoint = 800;

/// The conversation currently shown in the right (detail) pane on the web /
/// tablet master-detail layout. `null` = no conversation selected yet.
///
/// On mobile this is unused — navigation happens via `context.push('/chat/:id')`.
final selectedConversationIdProvider = StateProvider<String?>((ref) => null);

/// Whether the chat info sidebar is visible in the wide-screen layout.
final showChatInfoSidebarProvider = StateProvider<bool>((ref) => false);

/// Incremented by the info sidebar's Search button to trigger the search
/// overlay in the adjacent ChatScreen without requiring a direct callback.
final chatSearchActiveProvider = StateProvider<int>((ref) => 0);
