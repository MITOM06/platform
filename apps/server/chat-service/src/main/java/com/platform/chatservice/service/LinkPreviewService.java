package com.platform.chatservice.service;

import com.platform.chatservice.dto.LinkPreviewResponse;
import com.platform.chatservice.exception.BadRequestException;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Server-side Open Graph "unfurler". Fetching link metadata client-side is
 * blocked by CORS for most sites, so the Flutter client calls this instead.
 *
 * <p>Kept dependency-free: uses the JDK {@link HttpClient} and lightweight regex
 * parsing of {@code <meta property="og:*">} / {@code <title>} tags. A short
 * timeout, a capped read size and an http(s)-only guard keep it well-behaved.
 */
@Service
public class LinkPreviewService {

    private static final int MAX_BYTES = 512 * 1024; // 512 KB of HTML is plenty for <head>
    private static final Duration TIMEOUT = Duration.ofSeconds(6);

    private final HttpClient httpClient = HttpClient.newBuilder()
        .connectTimeout(TIMEOUT)
        .followRedirects(HttpClient.Redirect.NORMAL)
        .build();

    public LinkPreviewResponse fetch(String url) {
        if (url == null || url.isBlank()) {
            throw new BadRequestException("url is required");
        }
        URI uri;
        try {
            uri = URI.create(url.trim());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid url");
        }
        String scheme = uri.getScheme();
        if (scheme == null || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))) {
            throw new BadRequestException("Only http/https urls are supported");
        }

        String html = download(uri);
        if (html == null) {
            // Couldn't fetch — return a minimal card so the client still shows the link.
            return new LinkPreviewResponse(url, null, null, null, null);
        }

        String title = firstNonBlank(
            metaContent(html, "og:title"),
            metaContent(html, "twitter:title"),
            titleTag(html));
        String description = firstNonBlank(
            metaContent(html, "og:description"),
            metaContent(html, "twitter:description"),
            metaNameContent(html, "description"));
        String image = firstNonBlank(
            metaContent(html, "og:image"),
            metaContent(html, "twitter:image"));
        String siteName = metaContent(html, "og:site_name");

        return new LinkPreviewResponse(
            url,
            decode(title),
            decode(description),
            absolutize(uri, image),
            decode(siteName));
    }

    private String download(URI uri) {
        try {
            HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(TIMEOUT)
                .header("User-Agent", "Mozilla/5.0 (compatible; PON-LinkPreview/1.0)")
                .header("Accept", "text/html,application/xhtml+xml")
                .GET()
                .build();
            HttpResponse<byte[]> response =
                httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() / 100 != 2) return null;
            String contentType = response.headers().firstValue("content-type").orElse("");
            if (!contentType.isBlank() && !contentType.toLowerCase().contains("html")) {
                return null;
            }
            byte[] body = response.body();
            int len = Math.min(body.length, MAX_BYTES);
            return new String(body, 0, len, java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception e) {
            // Network error / timeout / DNS — degrade gracefully.
            return null;
        }
    }

    /** Matches both attribute orders: property-then-content and content-then-property. */
    private String metaContent(String html, String property) {
        String p = Pattern.quote(property);
        Matcher m = Pattern.compile(
            "<meta[^>]+property=[\"']" + p + "[\"'][^>]+content=[\"']([^\"']*)[\"']",
            Pattern.CASE_INSENSITIVE).matcher(html);
        if (m.find()) return m.group(1);
        m = Pattern.compile(
            "<meta[^>]+content=[\"']([^\"']*)[\"'][^>]+property=[\"']" + p + "[\"']",
            Pattern.CASE_INSENSITIVE).matcher(html);
        return m.find() ? m.group(1) : null;
    }

    private String metaNameContent(String html, String name) {
        String p = Pattern.quote(name);
        Matcher m = Pattern.compile(
            "<meta[^>]+name=[\"']" + p + "[\"'][^>]+content=[\"']([^\"']*)[\"']",
            Pattern.CASE_INSENSITIVE).matcher(html);
        return m.find() ? m.group(1) : null;
    }

    private String titleTag(String html) {
        Matcher m = Pattern.compile("<title[^>]*>([^<]*)</title>", Pattern.CASE_INSENSITIVE)
            .matcher(html);
        return m.find() ? m.group(1).trim() : null;
    }

    /** Resolve a possibly-relative image URL against the page URL. */
    private String absolutize(URI base, String image) {
        if (image == null || image.isBlank()) return null;
        try {
            return base.resolve(image.trim()).toString();
        } catch (Exception e) {
            return image;
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
