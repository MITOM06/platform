package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.chatservice.exception.BadRequestException;
import com.platform.chatservice.exception.ConversationNotFoundException;
import com.platform.chatservice.exception.ErrorCodes;
import com.platform.chatservice.exception.ForbiddenException;
import com.platform.chatservice.exception.MessageNotFoundException;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.model.Message;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.MessageRepository;
import com.platform.chatservice.repository.UserBlockRepository;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

class MessageServiceHelperTest {

  private static final String ALICE = "64b000000000000000000001";
  private static final String BOB = "64b000000000000000000002";
  private static final String CAROL = "64b000000000000000000003";

  private final MessageRepository messages = mock(MessageRepository.class);
  private final ConversationRepository conversations = mock(ConversationRepository.class);
  private final UserBlockRepository blocks = mock(UserBlockRepository.class);
  private final MongoTemplate mongo = mock(MongoTemplate.class);
  private final MessageServiceHelper helper =
      new MessageServiceHelper(messages, conversations, blocks, mongo);

  // --- blocking ---------------------------------------------------------------

  @Test
  void blockIsSymmetric() {
    when(blocks.existsByBlockerIdAndBlockedId(BOB, ALICE)).thenReturn(true);
    assertThat(helper.isBlockedBetween(ALICE, BOB)).isTrue();
    assertThat(helper.isBlockedBetween(BOB, ALICE)).isTrue();
    assertThat(helper.isBlockedBetween(ALICE, CAROL)).isFalse();
  }

  // --- requireParticipantMessage --------------------------------------------

  @Test
  void participantGetsTheMessage() {
    Message m = Message.builder().id("m1").conversationId("c1").build();
    when(messages.findById("m1")).thenReturn(Optional.of(m));
    when(conversations.findById("c1"))
        .thenReturn(
            Optional.of(Conversation.builder().id("c1").participants(List.of(ALICE)).build()));
    assertThat(helper.requireParticipantMessage(ALICE, "m1")).isSameAs(m);
  }

  @Test
  void nonParticipantIsForbidden() {
    when(messages.findById("m1"))
        .thenReturn(Optional.of(Message.builder().id("m1").conversationId("c1").build()));
    when(conversations.findById("c1"))
        .thenReturn(
            Optional.of(Conversation.builder().id("c1").participants(List.of(ALICE)).build()));
    assertThatThrownBy(() -> helper.requireParticipantMessage(BOB, "m1"))
        .isInstanceOf(ForbiddenException.class);
  }

  @Test
  void missingMessageOrConversationIsNotFound() {
    when(messages.findById("nope")).thenReturn(Optional.empty());
    assertThatThrownBy(() -> helper.requireParticipantMessage(ALICE, "nope"))
        .isInstanceOf(MessageNotFoundException.class);

    when(messages.findById("m1"))
        .thenReturn(Optional.of(Message.builder().id("m1").conversationId("gone").build()));
    when(conversations.findById("gone")).thenReturn(Optional.empty());
    assertThatThrownBy(() -> helper.requireParticipantMessage(ALICE, "m1"))
        .isInstanceOf(ConversationNotFoundException.class);
  }

  // --- buildReplyPreview -----------------------------------------------------

  @Test
  void replyPreviewIsNullWithoutTarget() {
    assertThat(helper.buildReplyPreview(null, "c1")).isNull();
    assertThat(helper.buildReplyPreview("  ", "c1")).isNull();
    verify(messages, never()).findById(any());
  }

  @Test
  void replyPreviewSnapshotsTargetInSameConversation() {
    when(messages.findById("t"))
        .thenReturn(
            Optional.of(
                Message.builder()
                    .id("t")
                    .conversationId("c1")
                    .senderId(BOB)
                    .content("hi")
                    .build()));
    Message.ReplyPreview p = helper.buildReplyPreview("t", "c1");
    assertThat(p.getMessageId()).isEqualTo("t");
    assertThat(p.getSenderId()).isEqualTo(BOB);
    assertThat(p.getContent()).isEqualTo("hi");
    assertThat(p.isRecalled()).isFalse();
  }

  @Test
  void replyPreviewTruncatesLongContentTo80Chars() {
    String longText = "x".repeat(81);
    when(messages.findById("t"))
        .thenReturn(
            Optional.of(Message.builder().id("t").conversationId("c1").content(longText).build()));
    assertThat(helper.buildReplyPreview("t", "c1").getContent()).isEqualTo("x".repeat(80) + "…");

    when(messages.findById("t80"))
        .thenReturn(
            Optional.of(
                Message.builder().id("t80").conversationId("c1").content("y".repeat(80)).build()));
    assertThat(helper.buildReplyPreview("t80", "c1").getContent()).isEqualTo("y".repeat(80));

    when(messages.findById("tn"))
        .thenReturn(Optional.of(Message.builder().id("tn").conversationId("c1").build()));
    assertThat(helper.buildReplyPreview("tn", "c1").getContent()).isEmpty();
  }

