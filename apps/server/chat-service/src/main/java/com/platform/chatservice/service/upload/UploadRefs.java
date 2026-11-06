package com.platform.chatservice.service.upload;

import com.mongodb.client.gridfs.model.GridFSFile;
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
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.stereotype.Component;

/**
 * Records where an upload is used, so {@link UploadAccessPolicy} can tell who may read it: every
 * {@code /api/uploads/<id>} found in saved text gets {@code {t:"c"|"d", id}} added to its GridFS
 * {@code metadata.refs}. Attaching never throws — a missed ref only hides a file, it must never
 * fail the save that triggered it.
 *
 * <p>Every write names the acting user: only ids that user can already read ({@link
 * UploadAccessPolicy}) are attached, so pasting a known URL into another chat — or getting an AI
 * reply, reminder or bot to echo it — can never widen access. AI-authored text uses the user whose
 * text it echoes (prompting user, reminder owner, bot owner); no actor = nothing is attached.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class UploadRefs {

  public static final String FILES_COLLECTION = "fs.files";
  public static final String REF_CONVERSATION = "c";
  public static final String REF_DEPARTMENT = "d";
  public static final String REF_MEETING = "m";

  private static final Pattern UPLOAD_URL =
      Pattern.compile(
          "/api/uploads/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
              + "|[0-9a-fA-F]{24})(?![0-9a-zA-Z_-])");

  private static final Pattern UPLOAD_ID =
      Pattern.compile(
          "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
              + "|[0-9a-fA-F]{24}");

  private final MongoTemplate mongoTemplate;
  private final GridFsTemplate gridFsTemplate;
  private final UploadAccessPolicy accessPolicy;

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

  /** Attaches only uploads {@code actorId} can read right now; a blank actor attaches nothing. */
  public void attachToConversation(String text, String conversationId, String actorId) {
    attach(text, REF_CONVERSATION, conversationId, actorId);
  }

  /** Attaches only uploads {@code actorId} can read right now; a blank actor attaches nothing. */
  public void attachToDepartment(String text, String departmentId, String actorId) {
    attach(text, REF_DEPARTMENT, departmentId, actorId);
  }

  /**
   * Lets everyone who can read the meeting's records open this upload. Takes the bare upload id;
   * attaches only when {@code actorId} can already read the file (in practice the uploader), never
   * throws, and returns whether the ref was added.
   */
  public boolean attachToMeeting(String uploadId, String meetingId, String actorId) {
    try {
      if (actorId == null || actorId.isBlank() || meetingId == null || meetingId.isBlank()) {
        return false;
      }
      if (uploadId == null || !UPLOAD_ID.matcher(uploadId).matches()) return false;
      Set<String> ids = extractIds("/api/uploads/" + uploadId);
      if (ids.isEmpty()) return false;
      Criteria files = readableBy(ids, actorId);
      if (files == null) return false;
      return mongoTemplate
              .updateMulti(
                  new Query(files),
                  new Update()
                      .addToSet(
                          "metadata.refs", new Document("t", REF_MEETING).append("id", meetingId)),
                  FILES_COLLECTION)
              .getMatchedCount()
          > 0;
    } catch (RuntimeException e) {
      log.warn("Could not record upload ref (m:{}): {}", meetingId, e.toString());
      return false;
    }
  }

  private void attach(String text, String type, String targetId, String actorId) {
    try {
      if (actorId == null || actorId.isBlank()) return;
      Set<String> ids = extractIds(text);
      if (ids.isEmpty() || targetId == null || targetId.isBlank()) return;
      Criteria files = readableBy(ids, actorId);
      if (files == null) return;
      mongoTemplate.updateMulti(
          new Query(files),
          new Update().addToSet("metadata.refs", new Document("t", type).append("id", targetId)),
          FILES_COLLECTION);
    } catch (RuntimeException e) {
      log.warn("Could not record upload refs ({}:{}): {}", type, targetId, e.toString());
    }
  }

  /** One GridFS query for all ids, then the policy per file; {@code null} when none is readable. */
  private Criteria readableBy(Set<String> ids, String actorId) {
    List<Object> readable = new ArrayList<>();
    for (GridFSFile file : gridFsTemplate.find(new Query(fileCriteria(ids)))) {
      if (accessPolicy.canRead(file, actorId)) {
        readable.add(file.getObjectId());
      } else {
        log.debug("Skipping upload ref: {} cannot read {}", actorId, file.getFilename());
      }
    }
    return readable.isEmpty() ? null : Criteria.where("_id").in(readable);
  }

  /**
   * GridFS files for these upload ids, matched the way {@code GET /api/uploads/{id}} resolves them:
   * a UUID by {@code metadata.fileId}; a 24-hex id only as a LEGACY file ({@code _id}, no {@code
   * metadata.fileId}).
   */
  public static Criteria fileCriteria(Set<String> ids) {
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
