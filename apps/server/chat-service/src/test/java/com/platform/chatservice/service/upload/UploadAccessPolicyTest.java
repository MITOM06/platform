package com.platform.chatservice.service.upload;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.mongodb.client.gridfs.model.GridFSFile;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.service.meeting.MeetingLobby;
import com.platform.chatservice.service.meeting.MeetingPeople;
import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** {@link UploadAccessPolicy} rules 1→4 against a real MongoDB. */
@DataMongoTest
@Testcontainers
class UploadAccessPolicyTest {

  @Container static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

  @DynamicPropertySource
  static void mongoProps(DynamicPropertyRegistry registry) {
    registry.add("spring.data.mongodb.uri", mongo::getReplicaSetUrl);
  }

  private static final String UPLOADER = new ObjectId().toHexString();
  private static final String MEMBER = new ObjectId().toHexString();
  private static final String STRANGER = new ObjectId().toHexString();
  private static final ObjectId DEPT = new ObjectId();
  private static final ObjectId OTHER_DEPT = new ObjectId();

  @Autowired private MongoTemplate mongoTemplate;
  @Autowired private ConversationRepository conversationRepository;

  private MongoTemplate spyTemplate;
  private GridFsTemplate gridFs;
  private UploadRefs refs;
  private UploadAccessPolicy policy;
  private MeetingLobby lobby;

  @BeforeEach
  void setUp() {
    lobby = mock(MeetingLobby.class);
    for (String c :
        List.of(
            "fs.files",
            "fs.chunks",
            "users",
            "workspaces",
            "external_bots",
            "ai_personas",
            "meetings")) {
      mongoTemplate.getCollection(c).deleteMany(new Document());
    }
    conversationRepository.deleteAll();
    gridFs =
        new GridFsTemplate(mongoTemplate.getMongoDatabaseFactory(), mongoTemplate.getConverter());
    // Refs are set up by the uploader (who can always read the file).
    refs =
        new UploadRefs(
            mongoTemplate,
            gridFs,
            new UploadAccessPolicy(mongoTemplate, new MeetingPeople(mongoTemplate), lobby));
    spyTemplate = spy(mongoTemplate);
    policy = new UploadAccessPolicy(spyTemplate, new MeetingPeople(mongoTemplate), lobby);

    mongoTemplate.getCollection("users").insertOne(user(MEMBER, DEPT));
    mongoTemplate.getCollection("users").insertOne(user(STRANGER, OTHER_DEPT));
  }

  private static Document user(String id, ObjectId dept) {
    return new Document("_id", new ObjectId(id))
        .append("departmentIds", new ArrayList<>(List.of(dept)));
  }

  /** Stores a new UUID-keyed upload by {@link #UPLOADER}; returns its id. */
  private String upload() {
    String id = UUID.randomUUID().toString();
    gridFs.store(
        new ByteArrayInputStream(new byte[] {1}),
        id,
        "image/png",
        new Document("fileId", id).append("uploadedBy", UPLOADER));
    return id;
  }

  private GridFSFile file(String id) {
    return gridFs.findOne(Query.query(Criteria.where("metadata.fileId").is(id)));
  }

  private String url(String id) {
    return "/api/uploads/" + id;
  }

  private Conversation conversation(String... participants) {
    return conversationRepository.save(
        Conversation.builder()
            .type(Conversation.TYPE_GROUP)
            .participants(new ArrayList<>(List.of(participants)))
            .build());
  }

  @Test
  void uploader_can_read() {
    assertThat(policy.canRead(file(upload()), UPLOADER)).isTrue();
  }

  @Test
  void participant_of_referenced_conversation_can_read() {
    String id = upload();
    Conversation c = conversation(UPLOADER, MEMBER);
    refs.attachToConversation(url(id), c.getId(), UPLOADER);

    assertThat(policy.canRead(file(id), MEMBER)).isTrue();
  }

  @Test
  void non_participant_cannot_read() {
    String id = upload();
    Conversation c = conversation(UPLOADER, MEMBER);
    refs.attachToConversation(url(id), c.getId(), UPLOADER);

    assertThat(policy.canRead(file(id), STRANGER)).isFalse();
  }

  @Test
  void user_who_left_conversation_cannot_read() {
    String id = upload();
    Conversation c = conversation(UPLOADER, MEMBER);
    refs.attachToConversation(url(id), c.getId(), UPLOADER);
    assertThat(policy.canRead(file(id), MEMBER)).isTrue();

    c.setParticipants(new ArrayList<>(List.of(UPLOADER)));
    conversationRepository.save(c);

    assertThat(policy.canRead(file(id), MEMBER)).isFalse();
  }

