package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.platform.chatservice.dto.LinkPreviewResponse;
import com.platform.chatservice.exception.BadRequestException;
import com.platform.chatservice.exception.ErrorCodes;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Flow;
import java.util.function.Predicate;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class LinkPreviewServiceTest {

  /** A canned response for one path of the stub server. */
  private record Route(int status, Map<String, String> headers, byte[] body, long delayMs) {}

  private HttpServer server;
  private String base;
  private final Map<String, Route> routes = new ConcurrentHashMap<>();
  private final List<String> hits = new CopyOnWriteArrayList<>();
  private final Map<String, String> lastHeaders = new ConcurrentHashMap<>();

  @BeforeEach
  void setUp() throws IOException {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.setExecutor(java.util.concurrent.Executors.newCachedThreadPool());
    server.createContext("/", this::handle);
    server.start();
    base = "http://127.0.0.1:" + server.getAddress().getPort();
  }

  @AfterEach
  void tearDown() {
    server.stop(0);
  }

  private void handle(HttpExchange exchange) throws IOException {
    String path = exchange.getRequestURI().getPath();
    hits.add(path);
    String ua = exchange.getRequestHeaders().getFirst("User-Agent");
    if (ua != null) lastHeaders.put("User-Agent", ua);
    String accept = exchange.getRequestHeaders().getFirst("Accept");
    if (accept != null) lastHeaders.put("Accept", accept);
    Route route = routes.get(path);
    if (route == null) {
      exchange.sendResponseHeaders(404, -1);
      exchange.close();
      return;
    }
    if (route.delayMs() > 0) {
      try {
        Thread.sleep(route.delayMs());
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      }
    }
    route.headers().forEach((k, v) -> exchange.getResponseHeaders().add(k, v));
    byte[] body = route.body();
    try {
      exchange.sendResponseHeaders(route.status(), body.length == 0 ? -1 : body.length);
      if (body.length > 0) {
        try (OutputStream os = exchange.getResponseBody()) {
          os.write(body);
        }
      }
    } catch (IOException ignored) {
      // client may cancel the stream (capped body) — that's expected
    } finally {
      exchange.close();
    }
  }

  private void html(String path, String html) {
    routes.put(
        path,
        new Route(
            200,
            Map.of("Content-Type", "text/html; charset=utf-8"),
            html.getBytes(StandardCharsets.UTF_8),
            0));
  }

  private void redirect(String path, String location) {
    routes.put(path, new Route(302, Map.of("Location", location), new byte[0], 0));
  }

  private LinkPreviewService service() {
    return service(uri -> true, Duration.ofSeconds(5));
  }

  private LinkPreviewService service(Predicate<URI> guard, Duration timeout) {
    HttpClient client =
        HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();
    return new LinkPreviewService(client, guard, timeout);
  }

  // ---------------------------------------------------------------- input validation

  @Test
  void fetch_rejectsNullAndBlankUrl() {
    LinkPreviewService svc = service();
    BadRequestException e1 = assertThrows(BadRequestException.class, () -> svc.fetch(null));
    assertEquals(ErrorCodes.INVALID_URL, e1.getCode());
    assertEquals("url is required", e1.getMessage());
    BadRequestException e2 = assertThrows(BadRequestException.class, () -> svc.fetch("   "));
    assertEquals("url is required", e2.getMessage());
  }

  @Test
  void fetch_rejectsTooLongUrl() {
    String url = "https://example.com/" + "a".repeat(2100);
    BadRequestException e = assertThrows(BadRequestException.class, () -> service().fetch(url));
    assertEquals(ErrorCodes.INVALID_URL, e.getCode());
    assertEquals("url is too long", e.getMessage());
  }

  @Test
  void fetch_rejectsMalformedUrl() {
    BadRequestException e =
        assertThrows(BadRequestException.class, () -> service().fetch("http://exa mple.com/"));
    assertEquals("Invalid url", e.getMessage());
  }

  @Test
  void fetch_rejectsNonHttpSchemesAndRelativeUrls() {
    LinkPreviewService svc = service();
    for (String bad : List.of("ftp://example.com/x", "file:///etc/passwd", "/relative/path")) {
      BadRequestException e = assertThrows(BadRequestException.class, () -> svc.fetch(bad));
      assertEquals("Only absolute http/https urls are supported", e.getMessage(), bad);
    }
    // scheme ok, but no host
    BadRequestException e = assertThrows(BadRequestException.class, () -> svc.fetch("http:///x"));
    assertEquals(ErrorCodes.INVALID_URL, e.getCode());
  }

  // ---------------------------------------------------------------- happy path parsing

  @Test
  void fetch_extractsOpenGraphMetadata_andDecodesEntities() {
    html(
        "/page",
        "<html><head>"
            + "<meta property=\"og:title\" content=\"Tom &amp; Jerry &quot;Show&quot;\">"
            + "<meta property='og:description' content='It&#39;s &lt;fun&gt;&nbsp;'>"
            + "<meta property=\"og:image\" content=\"/img/cover.png\">"
            + "<meta property=\"og:site_name\" content=\"Cartoons &apos;R Us\">"
            + "<title>Ignored title</title></head></html>");

    String url = base + "/page";
    LinkPreviewResponse r = service().fetch(url);

    assertEquals(url, r.url());
    assertEquals("Tom & Jerry \"Show\"", r.title());
    assertEquals("It's <fun>", r.description());
    assertEquals(base + "/img/cover.png", r.image());
    assertEquals("Cartoons 'R Us", r.siteName());
    assertEquals("Mozilla/5.0 (compatible; PON-LinkPreview/1.0)", lastHeaders.get("User-Agent"));
    assertEquals("text/html,application/xhtml+xml", lastHeaders.get("Accept"));
  }

  @Test
  void fetch_matchesContentBeforeProperty_andFallsBackToTwitterTags() {
    html(
        "/tw",
        "<head>"
            + "<meta content=\"Reversed Title\" property=\"og:title\">"
            + "<meta property=\"twitter:description\" content=\"tw desc\">"
            + "<meta property=\"twitter:image\" content=\"https://cdn.example.com/a.jpg\">"
            + "</head>");

    LinkPreviewResponse r = service().fetch(base + "/tw");

    assertEquals("Reversed Title", r.title());
    assertEquals("tw desc", r.description());
    assertEquals("https://cdn.example.com/a.jpg", r.image());
    assertNull(r.siteName());
  }

  @Test
  void fetch_fallsBackToTitleTagAndMetaNameDescription() {
    html(
        "/plain",
        "<html><head><TITLE lang=\"en\">  Plain Page  </TITLE>"
            + "<meta name=\"description\" content=\"meta name desc\"></head></html>");

    LinkPreviewResponse r = service().fetch(base + "/plain");

    assertEquals("Plain Page", r.title());
    assertEquals("meta name desc", r.description());
    assertNull(r.image());
    assertNull(r.siteName());
  }

  @Test
  void fetch_blankOgValuesFallThroughToNextCandidate() {
    html(
        "/blank",
        "<meta property=\"og:title\" content=\"   \">"
            + "<meta property=\"twitter:title\" content=\"From Twitter\">"
            + "<meta property=\"og:image\" content=\"  \">");

    LinkPreviewResponse r = service().fetch(base + "/blank");

    assertEquals("From Twitter", r.title());
    assertNull(r.description());
    assertNull(r.image());
  }

  @Test
  void fetch_dropsNonHttpImageUrls() {
    html("/js", "<meta property=\"og:image\" content=\"javascript:alert(1)\"><title>T</title>");

    LinkPreviewResponse r = service().fetch(base + "/js");

    assertEquals("T", r.title());
    assertNull(r.image());
  }

  @Test
  void fetch_dropsUnresolvableImageUrls() {
    html("/badimg", "<meta property=\"og:image\" content=\"http://bad host/x.png\">");

    assertNull(service().fetch(base + "/badimg").image());
  }

  @Test
  void fetch_acceptsMissingContentType() {
    routes.put(
        "/noct",
        new Route(200, Map.of(), "<title>No CT</title>".getBytes(StandardCharsets.UTF_8), 0));

    assertEquals("No CT", service().fetch(base + "/noct").title());
  }

  // ---------------------------------------------------------------- degrade to minimal card

  @Test
  void fetch_nonHtmlContent_returnsMinimalCard() {
    routes.put(
        "/json",
        new Route(
            200,
            Map.of("Content-Type", "application/json"),
            "{\"title\":\"x\"}".getBytes(StandardCharsets.UTF_8),
            0));

    String url = base + "/json";
    assertEquals(new LinkPreviewResponse(url, null, null, null, null), service().fetch(url));
  }

  @Test
  void fetch_non2xx_returnsMinimalCard() {
    routes.put(
        "/err",
        new Route(
            500,
            Map.of("Content-Type", "text/html"),
            "<title>Error page</title>".getBytes(StandardCharsets.UTF_8),
            0));

    String url = base + "/err";
    assertEquals(new LinkPreviewResponse(url, null, null, null, null), service().fetch(url));
  }

  @Test
  void fetch_guardRefusal_returnsMinimalCard_withoutContactingHost() {
    html("/secret", "<title>Internal</title>");

    String url = base + "/secret";
    LinkPreviewResponse r = service(uri -> false, Duration.ofSeconds(5)).fetch(url);

    assertEquals(new LinkPreviewResponse(url, null, null, null, null), r);
    assertTrue(hits.isEmpty(), "guarded target must never be requested");
  }

  @Test
  void fetch_connectionRefused_returnsMinimalCard() throws IOException {
    int deadPort;
    try (java.net.ServerSocket s = new java.net.ServerSocket(0)) {
      deadPort = s.getLocalPort();
    }
    String url = "http://127.0.0.1:" + deadPort + "/";

    assertEquals(new LinkPreviewResponse(url, null, null, null, null), service().fetch(url));
  }

  @Test
  void download_timesOut_returnsNull() {
    routes.put(
        "/slow",
        new Route(
            200,
            Map.of("Content-Type", "text/html"),
            "<title>slow</title>".getBytes(StandardCharsets.UTF_8),
            1500));

    long start = System.nanoTime();
    String body = service(uri -> true, Duration.ofMillis(200)).download(URI.create(base + "/slow"));
    long elapsedMs = (System.nanoTime() - start) / 1_000_000;

    assertNull(body);
    assertTrue(elapsedMs < 1400, "should give up at the deadline, took " + elapsedMs + "ms");
  }

  @Test
  void download_zeroTimeout_returnsNullBeforeAnyRequest() {
    html("/x", "<title>x</title>");

    assertNull(service(uri -> true, Duration.ZERO).download(URI.create(base + "/x")));
    assertTrue(hits.isEmpty());
  }

  // ---------------------------------------------------------------- redirects

  @Test
  void download_followsRedirects_upToLimit() {
    redirect("/r1", "/r2");
    redirect("/r2", base + "/r3");
    redirect("/r3", "/final");
    html("/final", "<title>Final</title>");

    LinkPreviewResponse r = service().fetch(base + "/r1");

    assertEquals("Final", r.title());
    assertEquals(List.of("/r1", "/r2", "/r3", "/final"), hits);
  }

  @Test
  void download_tooManyRedirects_returnsNull() {
    redirect("/a", "/b");
    redirect("/b", "/c");
    redirect("/c", "/d");
    redirect("/d", "/e");
    html("/e", "<title>Too far</title>");

    assertNull(service().download(URI.create(base + "/a")));
    assertEquals(List.of("/a", "/b", "/c", "/d"), hits);
  }

  @Test
  void download_redirectWithoutLocation_returnsNull() {
    routes.put("/noloc", new Route(301, Map.of(), new byte[0], 0));

    assertNull(service().download(URI.create(base + "/noloc")));
  }

  @Test
  void download_redirectToInvalidLocation_returnsNull() {
    redirect("/badloc", "http://bad host/");

    assertNull(service().download(URI.create(base + "/badloc")));
  }

  @Test
  void download_eachRedirectHopIsCheckedByGuard() {
    redirect("/start", "/internal");
    html("/internal", "<title>Internal</title>");
    List<URI> checked = new ArrayList<>();
    Predicate<URI> guard =
        uri -> {
          checked.add(uri);
          return !uri.getPath().equals("/internal");
        };

    assertNull(service(guard, Duration.ofSeconds(5)).download(URI.create(base + "/start")));
    assertEquals(List.of(URI.create(base + "/start"), URI.create(base + "/internal")), checked);
    assertEquals(List.of("/start"), hits);
  }

  @Test
  void download_bodyIsCappedAtMaxBytes() {
    byte[] big = new byte[LinkPreviewService.MAX_BYTES + 200_000];
    java.util.Arrays.fill(big, (byte) 'a');
    routes.put("/big", new Route(200, Map.of("Content-Type", "text/html"), big, 0));

    String body = service().download(URI.create(base + "/big"));

    assertEquals(LinkPreviewService.MAX_BYTES, body.length());
  }

  // ---------------------------------------------------------------- CappedBodySubscriber

  private static final class FakeSubscription implements Flow.Subscription {
    long requested;
    boolean cancelled;

    @Override
    public void request(long n) {
      requested += n;
    }

    @Override
    public void cancel() {
      cancelled = true;
    }
  }

  private static byte[] join(java.util.concurrent.CompletionStage<byte[]> stage)
      throws ExecutionException, InterruptedException {
    return stage.toCompletableFuture().get();
  }

  @Test
  void cappedSubscriber_zeroCap_cancelsImmediatelyWithEmptyBody() throws Exception {
    LinkPreviewService.CappedBodySubscriber sub = new LinkPreviewService.CappedBodySubscriber(0);
    FakeSubscription s = new FakeSubscription();

    sub.onSubscribe(s);

    assertTrue(s.cancelled);
    assertEquals(0, s.requested);
    assertArrayEquals(new byte[0], join(sub.getBody()));
  }

  @Test
  void cappedSubscriber_collectsUntilCompleteBelowCap() throws Exception {
    LinkPreviewService.CappedBodySubscriber sub = new LinkPreviewService.CappedBodySubscriber(10);
    FakeSubscription s = new FakeSubscription();
    sub.onSubscribe(s);
    assertEquals(1, s.requested);

    sub.onNext(List.of(ByteBuffer.wrap("abc".getBytes()), ByteBuffer.wrap("de".getBytes())));
    assertEquals(2, s.requested);
    assertTrue(!sub.getBody().toCompletableFuture().isDone());

    sub.onComplete();
    assertArrayEquals("abcde".getBytes(), join(sub.getBody()));
    assertTrue(!s.cancelled);
  }

  @Test
  void cappedSubscriber_truncatesAndCancelsAtCap_ignoresLaterChunks() throws Exception {
    LinkPreviewService.CappedBodySubscriber sub = new LinkPreviewService.CappedBodySubscriber(4);
    FakeSubscription s = new FakeSubscription();
    sub.onSubscribe(s);

    sub.onNext(List.of(ByteBuffer.wrap("abc".getBytes()), ByteBuffer.wrap("defgh".getBytes())));

    assertTrue(s.cancelled);
    assertArrayEquals("abcd".getBytes(), join(sub.getBody()));
    long requestedBefore = s.requested;
    sub.onNext(List.of(ByteBuffer.wrap("zzz".getBytes())));
    assertEquals(requestedBefore, s.requested);
    assertArrayEquals("abcd".getBytes(), join(sub.getBody()));
  }

  @Test
  void cappedSubscriber_onErrorCompletesExceptionally() {
    LinkPreviewService.CappedBodySubscriber sub = new LinkPreviewService.CappedBodySubscriber(4);
    sub.onSubscribe(new FakeSubscription());
    IOException boom = new IOException("reset");

    sub.onError(boom);

    ExecutionException e = assertThrows(ExecutionException.class, () -> join(sub.getBody()));
    assertThat(e.getCause()).isSameAs(boom);
  }
}
