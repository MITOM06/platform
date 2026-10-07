package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.meeting.PersonDto;
import java.util.List;
import java.util.Map;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

class MeetingPeopleTest {

  private static final String LAN = "64b000000000000000000001";
  private static final String MINH = "64b000000000000000000002";
  private static final String GONE = "64b000000000000000000003";
  private static final String DEPT = "66aa00000000000000000009";

  private MongoTemplate mongo;
  private MeetingPeople people;

  @BeforeEach
  void setUp() {
    mongo = mock(MongoTemplate.class);
    people = new MeetingPeople(mongo);
  }

  private Query capturedQuery() {
    ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
    verify(mongo).find(captor.capture(), eq(Document.class), eq("users"));
    return captor.getValue();
  }

  @Test
  void profilesAreOneQueryAndNeverNameSomeoneByTheirId() {
    when(mongo.find(any(Query.class), eq(Document.class), eq("users")))
        .thenReturn(
            List.of(
                new Document("_id", new ObjectId(LAN))
                    .append("displayName", "Lan Nguyen")
                    .append("avatarUrl", "/api/uploads/a"),
                new Document("_id", new ObjectId(MINH))));

    Map<String, PersonDto> map = people.profiles(List.of(LAN, MINH, GONE, "not-an-id", LAN));

    Query q = capturedQuery();
    @SuppressWarnings("unchecked")
    List<Object> ids =
        (List<Object>) ((Document) q.getQueryObject().get("_id")).get("$in", List.class);
    assertThat(ids)
        .containsExactlyInAnyOrder(new ObjectId(LAN), new ObjectId(MINH), new ObjectId(GONE));
    assertThat(q.getFieldsObject().keySet()).contains("displayName", "avatarUrl");

    assertThat(map).containsOnlyKeys(LAN, MINH);
    assertThat(map.get(LAN)).isEqualTo(new PersonDto(LAN, "Lan Nguyen", "/api/uploads/a"));
    assertThat(map.get(MINH)).isEqualTo(new PersonDto(MINH, null, null));
    assertThat(map.values()).allSatisfy(p -> assertThat(p.displayName()).isNotEqualTo(p.userId()));
  }

  @Test
  void profilesOfNobodyDoNotQuery() {
    assertThat(people.profiles(List.of("not-an-id"))).isEmpty();
    assertThat(people.profiles(null)).isEmpty();
    verify(mongo, never()).find(any(Query.class), eq(Document.class), eq("users"));
  }

  @Test
  void existingUserIdsKeepsOnlyPeopleWhoExist() {
    when(mongo.find(any(Query.class), eq(Document.class), eq("users")))
        .thenReturn(List.of(new Document("_id", new ObjectId(LAN))));

    assertThat(people.existingUserIds(List.of(LAN, GONE, "junk"))).containsExactly(LAN);
    verify(mongo, times(1)).find(any(Query.class), eq(Document.class), eq("users"));
  }

  @Test
  void anInvalidDepartmentHasNoMembersAndIsNotQueried() {
    assertThat(people.departmentMembers("not-an-id")).isEmpty();
    assertThat(people.departmentMembers(null)).isEmpty();
    verify(mongo, never()).find(any(Query.class), eq(Document.class), eq("users"));
  }

  @Test
  void departmentMembersSkipBlockedAccounts() {
    when(mongo.find(any(Query.class), eq(Document.class), eq("users")))
        .thenReturn(
            List.of(
                new Document("_id", new ObjectId(LAN)), new Document("_id", new ObjectId(MINH))));

    assertThat(people.departmentMembers(DEPT)).containsExactly(LAN, MINH);

    Document q = capturedQuery().getQueryObject();
    assertThat(q.get("departmentIds")).isEqualTo(new ObjectId(DEPT));
    assertThat(q.get("status")).isEqualTo(new Document("$ne", "blocked"));
  }
}
