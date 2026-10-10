import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart'
    show BuildContext, ScaffoldMessenger, SnackBar, Text;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/router/app_router.dart';
import '../../../core/services/notification_service.dart';
import '../../../core/utils/global_messenger.dart';
import '../ui/widgets/message_preview_text.dart';
import 'call_rules.dart';
import '../../../core/api/token_manager.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/session_reset.dart';
import '../../home/domain/home_providers.dart';
import '../data/stomp_service.dart';
import 'chat_misc_providers.dart';
import 'chat_provider.dart' show chatNotifierProvider;
import 'chat_state.dart';
import 'group_call_controller.dart';
import 'incoming_call.dart';
import 'sfu_call_service.dart';
import 'webrtc_service.dart';

/// Handles a raw 1-on-1 WebRTC [signal]. Group-call signals (call-ring + mesh
/// offer/answer/ice carrying a callId) are handled elsewhere and ignored here.
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
    final webrtc = ref.read(webRtcServiceProvider);

    // The callee has us blocked — notify the caller and bail.
    if (type == 'call-blocked') {
      final context = ref
          .read(appRouterProvider)
          .routerDelegate
          .navigatorKey
          .currentContext;
      if (context != null && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.callBlocked)),
        );
      }
      // Mirror web: close the call screen. dispose() fires onCallEnded →
      // Navigator.pop() in CallScreen. Safe to call even when no active
      // call exists — WebRTCService.dispose() is idempotent.
      webrtc.dispose();
      ref.read(sfuCallServiceProvider).handleSignal(signal);
      return;
    }

    if (type == 'offer') {
      final senderId = signal['senderId'] as String?;
      final convId = signal['conversationId'] as String?;
      final sdp = signal['sdp'] as String?;
      if (senderId == null || convId == null || sdp == null) return;

      if (webrtc.isInCallWith(senderId, convId)) {
        // The caller renegotiates mid-call: an ICE restart, or a camera on.
        unawaited(webrtc.answerRenegotiation(sdp));
        return;
      }
      switch (decideIncomingOffer(
        from: senderId,
        ringingFrom: ref.read(incomingCallProvider)?.senderId,
        inCallWith: webrtc.peerId,
        // A LiveKit 1-on-1 in progress counts as busy too.
        inGroupCall: ref.read(groupCallControllerProvider).isActive ||
            ref.read(sfuCallServiceProvider).isActive,
        // Both tapped Call: our offer crossed theirs. `targetId` is us, as
        // the caller addressed it.
        callingTo: webrtc.isCallingTo(senderId, convId) ? senderId : null,
        selfId: signal['targetId'] as String?,
      )) {
        case IncomingOfferAction.answerCrossed:
          unawaited(webrtc.answerCrossed(
              from: senderId, conversationId: convId, sdp: sdp));
          return;
        case IncomingOfferAction.ignore:
          return; // the same caller re-sent its offer
        case IncomingOfferAction.replyBusy:
          webrtc.sendEnd(
            targetId: senderId,
            conversationId: convId,
            reason: CallEndReason.busy,
          );
          return;
        case IncomingOfferAction.ring:
          // Show the accept/decline prompt (IncomingCallPrompt) and keep the
          // caller's early ICE candidates until the call is answered.
          webrtc.expectCallFrom(senderId);
          ref.read(incomingCallProvider.notifier).set(IncomingCall(
                senderId: senderId,
                conversationId: convId,
                sdp: sdp,
                isVideo: WebRTCService.sdpHasVideo(sdp),
              ));
      }
    } else {
      // answer / ice / end go to WebRTCService.
      if (type == 'answer') {
        final sdp = signal['sdp'] as String?;
        if (sdp == null) return;
        webrtc.handleAnswer(sdp);
      } else if (type == 'ice') {
        final candidate = signal['candidate'] as Map?;
        if (candidate == null) return;
        webrtc.handleIceCandidate(
          Map<String, dynamic>.from(candidate),
          senderId: signal['senderId'] as String?,
        );
      } else if (type == 'state') {
        webrtc.handleState(signal);
      } else if (type == 'answered-elsewhere') {
        // We answered this caller on our other device (web + phone).
        ref.read(incomingCallProvider.notifier).clearAnsweredElsewhere(
              signal['senderId'] as String?,
              signal['conversationId'] as String?,
            );
      } else if (type == 'end') {
        // Peer hung up: tear down locally only. Do NOT re-publish /app/call.end
        // or send a system call-log message — the hang-up initiator already
        // did both, otherwise we'd ping-pong and log the call twice.
        // A caller hanging up (or ringing out) before we answered also
        // dismisses the incoming prompt. An `end` from anyone but the current
        // peer is ignored by handleRemoteEnd.
        final from = signal['senderId'] as String?;
        ref.read(incomingCallProvider.notifier).clearFrom(from);
        webrtc.handleRemoteEnd(
          from: from,
          reasonWire: signal['reason'] as String?,
        );
      }
    }
  } catch (e) {
    debugPrint('Malformed WebRTC signal ignored: $e');
    return;
  }
}

