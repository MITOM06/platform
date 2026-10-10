package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.model.Message;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.MessageRepository;
import java.time.Instant;
import java.util.List;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

/**
 * Bot / AI / reminder / meeting-summary messages must be broadcast through the CLUSTER broker: a
 * local SimpMessagingTemplate send only reached sockets on the instance that persisted them.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AiMessageServiceTest {

  @Mock private MessageRepository messageRepository;
  @Mock private ConversationRepository conversationRepository;
  @Mock private ClusterMessageBroker clusterBroker;
  @Mock private MongoTemplate mongoTemplate;
  @Mock private ConversationCacheService conversationCacheService;

  private AiMessageService service;

  @BeforeEach
  void setUp() {
    service =
        new AiMessageService(
            messageRepository,
            conversationRepository,
            clusterBroker,
            new MessageMapper(),
            mongoTemplate,
            conversationCacheService);
    when(messageRepository.save(any(Message.class)))
        .thenAnswer(
            inv -> {
              Message m = inv.getArgument(0);
              m.setId("msg-1");
              m.setCreatedAt(Instant.parse("2026-10-05T10:00:00Z"));
              return m;
            });
  }

  @Test
  void saveBotMessage_persistsWithGivenSender_andBroadcastsClusterWide() {
    MessageResponse response =
        service.saveBotMessage("conv-1", "extbot:bf-1", "Hello from the assistant");

    ArgumentCaptor<Message> captor = ArgumentCaptor.forClass(Message.class);
    verify(messageRepository).save(captor.capture());
    Message saved = captor.getValue();
    assertThat(saved.getConversationId()).isEqualTo("conv-1");
    assertThat(saved.getSenderId()).isEqualTo("extbot:bf-1");
    assertThat(saved.getType()).isEqualTo("ai");
    assertThat(saved.getContent()).isEqualTo("Hello from the assistant");
    verify(clusterBroker).convertAndSend("/topic/conversation/conv-1", response);
  }

  @Test
  void saveAiMessage_broadcastsClusterWide() {
    MessageResponse response = service.saveAiMessage("conv-1", "🔔 Standup", null);

    assertThat(response.senderId()).isEqualTo(AiConstants.AI_BOT_USER_ID);
    verify(clusterBroker).convertAndSend("/topic/conversation/conv-1", response);
  }

  /** The streaming path delivers the message itself, in one ordered batch with AI_STREAM_DONE. */
  @Test
  void persistAiMessage_doesNotBroadcast() {
    MessageResponse response = service.persistAiMessage("conv-1", "Full reply", null);

    assertThat(response.type()).isEqualTo("ai");
    verifyNoInteractions(clusterBroker);
  }

  @Test
  void saveMeetingSummary_broadcastsClusterWide_andReturnsTheId() {
    String id = service.saveMeetingSummary("conv-1", "{\"title\":\"Sync\"}");

    assertThat(id).isEqualTo("msg-1");
    verify(clusterBroker).convertAndSend(eq("/topic/conversation/conv-1"), any(Object.class));
  }

  @Test
  void persist_bumpsLastMessageWithIdAndType_andEvictsCache() {
    service.persistAiMessage("conv-1", "Full reply", null);

    ArgumentCaptor<Update> update = ArgumentCaptor.forClass(Update.class);
    verify(mongoTemplate).updateFirst(any(Query.class), update.capture(), eq(Conversation.class));
    Document set = update.getValue().getUpdateObject().get("$set", Document.class);
    Conversation.LastMessage last = (Conversation.LastMessage) set.get("lastMessage");
    assertThat(last.getMessageId()).isEqualTo("msg-1");
    assertThat(last.getType()).isEqualTo("ai");
    assertThat(last.getSenderId()).isEqualTo(AiConstants.AI_BOT_USER_ID);
    verify(conversationCacheService).evict("conv-1");
  }

  @Test
  void persistAiMessage_storesTheCitations_andReturnsThem() {
    List<com.platform.chatservice.model.AiSource> sources =
        List.of(
            new com.platform.chatservice.model.AiSource("doc-1", "policy.pdf", 0.8, null, null));

    MessageResponse response =
        service.persistAiMessage("conv-1", "Per [Source 1]…", null, null, "reply-1", sources);

    ArgumentCaptor<Message> captor = ArgumentCaptor.forClass(Message.class);
    verify(messageRepository).save(captor.capture());
    assertThat(captor.getValue().getSources()).isEqualTo(sources);
    assertThat(response.sources()).isEqualTo(sources);
  }

  @Test
  void persistAiMessage_withoutCitations_storesNone() {
    MessageResponse response = service.persistAiMessage("conv-1", "Hi", null);

    ArgumentCaptor<Message> captor = ArgumentCaptor.forClass(Message.class);
    verify(messageRepository).save(captor.capture());
    assertThat(captor.getValue().getSources()).isNull();
    assertThat(response.sources()).isNull();
  }
}
