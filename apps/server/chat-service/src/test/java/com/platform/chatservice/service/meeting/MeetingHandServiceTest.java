package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.meeting.HandDto;
import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.security.UserPrincipal;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.DefaultTypedTuple;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.data.redis.core.ZSetOperations.TypedTuple;
import org.springframework.http.HttpStatus;

class MeetingHandServiceTest {

  private static final String KEY = "meet:hands:m1";

  private StringRedisTemplate redis;
  private ZSetOperations<String, String> zset;
  private MeetingGuard guard;
  private MeetingPeople people;
  private MeetingEvents events;
  private MeetingHandService service;
  private final UserPrincipal an = new UserPrincipal("a");

  @BeforeEach
  @SuppressWarnings("unchecked")
  void setUp() {
    redis = mock(StringRedisTemplate.class);
    zset = mock(ZSetOperations.class);
    guard = mock(MeetingGuard.class);
    people = mock(MeetingPeople.class);
    events = mock(MeetingEvents.class);
    when(redis.opsForZSet()).thenReturn(zset);
    when(people.profiles(anyCollection())).thenReturn(Map.of("a", new PersonDto("a", "An", null)));
    service = new MeetingHandService(redis, guard, people, events);
  }

  /** What ZRANGE … WITHSCORES returns: already in score (raise-time) order. */
  private void handsInRedis(Object... idThenMillis) {
    Set<TypedTuple<String>> rows = new LinkedHashSet<>();
    for (int i = 0; i < idThenMillis.length; i += 2) {
      rows.add(
          new DefaultTypedTuple<>(
              (String) idThenMillis[i], ((Long) idThenMillis[i + 1]).doubleValue()));
    }
    when(zset.rangeWithScores(KEY, 0, -1)).thenReturn(rows);
  }

  @Test
  void raisingAgainKeepsYourPlaceAndAnnouncesNothing() {
    when(zset.addIfAbsent(eq(KEY), eq("a"), anyDouble())).thenReturn(true).thenReturn(false);
    handsInRedis("a", 1_000L);

    service.setHand(an, "m1", true);
    service.setHand(an, "m1", true);

    verify(zset, never()).add(anyString(), anyString(), anyDouble()); // a plain ZADD moves you
    verify(redis, times(1)).expire(KEY, MeetingLobby.TTL);
    verify(events, times(1)).hands(eq("m1"), any());
  }

  @Test
  void theListIsInRaiseOrderWithNamesFromOneLookupAndNeverIdsAsNames() {
    handsInRedis("a", 1_000L, "b", 2_000L);

    List<HandDto> hands = service.hands("m1");

    assertThat(hands)
        .containsExactly(
            new HandDto("a", "An", Instant.ofEpochMilli(1_000)),
            new HandDto("b", null, Instant.ofEpochMilli(2_000)));
    verify(people, times(1)).profiles(anyCollection());
  }

  @Test
  void loweringYourOwnHandAnnouncesOnlyARealChange() {
    when(zset.remove(KEY, "a")).thenReturn(1L).thenReturn(0L);
    handsInRedis();

    service.setHand(an, "m1", false);
    service.setHand(an, "m1", false);

    verify(events, times(1)).hands("m1", List.of());
  }

  @Test
  void refusalsComeFromTheGuardAndTouchNothing() {
    when(guard.inRoom(any(), eq("m1")))
        .thenThrow(new ApiException(HttpStatus.CONFLICT, "MEETING_ENDED"));

    assertThatThrownBy(() -> service.setHand(an, "m1", true))
        .isInstanceOf(ApiException.class)
        .extracting(e -> ((ApiException) e).code())
        .isEqualTo("MEETING_ENDED");
    verifyNoInteractions(zset, events);
  }

  @Test
  void lowerAllAnnouncesAnEmptyListOnlyWhenThereWereHands() {
    when(redis.delete(KEY)).thenReturn(true).thenReturn(false);

    service.lowerAll("m1");
    service.lowerAll("m1");

    verify(events, times(1)).hands("m1", List.of());
  }

  @Test
  void lowerSomeoneElseSkipsTheGuardBecauseTheCallerAlreadyChecked() {
    when(zset.remove(KEY, "b")).thenReturn(1L);
    handsInRedis();

    assertThat(service.lower("m1", "b")).isTrue();

    verifyNoInteractions(guard);
    verify(events).hands("m1", List.of());
  }

  @Test
  void theSnapshotNeedsRoomAccess() {
    handsInRedis("a", 1_000L);

    assertThat(service.snapshot(an, "m1").hands()).extracting(HandDto::userId).containsExactly("a");
    verify(guard).inRoom(an, "m1");
  }
}
