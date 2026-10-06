package com.platform.chatservice.service;

import com.google.api.core.ApiFuture;
import com.google.api.core.ApiFutureCallback;
import com.google.api.core.ApiFutures;
import com.google.common.util.concurrent.MoreExecutors;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.AndroidConfig;
import com.google.firebase.messaging.AndroidNotification;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.MessagingErrorCode;
import com.google.firebase.messaging.Notification;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class FcmService {

  private final MongoTemplate mongoTemplate;
  private final StringRedisTemplate redisTemplate;

  private static final String STATUS_KEY_PREFIX = "user:status:";

  /**
   * Push a new-message notification to {@code targetUserId}'s devices when they are offline. {@code
   * title} is the sender's already-resolved display name — callers own the name resolution
   * (assistants are not users, so a {@code users} lookup here could not name them).
   */
  public void sendPushNotification(
      String targetUserId, String title, String messageContent, String conversationId) {
    // FCM disabled (no Firebase app configured) → silent no-op.
    // NOTE: FirebaseMessaging.getInstance() THROWS when no app exists, so we must
    // check FirebaseApp.getApps() instead — otherwise chat.send would break.
    if (FirebaseApp.getApps().isEmpty()) {
      return;
    }

    if (targetUserId == null || !ObjectId.isValid(targetUserId)) {
      log.warn("Skipping FCM push: invalid targetUserId '{}'", targetUserId);
      return;
    }

    try {
      // Check presence
      String status = redisTemplate.opsForValue().get(STATUS_KEY_PREFIX + targetUserId);
      if ("online".equals(status)) {
        // User is online, no need to send push notification
        return;
      }

      // Fetch target user's tokens
      Query query = new Query(Criteria.where("_id").is(new ObjectId(targetUserId)));
      query.fields().include("fcmTokens");

      Document userDoc = mongoTemplate.findOne(query, Document.class, "users");
      if (userDoc == null) return;

      List<String> tokens = userDoc.getList("fcmTokens", String.class);
      if (tokens == null || tokens.isEmpty()) return;

      // Check if the conversation is muted by the target user (time-based expiry)
      if (conversationId != null && ObjectId.isValid(conversationId)) {
        Query convQuery = new Query(Criteria.where("_id").is(new ObjectId(conversationId)));
        convQuery.fields().include("mutedUntil");
        Document convDoc = mongoTemplate.findOne(convQuery, Document.class, "conversations");
        if (convDoc != null) {
          Document mutedUntil = convDoc.get("mutedUntil", Document.class);
          if (mutedUntil != null) {
            Long expiryMs = mutedUntil.getLong(targetUserId);
            if (expiryMs != null && expiryMs > System.currentTimeMillis()) {
              // Conversation is muted and not yet expired for this user
              return;
            }
          }
        }
      }

      for (String token : tokens) {
        try {
          Message message =
              Message.builder()
                  .setToken(token)
                  .setNotification(
                      Notification.builder().setTitle(title).setBody(messageContent).build())
                  .setAndroidConfig(
                      AndroidConfig.builder()
                          .setPriority(AndroidConfig.Priority.HIGH)
                          .setNotification(
                              AndroidNotification.builder().setChannelId("pon_messages").build())
                          .build())
                  .putData("conversationId", conversationId)
                  .putData("type", "chat_message")
                  .build();

          dispatch(message, token);
        } catch (Exception e) {
          // Skip this recipient token only; never abort the whole loop.
          log.warn("Failed to send FCM to token (skipping): {}", e.getMessage());
        }
      }
    } catch (Exception e) {
      // Any failure (Firebase not ready, DB, ObjectId parse, etc.) must never break
      // the message-send flow that calls this.
      log.error("FCM push skipped due to error", e);
    }
  }

  /**
   * Push a due reminder to all of the owner's devices. Unlike chat pushes, reminders are delivered
   * regardless of online/mute state (the user explicitly asked to be reminded). Failures are
   * swallowed so the sweep loop never aborts.
   *
   * @return true if at least one push was dispatched (or FCM is disabled / user has no tokens —
   *     i.e. the reminder should still be marked notified so it is not retried forever).
   */
  public boolean sendReminderPush(String targetUserId, String text, String conversationId) {
    // FCM disabled → treat as delivered so the sweep doesn't spin on it every tick.
    if (FirebaseApp.getApps().isEmpty()) {
      return true;
    }
    if (targetUserId == null || !ObjectId.isValid(targetUserId)) {
      log.warn("Skipping reminder push: invalid targetUserId '{}'", targetUserId);
      return true;
    }

    try {
      Query query = new Query(Criteria.where("_id").is(new ObjectId(targetUserId)));
      query.fields().include("fcmTokens");
      Document userDoc = mongoTemplate.findOne(query, Document.class, "users");
      if (userDoc == null) return true;

      List<String> tokens = userDoc.getList("fcmTokens", String.class);
      if (tokens == null || tokens.isEmpty()) return true;

      for (String token : tokens) {
        try {
          Message message =
              Message.builder()
                  .setToken(token)
                  .setNotification(
                      Notification.builder().setTitle("Reminder").setBody(text).build())
                  .setAndroidConfig(
                      AndroidConfig.builder()
                          .setPriority(AndroidConfig.Priority.HIGH)
                          .setNotification(
                              AndroidNotification.builder().setChannelId("pon_reminders").build())
                          .build())
                  .putData("conversationId", conversationId == null ? "" : conversationId)
                  .putData("type", "reminder")
                  .build();
          dispatch(message, token);
        } catch (Exception e) {
          log.warn("Failed to send reminder push to token (skipping): {}", e.getMessage());
        }
      }
      return true;
    } catch (Exception e) {
      log.error("Reminder push skipped due to error", e);
      return false;
    }
  }

  /** Send one push and clean up the token when FCM says the device is gone. */
  private void dispatch(Message message, String token) {
    ApiFuture<String> future = FirebaseMessaging.getInstance().sendAsync(message);
    ApiFutures.addCallback(
        future,
        new ApiFutureCallback<>() {
          @Override
          public void onFailure(Throwable t) {
            handleSendFailure(token, t);
          }

          @Override
          public void onSuccess(String messageId) {
            // nothing to do
          }
        },
        MoreExecutors.directExecutor());
  }

  /**
   * A token FCM reports as UNREGISTERED (app uninstalled, or the client deleted it on logout) or
   * SENDER_ID_MISMATCH (belongs to another Firebase project) will never deliver again. Keeping it
   * means pushing every future message preview at a dead — or reassigned — device, so drop it from
   * whichever account still lists it. Other errors (quota, unavailable, an invalid message) are
   * transient or about the message, not the token, and leave it alone.
   */
  void handleSendFailure(String token, Throwable t) {
    Throwable cause = t;
    while (cause != null && !(cause instanceof FirebaseMessagingException)) {
      cause = cause.getCause();
    }
    if (!(cause instanceof FirebaseMessagingException fme)) {
      log.warn("FCM send failed: {}", t.getMessage());
      return;
    }
    MessagingErrorCode code = fme.getMessagingErrorCode();
    if (code != MessagingErrorCode.UNREGISTERED && code != MessagingErrorCode.SENDER_ID_MISMATCH) {
      log.warn("FCM send failed ({}): {}", code, fme.getMessage());
      return;
    }
    try {
      long removed =
          mongoTemplate
              .updateMulti(
                  new Query(Criteria.where("fcmTokens").is(token)),
                  new Update().pull("fcmTokens", token),
                  "users")
              .getModifiedCount();
      log.info("Removed a dead FCM token ({}) from {} account(s)", code, removed);
    } catch (Exception e) {
      log.warn("Could not remove dead FCM token: {}", e.getMessage());
    }
  }
}
