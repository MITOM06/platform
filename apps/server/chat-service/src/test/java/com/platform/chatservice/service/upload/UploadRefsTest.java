package com.platform.chatservice.service.upload;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.ByteArrayInputStream;
import java.util.List;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.UpdateDefinition;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** {@link UploadRefs} against a real MongoDB: id extraction + {@code metadata.refs} writes. */
@DataMongoTest
@Testcontainers
class UploadRefsTest {

  @Container static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

  @DynamicPropertySource
  static void mongoProps(DynamicPropertyRegistry registry) {
    registry.add("spring.data.mongodb.uri", mongo::getReplicaSetUrl);
  }

  private static final String UUID_A = "123e4567-e89b-12d3-a456-426614174000";
  private static final String UUID_B = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  private static final String HEX = "65a1b2c3d4e5f6a7b8c9d0e1";

  @Autowired private MongoTemplate mongoTemplate;

  private GridFsTemplate gridFs;
  private UploadRefs refs;

  @BeforeEach
  void setUp() {
    mongoTemplate.getCollection("fs.files").deleteMany(new Document());
    mongoTemplate.getCollection("fs.chunks").deleteMany(new Document());
    gridFs =
        new GridFsTemplate(mongoTemplate.getMongoDatabaseFactory(), mongoTemplate.getConverter());
    refs = new UploadRefs(mongoTemplate, gridFs, mock(UploadAccessPolicy.class));
  }

  private void storeUuidFile(String fileId) {
    gridFs.store(
        new ByteArrayInputStream(new byte[] {1}),
        fileId,
        "image/png",
        new Document("fileId", fileId).append("uploadedBy", "u1"));
  }

  @SuppressWarnings("unchecked")
  private List<Document> refsOf(String fileId) {
    Document file =
        mongoTemplate.getCollection("fs.files").find(new Document("filename", fileId)).first();
    Document meta = (Document) file.get("metadata");
    Object r = meta.get("refs");
    return r == null ? List.of() : (List<Document>) r;
  }

  @Test
  void extracts_relative_absolute_json_array_file_card_and_fragment() {
    String text =
        "see /api/uploads/"
            + UUID_A
            + " and https://api.example.com/api/uploads/"
            + UUID_B.toUpperCase()
            + "?download=1 "
            + "[\"/api/uploads/"
            + HEX
            + "#fit=cover&scale=120\"] "
            + "{\"url\":\"\\/api\\/uploads\\/"
            + "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
            + "\",\"filename\":\"a.pdf\"}";

    assertThat(UploadRefs.extractIds(text))
        .containsExactlyInAnyOrder(UUID_A, UUID_B, HEX, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  }

  @Test
  void ignores_external_urls_and_bad_ids() {
    String text =
        "https://cdn.example.com/x.png /api/uploads/token /api/uploads/not-an-id "
            + "/api/uploads/65a1b2c3d4e5f6a7b8c9d0e "
            + "/api/uploads/65a1b2c3d4e5f6a7b8c9d0e1ff "
            + "/api/uploads/123e4567-e89b-12d3-a456-42661417400 "
            + "/uploads/"
            + UUID_A;

    assertThat(UploadRefs.extractIds(text)).isEmpty();
    assertThat(UploadRefs.extractIds(null)).isEmpty();
    assertThat(UploadRefs.extractIds("")).isEmpty();
  }

  @Test
  void attach_is_idempotent() {
    storeUuidFile(UUID_A);
    String text = "[\"/api/uploads/" + UUID_A + "\"]";

    refs.attachToConversation(text, "conv-1");
    refs.attachToConversation(text, "conv-1");
    refs.attachToDepartment(text, "dept-1");

    assertThat(refsOf(UUID_A))
        .containsExactly(
            new Document("t", "c").append("id", "conv-1"),
            new Document("t", "d").append("id", "dept-1"));
  }

  @Test
  void attach_legacy_hex_file_matches_by_object_id() {
    ObjectId legacyId =
        gridFs.store(
            new ByteArrayInputStream(new byte[] {1}),
            "photo.png",
            "image/png",
            new Document("uploadedBy", "u1"));

    refs.attachToConversation("/api/uploads/" + legacyId.toHexString(), "conv-9");

    Document file =
        mongoTemplate.getCollection("fs.files").find(new Document("_id", legacyId)).first();
    assertThat(((Document) file.get("metadata")).getList("refs", Document.class))
        .containsExactly(new Document("t", "c").append("id", "conv-9"));
  }

  @Test
  void attach_unknown_id_is_noop() {
    storeUuidFile(UUID_A);

    assertThatCode(() -> refs.attachToConversation("/api/uploads/" + UUID_B + " " + HEX, "conv-1"))
        .doesNotThrowAnyException();

    assertThat(refsOf(UUID_A)).isEmpty();
    assertThat(mongoTemplate.getCollection("fs.files").countDocuments()).isEqualTo(1);
  }

  @Test
  void attach_swallows_database_errors() {
    MongoTemplate broken = mock(MongoTemplate.class);
    when(broken.updateMulti(any(Query.class), any(UpdateDefinition.class), anyString()))
        .thenThrow(new RuntimeException("db down"));
    GridFsTemplate brokenFs = mock(GridFsTemplate.class);
    when(brokenFs.find(any(Query.class))).thenThrow(new RuntimeException("db down"));
    UploadRefs failing = new UploadRefs(broken, brokenFs, mock(UploadAccessPolicy.class));

    assertThatCode(() -> failing.attachToConversation("/api/uploads/" + UUID_A, "conv-1"))
        .doesNotThrowAnyException();
    assertThatCode(() -> failing.attachToDepartment("/api/uploads/" + UUID_A, "dept-1"))
        .doesNotThrowAnyException();
    assertThatCode(() -> failing.attachToConversation("/api/uploads/" + UUID_A, "conv-1", "u1"))
        .doesNotThrowAnyException();
    assertThatCode(() -> failing.attachToDepartment("/api/uploads/" + UUID_A, "dept-1", "u1"))
        .doesNotThrowAnyException();
  }
}
