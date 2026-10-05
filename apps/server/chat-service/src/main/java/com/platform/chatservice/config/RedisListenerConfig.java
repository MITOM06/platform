package com.platform.chatservice.config;

import com.platform.chatservice.security.SessionRevokedListener;
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
    // auth-service → every chat-service instance: a user's sessions were revoked (blocked, role
    // changed, password reset, …) — close that user's open sockets right away.
    container.addMessageListener(
        sessionRevokedListener, new ChannelTopic(SessionRevokedListener.CHANNEL));
    // Membership of a conversation changed on some instance — drop the cached participants so the
    // outbound STOMP filter stops delivering to removed members right away.
    container.addMessageListener(
        conversationMembershipCache, new ChannelTopic(ConversationMembershipCache.CHANNEL));
    return container;
  }
}
