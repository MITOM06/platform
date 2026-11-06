package com.platform.chatservice.service.meeting;

import java.util.concurrent.ConcurrentHashMap;

/**
 * Tiny in-memory per-key token bucket for the high-frequency {@code /app/meet.transcript} path. Per
 * instance and best-effort on purpose: a miss only means a few extra dropped/kept lines.
 */
final class SpeechRateLimiter {

  private static final int MAX_KEYS = 10_000;

  private static final class Bucket {
    double tokens;
    long lastNanos;
  }

  private final double perSecond;
  private final int burst;
  private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();

  SpeechRateLimiter(double perSecond, int burst) {
    this.perSecond = perSecond;
    this.burst = burst;
  }

  boolean tryAcquire(String key) {
    long now = System.nanoTime();
    if (buckets.size() >= MAX_KEYS) {
      buckets.clear(); // a cleared bucket is just a full one: harmless
    }
    Bucket b =
        buckets.computeIfAbsent(
            key,
            k -> {
              Bucket nb = new Bucket();
              nb.tokens = burst;
              nb.lastNanos = now;
              return nb;
            });
    synchronized (b) {
      b.tokens = Math.min(burst, b.tokens + (now - b.lastNanos) / 1e9 * perSecond);
      b.lastNanos = now;
      if (b.tokens < 1) {
        return false;
      }
      b.tokens -= 1;
      return true;
    }
  }
}
