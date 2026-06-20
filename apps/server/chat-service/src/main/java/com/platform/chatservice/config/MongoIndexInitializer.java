package com.platform.chatservice.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexDefinition;
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.data.mongodb.core.index.IndexResolver;
import org.springframework.data.mongodb.core.index.MongoPersistentEntityIndexResolver;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;
import org.springframework.data.mongodb.core.mapping.MongoPersistentEntity;
import org.springframework.stereotype.Component;

/**
 * Creates the indexes declared via {@code @Indexed}/{@code @CompoundIndex}/{@code @TextIndexed} on
 * our {@code @Document} models — but does it AFTER the application is fully started (so Tomcat is
 * already listening on the port and Cloud Run's startup probe passes) and with per-index error
 * handling.
 *
 * <p>Why not Spring's {@code spring.data.mongodb.auto-index-creation=true}? That runs eagerly while
 * the {@code MongoTemplate} bean is being created. If a single index conflicts with one that
 * already exists under a different name — which happens constantly in this shared database, where
 * ai-service (Mongoose) creates {@code conversationId_1} on {@code ai_memories}/{@code ai_personas}
 * while Spring's {@code @Indexed} wants to call it {@code conversationId} — MongoDB returns error
 * 85 (IndexOptionsConflict), the bean fails, the whole context aborts, and the container exits
 * before binding the port. That is exactly the Cloud Run "failed to start and listen on PORT=8080"
 * failure.
 *
 * <p>Here, an equivalent pre-existing index simply logs a warning and is skipped, so a collection
 * owned by another service can never crash chat-service startup.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MongoIndexInitializer {

  private final MongoTemplate mongoTemplate;
  private final MongoMappingContext mappingContext;

  @EventListener(ApplicationReadyEvent.class)
  public void ensureIndexes() {
    IndexResolver resolver = new MongoPersistentEntityIndexResolver(mappingContext);
    int created = 0;
    int skipped = 0;

    for (MongoPersistentEntity<?> entity : mappingContext.getPersistentEntities()) {
      if (!entity.isAnnotationPresent(Document.class)) {
        continue; // only top-level collection models, not embedded types
      }
      Class<?> type = entity.getType();
      IndexOperations indexOps = mongoTemplate.indexOps(type);
      for (IndexDefinition index : resolver.resolveIndexFor(entity.getTypeInformation())) {
        try {
          indexOps.ensureIndex(index);
          created++;
        } catch (RuntimeException ex) {
          // IndexOptionsConflict (error 85) and any other index issue must never crash startup:
          // the app is already serving traffic at this point.
          skipped++;
          log.warn(
              "Skipped index on {} ({}): {}",
              type.getSimpleName(),
              entity.getCollection(),
              ex.getMessage());
        }
      }
    }
    log.info("Mongo index initialization complete: {} ensured, {} skipped", created, skipped);
  }
}
