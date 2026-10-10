package com.platform.chatservice.model;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AiSourceTest {

  @Test
  void keepsKnownFieldsOfWellFormedEntries() {
    Map<String, Object> web = new HashMap<>();
    web.put("documentId", "web-1");
    web.put("fileName", "Docs");
    web.put("score", 1);
    web.put("url", "https://example.com/a");
    web.put("type", "web");
    web.put("extra", "dropped");

    List<AiSource> out =
        AiSource.fromPayload(
            List.of(Map.of("documentId", "doc-1", "fileName", "policy.pdf", "score", 0.82), web));

    assertThat(out)
        .containsExactly(
            new AiSource("doc-1", "policy.pdf", 0.82, null, null),
            new AiSource("web-1", "Docs", 1.0, "https://example.com/a", "web"));
  }

  @Test
  void dropsEntriesWithoutADocumentId_andReturnsNullWhenNothingIsLeft() {
    assertThat(AiSource.fromPayload(List.of(Map.of("fileName", "x"), "doc-1", 42))).isNull();
    assertThat(AiSource.fromPayload(List.of())).isNull();
    assertThat(AiSource.fromPayload(null)).isNull();
    assertThat(AiSource.fromPayload("not a list")).isNull();
  }

  /** A record must survive the Mongo round trip: written with the message, read back on reload. */
  @Test
  void roundTripsThroughTheMongoConverter() {
    // The app's own conversions (Instant & co. as Mongo simple types), without a database.
    org.springframework.data.mongodb.core.convert.MongoCustomConversions conversions =
        new org.springframework.data.mongodb.core.convert.MongoCustomConversions(List.of());
    org.springframework.data.mongodb.core.mapping.MongoMappingContext context =
        new org.springframework.data.mongodb.core.mapping.MongoMappingContext();
    context.setSimpleTypeHolder(conversions.getSimpleTypeHolder());
    org.springframework.data.mongodb.core.convert.MappingMongoConverter converter =
        new org.springframework.data.mongodb.core.convert.MappingMongoConverter(
            org.springframework.data.mongodb.core.convert.NoOpDbRefResolver.INSTANCE, context);
    converter.setCustomConversions(conversions);
    converter.afterPropertiesSet();
    List<AiSource> sources =
        List.of(
            new AiSource("doc-1", "policy.pdf", 0.82, null, null),
            new AiSource("web-1", "Docs", 1.0, "https://example.com/a", "web"));
    Message message = Message.builder().conversationId("c").content("x").sources(sources).build();

    org.bson.Document doc = new org.bson.Document();
    converter.write(message, doc);
    Message back = converter.read(Message.class, doc);

    assertThat(back.getSources()).isEqualTo(sources);
  }
}
