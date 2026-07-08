package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.mockito.Mockito.verifyNoInteractions;

import com.platform.chatservice.dto.ConversationResponse;
import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.MessageRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;

/**
 * Unit tests for the read/list side of the conversation domain ({@link ConversationQueryService}).
 * Split out of {@code ConversationServiceTest} when the query methods (listing, participant lookup)
 * moved into their own service. A real {@link ConversationMapper} is wired over the mocked {@link
 * MessageRepository}.
 */
@ExtendWith(MockitoExtension.class)
class ConversationQueryServiceTest {

  @Mock private ConversationRepository conversationRepository;
  @Mock private ConversationCacheService conversationCacheService;
  @Mock private MessageRepository messageRepository;
  @Mock private MongoTemplate mongoTemplate;

  private ConversationQueryService conversationQueryService;

  private static final String USER_ID = "user-001";
  private static final String OTHER_ID = "user-002";
  private static final String CONV_ID = "conv-001";

  private Conversation conversation;

  @BeforeEach
  void setUp() {
    ConversationMapper conversationMapper = new ConversationMapper(messageRepository);
    conversationQueryService =
        new ConversationQueryService(
            conversationRepository, conversationCacheService, mongoTemplate, conversationMapper);

    conversation =
        Conversation.builder()
            .id(CONV_ID)
            .participants(List.of(USER_ID, OTHER_ID))
            .createdAt(Instant.now())
            .build();
  }

  @Test
  @SuppressWarnings("unchecked")
  void listConversations_ShouldReturnPagedResult() {
    var pageable = PageRequest.of(0, 20);
    when(conversationRepository.findByParticipantsContainingOrderByLastMessageAtDesc(
            USER_ID, pageable))
        .thenReturn(new PageImpl<>(List.of(conversation)));

    AggregationResults<Document> aggResults = mock(AggregationResults.class);
    when(aggResults.getMappedResults()).thenReturn(List.of());
    when(mongoTemplate.aggregate(any(Aggregation.class), eq("messages"), eq(Document.class)))
        .thenReturn(aggResults);

    PageResponse<ConversationResponse> result =
        conversationQueryService.listConversations(USER_ID, pageable);

    assertThat(result.content()).hasSize(1);
    assertThat(result.content().get(0).id()).isEqualTo(CONV_ID);
    assertThat(result.page()).isZero();
    assertThat(result.totalElements()).isEqualTo(1L);
  }

  @Test
  @SuppressWarnings("unchecked")
  void listConversations_WhenEmpty_ShouldReturnEmptyPage() {
    var pageable = PageRequest.of(0, 20);
    when(conversationRepository.findByParticipantsContainingOrderByLastMessageAtDesc(
            USER_ID, pageable))
        .thenReturn(new PageImpl<>(List.of()));

    PageResponse<ConversationResponse> result =
        conversationQueryService.listConversations(USER_ID, pageable);

    assertThat(result.content()).isEmpty();
    verifyNoInteractions(mongoTemplate);
  }

  @Test
  void getParticipants_ShouldReturnParticipantList() {
    when(conversationCacheService.findByIdOptional(CONV_ID)).thenReturn(Optional.of(conversation));

    List<String> participants = conversationQueryService.getParticipants(CONV_ID);

    assertThat(participants).containsExactlyInAnyOrder(USER_ID, OTHER_ID);
  }

  @Test
  void getParticipants_WhenNotFound_ShouldReturnEmptyList() {
    when(conversationCacheService.findByIdOptional(CONV_ID)).thenReturn(Optional.empty());

    List<String> participants = conversationQueryService.getParticipants(CONV_ID);

    assertThat(participants).isEmpty();
  }
}
