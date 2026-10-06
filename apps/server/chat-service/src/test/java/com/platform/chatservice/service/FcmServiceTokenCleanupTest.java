package com.platform.chatservice.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.MessagingErrorCode;
import com.mongodb.client.result.UpdateResult;
import java.util.concurrent.ExecutionException;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.data.redis.core.StringRedisTemplate;

class FcmServiceTokenCleanupTest {

  private final MongoTemplate mongo = mock(MongoTemplate.class);
  private final FcmService service = new FcmService(mongo, mock(StringRedisTemplate.class));

  private static FirebaseMessagingException fcmError(MessagingErrorCode code) {
    FirebaseMessagingException e = mock(FirebaseMessagingException.class);
    when(e.getMessagingErrorCode()).thenReturn(code);
    return e;
  }

  @Test
  void unregisteredToken_isPulledFromEveryAccount() {
    when(mongo.updateMulti(any(Query.class), any(Update.class), eq("users")))
        .thenReturn(UpdateResult.acknowledged(1, 1L, null));

    // sendAsync failures arrive wrapped, the way ApiFuture reports them.
    service.handleSendFailure(
        "dead-token", new ExecutionException(fcmError(MessagingErrorCode.UNREGISTERED)));

    ArgumentCaptor<Query> query = ArgumentCaptor.forClass(Query.class);
    ArgumentCaptor<Update> update = ArgumentCaptor.forClass(Update.class);
    verify(mongo).updateMulti(query.capture(), update.capture(), eq("users"));
    org.assertj.core.api.Assertions.assertThat(query.getValue().getQueryObject().get("fcmTokens"))
        .isEqualTo("dead-token");
    org.assertj.core.api.Assertions.assertThat(update.getValue().getUpdateObject().toJson())
        .contains("$pull")
        .contains("dead-token");
  }

  @Test
  void senderIdMismatch_isAlsoDead() {
    when(mongo.updateMulti(any(Query.class), any(Update.class), eq("users")))
        .thenReturn(UpdateResult.acknowledged(1, 1L, null));

    service.handleSendFailure("other-project", fcmError(MessagingErrorCode.SENDER_ID_MISMATCH));

    verify(mongo).updateMulti(any(Query.class), any(Update.class), eq("users"));
  }

  @Test
  void transientOrMessageErrors_keepTheToken() {
    service.handleSendFailure("t1", fcmError(MessagingErrorCode.UNAVAILABLE));
    service.handleSendFailure("t2", fcmError(MessagingErrorCode.INVALID_ARGUMENT));
    service.handleSendFailure("t3", fcmError(MessagingErrorCode.QUOTA_EXCEEDED));
    service.handleSendFailure("t4", new RuntimeException("network"));

    verify(mongo, never()).updateMulti(any(Query.class), any(Update.class), eq("users"));
  }
}
