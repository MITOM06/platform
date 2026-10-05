package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.InetAddress;
import java.net.URI;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class SsrfGuardTest {

  @ParameterizedTest
  @ValueSource(
      strings = {
        "127.0.0.1",
        "10.1.2.3",
        "172.16.0.1",
        "192.168.1.1",
        "169.254.169.254",
        "100.64.0.1",
        "0.0.0.0",
        "224.0.0.1",
        "240.0.0.1",
        "255.255.255.255",
        "198.18.0.1",
        "::1",
        "::",
        "fe80::1",
        "fc00::1",
        "fd12:3456::1",
        "::ffff:127.0.0.1",
        "64:ff9b::7f00:1",
        "2002:7f00:1::1",
        "2001:db8::1",
        "ff02::1"
      })
  void nonPublicAddresses_areRefused(String literal) throws Exception {
    assertThat(SsrfGuard.isPublicAddress(InetAddress.getByName(literal))).isFalse();
  }

  @ParameterizedTest
  @ValueSource(strings = {"93.184.216.34", "8.8.8.8", "2606:4700:4700::1111"})
  void publicAddresses_areAllowed(String literal) throws Exception {
    assertThat(SsrfGuard.isPublicAddress(InetAddress.getByName(literal))).isTrue();
  }

  /** E2E: link-preview returned the RabbitMQ management title for this URL. */
  @ParameterizedTest
  @ValueSource(
      strings = {
        "http://127.0.0.1:15692/",
        "http://localhost/",
        "http://rabbitmq:15672/",
        "http://chat-service:8080/actuator",
        "http://2130706433/",
        "http://[::1]/",
        "http://169.254.169.254/latest/meta-data/",
        "http://user:pw@example.com/",
        "ftp://example.com/",
        "http://example.com:22/",
        "http://host.docker.internal/"
      })
  void internalTargets_areRefused(String url) {
    assertThat(SsrfGuard.isAllowedTarget(URI.create(url))).isFalse();
  }
}
