package com.platform.chatservice.service.upload;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

/**
 * Records where an upload is used, so {@link UploadAccessPolicy} can tell who may read it: every
 * {@code /api/uploads/<id>} found in saved text gets {@code {t:"c"|"d", id}} added to its GridFS
 * {@code metadata.refs}. Attaching never throws — a missed ref only hides a file, it must never
 * fail the save that triggered it.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class UploadRefs {

  public static final String FILES_COLLECTION = "fs.files";
  public static final String REF_CONVERSATION = "c";
  public static final String REF_DEPARTMENT = "d";

  private static final Pattern UPLOAD_URL =
      Pattern.compile(
          "/api/uploads/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
              + "|[0-9a-fA-F]{24})(?![0-9a-zA-Z_-])");

  private final MongoTemplate mongoTemplate;

  /**
   * Every upload id referenced in {@code text} (relative or absolute URLs, JSON image arrays and
   * file cards — JSON-escaped slashes included — with or without {@code #fragment}/{@code ?query}),
   * lowercased.
   */
  public static Set<String> extractIds(String text) {
    Set<String> ids = new LinkedHashSet<>();
    if (text == null || text.isEmpty()) return ids;
    Matcher m = UPLOAD_URL.matcher(text.replace("\\/", "/"));
    while (m.find()) {
      ids.add(m.group(1).toLowerCase(Locale.ROOT));
    }
    return ids;
  }

  public void attachToConversation(String text, String conversationId) {
    attach(text, REF_CONVERSATION, conversationId);
  }

  public void attachToDepartment(String text, String departmentId) {
    attach(text, REF_DEPARTMENT, departmentId);
  }

  private void attach(String text, String type, String targetId) {
    try {
      Set<String> ids = extractIds(text);
      if (ids.isEmpty() || targetId == null || targetId.isBlank()) return;
      mongoTemplate.updateMulti(
          new Query(fileCriteria(ids)),
          new Update().addToSet("metadata.refs", new Document("t", type).append("id", targetId)),
          FILES_COLLECTION);
    } catch (RuntimeException e) {
      log.warn("Could not record upload refs ({}:{}): {}", type, targetId, e.toString());
    }
  }

  /**
   * GridFS files for these upload ids, matched the way {@code GET /api/uploads/{id}} resolves them:
   * a UUID by {@code metadata.fileId}; a 24-hex id only as a LEGACY file ({@code _id}, no {@code
   * metadata.fileId}).
   */
  static Criteria fileCriteria(Set<String> ids) {
    List<String> uuids = new ArrayList<>();
    List<ObjectId> legacy = new ArrayList<>();
    for (String id : ids) {
      if (id.length() == 24) legacy.add(new ObjectId(id));
      else uuids.add(id);
    }
    List<Criteria> any = new ArrayList<>();
    if (!uuids.isEmpty()) any.add(Criteria.where("metadata.fileId").in(uuids));
    if (!legacy.isEmpty()) {
      any.add(Criteria.where("_id").in(legacy).and("metadata.fileId").exists(false));
    }
    return any.size() == 1 ? any.get(0) : new Criteria().orOperator(any.toArray(new Criteria[0]));
  }
}
