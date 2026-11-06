package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@DataMongoTest
@Testcontainers
class MeetingScreenFrameSweepTest {

  @Container static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

  @DynamicPropertySource
  static void mongoProps(DynamicPropertyRegistry registry) {
    registry.add("spring.data.mongodb.uri", mongo::getReplicaSetUrl);
  }

  @Autowired private MongoTemplate template;
  private GridFsTemplate gridFs;
  private MeetingScreenFrameSweep sweep;

  @BeforeEach
  void setUp() {
    template.getCollection("fs.files").deleteMany(new Document());
    template.getCollection("fs.chunks").deleteMany(new Document());
    gridFs = new GridFsTemplate(template.getMongoDatabaseFactory(), template.getConverter());
    sweep = new MeetingScreenFrameSweep(gridFs);
  }

  private void store(String fileId, boolean screen, Duration age) {
    Document meta = new Document("fileId", fileId);
    if (screen) {
      meta.put("screenFrame", true);
    }
    gridFs.store(new ByteArrayInputStream(new byte[] {1, 2, 3}), fileId, "image/jpeg", meta);
    template
        .getCollection("fs.files")
        .updateOne(
            new Document("metadata.fileId", fileId),
            new Document("$set", new Document("uploadDate", Date.from(Instant.now().minus(age)))));
  }

  private boolean exists(String fileId) {
    return gridFs.findOne(new Query(Criteria.where("metadata.fileId").is(fileId))) != null;
  }

  @Test
  void deletesOldScreenFramesKeepsFreshOnesAndNeverTouchesOrdinaryUploads() {
    store("old-frame", true, Duration.ofHours(2));
    store("fresh-frame", true, Duration.ofMinutes(10));
    store("old-upload", false, Duration.ofHours(5));

    int n = sweep.deleteOlderThan(Instant.now().minus(MeetingScreenFrameSweep.MAX_AGE));

    assertThat(n).isEqualTo(1);
    assertThat(exists("old-frame")).isFalse();
    assertThat(exists("fresh-frame")).isTrue();
    assertThat(exists("old-upload")).isTrue();
  }
}