  @Test
  void department_member_can_read_department_kb_file() {
    String id = upload();
    refs.attachToDepartment(url(id), DEPT.toHexString(), UPLOADER);

    assertThat(policy.canRead(file(id), MEMBER)).isTrue();
  }

  @Test
  void other_department_cannot() {
    String id = upload();
    refs.attachToDepartment(url(id), DEPT.toHexString(), UPLOADER);

    assertThat(policy.canRead(file(id), STRANGER)).isFalse();
  }

  private Meeting meeting(Meeting.MeetingBuilder b) {
    return mongoTemplate.save(b.hostId(UPLOADER).build());
  }

  @Test
  void meeting_ref_opens_file_to_invitee_attendee_and_department_member() {
    String attendee = new ObjectId().toHexString();
    String invitee = new ObjectId().toHexString();
    Meeting byInvite = meeting(Meeting.builder().inviteeIds(new ArrayList<>(List.of(invitee))));
    Meeting byDept = meeting(Meeting.builder().departmentId(DEPT.toHexString()));
    Meeting byAttend =
        meeting(
            Meeting.builder()
                .attendance(
                    new ArrayList<>(
                        List.of(Meeting.Attendance.builder().userId(attendee).build()))));
    String a = upload();
    String b = upload();
    String c = upload();
    assertThat(refs.attachToMeeting(a, byInvite.getId(), UPLOADER)).isTrue();
    assertThat(refs.attachToMeeting(b, byDept.getId(), UPLOADER)).isTrue();
    assertThat(refs.attachToMeeting(c, byAttend.getId(), UPLOADER)).isTrue();

    assertThat(policy.canRead(file(a), invitee)).isTrue();
    assertThat(policy.canRead(file(b), MEMBER)).isTrue();
    assertThat(policy.canRead(file(c), attendee)).isTrue();
  }

  @Test
  void meeting_ref_admitted_guest_can_read() {
    Meeting m = meeting(Meeting.builder());
    String id = upload();
    refs.attachToMeeting(id, m.getId(), UPLOADER);
    when(lobby.isAdmitted(m.getId(), STRANGER)).thenReturn(true);

    assertThat(policy.canRead(file(id), STRANGER)).isTrue();
  }

  @Test
  void meeting_ref_outsider_and_removed_person_cannot_read() {
    Meeting m =
        meeting(
            Meeting.builder()
                .inviteeIds(new ArrayList<>(List.of(MEMBER)))
                .removedIds(new ArrayList<>(List.of(MEMBER))));
    String id = upload();
    refs.attachToMeeting(id, m.getId(), UPLOADER);

    assertThat(policy.canRead(file(id), STRANGER)).isFalse();
    assertThat(policy.canRead(file(id), MEMBER)).isFalse();
  }

  @Test
  void meeting_ref_to_missing_meeting_grants_nothing() {
    String id = upload();
    assertThat(refs.attachToMeeting(id, new ObjectId().toHexString(), UPLOADER)).isTrue();

    assertThat(policy.canRead(file(id), MEMBER)).isFalse();
  }

  @Test
  void non_uploader_cannot_attach_to_meeting() {
    Meeting m = meeting(Meeting.builder().inviteeIds(new ArrayList<>(List.of(STRANGER))));
    String id = upload();

    assertThat(refs.attachToMeeting(id, m.getId(), STRANGER)).isFalse();
    assertThat(policy.canRead(file(id), STRANGER)).isFalse();
  }

  @Test
  void attach_to_meeting_is_idempotent_and_ignores_blank_input() {
    Meeting m = meeting(Meeting.builder());
    String id = upload();
    assertThat(refs.attachToMeeting(id, m.getId(), UPLOADER)).isTrue();
    assertThat(refs.attachToMeeting(id, m.getId(), UPLOADER)).isTrue();
    assertThat(refs.attachToMeeting(id, "", UPLOADER)).isFalse();
    assertThat(refs.attachToMeeting("not-an-id", m.getId(), UPLOADER)).isFalse();

    List<?> list = (List<?>) file(id).getMetadata().get("refs");
    assertThat(list).hasSize(1);
  }

  @Test
  void departments_not_loaded_when_no_meeting_ref() {
    String id = upload();
    Conversation c = conversation(UPLOADER, MEMBER);
    refs.attachToConversation(url(id), c.getId(), UPLOADER);

    assertThat(policy.canRead(file(id), STRANGER)).isFalse();
    verify(lobby, never()).isAdmitted(any(), any());
  }

