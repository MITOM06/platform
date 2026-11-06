package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;

import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.service.AiConstants;
import java.util.Map;
import org.junit.jupiter.api.Test;

class MeetingMapperTest {

  @Test
  void theAiBotIsNamedLikeOnTheLivePathEvenWithoutAProfile() {
    PersonDto p = MeetingMapper.person(AiConstants.AI_BOT_USER_ID, Map.of());

    assertThat(p).isEqualTo(new PersonDto(AiConstants.AI_BOT_USER_ID, "PON AI", null));
  }

  @Test
  void anUnknownUserStaysNameless() {
    assertThat(MeetingMapper.person("u9", Map.of())).isEqualTo(new PersonDto("u9", null, null));
  }

  @Test
  void aKnownProfileWins() {
    PersonDto known = new PersonDto("u1", "Lan", null);
    assertThat(MeetingMapper.person("u1", Map.of("u1", known))).isSameAs(known);
  }
}
