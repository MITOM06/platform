package com.platform.chatservice.service.meeting;

import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.exception.ErrorCodes;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.service.rtc.LiveKitApiException;
import com.platform.chatservice.service.rtc.LiveKitRoomClient;
import com.platform.chatservice.service.rtc.LiveKitRoomClient.RoomParticipant;
import com.platform.chatservice.service.rtc.LiveKitRoomClient.RoomTrack;
import com.platform.chatservice.service.rtc.LiveKitUnavailableException;
import com.platform.chatservice.service.rtc.RtcGrant;
import com.platform.chatservice.service.rtc.RtcRooms;
import java.util.List;
import java.util.Set;
import java.util.function.Consumer;
import java.util.function.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * What people may do inside a meeting's LiveKit room, applied to the live room: publish permissions
 * (attendee screen share), muting microphones, removing people. A token already handed out cannot
 * be revoked, so the room is corrected through LiveKit's RoomService instead — now, and again when
 * the webhook reports someone (re)joining with an older token.
 *
 * <p>A LiveKit failure (not configured, network, non-2xx other than "not in the room") is 503
 * {@code MEETINGS_UNAVAILABLE}, except in the best-effort paths that say so.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MeetingRoomPolicy {

  static final List<String> ATTENDEE_SOURCES = List.of(RtcGrant.CAMERA, RtcGrant.MICROPHONE);
  static final List<String> EVERY_SOURCE =
      List.of(
          RtcGrant.CAMERA, RtcGrant.MICROPHONE, RtcGrant.SCREEN_SHARE, RtcGrant.SCREEN_SHARE_AUDIO);

  private static final String MICROPHONE = "MICROPHONE";
  private static final Set<String> SHARE_SOURCES = Set.of("SCREEN_SHARE", "SCREEN_SHARE_AUDIO");

  private final LiveKitRoomClient rooms;

  /**
   * Applies {@code settings.allowAttendeeScreenShare} to every attendee in the room: off ⇒ camera +
   * microphone only and their live share muted; on ⇒ every source. Host / co-hosts are untouched.
   */
  public void applyScreenShare(Meeting m) {
    String room = RtcRooms.forMeeting(m.getId());
    boolean allow = sharingAllowed(m);
    try {
      for (RoomParticipant p : rooms.listParticipants(room)) {
        String id = p.identity();
        if (id == null || !"attendee".equals(MeetingAccess.roleOf(m, id))) {
          continue;
        }
        if (!restrict(room, id, allow ? EVERY_SOURCE : ATTENDEE_SOURCES)) {
          continue; // left between the listing and the update
        }
        if (!allow) {
          muteTracks(room, p, SHARE_SOURCES);
        }
      }
    } catch (LiveKitApiException | LiveKitUnavailableException e) {
      throw unavailable(m.getId(), e);
    }
  }

  /**
   * After a {@code PATCH} saved new settings: a flipped attendee screen-share switch in a LIVE
   * meeting is applied to the room, best effort — the settings are saved either way and people who
   * join later get a token that matches them.
   */
  public void afterSettingsChange(Meeting before, Meeting after) {
    if (after == null
        || after.getStatus() != MeetingStatus.LIVE
        || (before != null && sharingAllowed(before) == sharingAllowed(after))) {
      return;
    }
    try {
      applyScreenShare(after);
    } catch (ApiException e) {
      log.warn("Meeting {} screen-share change not applied to the room", after.getId());
    }
  }

  /**
   * After {@code userId}'s role changed: while attendee screen share is off, a manager may publish
   * every source and an attendee only camera + microphone (their live share is muted). Someone not
   * in the room is a no-op.
   */
  public void applyPublishPermission(Meeting m, String userId) {
    if (sharingAllowed(m)) {
      return;
    }
    String room = RtcRooms.forMeeting(m.getId());
    boolean manager = MeetingAccess.canManage(m, userId);
    try {
      if (!restrict(room, userId, manager ? EVERY_SOURCE : ATTENDEE_SOURCES) || manager) {
        return;
      }
      for (RoomParticipant p : rooms.listParticipants(room)) {
        if (userId.equals(p.identity())) {
          muteTracks(room, p, SHARE_SOURCES);
        }
      }
    } catch (LiveKitApiException | LiveKitUnavailableException e) {
      throw unavailable(m.getId(), e);
    }
  }

  /**
   * For the {@code participant_joined} webhook; never throws. A removed person (rejoining with a
   * token issued before the removal) is kicked again ⇒ false: record nothing. An attendee arriving
   * while screen share is off is restricted (their token may predate the switch) ⇒ true.
   */
  public boolean admitOnJoin(Meeting m, String identity) {
    String room = RtcRooms.forMeeting(m.getId());
    if (m.getRemovedIds() != null && m.getRemovedIds().contains(identity)) {
      try {
        rooms.removeParticipant(room, identity);
      } catch (RuntimeException e) {
        log.warn("Meeting {} removed person could not be kicked on rejoin", m.getId());
      }
      return false;
    }
    if (!sharingAllowed(m) && "attendee".equals(MeetingAccess.roleOf(m, identity))) {
      try {
        rooms.updateParticipant(room, identity, ATTENDEE_SOURCES);
      } catch (RuntimeException e) {
        log.warn("Meeting {} arriving attendee could not be restricted", m.getId());
      }
    }
    return true;
  }

  /** Removes {@code identity} from the room; someone already gone is fine. */
  public void kick(String meetingId, String identity) {
    try {
      rooms.removeParticipant(RtcRooms.forMeeting(meetingId), identity);
    } catch (LiveKitApiException e) {
      if (!notInRoom(e)) {
        throw unavailable(meetingId, e);
      }
    } catch (LiveKitUnavailableException e) {
      throw unavailable(meetingId, e);
    }
  }

  /**
   * Mutes every live microphone track of the people in the room matching {@code who}, in LiveKit's
   * order (nobody can be unmuted remotely). {@code onMuted} is told each person as soon as at least
   * one of their tracks is muted, so a failure on a later person still reports the earlier ones.
   */
  public void muteMicrophones(String meetingId, Predicate<String> who, Consumer<String> onMuted) {
    String room = RtcRooms.forMeeting(meetingId);
    try {
      for (RoomParticipant p : rooms.listParticipants(room)) {
        if (p.identity() != null
            && who.test(p.identity())
            && muteTracks(room, p, Set.of(MICROPHONE))) {
          onMuted.accept(p.identity());
        }
      }
    } catch (LiveKitApiException | LiveKitUnavailableException e) {
      throw unavailable(meetingId, e);
    }
  }

  /** Sets what {@code identity} may publish; false when they are not in the room (404). */
  private boolean restrict(String room, String identity, List<String> sources) {
    try {
      rooms.updateParticipant(room, identity, sources);
      return true;
    } catch (LiveKitApiException e) {
      if (notInRoom(e)) {
        return false;
      }
      throw e;
    }
  }

  /** Mutes {@code p}'s unmuted tracks of {@code sources}; true when at least one was muted. */
  private boolean muteTracks(String room, RoomParticipant p, Set<String> sources) {
    boolean any = false;
    for (RoomTrack t : p.tracks() == null ? List.<RoomTrack>of() : p.tracks()) {
      if (t.muted() || t.sid() == null || !sources.contains(t.source())) {
        continue;
      }
      try {
        rooms.mutePublishedTrack(room, p.identity(), t.sid(), true);
        any = true;
      } catch (LiveKitApiException e) {
        if (!notInRoom(e)) {
          throw e;
        }
        // The track was unpublished (or its owner left) since the listing.
      }
    }
    return any;
  }

  private static boolean sharingAllowed(Meeting m) {
    return m.getSettings() == null || m.getSettings().isAllowAttendeeScreenShare();
  }

  private static boolean notInRoom(LiveKitApiException e) {
    return e.status() == HttpStatus.NOT_FOUND.value();
  }

  private static ApiException unavailable(String meetingId, RuntimeException e) {
    log.warn("Meeting {} LiveKit call failed: {}", meetingId, e.getMessage());
    return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, ErrorCodes.MEETINGS_UNAVAILABLE);
  }
}