/// [senderName] from a notification payload, or null when it is unusable for
/// display: empty, the literal `system`, or a raw id (chat-service sends the
/// id itself when the name can't be resolved).
String? displayableSenderName(String? senderName, String? senderId) {
  final name = senderName?.trim() ?? '';
  if (name.isEmpty || name == 'system') return null;
  if (senderId != null && name == senderId) return null;
  if (looksLikeRawId(name)) return null;
  return name;
}

/// A Mongo ObjectId, a bot id (`extbot:…`, `ai-bot-…`) — never display text.
bool looksLikeRawId(String value) =>
    RegExp(r'^[0-9a-fA-F]{24}$').hasMatch(value) ||
    value.startsWith('extbot:') ||
    value.startsWith('ai-bot-');

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
///
/// Assistants (the built-in AI and `extbot:*` personal assistants) have no user
/// profile to look up, so their name comes from [senderName], which chat-service
/// resolves from the persona / bot registry before sending.
Future<void> showIncomingMessageBanner(
  Ref ref, {
  required String convId,
  required String senderId,
  required bool isMention,
  String? senderName,
  String? content,
  String? messageType,
}) async {
  final isAssistant =
      senderId == kAiBotUserId || senderId.startsWith('extbot:');
  // chat-service falls back to the raw id when it can't resolve a name —
  // that must never be displayed.
  final safeSenderName = displayableSenderName(senderName, senderId);
  String resolvedName = '';
  if (isAssistant) {
    resolvedName = safeSenderName ?? '';
  } else if (senderId.isNotEmpty && senderId != 'system') {
    try {
      final profile = await ref.read(userProfileProvider(senderId).future);
      resolvedName = profile.displayName;
    } catch (_) {
      resolvedName = safeSenderName ?? '';
    }
  }

  final context =
      ref.read(appRouterProvider).routerDelegate.navigatorKey.currentContext;
  if (context == null || !context.mounted) return;
  final l10n = context.l10n;
  final name =
      resolvedName.isNotEmpty ? resolvedName : l10n.conversationDefault;

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

/// The user was removed from (or left) [conversationId]: close it wherever it
/// is open (mobile route or the wide-layout detail pane) and say why.
void leaveRemovedConversation(Ref ref, String conversationId) {
  ref.invalidate(archivedConversationsProvider);
  ref.invalidate(chatNotifierProvider(conversationId));
  if (ref.read(selectedConversationIdProvider) == conversationId) {
    ref.read(selectedConversationIdProvider.notifier).state = null;
  }
  final router = ref.read(appRouterProvider);
  final path = router.routeInformationProvider.value.uri.path;
  final openHere = path.endsWith('/$conversationId') ||
      path.contains('/$conversationId/');
  if (!openHere) return;
  router.go('/');
  final context = router.routerDelegate.navigatorKey.currentContext;
  if (context != null) showErrorSnackBar(context.l10n.removedFromConversation);
}

/// `CLAIMS_CHANGED`: the user's role / departments / permission matrix
/// changed. Mint a token with the fresh claims, refetch everything gated by
/// them and move the socket onto the new token — no re-login, no toast.
Future<void> refreshClaims(Ref ref) async {
  try {
    try {
      await TokenManager.shared.forceRefresh();
    } on RefreshRejectedException {
      // The session itself is gone — the one case that signs out.
      ref.read(authNotifierProvider.notifier).forceLogout();
      return;
    }
    invalidateClaimsDependentState(ref);
    await ref.read(stompServiceProvider.notifier).reconnect();
  } catch (_) {
    // Transient: the next 401 TOKEN_CLAIMS_STALE refreshes anyway.
  }
}
