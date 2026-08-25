package com.platform.chatservice.config;

import jakarta.annotation.PostConstruct;
import java.util.ArrayList;
import java.util.List;
import java.util.function.UnaryOperator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Refuses to start the {@code prod} profile when a backing-service address still points at a
 * developer's machine.
 *
 * <p>Every infrastructure property in {@code application.yml} carries a localhost default so the
 * service runs from a fresh clone with no environment at all. That convenience is
 * fail-<em>open</em> in production: a secret that is missing, renamed or mistyped does not break
 * the deploy, it silently yields a revision that dials {@code localhost} and finds nothing there.
 * We have paid for this twice — a RabbitMQ virtual host left at {@code /} made the AI go silent in
 * production, and the same shape of gap kept chat-service from booting at all under self-host.
 *
 * <p>The check runs on the resolved {@link Environment}, so it covers every layer that can supply a
 * value (env var, compose, Cloud Run) rather than only what this file can see. It is deliberately
 * limited to addresses: a wrong password is loud and immediate, a wrong host is not.
 */
@Component
@Profile("prod")
@RequiredArgsConstructor
@Slf4j
public class ProdEnvironmentGuard {

  /** A resolved Spring property and the environment variable operators actually set. */
  private record Address(String property, String envVar) {}

  private static final List<Address> REQUIRED =
      List.of(
          new Address("spring.data.mongodb.uri", "SPRING_DATA_MONGODB_URI"),
          new Address("spring.data.redis.url", "SPRING_DATA_REDIS_URL / SPRING_DATA_REDIS_HOST"),
          new Address("spring.rabbitmq.host", "SPRING_RABBITMQ_HOST"));

  /** Hosts that can only ever mean "this container", never a real backing service. */
  private static final List<String> LOOPBACK = List.of("localhost", "127.0.0.1", "0.0.0.0", "::1");

  private final Environment environment;

  @PostConstruct
  void verify() {
    List<String> problems = findProblems(environment::getProperty);
    if (!problems.isEmpty()) {
      throw new IllegalStateException(
          "Refusing to start the prod profile with development infrastructure addresses:\n  - "
              + String.join("\n  - ", problems)
              + "\nSet the environment variables above to the real backing services "
              + "(see .github/workflows/deploy.yml and infra/docker-compose/compose.prod.yml).");
    }
    warnOnSuspiciousRabbitVhost();
    log.info("prod environment guard: all backing-service addresses look external");
  }

  /**
   * Pure form of the check so it can be unit-tested without a Spring context. Returns one message
   * per offending address; empty means the environment is acceptable.
   */
  static List<String> findProblems(UnaryOperator<String> resolver) {
    List<String> problems = new ArrayList<>();
    for (Address address : REQUIRED) {
      String value = resolver.apply(address.property());
      if (value == null || value.isBlank()) {
        problems.add(address.property() + " is empty — set " + address.envVar());
      } else if (pointsAtLoopback(value)) {
        problems.add(
            address.property()
                + " = "
                + value
                + " — that is this container, not a backing service; set "
                + address.envVar());
      }
    }
    return problems;
  }

  private static boolean pointsAtLoopback(String value) {
    String lower = value.toLowerCase();
    return LOOPBACK.stream().anyMatch(lower::contains);
  }

  /**
   * CloudAMQP (and every other managed broker we use over TLS) issues a named virtual host; the
   * broker default {@code /} exists but holds none of our queues, so publishing succeeds into
   * nowhere. Self-hosting a broker on the default vhost is legitimate, so this warns rather than
   * failing.
   */
  private void warnOnSuspiciousRabbitVhost() {
    boolean ssl = Boolean.parseBoolean(environment.getProperty("spring.rabbitmq.ssl.enabled"));
    String vhost = environment.getProperty("spring.rabbitmq.virtual-host");
    if (ssl && "/".equals(vhost)) {
      log.warn(
          "RabbitMQ uses TLS but the virtual host is the broker default '/'. A managed broker "
              + "gives you a named vhost — if SPRING_RABBITMQ_VIRTUAL_HOST is unset, AI requests "
              + "will publish into a vhost that has no consumers.");
    }
  }
}
