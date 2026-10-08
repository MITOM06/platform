import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/services/push_routes.dart';

void main() {
  test('meeting pushes open the room by code, else the meeting page', () {
    expect(pushRouteFor({'type': 'MEETING_INVITED', 'meetingId': 'm1', 'code': 'abc-defg-hjk'}), '/meet/abc-defg-hjk');
    expect(pushRouteFor({'type': 'MEETING_STARTING', 'meetingId': 'm1', 'code': ''}), '/meetings/m1');
    expect(pushRouteFor({'type': 'MEETING_STARTING', 'code': 'javascript:alert(1)'}), isNull);
    expect(isMeetingPush({'type': 'MEETING_INVITED'}), isTrue);
  });

  test('message pushes keep opening the conversation', () {
    expect(pushRouteFor({'conversationId': 'c1'}), '/chat/c1');
    expect(isMeetingPush({'conversationId': 'c1'}), isFalse);
    expect(pushRouteFor({}), isNull);
  });
}
