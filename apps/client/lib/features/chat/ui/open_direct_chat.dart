import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/l10n/l10n_ext.dart';
import '../../../core/utils/global_messenger.dart';
import '../../home/domain/home_providers.dart';
import '../data/chat_repository.dart';
import '../domain/chat_provider.dart';
import '../utils/chat_error.dart';

/// Opens the 1-1 chat with [userId], creating it when needed (an existing DM
/// comes back as 409 + `conversationId`, which the repository follows).
///
/// Everything that is used after the network call is captured BEFORE it, so
/// this works when called from a dialog or sheet that is popped first — the
/// profile dialog's "Message" button used to pop itself and then check its own
/// (now unmounted) context, so the chat never opened.
Future<void> openDirectChat(
  BuildContext context,
  WidgetRef ref,
  String userId,
) async {
  final router = GoRouter.of(context);
  final wide = MediaQuery.of(context).size.width >= kWebBreakpoint;
  final l10n = context.l10n;
  final repo = ref.read(chatRepositoryProvider);
  final conversations = ref.read(conversationsNotifierProvider.notifier);
  final selected = ref.read(selectedConversationIdProvider.notifier);
  try {
    final conv = await repo.getOrCreateConversation(userId);
    unawaited(conversations.ensureLoaded(conv.id));
    if (wide) {
      // Master-detail layout: the chat is the right pane of home.
      selected.state = conv.id;
      router.go('/');
    } else {
      router.push('/chat/${conv.id}');
    }
  } catch (e) {
    showErrorSnackBar(chatErrorMessage(l10n, e));
  }
}
