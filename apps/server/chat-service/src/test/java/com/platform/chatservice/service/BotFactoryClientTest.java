package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.config.BotFactoryProperties;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class BotFactoryClientTest {

  private HttpServer server;
  private int port;
  private final AtomicReference<String> lastBody = new AtomicReference<>();
  private final AtomicReference<String> lastToken = new AtomicReference<>();
  private final AtomicReference<String> lastPath = new AtomicReference<>();
  private volatile int statusToReturn = 200;
  private volatile String responseJson = "{\"reply\":\"hi there\"}";

  @BeforeEach
  void setUp() throws IOException {
    server = HttpServer.create(new InetSocketAddress(0), 0);
    port = server.getAddress().getPort();
    server.createContext(
        "/api/bots/",
        exchange -> {
          lastPath.set(exchange.getRequestURI().getPath());
          lastToken.set(exchange.getRequestHeaders().getFirst("x-worker-token"));
          lastBody.set(
              new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
          byte[] out = responseJson.getBytes(StandardCharsets.UTF_8);
          exchange.sendResponseHeaders(statusToReturn, out.length);
          exchange.getResponseBody().write(out);
          exchange.close();
        });
    server.start();
  }

  @AfterEach
  void tearDown() {
    server.stop(0);
  }

  private BotFactoryClient client() {
    BotFactoryProperties props = new BotFactoryProperties();
    props.setBaseUrl("http://localhost:" + port);
    props.setWorkerToken("secret-token");
    return new BotFactoryClient(props, new ObjectMapper());
  }

  @Test
  void chat_sendsTokenAndBody_andReturnsReply() {
    String reply = client().chat("bf-1", "hello", "pon:conv-1");

    assertThat(reply).isEqualTo("hi there");
    assertThat(lastPath.get()).isEqualTo("/api/bots/bf-1/chat");
    assertThat(lastToken.get()).isEqualTo("secret-token");
    assertThat(lastBody.get()).contains("\"message\":\"hello\"");
    assertThat(lastBody.get()).contains("\"conversationKey\":\"pon:conv-1\"");
  }

  @Test
  void chat_returnsNullOnNon2xx() {
    statusToReturn = 500;
    assertThat(client().chat("bf-1", "hello", "pon:conv-1")).isNull();
  }

  @Test
  void chat_returnsNullWhenBaseUrlUnset() {
    BotFactoryProperties props = new BotFactoryProperties();
    BotFactoryClient c = new BotFactoryClient(props, new ObjectMapper());
    assertThat(c.chat("bf-1", "hello", "pon:conv-1")).isNull();
  }
}
