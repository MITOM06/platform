package com.platform.chatservice.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import com.platform.chatservice.dto.AiMemoryResponse;
import com.platform.chatservice.model.AiMemory;
import com.platform.chatservice.repository.AiMemoryRepository;
import java.security.Principal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AiMemoryControllerTest {

  @Mock private AiMemoryRepository aiMemoryRepository;

  @Mock private Principal principal;

  @InjectMocks private AiMemoryController controller;

  private static final String USER_ID = "user-001";
  private static final String CONV_ID = "conv-001";

  private AiMemory memory;

  @BeforeEach
  void setUp() {
    when(principal.getName()).thenReturn(USER_ID);
    memory =
        AiMemory.builder()
            .id("mem-1")
            .conversationId(CONV_ID)
            .userId(USER_ID)
            .summary("The user discussed Flutter and Redis.")
            .keyFacts(List.of("Uses Flutter", "Uses Redis"))
            .messageCount(20)
            .updatedAt(Instant.now())
            .build();
  }

  @Test
  void getMyMemories_aggregatesAllConversationsIntoOnePerUserMemory() {
    AiMemory older =
        AiMemory.builder()
            .id("mem-a")
            .conversationId("cA")
            .userId(USER_ID)
            .summary("older")
            .keyFacts(List.of("Name is Khang", "Likes Flutter"))
            .messageCount(3)
            .updatedAt(Instant.ofEpochSecond(100))
            .build();
    AiMemory newest =
        AiMemory.builder()
            .id("mem-b")
            .conversationId("cB")
            .userId(USER_ID)
            .summary("newest")
            .keyFacts(List.of("Likes Flutter", "Works on PON"))
            .messageCount(5)
            .updatedAt(Instant.ofEpochSecond(200))
            .build();
    when(aiMemoryRepository.findByUserId(USER_ID)).thenReturn(List.of(older, newest));

    ResponseEntity<AiMemoryResponse> response = controller.getMyMemories(principal);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    AiMemoryResponse body = response.getBody();
    assertThat(body).isNotNull();
    // Most-recent conversation first (cB), union deduped preserving each doc's order.
    assertThat(body.keyFacts()).containsExactly("Likes Flutter", "Works on PON", "Name is Khang");
    assertThat(body.summary()).isEqualTo("newest");
    assertThat(body.messageCount()).isEqualTo(8);
    assertThat(body.conversationId()).isNull();
    verify(aiMemoryRepository).findByUserId(USER_ID);
  }

  @Test
  void getMyMemories_returnsEmptyAggregateWhenNoMemories() {
    when(aiMemoryRepository.findByUserId(USER_ID)).thenReturn(List.of());

    ResponseEntity<AiMemoryResponse> response = controller.getMyMemories(principal);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    AiMemoryResponse body = response.getBody();
    assertThat(body).isNotNull();
    assertThat(body.keyFacts()).isEmpty();
    assertThat(body.summary()).isEmpty();
    assertThat(body.messageCount()).isZero();
  }

  @Test
  void getConversationMemory_ReturnsMemoryForOwner() {
    when(aiMemoryRepository.findByConversationId(CONV_ID)).thenReturn(Optional.of(memory));

    ResponseEntity<AiMemoryResponse> response =
        controller.getConversationMemory(CONV_ID, principal);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(response.getBody()).isNotNull();
    assertThat(response.getBody().conversationId()).isEqualTo(CONV_ID);
  }

  @Test
  void getConversationMemory_ReturnsNotFoundForWrongUser() {
    AiMemory otherMemory =
        AiMemory.builder()
            .id("mem-2")
            .conversationId(CONV_ID)
            .userId("other-user")
            .summary("Other")
            .keyFacts(List.of())
            .messageCount(5)
            .updatedAt(Instant.now())
            .build();
    when(aiMemoryRepository.findByConversationId(CONV_ID)).thenReturn(Optional.of(otherMemory));

    ResponseEntity<AiMemoryResponse> response =
        controller.getConversationMemory(CONV_ID, principal);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
  }

  @Test
  void deleteMemory_Returns204AndDeletesWhenOwner() {
    when(aiMemoryRepository.findByConversationId(CONV_ID)).thenReturn(Optional.of(memory));

    ResponseEntity<Void> response = controller.deleteMemory(CONV_ID, principal);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    verify(aiMemoryRepository).deleteByConversationId(CONV_ID);
  }

  @Test
  void deleteMemory_Returns403WhenNotOwner() {
    AiMemory otherMemory =
        AiMemory.builder()
            .id("mem-2")
            .conversationId(CONV_ID)
            .userId("other-user")
            .summary("Other")
            .keyFacts(List.of())
            .messageCount(5)
            .updatedAt(Instant.now())
            .build();
    when(aiMemoryRepository.findByConversationId(CONV_ID)).thenReturn(Optional.of(otherMemory));

    ResponseEntity<Void> response = controller.deleteMemory(CONV_ID, principal);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    verify(aiMemoryRepository, never()).deleteByConversationId(any());
  }

  @Test
  void deleteMemory_Returns404WhenNotFound() {
    when(aiMemoryRepository.findByConversationId(CONV_ID)).thenReturn(Optional.empty());

    ResponseEntity<Void> response = controller.deleteMemory(CONV_ID, principal);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
  }
}
