package com.platform.chatservice.service.upload;

import com.mongodb.client.gridfs.model.GridFSFile;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

/**
 * Who may read an upload (rules in order; the internal-key bypass is handled by the controller):
 *
 * <ol>
 *   <li>the uploader ({@code metadata.uploadedBy});
 *   <li>a current participant of a conversation in {@code metadata.refs} ({@code t:"c"});
 *   <li>a member of a department in {@code metadata.refs} ({@code t:"d"}, via {@code
 *       users.departmentIds});
 *   <li>anyone, when the file is a public profile image — queried only when 1–3 fail: the avatar /
 *       cover photo of the user who UPLOADED it (users can point their profile at any string, so a
 *       foreign file there proves nothing), the workspace logo, or a bot avatar (both admin-only
 *       writes). AI persona avatars are not here: they are recorded as a conversation ref.
 * </ol>
 */
@Component
@RequiredArgsConstructor
public class UploadAccessPolicy {

  /** collection → field holding an admin-set image URL readable by every signed-in user. */
  private static final List<String[]> ADMIN_IMAGE_FIELDS =
      List.of(new String[] {"workspaces", "logoUrl"}, new String[] {"external_bots", "avatarUrl"});

  private final MongoTemplate mongoTemplate;

  public boolean canRead(GridFSFile file, String userId) {
    if (file == null || userId == null || userId.isBlank()) return false;
    Document meta = file.getMetadata() == null ? new Document() : file.getMetadata();
    if (userId.equals(meta.getString("uploadedBy"))) return true;

    List<String> conversations = new ArrayList<>();
    List<String> departments = new ArrayList<>();
    collectRefs(meta, conversations, departments);
    if (inAnyConversation(conversations, userId)) return true;
    if (!departments.isEmpty() && inAnyDepartment(departments, userId)) return true;
    return isProfileImage(publicId(file, meta), meta.getString("uploadedBy"));
  }

  private static void collectRefs(Document meta, List<String> conversations, List<String> depts) {
    if (!(meta.get("refs") instanceof List<?> refs)) return;
    for (Object r : refs) {
      if (!(r instanceof Document ref) || !(ref.get("id") instanceof String id)) continue;
      if (UploadRefs.REF_CONVERSATION.equals(ref.getString("t"))) conversations.add(id);
      else if (UploadRefs.REF_DEPARTMENT.equals(ref.getString("t"))) depts.add(id);
    }
  }

  /** One uncached existence query, so leaving a conversation revokes access immediately. */
  private boolean inAnyConversation(List<String> conversationIds, String userId) {
    if (conversationIds.isEmpty()) return false;
    // Conversation.id is a String @Id: Spring stores valid 24-hex values as ObjectId.
    List<Object> ids = new ArrayList<>(conversationIds.size());
    for (String id : conversationIds) ids.add(ObjectId.isValid(id) ? new ObjectId(id) : id);
    Query query = new Query(Criteria.where("_id").in(ids).and("participants").is(userId));
    return mongoTemplate.exists(query, "conversations");
  }

  private boolean inAnyDepartment(List<String> departmentIds, String userId) {
    if (!ObjectId.isValid(userId)) return false;
    // users.departmentIds holds ObjectIds (strings tolerated for legacy rows).
    List<Object> deptIds = new ArrayList<>(departmentIds.size() * 2);
    for (String d : departmentIds) {
      deptIds.add(d);
      if (ObjectId.isValid(d)) deptIds.add(new ObjectId(d));
    }
    Query query =
        new Query(Criteria.where("_id").is(new ObjectId(userId)).and("departmentIds").in(deptIds));
    return mongoTemplate.exists(query, "users");
  }

  private boolean isProfileImage(String publicId, String uploadedBy) {
    if (publicId == null) return false;
    // Stored values may carry a "#fit=cover&scale=120" fragment or a "?v=" query.
    Pattern url = Pattern.compile("^" + Pattern.quote("/api/uploads/" + publicId) + "($|[#?])");
    if (uploadedBy != null && !uploadedBy.isBlank()) {
      Object ownerId = ObjectId.isValid(uploadedBy) ? new ObjectId(uploadedBy) : uploadedBy;
      Criteria ownProfile =
          new Criteria()
              .andOperator(
                  Criteria.where("_id").is(ownerId),
                  new Criteria()
                      .orOperator(
                          Criteria.where("avatarUrl").regex(url),
                          Criteria.where("coverPhoto").regex(url)));
      if (mongoTemplate.exists(new Query(ownProfile), "users")) return true;
    }
    for (String[] field : ADMIN_IMAGE_FIELDS) {
      if (mongoTemplate.exists(new Query(Criteria.where(field[1]).regex(url)), field[0])) {
        return true;
      }
    }
    return false;
  }

  /** The id used in the file's URL: {@code metadata.fileId}, or a legacy file's {@code _id}. */
  private static String publicId(GridFSFile file, Document meta) {
    String fileId = meta.getString("fileId");
    if (fileId != null) return fileId;
    try {
      return file.getObjectId().toHexString();
    } catch (RuntimeException e) {
      return null;
    }
  }
}
