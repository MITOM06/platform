package com.platform.chatservice.service.upload;

import com.mongodb.client.gridfs.model.GridFSFile;
import com.platform.chatservice.service.ConversationCacheService;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
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
 *   <li>anyone, when the file is a public profile image: its URL is a user avatar / cover photo,
 *       the workspace logo, or a bot / AI persona avatar — queried only when 1–3 fail.
 * </ol>
 */
@Component
@RequiredArgsConstructor
public class UploadAccessPolicy {

  /** collection → field holding a profile image URL readable by every signed-in user. */
  private static final List<String[]> PROFILE_IMAGE_FIELDS =
      List.of(
          new String[] {"users", "avatarUrl"},
          new String[] {"users", "coverPhoto"},
          new String[] {"workspaces", "logoUrl"},
          new String[] {"external_bots", "avatarUrl"},
          new String[] {"ai_personas", "avatarUrl"});

  private final MongoTemplate mongoTemplate;
  private final ConversationCacheService conversationCacheService;

  public boolean canRead(GridFSFile file, String userId) {
    if (file == null || userId == null || userId.isBlank()) return false;
    Document meta = file.getMetadata() == null ? new Document() : file.getMetadata();
    if (userId.equals(meta.getString("uploadedBy"))) return true;

    List<String> conversations = new ArrayList<>();
    List<String> departments = new ArrayList<>();
    collectRefs(meta, conversations, departments);
    if (inAnyConversation(conversations, userId)) return true;
    if (!departments.isEmpty() && inAnyDepartment(departments, userId)) return true;
    return isProfileImage(publicId(file, meta));
  }

  private static void collectRefs(Document meta, List<String> conversations, List<String> depts) {
    if (!(meta.get("refs") instanceof List<?> refs)) return;
    for (Object r : refs) {
      if (!(r instanceof Document ref) || !(ref.get("id") instanceof String id)) continue;
      if (UploadRefs.REF_CONVERSATION.equals(ref.getString("t"))) conversations.add(id);
      else if (UploadRefs.REF_DEPARTMENT.equals(ref.getString("t"))) depts.add(id);
    }
  }

  private boolean inAnyConversation(List<String> conversationIds, String userId) {
    for (String id : conversationIds) {
      boolean member =
          conversationCacheService
              .findByIdOptional(id)
              .map(c -> c.getParticipants() != null && c.getParticipants().contains(userId))
              .orElse(false);
      if (member) return true;
    }
    return false;
  }

  private boolean inAnyDepartment(List<String> departmentIds, String userId) {
    if (!ObjectId.isValid(userId)) return false;
    Query query = new Query(Criteria.where("_id").is(new ObjectId(userId)));
    query.fields().include("departmentIds");
    Document user = mongoTemplate.findOne(query, Document.class, "users");
    if (user == null || !(user.get("departmentIds") instanceof List<?> mine)) return false;
    Set<String> userDepts = new HashSet<>();
    for (Object d : mine) {
      if (d != null) userDepts.add(d.toString());
    }
    return departmentIds.stream().anyMatch(userDepts::contains);
  }

  private boolean isProfileImage(String publicId) {
    if (publicId == null) return false;
    // Stored values may carry a "#fit=cover&scale=120" fragment or a "?v=" query.
    Pattern url = Pattern.compile("^" + Pattern.quote("/api/uploads/" + publicId) + "($|[#?])");
    for (String[] field : PROFILE_IMAGE_FIELDS) {
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
