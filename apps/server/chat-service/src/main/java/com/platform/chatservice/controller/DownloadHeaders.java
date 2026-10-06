package com.platform.chatservice.controller;

import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.Locale;
import java.util.Set;

/**
 * Response-header policy for user-uploaded files served from the API origin. Anything a browser
 * could execute must never render there: only raster images, audio, video and PDF — and only when
 * their magic bytes match — are served {@code inline}; everything else is an {@code attachment},
 * and active document types (HTML, XML, SVG, scripts) are additionally relabelled {@code
 * application/octet-stream}.
 */
final class DownloadHeaders {

  /** Types a browser could interpret as an active document if rendered. */
  private static final Set<String> ACTIVE_TYPES =
      Set.of(
          "text/html",
          "application/xhtml+xml",
          "text/xml",
          "application/xml",
          "image/svg+xml",
          "text/javascript",
          "application/javascript",
          "application/ecmascript",
          "text/ecmascript",
          "application/x-javascript",
          "text/css",
          "application/wasm",
          "text/x-component",
          "application/x-shockwave-flash");

  /** RFC 5987 {@code attr-char} besides ALPHA / DIGIT. */
  private static final String ATTR_CHAR_EXTRA = "!#$&+-.^_`|~";

  private DownloadHeaders() {}

  /** Lower-cased media type without parameters ({@code "text/html; charset=x"} → text/html). */
  static String baseType(String contentType) {
    if (contentType == null) return "";
    int semi = contentType.indexOf(';');
    String base = semi >= 0 ? contentType.substring(0, semi) : contentType;
    return base.trim().toLowerCase(Locale.ROOT);
  }

  /** May this (already signature-verified) type be rendered inline? */
  static boolean isInlineType(String baseType) {
    if (baseType.startsWith("image/")) {
      return !baseType.contains("svg");
    }
    return baseType.startsWith("audio/")
        || baseType.startsWith("video/")
        || baseType.equals("application/pdf");
  }

  static boolean isActiveType(String baseType) {
    return ACTIVE_TYPES.contains(baseType)
        || baseType.endsWith("+xml")
        || baseType.contains("script")
        || baseType.contains("html");
  }

  /**
   * {@code <disposition>; filename="<ascii fallback>"; filename*=UTF-8''<percent-encoded>} — RFC
   * 6266 / 5987, so non-ASCII (e.g. Vietnamese) names survive and a crafted name can never break
   * out of the header.
   */
  static String contentDisposition(String disposition, String filename) {
    String name = filename == null || filename.isBlank() ? "file" : filename.strip();
    return disposition
        + "; filename=\""
        + asciiFallback(name)
        + "\"; filename*=UTF-8''"
        + rfc5987(name);
  }

  /** Diacritics stripped ("Báo cáo" → "Bao cao"), anything else non-printable-ASCII → '_'. */
  static String asciiFallback(String name) {
    String decomposed =
        Normalizer.normalize(name, Normalizer.Form.NFD)
            .replaceAll("\\p{M}+", "")
            .replace('đ', 'd')
            .replace('Đ', 'D');
    StringBuilder sb = new StringBuilder(decomposed.length());
    for (int i = 0; i < decomposed.length(); i++) {
      char c = decomposed.charAt(i);
      boolean printable = c >= 0x20 && c < 0x7F;
      sb.append(printable && c != '"' && c != '\\' && c != ';' && c != '%' ? c : '_');
    }
    String result = sb.toString().strip();
    return result.isEmpty() ? "file" : result;
  }

  static String rfc5987(String name) {
    byte[] bytes = name.getBytes(StandardCharsets.UTF_8);
    StringBuilder sb = new StringBuilder(bytes.length * 3);
    for (byte raw : bytes) {
      int b = raw & 0xFF;
      boolean alphaNum = (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z') || (b >= '0' && b <= '9');
      if (alphaNum || (b < 0x80 && ATTR_CHAR_EXTRA.indexOf(b) >= 0)) {
        sb.append((char) b);
      } else {
        sb.append('%').append(Character.toUpperCase(Character.forDigit(b >> 4, 16)));
        sb.append(Character.toUpperCase(Character.forDigit(b & 0xF, 16)));
      }
    }
    return sb.toString();
  }
}
