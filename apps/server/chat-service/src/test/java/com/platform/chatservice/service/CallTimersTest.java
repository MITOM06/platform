package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class CallTimersTest {

  private final CallTimers timers = new CallTimers();

  @AfterEach
  void tearDown() {
    timers.destroy();
  }

  @Test
  void runsTheTaskAfterTheDelayAndSurvivesAFailingOne() throws Exception {
    CountDownLatch ran = new CountDownLatch(1);
    timers.after(
        Duration.ofMillis(10),
        () -> {
          throw new IllegalStateException("boom");
        });
    timers.after(Duration.ofMillis(20), ran::countDown);

    assertThat(ran.await(2, TimeUnit.SECONDS)).isTrue();
  }
}
