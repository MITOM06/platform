package com.platform.chatservice.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Connection settings for the internal connector-service ({@code :3003}) used to issue/revoke the
 * MCP session token a member's Bot Factory assistant authenticates with. Bound from {@code
 * app.connector.*}. When {@code baseUrl} is blank the BotFather Zone provisioning flow is disabled
 * (calls throw), but the rest of chat-service runs fine.
 */
@Component
@ConfigurationProperties(prefix = "app.connector")
@Data
public class ConnectorProperties {
  private String baseUrl;
  private String internalKey;
}
