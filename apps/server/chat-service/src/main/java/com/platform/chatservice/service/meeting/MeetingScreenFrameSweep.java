package com.platform.chatservice.service.meeting;

import java.time.Duration;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Deletes shared-screen frames (GridFS {@code metadata.screenFrame=true}) older than one hour that
 * the result listener never consumed (AI down, lost message). Ordinary uploads are never touched.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MeetingScreenFrameSweep {

  static final Duration MAX_AGE = Duration.ofHours(1);

  private final GridFsTemplate gridFs;

  @Scheduled(fixedDelayString = "${meetings.ai.screen-sweep-ms:600000}")
  public void sweep() {
    try {
      int n = deleteOlderThan(Instant.now().minus(MAX_AGE));
      if (n > 0) {
        log.info("Screen-frame sweep deleted {} orphan frame(s)", n);
      }
    } catch (Exception e) {
      log.warn("Screen-frame sweep failed: {}", e.toString());
    }
  }

  int deleteOlderThan(Instant cutoff) {
    Query old =
        new Query(
            Criteria.where("metadata.screenFrame")
                .is(true)
                .and("uploadDate")
                .lt(java.util.Date.from(cutoff)));
    int count = 0;
    for (var ignored : gridFs.find(old)) {
      count++;
    }
    if (count > 0) {
      gridFs.delete(old);
    }
    return count;
  }
}