  @Test
  void own_avatar_readable_by_any_authenticated_user() {
    mongoTemplate.getCollection("users").insertOne(user(UPLOADER, DEPT));
    String avatar = upload();
    String cover = upload();
    mongoTemplate
        .getCollection("users")
        .updateOne(
            new Document("_id", new ObjectId(UPLOADER)),
            new Document(
                "$set",
                new Document("avatarUrl", url(avatar) + "#fit=cover&scale=120")
                    .append("coverPhoto", url(cover))));

    assertThat(policy.canRead(file(avatar), STRANGER)).isTrue();
    assertThat(policy.canRead(file(cover), STRANGER)).isTrue();
  }

  @Test
  void user_avatar_set_to_foreign_file_does_not_make_it_public() {
    String id = upload(); // uploaded by UPLOADER
    // MEMBER points their own avatar at UPLOADER's file: must not open it to everyone.
    mongoTemplate
        .getCollection("users")
        .updateOne(
            new Document("_id", new ObjectId(MEMBER)),
            new Document("$set", new Document("avatarUrl", url(id))));

    assertThat(policy.canRead(file(id), STRANGER)).isFalse();
  }

  @Test
  void file_without_uploader_never_matches_user_profile() {
    String id = UUID.randomUUID().toString();
    gridFs.store(
        new ByteArrayInputStream(new byte[] {1}), id, "image/png", new Document("fileId", id));
    mongoTemplate
        .getCollection("users")
        .updateOne(
            new Document("_id", new ObjectId(MEMBER)),
            new Document("$set", new Document("avatarUrl", url(id))));

    assertThat(policy.canRead(file(id), STRANGER)).isFalse();
  }

  @Test
  void profile_url_must_match_whole_id() {
    mongoTemplate.getCollection("users").insertOne(user(UPLOADER, DEPT));
    String id = upload();
    // A stored URL that merely starts with the id (longer path) must not grant access.
    mongoTemplate
        .getCollection("users")
        .updateOne(
            new Document("_id", new ObjectId(UPLOADER)),
            new Document("$set", new Document("avatarUrl", url(id) + "x")));

    assertThat(policy.canRead(file(id), STRANGER)).isFalse();
  }

  @Test
  void workspace_logo_readable() {
    String id = upload();
    mongoTemplate
        .getCollection("workspaces")
        .insertOne(new Document("name", "Acme").append("logoUrl", url(id) + "?v=2"));

    assertThat(policy.canRead(file(id), STRANGER)).isTrue();
  }

  @Test
  void bot_avatar_readable() {
    String bot = upload();
    mongoTemplate.getCollection("external_bots").insertOne(new Document("avatarUrl", url(bot)));

    assertThat(policy.canRead(file(bot), STRANGER)).isTrue();
  }

  @Test
  void persona_avatar_no_longer_matches_rule4() {
    String persona = upload();
    mongoTemplate.getCollection("ai_personas").insertOne(new Document("avatarUrl", url(persona)));

    assertThat(policy.canRead(file(persona), STRANGER)).isFalse();
  }

  @Test
  void file_without_refs_only_uploader() {
    String id = upload();

    assertThat(policy.canRead(file(id), UPLOADER)).isTrue();
    assertThat(policy.canRead(file(id), MEMBER)).isFalse();
    assertThat(policy.canRead(file(id), STRANGER)).isFalse();
    assertThat(policy.canRead(file(id), null)).isFalse();
  }

  @Test
  void profile_fallback_not_queried_when_conversation_rule_matches() {
    String id = upload();
    Conversation c = conversation(UPLOADER, MEMBER);
    refs.attachToConversation(url(id), c.getId(), UPLOADER);

    assertThat(policy.canRead(file(id), MEMBER)).isTrue();

    verify(spyTemplate, never()).exists(any(Query.class), eq("users"));
    verify(spyTemplate, never()).exists(any(Query.class), eq("workspaces"));
    verify(spyTemplate, never()).exists(any(Query.class), eq("external_bots"));
    verify(spyTemplate, never()).findOne(any(Query.class), eq(Document.class), eq("users"));
  }

  @Test
  void many_conversation_refs_use_a_single_conversations_query() {
    String id = upload();
    Conversation a = conversation(UPLOADER);
    Conversation b = conversation(UPLOADER);
    Conversation c = conversation(UPLOADER, MEMBER);
    refs.attachToConversation(url(id), a.getId(), UPLOADER);
    refs.attachToConversation(url(id), b.getId(), UPLOADER);
    refs.attachToConversation(url(id), c.getId(), UPLOADER);

    assertThat(policy.canRead(file(id), MEMBER)).isTrue();

    verify(spyTemplate, times(1)).exists(any(Query.class), eq("conversations"));
    verify(spyTemplate, never()).findOne(any(Query.class), eq(Document.class), eq("conversations"));
  }
}
