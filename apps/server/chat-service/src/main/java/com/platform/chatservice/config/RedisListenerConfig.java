package com.platform.chatservice.config;

import com.platform.chatservice.service.AiResponseListener;
import com.platform.chatservice.service.CallSummaryListener;
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
      CallSummaryListener callSummaryListener) {
    RedisMessageListenerContainer container = new RedisMessageListenerContainer();
    container.setConnectionFactory(connectionFactory);
    container.addMessageListener(aiResponseListener, new PatternTopic("ai:response:*"));
    container.addMessageListener(kbStatusListener, new PatternTopic("kb:status:*"));
    // Exact-name channel (no wildcard) — ai-service → chat-service summary results.
    container.addMessageListener(callSummaryListener, new ChannelTopic("call:summary:result"));
    return container;
  }
}
