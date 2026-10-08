package com.platform.chatservice.service.meeting;

import com.platform.chatservice.dto.meeting.PersonDto;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

/**
 * Batched lookups in the {@code users} collection (owned by auth-service) for meetings: names and
 * avatars, which invitees exist, who is in a department.
 *
 * <p>An unknown user is simply absent from the result — callers fall back to a nameless {@link
 * PersonDto}; the id is never used as a name.
 */
@Component
@RequiredArgsConstructor
public class MeetingPeople {

  private static final String USERS = "users";

  private final MongoTemplate mongo;

  /** One query for every valid id; users that do not exist are not in the map. */
  public Map<String, PersonDto> profiles(Collection<String> userIds) {
    List<ObjectId> ids = objectIds(userIds);
    Map<String, PersonDto> out = new HashMap<>();
    if (ids.isEmpty()) {
      return out;
    }
    Query query = new Query(Criteria.where("_id").in(ids));
    query.fields().include("displayName", "avatarUrl");
    for (Document doc : mongo.find(query, Document.class, USERS)) {
      String id = doc.getObjectId("_id").toHexString();
      out.put(
          id,
          new PersonDto(
              id, blankToNull(doc.get("displayName")), blankToNull(doc.get("avatarUrl"))));
    }
    return out;
  }

  /** The subset of {@code userIds} that are real users (invalid ids are dropped). */
  public Set<String> existingUserIds(Collection<String> userIds) {
    List<ObjectId> ids = objectIds(userIds);
    Set<String> out = new LinkedHashSet<>();
    if (ids.isEmpty()) {
      return out;
    }
    Query query = new Query(Criteria.where("_id").in(ids));
    query.fields().include("_id");
    for (Document doc : mongo.find(query, Document.class, USERS)) {
      out.add(doc.getObjectId("_id").toHexString());
    }
    return out;
  }

  /** Non-blocked members of {@code departmentId}; empty for an invalid id. */
  public List<String> departmentMembers(String departmentId) {
    if (departmentId == null || !ObjectId.isValid(departmentId)) {
      return List.of();
    }
    Query query =
        new Query(
            Criteria.where("departmentIds")
                .is(new ObjectId(departmentId))
                .and("status")
                .ne("blocked"));
    query.fields().include("_id");
    return mongo.find(query, Document.class, USERS).stream()
        .map(doc -> doc.getObjectId("_id").toHexString())
        .toList();
  }

  private static List<ObjectId> objectIds(Collection<String> userIds) {
    if (userIds == null) {
      return List.of();
    }
    Set<ObjectId> ids = new LinkedHashSet<>();
    for (String id : userIds) {
      if (id != null && ObjectId.isValid(id)) {
        ids.add(new ObjectId(id));
      }
    }
    return List.copyOf(ids);
  }

  private static String blankToNull(Object value) {
    return value instanceof String s && !s.isBlank() ? s : null;
  }
}
