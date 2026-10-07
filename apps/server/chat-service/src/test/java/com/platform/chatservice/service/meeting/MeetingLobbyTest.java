package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.meeting.LobbyEntryDto;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.SetOperations;
import org.springframework.data.redis.core.StringRedisTemplate;

class MeetingLobbyTest {

  private StringRedisTemplate redis;
  private HashOperations<String, Object, Object> hashes;
  private SetOperations<String, String> sets;
  private MeetingLobby lobby;

  @BeforeEach
  @SuppressWarnings("unchecked")
  void setUp() {
    redis = mock(StringRedisTemplate.class);
    hashes = mock(HashOperations.class);
    sets = mock(SetOperations.class);
    when(redis.opsForHash()).thenReturn(hashes);
    when(redis.opsForSet()).thenReturn(sets);
    lobby = new MeetingLobby(redis);
  }

  @Test
  void addKeepsTheNameAndExpiresWithTheMeetingDay() {
    lobby.add("m1", "u1", "Hoa");
    lobby.add("m1", "u2", null);

    verify(hashes).put("meet:lobby:m1", "u1", "Hoa");
    verify(hashes).put("meet:lobby:m1", "u2", "");
    verify(redis, org.mockito.Mockito.times(2)).expire("meet:lobby:m1", Duration.ofHours(24));
  }

  @Test
  void removeTellsWhetherTheyWereWaiting() {
    when(hashes.delete("meet:lobby:m1", "u1")).thenReturn(1L);
    when(hashes.delete("meet:lobby:m1", "u2")).thenReturn(0L);

    assertThat(lobby.remove("m1", "u1")).isTrue();
    assertThat(lobby.remove("m1", "u2")).isFalse();
  }

  @Test
  void waitingIsSortedByNameWithNamelessPeopleLastAndNeverNamedByTheirId() {
    Map<Object, Object> raw = new LinkedHashMap<>();
    raw.put("u3", "");
    raw.put("u1", "minh");
    raw.put("u2", "Anh");
    when(hashes.entries("meet:lobby:m1")).thenReturn(raw);

    assertThat(lobby.waiting("m1"))
        .containsExactly(
            new LobbyEntryDto("u2", "Anh"),
            new LobbyEntryDto("u1", "minh"),
            new LobbyEntryDto("u3", null));
  }

  @Test
  void admittedPeopleAreRemembered() {
    lobby.admit("m1", "u1");
    verify(sets).add("meet:admitted:m1", "u1");
    verify(redis).expire("meet:admitted:m1", Duration.ofHours(24));

    when(sets.isMember("meet:admitted:m1", "u1")).thenReturn(true);
    assertThat(lobby.isAdmitted("m1", "u1")).isTrue();
    assertThat(lobby.isAdmitted("m1", "u2")).isFalse();
  }

  @Test
  void clearDropsEverythingTheMeetingKeptInRedis() {
    lobby.clear("m1");
    verify(redis).delete(List.of("meet:lobby:m1", "meet:admitted:m1", "meet:hands:m1"));
  }
}
