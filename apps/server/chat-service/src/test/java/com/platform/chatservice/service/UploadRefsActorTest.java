package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.mongodb.client.gridfs.model.GridFSFile;
import com.platform.chatservice.controller.AiPersonaController;
import com.platform.chatservice.dto.AiPersonaRequest;
import com.platform.chatservice.dto.SendMessageRequest;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.repository.AiPersonaRepository;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.ExternalBotRepository;
import com.platform.chatservice.repository.FriendshipRepository;
import com.platform.chatservice.repository.MessageRepository;
import com.platform.chatservice.service.meeting.MeetingLobby;
import com.platform.chatservice.service.meeting.MeetingPeople;
import com.platform.chatservice.service.upload.UploadAccessPolicy;
import com.platform.chatservice.service.upload.UploadRefs;
import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.bson.Document;
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

/**
 * Ref laundering guard, end to end through the real services and MongoDB: a user-initiated write
 * only attaches upload ids the acting user can already read — AI / bot / reminder messages use the
 * user whose text they echo as the actor, and writes with no actor attach nothing.
 */
@DataMongoTest
@Testcontainers
class UploadRefsActorTest {

  @Container static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

  @DynamicPropertySource
  static void mongoProps(DynamicPropertyRegistry registry) {
    registry.add("spring.data.mongodb.uri", mongo::getReplicaSetUrl);
  }

  private static final String OWNER = "owner";
  private static final String LEAVER = "leaver";
  private static final String FRIEND = "friend";

  @Autowired private MongoTemplate mongoTemplate;
  @Autowired private ConversationRepository conversationRepository;
  @Autowired private MessageRepository messageRepository;
  @Autowired private FriendshipRepository friendshipRepository;
  @Autowired private ExternalBotRepository externalBotRepository;
  @Autowired private AiPersonaRepository aiPersonaRepository;

  private GridFsTemplate gridFs;
  private UploadAccessPolicy policy;
  private UploadRefs refs;
  private MessageService messageService;
  private AiMessageService aiMessageService;
  private ConversationService conversationService;

  @BeforeEach
  void setUp() {
    for (String c : List.of("fs.files", "fs.chunks", "users")) {
      mongoTemplate.getCollection(c).deleteMany(new Document());
    }
    conversationRepository.deleteAll();
    messageRepository.deleteAll();
    aiPersonaRepository.deleteAll();

    gridFs =
        new GridFsTemplate(mongoTemplate.getMongoDatabaseFactory(), mongoTemplate.getConverter());
    ConversationCacheService cache = new ConversationCacheService(conversationRepository);
    policy =
        new UploadAccessPolicy(
            mongoTemplate, new MeetingPeople(mongoTemplate), mock(MeetingLobby.class));
    refs = new UploadRefs(mongoTemplate, gridFs, policy);
    MessageMapper mapper = new MessageMapper();
    aiMessageService =
        new AiMessageService(
            messageRepository,
            conversationRepository,
            mock(ClusterMessageBroker.class),
            mapper,
            mongoTemplate,
            cache,
            refs);
    messageService =
        new MessageService(
            messageRepository,
            conversationRepository,
            mongoTemplate,
            mock(MessageServiceHelper.class),
            mapper,
            aiMessageService,
            cache,
            refs,
            org.mockito.Mockito.mock(AiThreadService.class));
    ConversationWriteSupport support =
        new ConversationWriteSupport(
            cache, mongoTemplate, messageRepository, new ConversationMapper(messageRepository));
    conversationService =
        new ConversationService(
            conversationRepository,
            cache,
            friendshipRepository,
            externalBotRepository,
            support,
            mock(ConversationMembershipCache.class),
            refs);
  }

  private String upload(String by) {
    String id = UUID.randomUUID().toString();
    gridFs.store(
        new ByteArrayInputStream(new byte[] {1}),
        id,
        "image/png",
        new Document("fileId", id).append("uploadedBy", by));
    return id;
  }

  private GridFSFile file(String id) {
    return gridFs.findOne(Query.query(Criteria.where("metadata.fileId").is(id)));
  }

  private List<Document> refsOf(String id) {
    Document meta = file(id).getMetadata();
    List<Document> r = meta.getList("refs", Document.class);
    return r == null ? List.of() : r;
  }

  private static Document conv(String id) {
    return new Document("t", "c").append("id", id);
  }

  private Conversation group(String... members) {
    return conversationRepository.save(
        Conversation.builder()
            .type(Conversation.TYPE_GROUP)
            .name("g")
            .participants(new ArrayList<>(List.of(members)))
            .admins(new ArrayList<>(List.of(members[0])))
            .build());
  }

  private static String url(String id) {
    return "/api/uploads/" + id;
  }

