// Where a tapped push opens — pure, so the routing is unit-testable.
// Meeting pushes carry `data: {type, meetingId, code}` (docs/api-spec.md
// § Meetings › FCM); message pushes carry `conversationId`.

import '../../features/meetings/domain/meeting_code.dart';

const kMeetingPushTypes = {'MEETING_INVITED', 'MEETING_STARTING'};

final _meetingId = RegExp(r'^[A-Za-z0-9]{1,64}$');

bool isMeetingPush(Map<String, dynamic> data) =>
    kMeetingPushTypes.contains(data['type']);

/// MEETING_* ⇒ `/meet/{code}` (valid code) or `/meetings/{meetingId}`;
/// a message ⇒ `/chat/{conversationId}`; anything else ⇒ null. Values off the
/// wire are validated — never an arbitrary location.
String? pushRouteFor(Map<String, dynamic> data) {
  if (isMeetingPush(data)) {
    final code = data['code'];
    if (code is String && meetingCodePattern.hasMatch(code)) {
      return meetingPath(code);
    }
    final id = data['meetingId'];
    if (id is String && _meetingId.hasMatch(id)) return '/meetings/$id';
    return null;
  }
  final conversationId = data['conversationId'];
  if (conversationId is String && conversationId.isNotEmpty) {
    return '/chat/${Uri.encodeComponent(conversationId)}';
  }
  return null;
}
