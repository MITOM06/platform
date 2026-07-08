import 'dart:async';
import 'package:collection/collection.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart' show ScaffoldMessenger, SnackBar, Text;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/router/app_router.dart';
import '../../../core/services/notification_service.dart';
import '../../../core/utils/global_messenger.dart';
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

  String bodyText;
  if (isMention) {
    bodyText = l10n.mentionNotificationBody(name);
  } else {
    if (messageType == 'image') {
      bodyText = '$name: [${l10n.attachPhoto}]';
    } else if (messageType == 'video') {
      bodyText = '$name: [${l10n.attachVideo}]';
    } else if (messageType == 'file') {
      bodyText = '$name: [${l10n.attachFile}]';
    } else if (content != null && content.isNotEmpty) {
      bodyText = '$name: $content';
    } else {
      bodyText = l10n.newNotificationBody(name);
    }
  }

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
