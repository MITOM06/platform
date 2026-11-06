package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.exception.ConversationNotFoundException;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.model.Message;
import com.platform.chatservice.repository.ConversationRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

/** Shared media / files / links gallery: members only, same visibility rules as the history. */
class AttachmentServiceTest {

  private static final String ME = "me";
  private static final String CONV = "c1";

  private final ConversationRepository conversations = mock(ConversationRepository.class);
  private final MongoTemplate mongo = mock(MongoTemplate.class);
  private final AttachmentService service =
      new AttachmentService(conversations, mongo, new MessageMapper());

  private void member(Map<String, Instant> clearedAt) {
    when(conversations.findById(CONV))
        .thenReturn(
            Optional.of(
                Conversation.builder()
                    .id(CONV)
                    .participants(List.of(ME, "other"))
                    .clearedAt(clearedAt)
                    .build()));
  }

  private Document runQuery(String type) {
    when(mongo.find(any(Query.class), eq(Message.class)))
        .thenReturn(List.of(Message.builder().id("m1").conversationId(CONV).type("image").build()));
    when(mongo.count(any(Query.class), eq(Message.class))).thenReturn(41L);
    PageResponse<MessageResponse> page =
        service.getSharedAttachments(ME, CONV, type, PageRequest.of(1, 20));
    assertThat(page.totalElements()).isEqualTo(41L);
    assertThat(page.page()).isEqualTo(1);
    assertThat(page.content()).extracting(MessageResponse::id).containsExactly("m1");
    ArgumentCaptor<Query> q = ArgumentCaptor.forClass(Query.class);
    verify(mongo).find(q.capture(), eq(Message.class));
    assertThat(q.getValue().getSkip()).isEqualTo(20);
    assertThat(q.getValue().getLimit()).isEqualTo(20);
    return q.getValue().getQueryObject();
  }

  @Test
  void nonMemberSeesNotFoundAndNoQueryRuns() {
    member(null);
    assertThatThrownBy(
            () -> service.getSharedAttachments("stranger", CONV, "media", PageRequest.of(0, 20)))
        .isInstanceOf(ConversationNotFoundException.class);
    when(conversations.findById("ghost")).thenReturn(Optional.empty());
    assertThatThrownBy(
            () -> service.getSharedAttachments(ME, "ghost", "media", PageRequest.of(0, 20)))
        .isInstanceOf(ConversationNotFoundException.class);
    verifyNoInteractions(mongo);
  }

  @Test
  void nullParticipantsIsNotFound() {
    when(conversations.findById(CONV))
        .thenReturn(Optional.of(Conversation.builder().id(CONV).build()));
    assertThatThrownBy(() -> service.getSharedAttachments(ME, CONV, "media", PageRequest.of(0, 20)))
        .isInstanceOf(ConversationNotFoundException.class);
  }

  @Test
  void mediaExcludesRecalledAndDeletedForMe() {
    member(null);
    Document q = runQuery("media");
    assertThat(q.get("conversationId")).isEqualTo(CONV);
    assertThat(q.get("recalled")).isEqualTo(new Document("$ne", true));
    assertThat(q.get("deletedFor")).isEqualTo(new Document("$ne", ME));
    assertThat(q.get("type")).isEqualTo(new Document("$in", List.of("image", "video")));
    assertThat(q.containsKey("createdAt")).isFalse();
  }

  @Test
  void unknownTypeFallsBackToMedia() {
    member(null);
    assertThat(runQuery("whatever").get("type"))
        .isEqualTo(new Document("$in", List.of("image", "video")));
  }

  @Test
  void filesAndLinks() {
    member(null);
    assertThat(runQuery("file").get("type")).isEqualTo("file");
  }

  @Test
  void linksAreTextMessagesWithAnHttpUrl() {
    member(null);
    Document q = runQuery("link");
    assertThat(q.get("type")).isEqualTo("text");
    Pattern p = (Pattern) q.get("content");
    assertThat(p.matcher("see HTTPS://x.io").find()).isTrue();
    assertThat(p.matcher("no link here").find()).isFalse();
  }

  @Test
  void historyClearedByMeHidesOlderAttachments() {
    Instant cleared = Instant.parse("2026-11-01T00:00:00Z");
    member(Map.of(ME, cleared, "other", Instant.parse("2026-11-05T00:00:00Z")));
    assertThat(runQuery("media").get("createdAt")).isEqualTo(new Document("$gt", cleared));
  }
}
