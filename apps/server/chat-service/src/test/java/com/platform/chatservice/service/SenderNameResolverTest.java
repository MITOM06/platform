package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.platform.chatservice.model.AiPersona;
import com.platform.chatservice.model.ExternalBot;
import com.platform.chatservice.repository.AiPersonaRepository;
import com.platform.chatservice.repository.ExternalBotRepository;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SenderNameResolverTest {

  private static final String CONV = "conv-1";
  private static final String ALICE = "64b7f0c2a1b2c3d4e5f60711";
  private static final String GHOST = "64b7f0c2a1b2c3d4e5f60799";

  @Mock private MessageServiceHelper helper;
  @Mock private AiPersonaRepository personas;
  @Mock private ExternalBotRepository bots;

  private SenderNameResolver resolver() {
    return new SenderNameResolver(helper, personas, bots);
  }

  @Test
  @SuppressWarnings("unchecked")
  void namesHumansInOneLookup_assistantsByPersonaOrRegistry_andNeverUsesIds() {
    when(helper.lookupDisplayNames(anyCollection())).thenReturn(Map.of(ALICE, "Alice"));
    when(personas.findByConversationId(CONV))
        .thenReturn(Optional.of(AiPersona.builder().conversationId(CONV).name("Lumi").build()));
    when(bots.findByBotUserId("extbot:b1"))
        .thenReturn(
            Optional.of(ExternalBot.builder().botUserId("extbot:b1").name("Jarvis").build()));
    when(bots.findByBotUserId("extbot:gone")).thenReturn(Optional.empty());

    Map<String, String> names =
        resolver()
            .displayNames(
                CONV,
                List.of(
                    ALICE, GHOST, ALICE, AiConstants.AI_BOT_USER_ID, "extbot:b1", "extbot:gone"));

    assertThat(names)
        .containsEntry(ALICE, "Alice")
        .containsEntry(AiConstants.AI_BOT_USER_ID, "Lumi")
        .containsEntry("extbot:b1", "Jarvis")
        .doesNotContainKeys(GHOST, "extbot:gone");
    ArgumentCaptor<Collection<String>> humans = ArgumentCaptor.forClass(Collection.class);
    verify(helper, times(1)).lookupDisplayNames(humans.capture());
    assertThat(humans.getValue()).containsExactlyInAnyOrder(ALICE, GHOST);
  }

  @Test
  void builtInAiWithoutPersona_usesTheDefaultName() {
    when(personas.findByConversationId(CONV)).thenReturn(Optional.empty());

    assertThat(resolver().displayNames(CONV, List.of(AiConstants.AI_BOT_USER_ID)))
        .containsEntry(AiConstants.AI_BOT_USER_ID, SenderNameResolver.DEFAULT_AI_NAME);
  }

  @Test
  void emptyInput_needsNoLookup() {
    assertThat(resolver().displayNames(CONV, List.of())).isEmpty();
    assertThat(resolver().displayNames(CONV, null)).isEmpty();
    verifyNoInteractions(helper, personas, bots);
  }

  // ---------------------------------------------------------------- batched users lookup

  @Mock private MongoTemplate mongoTemplate;

  @Test
  void lookupDisplayNames_isOneInQueryOverValidObjectIdsOnly() {
    MessageServiceHelper real = new MessageServiceHelper(null, null, null, mongoTemplate);
    when(mongoTemplate.find(any(Query.class), eq(Document.class), eq("users")))
        .thenReturn(
            List.of(
                new Document("_id", new ObjectId(ALICE)).append("displayName", "Alice"),
                new Document("_id", new ObjectId(GHOST)).append("displayName", " ")));

    Map<String, String> names =
        real.lookupDisplayNames(List.of(ALICE, GHOST, "system", AiConstants.AI_BOT_USER_ID));

    assertThat(names).containsExactly(Map.entry(ALICE, "Alice"));
    ArgumentCaptor<Query> query = ArgumentCaptor.forClass(Query.class);
    verify(mongoTemplate, times(1)).find(query.capture(), eq(Document.class), eq("users"));
    @SuppressWarnings("unchecked")
    List<ObjectId> ids =
        (List<ObjectId>) query.getValue().getQueryObject().get("_id", Document.class).get("$in");
    assertThat(ids).containsExactly(new ObjectId(ALICE), new ObjectId(GHOST));
  }

  @Test
  void lookupDisplayNames_withoutObjectIds_skipsTheQuery() {
    MessageServiceHelper real = new MessageServiceHelper(null, null, null, mongoTemplate);

    assertThat(real.lookupDisplayNames(List.of("system"))).isEmpty();
    verifyNoInteractions(mongoTemplate);
  }
}
