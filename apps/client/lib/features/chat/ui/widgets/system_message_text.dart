import '../../../../l10n/app_localizations.dart';
import '../../utils/duration_text.dart';

/// Maps a user id to the name shown in a system sentence ("You", a nickname,
/// the display name, or a generic label — never the raw id).
typedef SystemNameResolver = String Function(String userId);

/// Sender id chat-service uses for messages it writes itself (group created,
/// member left, timer changed, …). Those carry no actor, so their sentence
/// must not start with a name — it used to render "... created the group".
const kSystemSenderId = 'system';

bool isSystemSender(String senderId) =>
    senderId.isEmpty || senderId == kSystemSenderId;

/// Localized sentence for the `system.*` code [content] sent by [senderId].
///
/// Shared by the in-chat system bubble (full names via [resolveName]) and
/// every preview surface (conversation list, reply quote, pinned bar,
/// notifications) so they can never disagree or leak a raw code / user id
/// (`.claude/rules/no-raw-system-data-in-ui.md`). Returns null for a code this
/// client does not know — the caller decides how to label it.
String? systemMessageText(
  AppLocalizations l10n,
  String content, {
  required String senderId,
  required SystemNameResolver resolveName,
}) {
  if (!content.startsWith('system.')) return null;
  final hasActor = !isSystemSender(senderId);
  String actor() => resolveName(senderId);
  final parts = content.split(':');
  String arg(int i) => parts.length > i ? parts[i] : '';

  if (content.startsWith('system.nickname.changed:')) {
    final targetId = arg(1);
    final nickname = parts.length > 2 ? parts.sublist(2).join(':') : '';
    final actorName = actor();
    final targetName = resolveName(targetId);
    if (nickname.isEmpty) {
      return targetId == senderId
          ? l10n.sysNicknameClearedSelf(actorName)
          : l10n.sysNicknameClearedOther(actorName, targetName);
    }
    return targetId == senderId
        ? l10n.sysNicknameSetSelf(actorName, nickname)
        : l10n.sysNicknameSetOther(actorName, targetName, nickname);
  }
  if (content.startsWith('system.theme.changed:')) {
    return hasActor ? l10n.sysThemeChanged(actor()) : l10n.systemThemeChanged;
  }
  if (content.startsWith('system.quick_reaction.changed:')) {
    final emoji = arg(1).isEmpty ? '👍' : arg(1);
    return hasActor
        ? l10n.sysQuickReactionChanged(actor(), emoji)
        : l10n.systemQuickReactionChanged;
  }
  if (content.startsWith('system.message.pinned:') ||
      content.startsWith('system.message.unpinned:')) {
    // The actor id rides in the content (the sender is "system").
    final pinActor = arg(1);
    final name = pinActor.isEmpty ? l10n.someone : resolveName(pinActor);
    return content.startsWith('system.message.pinned:')
        ? l10n.sysPinnedMessage(name)
        : l10n.sysUnpinnedMessage(name);
  }
  if (content.startsWith('system.autodelete.changed:')) {
    final seconds = int.tryParse(arg(1)) ?? 0;
    if (seconds <= 0) {
      return hasActor
          ? l10n.sysAutoDeleteOffBy(actor())
          : l10n.sysAutoDeleteOff;
    }
    final duration = durationText(l10n, seconds);
    return hasActor
        ? l10n.sysAutoDeleteOnBy(actor(), duration)
        : l10n.sysAutoDeleteOn(duration);
  }
  if (content.startsWith('system.admin.promoted:') ||
      content.startsWith('system.admin.demoted:')) {
    final targetName = resolveName(arg(1));
    final promoted = content.startsWith('system.admin.promoted:');
    if (!hasActor) {
      return promoted
          ? l10n.sysAdminPromoted(targetName)
          : l10n.sysAdminDemoted(targetName);
    }
    return promoted
        ? l10n.sysAdminPromotedBy(actor(), targetName)
        : l10n.sysAdminDemotedBy(actor(), targetName);
  }
  if (content.startsWith('system.call.ended:')) {
    final secs = int.tryParse(arg(2)) ?? 0;
    final mm = (secs ~/ 60).toString().padLeft(2, '0');
    final ss = (secs % 60).toString().padLeft(2, '0');
    return arg(1) == 'video'
        ? l10n.systemVideoCallEnded('$mm:$ss')
        : l10n.systemVoiceCallEnded('$mm:$ss');
  }
  if (content.startsWith('system.call.missed:')) {
    return arg(1) == 'video'
        ? l10n.systemVideoCallMissed
        : l10n.systemVoiceCallMissed;
  }
  switch (content) {
    case 'system.group.created':
      return hasActor
          ? l10n.sysGroupCreated(actor())
          : l10n.sysGroupCreatedNoActor;
    case 'system.members.added':
      return hasActor
          ? l10n.sysMembersAdded(actor())
          : l10n.sysMembersAddedNoActor;
    case 'system.member.left':
      return hasActor ? l10n.sysMemberLeft(actor()) : l10n.sysMemberLeftNoActor;
    case 'system.member.removed':
      return hasActor
          ? l10n.sysMemberRemoved(actor())
          : l10n.sysMemberRemovedNoActor;
    case 'system.member.joined':
      return hasActor
          ? l10n.sysMemberJoined(actor())
          : l10n.sysMemberJoinedNoActor;
  }
  return null;
}

/// Short preview of a system message for surfaces with no participant
/// context (conversation list, reply quote, push body): names are generic,
/// nickname changes collapse to one line, unknown codes get a generic label.
String systemPreviewText(
  AppLocalizations l10n,
  String content, {
  String senderId = kSystemSenderId,
}) {
  if (content.startsWith('system.nickname.changed:')) {
    return l10n.systemNicknameChanged;
  }
  return systemMessageText(
        l10n,
        content,
        senderId: senderId,
        resolveName: (_) => l10n.someone,
      ) ??
      l10n.pinnedSystemMessage;
}
