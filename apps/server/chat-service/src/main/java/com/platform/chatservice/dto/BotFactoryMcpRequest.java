package com.platform.chatservice.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Request body for Bot Factory {@code POST /api/bots/{id}/mcp}. For PON we always inject an HTTP
 * MCP server: {@code transport}="http", {@code authType}="apikey", and {@code headers} is a JSON
 * string such as {@code {"Authorization":"Bearer <token>"}}. The {@code name} must match Bot
 * Factory's {@code ^[a-zA-Z0-9_]+$} rule — hyphens are rejected.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record BotFactoryMcpRequest(
    String name, String transport, String url, String headers, String authType) {}
