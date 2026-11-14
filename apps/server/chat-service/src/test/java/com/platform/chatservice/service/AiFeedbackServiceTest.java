package com.platform.chatservice.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.AiFeedbackRequest;
import com.platform.chatservice.dto.AiFeedbackResponse;
import com.platform.chatservice.exception.MessageNotFoundException;
import com.platform.chatservice.model.AiFeedback;
import com.platform.chatservice.model.Message;
import com.platform.chatservice.repository.AiFeedbackRepository;
import com.platform.chatservice.repository.MessageRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class AiFeedbackServiceTest {

  private AiFeedbackRepository feedbackRepo;
  private MessageRepository messageRepo;
  private AiFeedbackService service;

  @BeforeEach
  void setUp() {
    feedbackRepo = mock(AiFeedbackRepository.class);
    messageRepo = mock(MessageRepository.class);
    service = new AiFeedbackService(feedbackRepo, messageRepo);
    when(feedbackRepo.save(any(AiFeedback.class))).thenAnswer(inv -> inv.getArgument(0));
  }

  private void messageExists() {
    when(messageRepo.findById("m1"))
        .thenReturn(Optional.of(Message.builder().id("m1").conversationId("c1").build()));
  }

  @Test
  void submitFeedback_unknownMessage_throwsAndTouchesNothing() {
    when(messageRepo.findById("missing")).thenReturn(Optional.empty());

    assertThrows(
        MessageNotFoundException.class,
        () -> service.submitFeedback("u1", "missing", new AiFeedbackRequest("up", null)));
    verify(feedbackRepo, never()).save(any());
    verify(feedbackRepo, never()).deleteByUserIdAndMessageId(any(), any());
  }

  @Test
  void submitFeedback_noneOrNullRating_deletesVote() {
    messageExists();

    AiFeedbackResponse r1 = service.submitFeedback("u1", "m1", new AiFeedbackRequest("NONE", "x"));
    AiFeedbackResponse r2 = service.submitFeedback("u1", "m1", new AiFeedbackRequest(null, null));

    assertEquals(new AiFeedbackResponse("none", null), r1);
    assertEquals(new AiFeedbackResponse("none", null), r2);
    verify(feedbackRepo, org.mockito.Mockito.times(2)).deleteByUserIdAndMessageId("u1", "m1");
    verify(feedbackRepo, never()).save(any());
  }

  @Test
  void submitFeedback_firstVote_createsDocumentForUserAndMessage() {
    messageExists();
    when(feedbackRepo.findByUserIdAndMessageId("u1", "m1")).thenReturn(Optional.empty());

    AiFeedbackResponse r =
        service.submitFeedback("u1", "m1", new AiFeedbackRequest("up", "great answer"));

    assertEquals(new AiFeedbackResponse("up", "great answer"), r);
    ArgumentCaptor<AiFeedback> saved = ArgumentCaptor.forClass(AiFeedback.class);
    verify(feedbackRepo).save(saved.capture());
    assertEquals("u1", saved.getValue().getUserId());
    assertEquals("m1", saved.getValue().getMessageId());
    assertEquals("c1", saved.getValue().getConversationId());
    assertEquals("up", saved.getValue().getRating());
  }

  @Test
  void submitFeedback_existingVote_isUpdatedInPlace() {
    messageExists();
    AiFeedback existing =
        AiFeedback.builder()
            .id("f1")
            .userId("u1")
            .messageId("m1")
            .conversationId("stale")
            .rating("up")
            .comment("old")
            .build();
    when(feedbackRepo.findByUserIdAndMessageId("u1", "m1")).thenReturn(Optional.of(existing));

    AiFeedbackResponse r = service.submitFeedback("u1", "m1", new AiFeedbackRequest("down", null));

    assertEquals("down", r.rating());
    assertNull(r.comment());
    ArgumentCaptor<AiFeedback> saved = ArgumentCaptor.forClass(AiFeedback.class);
    verify(feedbackRepo).save(saved.capture());
    assertSame(existing, saved.getValue());
    assertEquals("f1", saved.getValue().getId());
    assertEquals("c1", saved.getValue().getConversationId());
  }
}
