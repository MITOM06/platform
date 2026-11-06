package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.ConversationResponse;
import com.platform.chatservice.exception.BadRequestException;
import com.platform.chatservice.exception.ConversationNotFoundException;
import com.platform.chatservice.exception.ErrorCodes;
import com.platform.chatservice.model.AiPersona;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.repository.AiPersonaRepository;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.MessageRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.UpdateDefinition;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AiThreadServiceTest {

  private static final String ME = "user-001";
  private static final String BOT = AiConstants.AI_BOT_USER_ID;

  @Mock private ConversationRepository conversationRepository;
  @Mock private ConversationCacheService cache;
  @Mock private AiPersonaRepository personaRepository;
  @Mock private MongoTemplate mongoTemplate;
  @Mock private MessageRepository messageRepository;
  @Mock private ConversationEventPublisher events;

  private AiThreadService service;
  private final AtomicInteger seq = new AtomicInteger();

  @BeforeEach
  void setUp() {
    ConversationWriteSupport support =
        new ConversationWriteSupport(
            cache, mongoTemplate, messageRepository, new ConversationMapper(messageRepository));
    service =
        new AiThreadService(conversationRepository, cache, personaRepository, support, events);
    when(cache.save(any(Conversation.class)))
        .thenAnswer(
            inv -> {
              Conversation c = inv.getArgument(0);
              c.setId("new-" + seq.incrementAndGet());
              return c;
            });
    when(conversationRepository.findTwoMemberNonGroupConversations(any())).thenReturn(List.of());
  }

  private static Conversation thread(String id, Instant lastAt, Instant createdAt) {
    return Conversation.builder()
        .id(id)
        .type("direct")
        .participants(List.of(ME, BOT))
        .lastMessageAt(lastAt)
        .createdAt(createdAt)
        .hiddenFor(new ArrayList<>())
        .build();
  }

  @Test
  void create_makesNewConversationEvenWhenOneExists() {
    when(conversationRepository.findTwoMemberNonGroupConversations(List.of(ME, BOT)))
        .thenReturn(List.of(thread("old", null, Instant.now())));

    ConversationResponse a = service.create(ME);
    ConversationResponse b = service.create(ME);

    assertThat(a.id()).isNotEqualTo(b.id());
    for (ConversationResponse r : List.of(a, b)) {
      assertThat(r.participants()).containsExactly(ME, BOT);
      assertThat(r.status()).isEqualTo("accepted");
      assertThat(r.type()).isEqualTo("direct");
      assertThat(r.name()).isNull();
    }
  }

  @Test
  void create_copiesPersonaFromMostRecentThread() {
    Instant now = Instant.now();
    when(conversationRepository.findTwoMemberNonGroupConversations(List.of(ME, BOT)))
        .thenReturn(
            List.of(
                thread("stale", now.minusSeconds(500), now.minusSeconds(900)),
                thread("fresh", now.minusSeconds(5), now.minusSeconds(800)),
                thread("empty", null, now.minusSeconds(700))));
    AiPersona persona =
        AiPersona.builder()
            .id("p1")
            .conversationId("fresh")
            .name("Jarvis")
            .tone("formal")
            .avatarUrl("/a.png")
            .systemPromptPrefix("Be brief")
            .build();
    when(personaRepository.findByConversationId("fresh")).thenReturn(Optional.of(persona));

    ConversationResponse created = service.create(ME);

    ArgumentCaptor<AiPersona> saved = ArgumentCaptor.forClass(AiPersona.class);
    verify(personaRepository).save(saved.capture());
    AiPersona copy = saved.getValue();
    assertThat(copy.getId()).isNull();
    assertThat(copy.getConversationId()).isEqualTo(created.id());
    assertThat(copy.getName()).isEqualTo("Jarvis");
    assertThat(copy.getTone()).isEqualTo("formal");
    assertThat(copy.getSystemPromptPrefix()).isEqualTo("Be brief");
    assertThat(copy.getAvatarUrl()).isEqualTo("/a.png");
  }

  @Test
  void create_withoutAnyThreadOrPersona_savesNoPersona() {
    service.create(ME);
    when(conversationRepository.findTwoMemberNonGroupConversations(List.of(ME, BOT)))
        .thenReturn(List.of(thread("t", null, Instant.now())));
    service.create(ME); // latest thread has no persona
    verify(personaRepository, never()).save(any(AiPersona.class));
  }

  @Test
  void list_returnsOnlyCallersAiThreads_newestFirst_skipsDeleted() {
    Instant now = Instant.now();
    Conversation older = thread("older", now.minusSeconds(100), now.minusSeconds(900));
    Conversation newest = thread("newest", now.minusSeconds(1), now.minusSeconds(800));
    Conversation noMessages = thread("fresh", null, now.minusSeconds(50));
    Conversation deleted = thread("deleted", now, now);
    deleted.setHiddenFor(new ArrayList<>(List.of(ME)));
    Conversation blocked = thread("blocked", now, now);
    blocked.setBlockedBy(new ArrayList<>(List.of(ME)));
    // The repository query is already scoped to [me, bot] direct chats, so another user's thread
    // and human DMs never come back; assert the exact query used.
    when(conversationRepository.findTwoMemberNonGroupConversations(List.of(ME, BOT)))
        .thenReturn(List.of(older, deleted, noMessages, newest, blocked));

    List<ConversationResponse> result = service.list(ME);

    assertThat(result)
        .extracting(ConversationResponse::id)
        .containsExactly("newest", "fresh", "older");
    verify(conversationRepository).findTwoMemberNonGroupConversations(List.of(ME, BOT));
  }

  @Test
  void list_includesLegacyAiConversationWithNoTypeField() {
    Instant now = Instant.now();
    Conversation legacy = thread("legacy", now, now);
    legacy.setType(null);
    when(conversationRepository.findTwoMemberNonGroupConversations(List.of(ME, BOT)))
        .thenReturn(List.of(legacy));

    assertThat(service.list(ME)).extracting(ConversationResponse::id).containsExactly("legacy");
  }

  private void updateReturns(Conversation c) {
    when(mongoTemplate.findAndModify(
            any(),
            any(UpdateDefinition.class),
            any(FindAndModifyOptions.class),
            eq(Conversation.class)))
        .thenReturn(c);
  }

  @Test
  void rename_rejectsBlankAndTooLong_andForeignThread() {
    when(cache.findByIdOptional("mine"))
        .thenReturn(Optional.of(thread("mine", null, Instant.now())));
    Conversation foreign =
        Conversation.builder()
            .id("foreign")
            .type("direct")
            .participants(List.of("other", BOT))
            .build();
    when(cache.findByIdOptional("foreign")).thenReturn(Optional.of(foreign));
    Conversation humanDm =
        Conversation.builder()
            .id("dm")
            .type("direct")
            .participants(List.of(ME, "user-002"))
            .build();
    when(cache.findByIdOptional("dm")).thenReturn(Optional.of(humanDm));

    assertThatThrownBy(() -> service.rename(ME, "mine", "   "))
        .isInstanceOfSatisfying(
            BadRequestException.class,
            e -> assertThat(e.getCode()).isEqualTo(ErrorCodes.AI_THREAD_NAME_INVALID));
    assertThatThrownBy(() -> service.rename(ME, "mine", null))
        .isInstanceOf(BadRequestException.class);
    assertThatThrownBy(() -> service.rename(ME, "mine", "x".repeat(81)))
        .isInstanceOfSatisfying(
            BadRequestException.class,
            e -> assertThat(e.getCode()).isEqualTo(ErrorCodes.AI_THREAD_NAME_INVALID));
    assertThatThrownBy(() -> service.rename(ME, "foreign", "ok"))
        .isInstanceOf(ConversationNotFoundException.class);
    assertThatThrownBy(() -> service.rename(ME, "dm", "ok"))
        .isInstanceOf(ConversationNotFoundException.class);
  }

  @Test
  void rename_trimsAndPersists() {
    Conversation t = thread("mine", null, Instant.now());
    when(cache.findByIdOptional("mine")).thenReturn(Optional.of(t));
    Conversation renamed = thread("mine", null, Instant.now());
    renamed.setName("Plan");
    updateReturns(renamed);

    ConversationResponse r = service.rename(ME, "mine", "  Plan ");

    assertThat(r.name()).isEqualTo("Plan");
    ArgumentCaptor<UpdateDefinition> u = ArgumentCaptor.forClass(UpdateDefinition.class);
    verify(mongoTemplate)
        .findAndModify(any(), u.capture(), any(FindAndModifyOptions.class), eq(Conversation.class));
    assertThat(u.getValue().getUpdateObject().toJson()).contains("\"name\": \"Plan\"");
  }

  private String autoTitleWrites(Conversation c, String text) {
    Conversation after = thread(c.getId(), null, Instant.now());
    updateReturns(after);
    service.maybeAutoTitle(c, text);
    ArgumentCaptor<UpdateDefinition> u = ArgumentCaptor.forClass(UpdateDefinition.class);
    verify(mongoTemplate)
        .findAndModify(any(), u.capture(), any(FindAndModifyOptions.class), eq(Conversation.class));
    return u.getValue().getUpdateObject().toJson();
  }

  @Test
  void autoTitle_setsFirst60Chars_once() {
    assertThat(autoTitleWrites(thread("t1", null, Instant.now()), "  Xin chào\n bạn  "))
        .contains("\"name\": \"Xin chào bạn\"");
  }

  @Test
  void autoTitle_cutsLongTextTo59CharsPlusEllipsis() {
    String json = autoTitleWrites(thread("t2", null, Instant.now()), "a".repeat(70));
    assertThat(json).contains("\"name\": \"" + "a".repeat(59) + "…\"");
  }

  @Test
  void autoTitle_neverOverwrites_andIgnoresNonAiConversations() {
    Conversation named = thread("t3", null, Instant.now());
    named.setName("My title");
    service.maybeAutoTitle(named, "second message");

    Conversation group =
        Conversation.builder().id("g").type("group").participants(List.of(ME, BOT)).build();
    service.maybeAutoTitle(group, "hello");

    Conversation threeWay =
        Conversation.builder().id("x").type("direct").participants(List.of(ME, "u2", BOT)).build();
    service.maybeAutoTitle(threeWay, "hello");

    service.maybeAutoTitle(thread("t4", null, Instant.now()), "   ");

    verify(mongoTemplate, never())
        .findAndModify(
            any(),
            any(UpdateDefinition.class),
            any(FindAndModifyOptions.class),
            eq(Conversation.class));
  }

  @Test
  void autoTitle_publishesSharedEventOnlyWhenTitled() {
    Conversation c = thread("t5", null, Instant.now());
    updateReturns(null); // a concurrent rename already won the guarded write
    service.maybeAutoTitle(c, "hi");
    verify(events, never()).publishShared(any(ConversationResponse.class));

    updateReturns(thread("t5", null, Instant.now()));
    service.maybeAutoTitle(c, "hi");
    verify(events).publishShared(any(ConversationResponse.class));
  }
}
