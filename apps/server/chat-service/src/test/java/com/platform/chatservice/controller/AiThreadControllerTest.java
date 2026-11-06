package com.platform.chatservice.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.ConversationResponse;
import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.dto.RenameAiThreadRequest;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.MessageRepository;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.AiConstants;
import com.platform.chatservice.service.AiThreadService;
import com.platform.chatservice.service.ConversationCacheService;
import com.platform.chatservice.service.ConversationEventPublisher;
import com.platform.chatservice.service.ConversationMapper;
import com.platform.chatservice.service.ConversationQueryService;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.core.context.SecurityContextHolder;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AiThreadControllerTest {

  private static final String ME = "user-001";

  @Mock private AiThreadService aiThreadService;
  @Mock private ConversationEventPublisher events;
  @Mock private ConversationRepository conversationRepository;
  @Mock private ConversationCacheService cache;
  @Mock private MongoTemplate mongoTemplate;
  @Mock private MessageRepository messageRepository;

  @InjectMocks private AiThreadController controller;

  @BeforeEach
  void setUp() {
    SecurityContextHolder.getContext().setAuthentication(new UserPrincipal(ME));
  }

  @AfterEach
  void tearDown() {
    SecurityContextHolder.clearContext();
  }

  private static ConversationResponse view(String id) {
    return new ConversationResponse(
        id,
        "direct",
        null,
        null,
        List.of(ME, AiConstants.AI_BOT_USER_ID),
        null,
        ME,
        null,
        null,
        null,
        0L,
        Instant.now(),
        "accepted",
        false,
        List.of(),
        null,
        null,
        null,
        null,
        null,
        List.of(),
        null,
        null);
  }

  @Test
  void create_publishesToCreatorsOtherDevices() {
    ConversationResponse v = view("c1");
    when(aiThreadService.create(ME)).thenReturn(v);

    assertThat(controller.create()).isSameAs(v);
    verify(events).publishToUser(ME, v);
  }

  @Test
  void rename_broadcastsSharedUpdate() {
    ConversationResponse v = view("c1");
    when(aiThreadService.rename(ME, "c1", "Plan")).thenReturn(v);

    assertThat(controller.rename("c1", new RenameAiThreadRequest("Plan"))).isSameAs(v);
    verify(events).publishShared(v);
  }

  /** GET /api/conversations?excludeAi=... against the real query service (mocked Mongo). */
  private String listQueryJson(boolean excludeAi) {
    ConversationQueryService queries =
        new ConversationQueryService(
            conversationRepository,
            cache,
            mongoTemplate,
            new ConversationMapper(messageRepository));
    ArgumentCaptor<Query> q = ArgumentCaptor.forClass(Query.class);
    when(mongoTemplate.find(q.capture(), eq(Conversation.class))).thenReturn(List.of());
    when(mongoTemplate.count(any(Query.class), eq(Conversation.class))).thenReturn(0L);
    PageResponse<ConversationResponse> r =
        queries.listConversations(ME, PageRequest.of(0, 20), false, excludeAi);
    assertThat(r.content()).isEmpty();
    return q.getValue().getQueryObject().toJson();
  }

  @Test
  void listConversations_excludeAi_addsNorOnDirectBotChats() {
    assertThat(listQueryJson(true))
        .contains("$nor")
        .contains(AiConstants.AI_BOT_USER_ID)
        .contains("\"hiddenFor\"");
  }

  @Test
  void listConversations_withoutExcludeAi_hasNoBotFilter() {
    assertThat(listQueryJson(false))
        .doesNotContain("$nor")
        .doesNotContain(AiConstants.AI_BOT_USER_ID);
  }
}
