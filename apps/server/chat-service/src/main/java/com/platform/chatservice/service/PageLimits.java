package com.platform.chatservice.service;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

/** Bounds for client-supplied paging parameters on list endpoints. */
public final class PageLimits {

  /** Hard cap on {@code size} for every list endpoint. */
  public static final int MAX_PAGE_SIZE = 100;

  private PageLimits() {}

  /** {@code requested} clamped to [1, {@link #MAX_PAGE_SIZE}]; non-positive → {@code fallback}. */
  public static int size(int requested, int fallback) {
    if (requested <= 0) {
      return Math.min(fallback, MAX_PAGE_SIZE);
    }
    return Math.min(requested, MAX_PAGE_SIZE);
  }

  public static PageRequest of(int page, int size, int fallbackSize) {
    return PageRequest.of(Math.max(0, page), size(size, fallbackSize));
  }

  public static PageRequest of(int page, int size, int fallbackSize, Sort sort) {
    return PageRequest.of(Math.max(0, page), size(size, fallbackSize), sort);
  }
}
