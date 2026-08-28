import 'dart:async';
import 'package:collection/collection.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart'
    show BuildContext, ScaffoldMessenger, SnackBar, Text;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/router/app_router.dart';
import '../../../core/services/notification_service.dart';
import '../../../core/utils/global_messenger.dart';
import '../ui/widgets/message_preview_text.dart';
import 'chat_misc_providers.dart';
import 'chat_state.dart';
import 'webrtc_service.dart';

/// Handles a raw 1-on-1 WebRTC [signal]. Group-call signals (call-ring + mesh
/// offer/answer/ice carrying a callId) are handled elsewhere and ignored here.
/// [conversations] is the current conversation list (for caller-name lookup).
void handleWebRtcSignal(
  Ref ref,
  Map<String, dynamic> signal,
  List<ConversationModel>? conversations,
) {
  try {
    final type = signal['type'] as String?;
    // Group-call signals (call-ring + mesh offer/answer/ice carrying a
    // callId) are handled by GroupCallSignaling. Ignore them here so the
    // legacy 1-on-1 flow stays untouched.
    if (type == 'call-ring' || signal['callId'] != null) return;

    // The callee has us blocked — notify the caller and bail.
    if (type == 'call-blocked') {
      final context =
          ref.read(appRouterProvider).routerDelegate.navigatorKey.currentContext;
      if (context != null && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.callBlocked)),
        );
      }
      // Mirror web: close the call screen. dispose() fires onCallEnded →
      // Navigator.pop() in CallScreen. Safe to call even when no active
      // call exists — WebRTCService.dispose() is idempotent.
      ref.read(webRtcServiceProvider).dispose();
      return;
    }

    if (type == 'offer') {
      final senderId = signal['senderId'] as String?;
      final convId = signal['conversationId'] as String?;
      final sdp = signal['sdp'] as String?;
      if (senderId == null || convId == null || sdp == null) return;

      // Show incoming call dialog
      final router = ref.read(appRouterProvider);
      final context = router.routerDelegate.navigatorKey.currentContext;
      if (context == null) return;
      final l10n = context.l10n;

      // Resolve caller display name from local conversation state if available.
      String callerName = l10n.callUnknownCaller;
      final conv = conversations?.firstWhereOrNull((c) => c.id == convId);
      if (conv?.name != null) {
        callerName = conv!.name!;
      }

      showInAppNotification(
        l10n.callIncoming,
        l10n.callIncomingBody(callerName),
        onTap: () {
          router.push('/call', extra: {
            'targetId': senderId, // we reply back to sender
            'targetName': callerName,
            'conversationId': convId,
            'isCaller': false,
            'initialOfferSdp': sdp,
          });
        },
      );
    } else {
      // For answer, ice, end, we need to pass them to WebRTCService if it's active.
      final webrtc = ref.read(webRtcServiceProvider);
      if (type == 'answer') {
        final sdp = signal['sdp'] as String?;
        if (sdp == null) return;
        webrtc.handleAnswer(sdp);
      } else if (type == 'ice') {
        final candidate = signal['candidate'] as Map?;
        if (candidate == null) return;
        webrtc.handleIceCandidate(Map<String, dynamic>.from(candidate));
      } else if (type == 'end') {
        // Peer hung up: tear down locally only. Do NOT re-publish /app/call.end
        // or send a system call-log message — the hang-up initiator already
        // did both, otherwise we'd ping-pong and log the call twice.
        webrtc.dispose();
      }
    }
  } catch (e) {
    debugPrint('Malformed WebRTC signal ignored: $e');
    return;
  }
}

/// Builds the SANITIZED body line for the in-app banner and the OS notification.
///
/// Kept pure (context + values in, string out) so the no-raw-system-data rule can be
/// regression-tested — the leak this guards was invisible from the widget tree.
///
/// Only image/video/file used to be masked here, so every OTHER non-text type fell through
/// to raw `content`: a voice note or sticker pushed its `/api/uploads/<id>` URL, a group
/// event pushed `system.nickname.changed:<userId>:<value>`, and a meeting summary pushed its
/// JSON — onto the lock screen, where the user cannot even dismiss it by scrolling past
/// (.claude/rules/no-raw-system-data-in-ui.md). Everything now goes through the same
/// sanitizer the reply quotes and the conversation list use. System events carry no
/// meaningful sender, so they drop the `"<name>: "` prefix the way web does.
String notificationBodyText(
  BuildContext context, {
  required String name,
  required bool isMention,
  String? content,
  String? messageType,
}) {
  final l10n = context.l10n;
  if (isMention) return l10n.mentionNotificationBody(name);
  if (messageType == 'image') return '$name: [${l10n.attachPhoto}]';
  if (messageType == 'video') return '$name: [${l10n.attachVideo}]';
  if (messageType == 'file') return '$name: [${l10n.attachFile}]';
  if (content == null || content.isEmpty) return l10n.newNotificationBody(name);

  final preview = messagePreviewFromContent(context, content);
  return content.startsWith('system.') ? preview : '$name: $preview';
}

/// Resolves [senderId] to a display name then shows the top in-app banner and
/// fires the OS/local notification with the same humanized title + body.
Future<void> showIncomingMessageBanner(
  Ref ref, {
  required String convId,
  required String senderId,
  required bool isMention,
  String? content,
  String? messageType,
}) async {
  String senderName = '';
  if (senderId.isNotEmpty) {
    try {
      final profile = await ref.read(userProfileProvider(senderId).future);
      senderName = profile.displayName;
    } catch (_) {}
  }

  final context =
      ref.read(appRouterProvider).routerDelegate.navigatorKey.currentContext;
  if (context == null || !context.mounted) return;
  final l10n = context.l10n;
  final name = senderName.isNotEmpty ? senderName : l10n.conversationDefault;

  final bodyText = notificationBodyText(
    context,
    name: name,
    isMention: isMention,
    content: content,
    messageType: messageType,
  );

  final title =
      isMention ? l10n.mentionNotificationTitle : l10n.newNotificationTitle;

  showInAppNotification(
    title,
    bodyText,
    onTap: () => ref.read(appRouterProvider).push('/chat/$convId'),
  );

  // Also fire an OS/local notification with the SAME humanized title + body.
  // Without this, a foregrounded app with STOMP up showed only the in-app
  // banner and never an OS notification (the FCM foreground handler only
  // fires when STOMP is DOWN). Reuses the already-gated path in
  // _onNotification (notifications enabled + not viewing this conversation),
  // and the already-sanitized bodyText (no raw content for system/attachment
  // types).
  unawaited(showMessageNotification(
    title: title,
    body: bodyText,
    conversationId: convId,
  ));
}
