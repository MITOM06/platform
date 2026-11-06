package com.platform.chatservice.service.meeting;

import com.mongodb.client.gridfs.model.GridFSFile;
import com.platform.chatservice.dto.meeting.MeetingChatCommand;
import com.platform.chatservice.model.MeetingAttachment;
import com.platform.chatservice.service.upload.UploadRefs;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.stereotype.Component;

/**
 * The file on a meeting chat line: checks what the client claims and reads the facts (size, type)
 * from the stored upload. Every refusal is {@code MEETING_INVALID} on field {@code attachment}.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MeetingAttachments {

  static final int NAME_MAX = 200;

  /** Exactly a relative upload URL; no query, fragment or host. */
  private static final Pattern URL =
      Pattern.compile(
          "/api/uploads/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
              + "|[0-9a-fA-F]{24})");

  private final GridFsTemplate gridFs;
  private final UploadRefs uploadRefs;

  /** Cheap shape check (no I/O); returns the lowercased upload id. */
  String shape(MeetingChatCommand.Attachment a) {
    if (a == null || a.url() == null || a.name() == null) {
      throw MeetingRequests.invalid("attachment");
    }
    Matcher m = URL.matcher(a.url());
    String name = a.name().trim();
    if (!m.matches() || name.isEmpty() || name.length() > NAME_MAX) {
      throw MeetingRequests.invalid("attachment");
    }
    return m.group(1).toLowerCase(Locale.ROOT);
  }

  /** The stored file must exist and have been uploaded by {@code userId}. */
  MeetingAttachment load(MeetingChatCommand.Attachment a, String uploadId, String userId) {
    GridFSFile file = gridFs.findOne(new Query(UploadRefs.fileCriteria(Set.of(uploadId))));
    Document meta = file == null || file.getMetadata() == null ? null : file.getMetadata();
    if (meta == null || userId == null || !userId.equals(meta.getString("uploadedBy"))) {
      throw MeetingRequests.invalid("attachment");
    }
    return MeetingAttachment.builder()
        .uploadId(uploadId)
        .url("/api/uploads/" + uploadId)
        .name(a.name().trim())
        .size(file.getLength())
        .contentType(meta.getString("_contentType"))
        .build();
  }

  /** Lets everyone who can read the meeting's records open the file. Never throws. */
  void attach(MeetingAttachment a, String meetingId, String userId) {
    if (!uploadRefs.attachToMeeting(a.getUploadId(), meetingId, userId)) {
      log.warn("Meeting {} file {} could not be opened to the room", meetingId, a.getUploadId());
    }
  }
}
