package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.Mockito.*;

import com.platform.chatservice.dto.ConversationResponse;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.model.Message;
import com.platform.chatservice.repository.MessageRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

/** Pinned-message previews: ONE batched lookup, pin order kept, unpinnable kinds filtered. */
class ConversationMapperTest {

  private static Message msg(String id, String type, boolean recalled) {
    return Message.builder()
        .id(id)
        .conversationId("c1")
        .senderId("u1")
        .content("text " + id)
        .type(type)
        .recalled(recalled)
        .build();
  }

  @Test
  void pinnedPreviews_areLoadedInOneQuery_inPinOrder_withoutRecalledOrSystem() {
    MessageRepository repository = mock(MessageRepository.class);
    // Repository returns them in a different order than pinned.
    when(repository.findAllById(anyIterable()))
        .thenReturn(
            List.of(
                msg("m3", "text", false),
                msg("m1", "image", false),
                msg("m2", "text", true),
                msg("m4", "system", false)));
    Conversation c =
        Conversation.builder()
            .id("c1")
            .participants(List.of("u1", "u2"))
            .pinnedMessages(new ArrayList<>(List.of("m1", "m2", "m3", "m4", "missing")))
            .build();

    ConversationResponse view = new ConversationMapper(repository).toResponse(c, "u1", 0L);

    assertThat(view.pinnedMessages())
        .extracting(ConversationResponse.PinnedMessageDto::id)
        .containsExactly("m1", "m3");
    verify(repository, times(1)).findAllById(anyIterable());
    verify(repository, never()).findById(org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void pinnedPreviews_areClampedToTheLimit() {
    MessageRepository repository = mock(MessageRepository.class);
    List<String> ids = IntStream.range(0, 7).mapToObj(i -> "m" + i).toList();
    when(repository.findAllById(anyIterable()))
        .thenReturn(ids.stream().map(id -> msg(id, "text", false)).toList());
    Conversation c =
        Conversation.builder()
            .id("c1")
            .participants(List.of("u1"))
            .pinnedMessages(new ArrayList<>(ids))
            .build();

    ConversationResponse view = new ConversationMapper(repository).toResponse(c, "u1", 0L);

    assertThat(view.pinnedMessages()).hasSize(MessageInteractionService.MAX_PINNED_MESSAGES);
  }

  @Test
  void noPins_needNoLookup() {
    MessageRepository repository = mock(MessageRepository.class);
    Conversation c = Conversation.builder().id("c1").participants(List.of("u1")).build();

    assertThat(new ConversationMapper(repository).toResponse(c, "u1", 0L).pinnedMessages())
        .isEmpty();
    verifyNoInteractions(repository);
  }
}
