package com.platform.chatservice.service.upload;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;

import com.mongodb.client.gridfs.model.GridFSFile;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.service.ConversationCacheService;
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

  @BeforeEach
  void setUp() {
    for (String c :
        List.of("fs.files", "fs.chunks", "users", "workspaces", "external_bots", "ai_personas")) {
      mongoTemplate.getCollection(c).deleteMany(new Document());
    }
    conversationRepository.deleteAll();
    gridFs =
        new GridFsTemplate(mongoTemplate.getMongoDatabaseFactory(), mongoTemplate.getConverter());
    refs =
        new UploadRefs(mongoTemplate, gridFs, org.mockito.Mockito.mock(UploadAccessPolicy.class));
    spyTemplate = spy(mongoTemplate);
    policy =
        new UploadAccessPolicy(spyTemplate, new ConversationCacheService(conversationRepository));

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
    refs.attachToConversation(url(id), c.getId());

    assertThat(policy.canRead(file(id), MEMBER)).isTrue();
  }

  @Test
  void non_participant_cannot_read() {
    String id = upload();
    Conversation c = conversation(UPLOADER, MEMBER);
    refs.attachToConversation(url(id), c.getId());

    assertThat(policy.canRead(file(id), STRANGER)).isFalse();
  }

  @Test
  void user_who_left_conversation_cannot_read() {
    String id = upload();
    Conversation c = conversation(UPLOADER, MEMBER);
    refs.attachToConversation(url(id), c.getId());
    assertThat(policy.canRead(file(id), MEMBER)).isTrue();

    c.setParticipants(new ArrayList<>(List.of(UPLOADER)));
    conversationRepository.save(c);

    assertThat(policy.canRead(file(id), MEMBER)).isFalse();
  }

  @Test
  void department_member_can_read_department_kb_file() {
    String id = upload();
    refs.attachToDepartment(url(id), DEPT.toHexString());

    assertThat(policy.canRead(file(id), MEMBER)).isTrue();
  }

  @Test
  void other_department_cannot() {
    String id = upload();
    refs.attachToDepartment(url(id), DEPT.toHexString());

    assertThat(policy.canRead(file(id), STRANGER)).isFalse();
  }

  @Test
  void user_avatar_readable_by_any_authenticated_user() {
    String avatar = upload();
    String cover = upload();
    mongoTemplate
        .getCollection("users")
        .updateOne(
            new Document("_id", new ObjectId(MEMBER)),
            new Document(
                "$set",
                new Document("avatarUrl", url(avatar) + "#fit=cover&scale=120")
                    .append("coverPhoto", url(cover))));

    assertThat(policy.canRead(file(avatar), STRANGER)).isTrue();
    assertThat(policy.canRead(file(cover), STRANGER)).isTrue();
  }

  @Test
  void profile_url_must_match_whole_id() {
    String id = upload();
    // A stored URL that merely starts with the id (longer path) must not grant access.
    mongoTemplate
        .getCollection("users")
        .updateOne(
            new Document("_id", new ObjectId(MEMBER)),
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
  void bot_and_persona_avatar_readable() {
    String bot = upload();
    String persona = upload();
    mongoTemplate.getCollection("external_bots").insertOne(new Document("avatarUrl", url(bot)));
    mongoTemplate.getCollection("ai_personas").insertOne(new Document("avatarUrl", url(persona)));

    assertThat(policy.canRead(file(bot), STRANGER)).isTrue();
    assertThat(policy.canRead(file(persona), STRANGER)).isTrue();
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
    refs.attachToConversation(url(id), c.getId());

    assertThat(policy.canRead(file(id), MEMBER)).isTrue();

    verify(spyTemplate, never()).exists(any(Query.class), anyString());
    verify(spyTemplate, never()).findOne(any(Query.class), eq(Document.class), eq("users"));
  }
}
