package com.platform.chatservice.service;

import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.AndroidConfig;
import com.google.firebase.messaging.AndroidNotification;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class FcmService {

  private final MongoTemplate mongoTemplate;
  private final StringRedisTemplate redisTemplate;

  private static final String STATUS_KEY_PREFIX = "user:status:";

  public void sendPushNotification(
      String targetUserId, String senderName, String messageContent, String conversationId) {
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

      // Check if the conversation is muted by the target user
      if (conversationId != null && ObjectId.isValid(conversationId)) {
        Query convQuery = new Query(Criteria.where("_id").is(new ObjectId(conversationId)));
        convQuery.fields().include("mutedUsers");
        Document convDoc = mongoTemplate.findOne(convQuery, Document.class, "conversations");
        if (convDoc != null) {
          List<String> mutedUsers = convDoc.getList("mutedUsers", String.class);
          if (mutedUsers != null && mutedUsers.contains(targetUserId)) {
            // Conversation is muted by this user, do not send push notification
            return;
          }
        }
      }

      // Fetch sender's name
      String finalSenderName = "New Message";
      try {
        Query senderQuery =
            new Query(
                Criteria.where("_id")
                    .is(new ObjectId(senderName))); // senderName is actually senderId here
        senderQuery.fields().include("displayName");
        Document senderDoc = mongoTemplate.findOne(senderQuery, Document.class, "users");
        if (senderDoc != null && senderDoc.getString("displayName") != null) {
          finalSenderName = senderDoc.getString("displayName");
        }
      } catch (Exception e) {
        // fallback
      }

      for (String token : tokens) {
        try {
          Message message =
              Message.builder()
                  .setToken(token)
                  .setNotification(
                      Notification.builder()
                          .setTitle(finalSenderName)
                          .setBody(messageContent)
                          .build())
                  .setAndroidConfig(
                      AndroidConfig.builder()
                          .setPriority(AndroidConfig.Priority.HIGH)
                          .setNotification(
                              AndroidNotification.builder().setChannelId("pon_messages").build())
                          .build())
                  .putData("conversationId", conversationId)
                  .putData("type", "chat_message")
                  .build();

          FirebaseMessaging.getInstance().sendAsync(message);
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
}
