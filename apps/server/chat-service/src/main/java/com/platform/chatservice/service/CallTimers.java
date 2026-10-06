package com.platform.chatservice.service;

import java.time.Duration;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.stereotype.Component;

/**
 * Delayed checks for calls (an unanswered ring, a dropped participant). In-memory and per instance:
 * a check lost to a restart is backstopped by LiveKit closing empty rooms and by the busy key's
 * TTL. Its own thread so it never competes with the STOMP heartbeat scheduler.
 */
@Slf4j
@Component
public class CallTimers implements DisposableBean {

  private final ScheduledExecutorService executor =
      Executors.newSingleThreadScheduledExecutor(
          r -> {
            Thread t = new Thread(r, "call-timers");
            t.setDaemon(true);
            return t;
          });

  public void after(Duration delay, Runnable task) {
    executor.schedule(
        () -> {
          try {
            task.run();
          } catch (RuntimeException e) {
            log.error("Delayed call check failed", e);
          }
        },
        delay.toMillis(),
        TimeUnit.MILLISECONDS);
  }

  @Override
  public void destroy() {
    executor.shutdownNow();
  }
}