  @Test
  void send_does_not_attach_file_sender_cannot_read() {
    Conversation c1 = group(OWNER, LEAVER);
    String photo = upload(OWNER);
    messageService.sendMessage(OWNER, new SendMessageRequest(c1.getId(), url(photo), "image"));
    assertThat(refsOf(photo)).containsExactly(conv(c1.getId()));

    // LEAVER leaves C1, then pastes the URL into C2 to regain access.
    c1.setParticipants(new ArrayList<>(List.of(OWNER)));
    conversationRepository.save(c1);
    Conversation c2 = group(LEAVER, FRIEND);
    messageService.sendMessage(LEAVER, new SendMessageRequest(c2.getId(), url(photo), "image"));

    assertThat(refsOf(photo)).containsExactly(conv(c1.getId()));
    assertThat(policy.canRead(file(photo), LEAVER)).isFalse(); // → 403 at the controller
    assertThat(messageRepository.count()).isEqualTo(2); // the message itself was still saved
  }

  @Test
  void forward_attaches_file_from_source_conversation_sender_is_in() {
    Conversation src = group(OWNER, FRIEND);
    Conversation target = group(FRIEND, LEAVER);
    String photo = upload(OWNER);
    var sent =
        messageService.sendMessage(OWNER, new SendMessageRequest(src.getId(), url(photo), "image"));

    messageService.forwardMessage(FRIEND, sent.id(), target.getId());

    assertThat(refsOf(photo)).containsExactly(conv(src.getId()), conv(target.getId()));
    assertThat(policy.canRead(file(photo), LEAVER)).isTrue();
  }

  @Test
  void edit_does_not_attach_file_editor_cannot_read() {
    Conversation c = group(LEAVER, FRIEND);
    String foreign = upload(OWNER);
    var sent = messageService.sendMessage(LEAVER, new SendMessageRequest(c.getId(), "hi", "text"));

    messageService.editMessage(LEAVER, sent.id(), "look " + url(foreign));

    assertThat(refsOf(foreign)).isEmpty();
  }

  @Test
  void ai_reply_attaches_only_files_prompting_user_can_read() {
    Conversation c = group(FRIEND, LEAVER);
    String foreign = upload(OWNER);
    String own = upload(FRIEND);

    aiMessageService.persistAiMessage(
        c.getId(), "see " + url(foreign) + " and " + url(own), null, null, "r-1", null, FRIEND);

    assertThat(refsOf(foreign)).isEmpty();
    assertThat(refsOf(own)).containsExactly(conv(c.getId()));
  }

  @Test
  void reminder_echoing_foreign_upload_does_not_attach() {
    Conversation c = group(LEAVER, FRIEND);
    String foreign = upload(OWNER);

    // ReminderSweepService passes reminder.getUserId() as the actor.
    aiMessageService.saveAiMessage(c.getId(), "🔔 " + url(foreign), null, LEAVER);

    assertThat(refsOf(foreign)).isEmpty();
    assertThat(policy.canRead(file(foreign), LEAVER)).isFalse();
  }

  @Test
  void ai_write_without_actor_attaches_nothing() {
    Conversation c = group(FRIEND, LEAVER);
    String foreign = upload(OWNER);

    aiMessageService.saveMeetingSummary(c.getId(), "{\"t\":\"" + url(foreign) + "\"}");
    aiMessageService.persistAiMessage(c.getId(), url(foreign), null);

    assertThat(refsOf(foreign)).isEmpty();
  }

  @Test
  void persona_avatar_attaches_conversation_ref_only_if_actor_can_read() {
    Conversation c = group(LEAVER, FRIEND); // LEAVER is admin
    String foreign = upload(OWNER);
    String own = upload(LEAVER);
    var controller = new AiPersonaController(aiPersonaRepository, conversationRepository, refs);
    java.security.Principal me = () -> LEAVER;

    controller.upsertPersona(c.getId(), new AiPersonaRequest(null, url(foreign), null, null), me);
    assertThat(refsOf(foreign)).isEmpty();
    assertThat(policy.canRead(file(foreign), FRIEND)).isFalse();

    controller.upsertPersona(c.getId(), new AiPersonaRequest(null, url(own), null, null), me);
    assertThat(refsOf(own)).containsExactly(conv(c.getId()));
    assertThat(policy.canRead(file(own), FRIEND)).isTrue();
  }

  @Test
  void conversation_avatar_with_unreadable_id_attaches_no_ref() {
    Conversation c = group(LEAVER, FRIEND);
    String foreign = upload(OWNER);
    String own = upload(LEAVER);

    conversationService.updateGroup(LEAVER, c.getId(), null, url(foreign));
    conversationService.setWallpaper(LEAVER, c.getId(), url(foreign));
    assertThat(refsOf(foreign)).isEmpty();

    conversationService.updateGroup(LEAVER, c.getId(), null, url(own));
    assertThat(refsOf(own)).containsExactly(conv(c.getId()));
  }
}
