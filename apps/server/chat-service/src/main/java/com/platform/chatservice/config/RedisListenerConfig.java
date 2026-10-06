package com.platform.chatservice.config;

import com.platform.chatservice.security.ClaimsChangedListener;
import com.platform.chatservice.security.SessionRevokedListener;
import com.platform.chatservice.service.AiActionResolvedListener;
import com.platform.chatservice.service.AiResponseListener;
import com.platform.chatservice.service.CallSummaryListener;
import com.platform.chatservice.service.ClusterBroadcastListener;
import com.platform.chatservice.service.ClusterMessageBroker;
import com.platform.chatservice.service.ConversationMembershipCache;
import com.platform.chatservice.service.KbStatusListener;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.PatternTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;

@Configuration
public class RedisListenerConfig {

  @Bean
  public RedisMessageListenerContainer redisMessageListenerContainer(
      RedisConnectionFactory connectionFactory,
      AiResponseListener aiResponseListener,
      KbStatusListener kbStatusListener,
      CallSummaryListener callSummaryListener,
      ClusterBroadcastListener clusterBroadcastListener,
      SessionRevokedListener sessionRevokedListener,
      ClaimsChangedListener claimsChangedListener,
      AiActionResolvedListener aiActionResolvedListener,
      ConversationMembershipCache conversationMembershipCache) {
    RedisMessageListenerContainer container = new RedisMessageListenerContainer();
    container.setConnectionFactory(connectionFactory);
    container.addMessageListener(aiResponseListener, new PatternTopic("ai:response:*"));
    container.addMessageListener(kbStatusListener, new PatternTopic("kb:status:*"));
    // Exact-name channel (no wildcard) — ai-service → chat-service summary results.
    container.addMessageListener(callSummaryListener, new ChannelTopic("call:summary:result"));
    // Cross-instance fan-out of ordinary chat broadcasts (messages, notifications, typing, read
    // receipts, call signaling, presence) so realtime works when participants are connected to
    // different Cloud Run instances. Published by ClusterMessageBroker.
    container.addMessageListener(
        clusterBroadcastListener, new ChannelTopic(ClusterMessageBroker.CHANNEL));
    // auth-service → every chat-service instance: a user's sessions were revoked (blocked,
    // password reset/change, logout-all, …) — close that user's open sockets right away. A role /
    // department / permission change no longer revokes: see auth:claims-changed below.
    container.addMessageListener(
        sessionRevokedListener, new ChannelTopic(SessionRevokedListener.CHANNEL));
    // auth-service → every instance: a user's role/departments/permissions changed. Their cached
    // sessions are dropped (stale tokens get 401 TOKEN_CLAIMS_STALE) and their open sockets are
    // told CLAIMS_CHANGED so the client refreshes + reconnects — no logout.
    container.addMessageListener(
        claimsChangedListener, new ChannelTopic(ClaimsChangedListener.CHANNEL));
    // ai-service → chat-service: a sensitive AI action was confirmed / cancelled / failed — flip
    // the matching pendingActions[] element of the AI message and broadcast MESSAGE_UPDATED.
    container.addMessageListener(
        aiActionResolvedListener, new ChannelTopic(AiActionResolvedListener.CHANNEL));
    // Membership of a conversation changed on some instance — drop the cached participants so the
    // outbound STOMP filter stops delivering to removed members right away.
    container.addMessageListener(
        conversationMembershipCache, new ChannelTopic(ConversationMembershipCache.CHANNEL));
    return container;
  }
}
