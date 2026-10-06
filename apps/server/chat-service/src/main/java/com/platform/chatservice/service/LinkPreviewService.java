package com.platform.chatservice.service;

import com.platform.chatservice.dto.LinkPreviewResponse;
import com.platform.chatservice.exception.BadRequestException;
import com.platform.chatservice.exception.ErrorCodes;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Flow;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Predicate;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Server-side Open Graph "unfurler". Fetching link metadata client-side is blocked by CORS for most
 * sites, so the clients call this instead.
 *
 * <p>The URL comes from a user, so this is an SSRF surface (it used to return the RabbitMQ
 * management page title for {@code http://127.0.0.1:15692/}). Every hop — the original URL and each
 * redirect — must pass {@link SsrfGuard#isAllowedTarget}; redirects are followed manually (at most
 * {@link #MAX_REDIRECTS}); the body is streamed with a hard {@link #MAX_BYTES} cap; the whole
 * exchange runs under one {@link #TOTAL_TIMEOUT} deadline. A refused or failed fetch yields the
 * same minimal card as an unreachable site (no oracle about internal hosts).
 */
@Service
@Slf4j
public class LinkPreviewService {

  static final int MAX_BYTES = 512 * 1024; // 512 KB of HTML is plenty for <head>
  static final int MAX_REDIRECTS = 3;
  static final Duration TOTAL_TIMEOUT = Duration.ofSeconds(8);
  private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(4);
  private static final int MAX_URL_LENGTH = 2048;

  private final HttpClient httpClient;
  private final Predicate<URI> targetGuard;
  private final Duration totalTimeout;

  public LinkPreviewService() {
    this(
        HttpClient.newBuilder()
            .connectTimeout(CONNECT_TIMEOUT)
            .followRedirects(HttpClient.Redirect.NEVER)
            .build(),
        SsrfGuard::isAllowedTarget,
        TOTAL_TIMEOUT);
  }

  LinkPreviewService(HttpClient httpClient, Predicate<URI> targetGuard, Duration totalTimeout) {
    this.httpClient = httpClient;
    this.targetGuard = targetGuard;
    this.totalTimeout = totalTimeout;
  }

  public LinkPreviewResponse fetch(String url) {
    URI uri = parse(url);
    String html = download(uri);
    if (html == null) {
      // Couldn't (or may not) fetch — return a minimal card so the client still shows the link.
      return new LinkPreviewResponse(url, null, null, null, null);
    }

    String title =
        firstNonBlank(
            metaContent(html, "og:title"), metaContent(html, "twitter:title"), titleTag(html));
    String description =
        firstNonBlank(
            metaContent(html, "og:description"),
            metaContent(html, "twitter:description"),
            metaNameContent(html, "description"));
    String image = firstNonBlank(metaContent(html, "og:image"), metaContent(html, "twitter:image"));
    String siteName = metaContent(html, "og:site_name");

    return new LinkPreviewResponse(
        url, decode(title), decode(description), absolutize(uri, image), decode(siteName));
  }

  private static URI parse(String url) {
    if (url == null || url.isBlank()) {
      throw new BadRequestException(ErrorCodes.INVALID_URL, "url is required");
    }
    if (url.length() > MAX_URL_LENGTH) {
      throw new BadRequestException(ErrorCodes.INVALID_URL, "url is too long");
    }
    URI uri;
    try {
      uri = new URI(url.trim());
    } catch (URISyntaxException e) {
      throw new BadRequestException(ErrorCodes.INVALID_URL, "Invalid url");
    }
    String scheme = uri.getScheme();
    if (scheme == null
        || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))
        || uri.getHost() == null) {
      throw new BadRequestException(
          ErrorCodes.INVALID_URL, "Only absolute http/https urls are supported");
    }
    return uri;
  }

  /** The (capped) HTML of {@code start}, following ≤ MAX_REDIRECTS checked hops; null if none. */
  String download(URI start) {
    long deadline = System.nanoTime() + totalTimeout.toNanos();
    URI current = start;
    for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!targetGuard.test(current)) {
        log.debug("Link preview refused target {}", current);
        return null;
      }
      long remainingMs = TimeUnit.NANOSECONDS.toMillis(deadline - System.nanoTime());
      if (remainingMs <= 0) {
        return null;
      }
      HttpResponse<byte[]> response = exchange(current, remainingMs);
      if (response == null) {
        return null;
      }
      int status = response.statusCode();
      if (status >= 300 && status < 400) {
        Optional<String> location = response.headers().firstValue("location");
        if (location.isEmpty() || location.get().isBlank()) {
          return null;
        }
        try {
          current = current.resolve(location.get().trim());
        } catch (IllegalArgumentException e) {
          return null;
        }
        continue;
      }
      if (status / 100 != 2 || !isHtml(response.headers())) {
        return null;
      }
      byte[] body = response.body();
      return body == null ? null : new String(body, StandardCharsets.UTF_8);
    }
    return null; // too many redirects
  }

  private HttpResponse<byte[]> exchange(URI uri, long timeoutMs) {
    HttpRequest request;
    try {
      request =
          HttpRequest.newBuilder(uri)
              .timeout(Duration.ofMillis(timeoutMs))
              .header("User-Agent", "Mozilla/5.0 (compatible; PON-LinkPreview/1.0)")
              .header("Accept", "text/html,application/xhtml+xml")
              .GET()
              .build();
    } catch (IllegalArgumentException e) {
      return null;
    }
    CompletableFuture<HttpResponse<byte[]>> future =
        httpClient.sendAsync(
            request,
            info ->
                new CappedBodySubscriber(
                    info.statusCode() / 100 == 2 && isHtml(info.headers()) ? MAX_BYTES : 0));
    try {
      return future.get(timeoutMs, TimeUnit.MILLISECONDS);
    } catch (TimeoutException e) {
      future.cancel(true);
      return null;
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      future.cancel(true);
      return null;
    } catch (ExecutionException | RuntimeException e) {
      // Network error / TLS / DNS — degrade gracefully.
      return null;
    }
  }

  private static boolean isHtml(HttpHeaders headers) {
    String contentType = headers.firstValue("content-type").orElse("");
    return contentType.isBlank() || contentType.toLowerCase(Locale.ROOT).contains("html");
  }

  /**
   * Collects at most {@code cap} bytes of the body, then cancels the stream (closing the
   * connection) — a huge or never-ending response can no longer be buffered whole into memory.
   */
  static final class CappedBodySubscriber implements HttpResponse.BodySubscriber<byte[]> {
    private final int cap;
    private final ByteArrayOutputStream buffer = new ByteArrayOutputStream();
    private final CompletableFuture<byte[]> result = new CompletableFuture<>();
    private Flow.Subscription subscription;

    CappedBodySubscriber(int cap) {
      this.cap = cap;
    }

    @Override
    public CompletionStage<byte[]> getBody() {
      return result;
    }

    @Override
    public void onSubscribe(Flow.Subscription s) {
      this.subscription = s;
      if (cap <= 0) {
        s.cancel();
        result.complete(new byte[0]);
        return;
      }
      s.request(1);
    }

    @Override
    public void onNext(List<ByteBuffer> items) {
      if (result.isDone()) {
        return;
      }
      for (ByteBuffer item : items) {
        int take = Math.min(item.remaining(), cap - buffer.size());
        if (take > 0) {
          byte[] chunk = new byte[take];
          item.get(chunk);
          buffer.write(chunk, 0, take);
        }
      }
      if (buffer.size() >= cap) {
        subscription.cancel();
        result.complete(buffer.toByteArray());
      } else {
        subscription.request(1);
      }
    }

    @Override
    public void onError(Throwable throwable) {
      result.completeExceptionally(throwable);
    }

    @Override
    public void onComplete() {
      result.complete(buffer.toByteArray());
    }
  }

  /** Matches both attribute orders: property-then-content and content-then-property. */
  private String metaContent(String html, String property) {
    String p = Pattern.quote(property);
    Matcher m =
        Pattern.compile(
                "<meta[^>]+property=[\"']" + p + "[\"'][^>]+content=[\"']([^\"']*)[\"']",
                Pattern.CASE_INSENSITIVE)
            .matcher(html);
    if (m.find()) return m.group(1);
    m =
        Pattern.compile(
                "<meta[^>]+content=[\"']([^\"']*)[\"'][^>]+property=[\"']" + p + "[\"']",
                Pattern.CASE_INSENSITIVE)
            .matcher(html);
    return m.find() ? m.group(1) : null;
  }

  private String metaNameContent(String html, String name) {
    String p = Pattern.quote(name);
    Matcher m =
        Pattern.compile(
                "<meta[^>]+name=[\"']" + p + "[\"'][^>]+content=[\"']([^\"']*)[\"']",
                Pattern.CASE_INSENSITIVE)
            .matcher(html);
    return m.find() ? m.group(1) : null;
  }

  private String titleTag(String html) {
    Matcher m =
        Pattern.compile("<title[^>]*>([^<]*)</title>", Pattern.CASE_INSENSITIVE).matcher(html);
    return m.find() ? m.group(1).trim() : null;
  }

  /** Resolve a possibly-relative image URL against the page URL; only http(s) results survive. */
  private String absolutize(URI base, String image) {
    if (image == null || image.isBlank()) return null;
    try {
      URI resolved = base.resolve(image.trim());
      String scheme = resolved.getScheme();
      if (scheme == null
          || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))) {
        return null;
      }
      return resolved.toString();
    } catch (Exception e) {
      return null;
    }
  }

  private String firstNonBlank(String... values) {
    for (String v : values) {
      if (v != null && !v.isBlank()) return v.trim();
    }
    return null;
  }

  /** Decode the handful of HTML entities common in titles/descriptions. */
  private String decode(String s) {
    if (s == null) return null;
    return s.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&nbsp;", " ")
        .trim();
  }
}
