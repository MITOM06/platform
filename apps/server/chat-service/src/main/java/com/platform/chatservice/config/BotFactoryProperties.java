package com.platform.chatservice.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Connection settings for the external Bot Factory service that powers per-member personal
 * assistants. Bound from {@code app.botfactory.*}. When {@code baseUrl} is blank the bridge is
 * disabled (calls return null) so the service runs fine without Bot Factory configured.
 */
@Component
@ConfigurationProperties(prefix = "app.botfactory")
@Data
public class BotFactoryProperties {
  private String baseUrl;
  private String workerToken;
}
