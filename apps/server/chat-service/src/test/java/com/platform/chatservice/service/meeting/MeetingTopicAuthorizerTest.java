package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.repository.MeetingRepository;
import com.platform.chatservice.security.UserPrincipal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MeetingTopicAuthorizerTest {

  @Mock private MeetingRepository meetings;
  @Mock private MeetingLobby lobby;
  @InjectMocks private MeetingTopicAuthorizer authorizer;
  private Meeting m;

  @BeforeEach
  void setUp() {
    m =
        Meeting.builder()
            .id("m1")
            .hostId("host")
            .inviteeIds(new ArrayList<>(List.of("inv")))
            .departmentId("dept-a")
            .build();
    when(meetings.findById("m1")).thenReturn(Optional.of(m));
  }

  private boolean can(String userId, List<String> depts) {
    return authorizer.canSubscribe("m1", new UserPrincipal(userId, null, List.of(), depts));
  }

  @Test
  void peopleWhoMayEnterTheRoomMaySubscribe() {
    assertThat(can("host", List.of())).isTrue();
    assertThat(can("inv", List.of())).isTrue();
    assertThat(can("x", List.of("dept-a"))).isTrue();
    when(lobby.isAdmitted("m1", "y")).thenReturn(true);
    assertThat(can("y", List.of())).isTrue();
  }

  @Test
  void waitingRemovedEndedAndUnknownMeetingsMayNot() {
    assertThat(can("stranger", List.of())).isFalse(); // waiting room on
    m.getRemovedIds().add("inv");
    assertThat(can("inv", List.of())).isFalse();
    m.setStatus(MeetingStatus.ENDED);
    assertThat(can("host", List.of())).isFalse();
    assertThat(authorizer.canSubscribe("nope", new UserPrincipal("host"))).isFalse();
  }
}