  @Test
  void replyPreviewOfRecalledMessageLeaksNoContent() {
    when(messages.findById("t"))
        .thenReturn(
            Optional.of(
                Message.builder()
                    .id("t")
                    .conversationId("c1")
                    .content("secret")
                    .recalled(true)
                    .build()));
    Message.ReplyPreview p = helper.buildReplyPreview("t", "c1");
    assertThat(p.getContent()).isEmpty();
    assertThat(p.isRecalled()).isTrue();
  }

  @Test
  void replyToMessageOfAnotherConversationIsRejected() {
    when(messages.findById("t"))
        .thenReturn(
            Optional.of(
                Message.builder().id("t").conversationId("private").content("secret").build()));
    for (String conv : new String[] {"c1", null}) {
      assertThatThrownBy(() -> helper.buildReplyPreview("t", conv))
          .isInstanceOfSatisfying(
              BadRequestException.class,
              e -> assertThat(e.getCode()).isEqualTo(ErrorCodes.REPLY_TARGET_INVALID));
    }
    when(messages.findById("missing")).thenReturn(Optional.empty());
    assertThatThrownBy(() -> helper.buildReplyPreview("missing", "c1"))
        .isInstanceOf(BadRequestException.class);
  }

  // --- mentions --------------------------------------------------------------

  private void userName(String id, String name) {
    when(mongo.findOne(
            org.mockito.ArgumentMatchers.argThat(
                (Query q) -> q != null && new ObjectId(id).equals(q.getQueryObject().get("_id"))),
            eq(Document.class),
            eq("users")))
        .thenReturn(name == null ? null : new Document("displayName", name));
  }

  @Test
  void mentionsMatchDisplayNamesCaseInsensitivelyAndSkipSender() {
    userName(ALICE, "Alice");
    userName(BOB, "Bob Tran");
    userName(CAROL, "Carol");
    List<String> mentioned =
        helper.parseMentions("hey @bob tran and @ALICE", List.of(ALICE, BOB, CAROL), ALICE);
    assertThat(mentioned).containsExactly(BOB);
  }

  @Test
  void mentionsShortCircuitWithoutAtSignOrParticipants() {
    assertThat(helper.parseMentions(null, List.of(BOB), ALICE)).isEmpty();
    assertThat(helper.parseMentions("no mention", List.of(BOB), ALICE)).isEmpty();
    assertThat(helper.parseMentions("@x", null, ALICE)).isEmpty();
    assertThat(helper.parseMentions("@alice", List.of(ALICE), ALICE)).isEmpty();
    verify(mongo, never()).findOne(any(Query.class), eq(Document.class), eq("users"));
  }

  @Test
  void mentionsIgnoreUsersWithoutNameOrInvalidIds() {
    userName(BOB, null);
    userName(CAROL, " ");
    assertThat(helper.parseMentions("@ @bot", List.of(ALICE, BOB, CAROL, "bot"), ALICE)).isEmpty();
  }

  @Test
  void lookupDisplayNameReturnsNullOnError() {
    assertThat(helper.lookupDisplayName("not-an-object-id")).isNull();
    when(mongo.findOne(any(Query.class), eq(Document.class), eq("users")))
        .thenThrow(new RuntimeException("down"));
    assertThat(helper.lookupDisplayName(ALICE)).isNull();
  }

  // --- lookupDisplayNames ----------------------------------------------------

  @Test
  void bulkLookupResolvesOnlyValidIdsWithNames() {
    when(mongo.find(any(Query.class), eq(Document.class), eq("users")))
        .thenReturn(
            List.of(
                new Document("_id", new ObjectId(ALICE)).append("displayName", "Alice"),
                new Document("_id", new ObjectId(BOB)).append("displayName", " "),
                new Document("displayName", "NoId")));
    Map<String, String> names =
        helper.lookupDisplayNames(Arrays.asList(ALICE, BOB, ALICE, "system", null));
    assertThat(names).containsExactly(Map.entry(ALICE, "Alice"));
  }

  @Test
  void bulkLookupSkipsQueryForEmptyOrNonObjectIdsAndFailsSoft() {
    assertThat(helper.lookupDisplayNames(null)).isEmpty();
    assertThat(helper.lookupDisplayNames(List.of())).isEmpty();
    assertThat(helper.lookupDisplayNames(List.of("extbot:1", "system"))).isEmpty();
    verify(mongo, never()).find(any(Query.class), eq(Document.class), eq("users"));

    when(mongo.find(any(Query.class), eq(Document.class), eq("users")))
        .thenThrow(new RuntimeException("down"));
    assertThat(helper.lookupDisplayNames(List.of(ALICE))).isEmpty();
  }
}
