// "PON AI is answering…" bookkeeping for the in-meeting chat — pure, no
// timers. Mirror of web `lib/meetings/pending-ai.ts`.
//
// A list of [PendingAi] per room, oldest first:
//  - `meet.ai thinking`        → add (requesterId, now)
//  - `meet.chat` from AI bot   → remove the oldest
//  - `meet.ai error`           → remove the oldest of that requester, else
//                                the oldest
//  - every entry expires 60 s after it started
// The indicator shows while the list is non-empty. Times are epoch ms.

const kAiPendingTtl = Duration(seconds: 60);

class PendingAi {
  const PendingAi({required this.requesterId, required this.startedAt});

  final String requesterId;
  final int startedAt;

  @override
  bool operator ==(Object other) =>
      other is PendingAi &&
      other.requesterId == requesterId &&
      other.startedAt == startedAt;

  @override
  int get hashCode => Object.hash(requesterId, startedAt);

  @override
  String toString() => 'PendingAi($requesterId, $startedAt)';
}

/// Which translated line the requester sees on error.
enum AiErrorKind { unavailable, failed }

/// A non-persisted error line in the chat (only the requester gets one).
class AiNotice {
  const AiNotice({required this.id, required this.kind});

  final int id;
  final AiErrorKind kind;
}

List<PendingAi> addPendingAi(
        List<PendingAi> list, String requesterId, int now) =>
    [...list, PendingAi(requesterId: requesterId, startedAt: now)];

List<PendingAi> resolvePendingAi(List<PendingAi> list) =>
    list.isEmpty ? list : list.sublist(1);

List<PendingAi> failPendingAi(List<PendingAi> list, String requesterId) {
  if (list.isEmpty) return list;
  final own = list.indexWhere((p) => p.requesterId == requesterId);
  final at = own >= 0 ? own : 0;
  return [
    for (var i = 0; i < list.length; i++)
      if (i != at) list[i]
  ];
}

List<PendingAi> expirePendingAi(List<PendingAi> list, int now) => list
    .where((p) => now - p.startedAt < kAiPendingTtl.inMilliseconds)
    .toList();

/// Never the raw code: AI_UNAVAILABLE → unavailable; anything else → failed.
AiErrorKind aiErrorKind(String? code) =>
    code == 'AI_UNAVAILABLE' ? AiErrorKind.unavailable : AiErrorKind.failed;
