package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

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
    org.mockito.ArgumentCaptor<org.springframework.data.mongodb.core.query.Query> query =
        org.mockito.ArgumentCaptor.forClass(
            org.springframework.data.mongodb.core.query.Query.class);
    when(mongoTemplate.find(query.capture(), eq(Conversation.class)))
        .thenReturn(List.of(conversation));
    when(mongoTemplate.count(
            any(org.springframework.data.mongodb.core.query.Query.class), eq(Conversation.class)))
        .thenReturn(1L);

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
    // Filters are part of the query (they used to be applied after paging).
    String json = query.getValue().getQueryObject().toJson();
    assertThat(json).contains("hiddenFor").contains("blockedBy").contains("archivedBy");
    assertThat(query.getValue().getLimit()).isEqualTo(20);
  }

  @Test
  void listConversations_Archived_SelectsOnlyArchived() {
    org.mockito.ArgumentCaptor<org.springframework.data.mongodb.core.query.Query> query =
        org.mockito.ArgumentCaptor.forClass(
            org.springframework.data.mongodb.core.query.Query.class);
    when(mongoTemplate.find(query.capture(), eq(Conversation.class))).thenReturn(List.of());

    conversationQueryService.listConversations(USER_ID, PageRequest.of(1, 10), true);

    Document q = query.getValue().getQueryObject();
    assertThat(q.get("archivedBy")).isEqualTo(USER_ID);
    assertThat(query.getValue().getSkip()).isEqualTo(10L);
  }

  @Test
  @SuppressWarnings("unchecked")
  void listConversations_WhenEmpty_ShouldReturnEmptyPage() {
    var pageable = PageRequest.of(0, 20);
    when(mongoTemplate.find(
            any(org.springframework.data.mongodb.core.query.Query.class), eq(Conversation.class)))
        .thenReturn(List.of());

    PageResponse<ConversationResponse> result =
        conversationQueryService.listConversations(USER_ID, pageable);

    assertThat(result.content()).isEmpty();
    verify(mongoTemplate, never())
        .aggregate(any(Aggregation.class), anyString(), eq(Document.class));
  }

  @Test
  void listPublicChannels_QuotesTheSearchTerm() {
    when(conversationRepository.findPublicGroupsByName(anyString(), any()))
        .thenReturn(new PageImpl<>(List.of()));

    conversationQueryService.listPublicChannels(".*(a+)+$", PageRequest.of(0, 20));

    verify(conversationRepository)
        .findPublicGroupsByName(eq(java.util.regex.Pattern.quote(".*(a+)+$")), any());
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
