package com.platform.chatservice.service;

import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Decides whether the server may open an outbound HTTP connection to a user-supplied URL (link
 * previews). Only {@code http}/{@code https} on standard web ports, never a single-label / local
 * hostname (Docker service names such as {@code rabbitmq} or {@code chat-service}), and every
 * address the host resolves to must be a public unicast address — so loopback, RFC 1918, CGNAT,
 * link-local (incl. the 169.254.169.254 cloud metadata endpoint), unique-local, unspecified,
 * multicast, reserved and IPv4-embedding IPv6 ranges are all refused.
 *
 * <p>DNS rebinding: the check resolves the host, and the HTTP client resolves it again right after.
 * Both go through the JVM's positive DNS cache (30 s by default), so they see the same answer; a
 * redirect is re-checked hop by hop by the caller.
 */
public final class SsrfGuard {

  private static final Set<Integer> ALLOWED_PORTS = Set.of(-1, 80, 443, 8080, 8443);

  private static final List<String> BLOCKED_SUFFIXES =
      List.of(".localhost", ".local", ".internal", ".home.arpa", ".localdomain");

  private SsrfGuard() {}

  /** True iff {@code uri} is an http(s) URL whose host resolves only to public addresses. */
  public static boolean isAllowedTarget(URI uri) {
    if (uri == null || uri.getScheme() == null || uri.getRawUserInfo() != null) {
      return false;
    }
    String scheme = uri.getScheme().toLowerCase(Locale.ROOT);
    if (!scheme.equals("http") && !scheme.equals("https")) {
      return false;
    }
    if (!ALLOWED_PORTS.contains(uri.getPort())) {
      return false;
    }
    String host = normalizeHost(uri.getHost());
    if (host == null || isBlockedHostname(host)) {
      return false;
    }
    try {
      InetAddress[] addresses = InetAddress.getAllByName(host);
      if (addresses.length == 0) {
        return false;
      }
      for (InetAddress address : addresses) {
        if (!isPublicAddress(address)) {
          return false;
        }
      }
      return true;
    } catch (UnknownHostException | SecurityException e) {
      return false;
    }
  }

  /** Lower-cased host without IPv6 brackets or a trailing dot; null when absent. */
  static String normalizeHost(String rawHost) {
    if (rawHost == null) return null;
    String host = rawHost.trim().toLowerCase(Locale.ROOT);
    if (host.startsWith("[") && host.endsWith("]")) {
      host = host.substring(1, host.length() - 1);
    }
    while (host.endsWith(".")) {
      host = host.substring(0, host.length() - 1);
    }
    return host.isEmpty() ? null : host;
  }

  /**
   * Hostnames that can only mean "something on this network": single-label names (Docker /
   * Kubernetes service names, {@code localhost}, bare decimal IPs like {@code 2130706433}) and
   * local-only suffixes. IP literals pass through to the address check.
   */
  static boolean isBlockedHostname(String host) {
    if (host.indexOf(':') >= 0) {
      return false; // IPv6 literal — judged by isPublicAddress
    }
    if (host.indexOf('.') < 0) {
      return true;
    }
    if (host.equals("localhost")) {
      return true;
    }
    for (String suffix : BLOCKED_SUFFIXES) {
      if (host.endsWith(suffix)) {
        return true;
      }
    }
    return false;
  }

  /** True only for globally routable unicast addresses. */
  public static boolean isPublicAddress(InetAddress address) {
    if (address.isAnyLocalAddress()
        || address.isLoopbackAddress()
        || address.isLinkLocalAddress()
        || address.isSiteLocalAddress()
        || address.isMulticastAddress()) {
      return false;
    }
    byte[] b = address.getAddress();
    if (address instanceof Inet4Address) {
      return isPublicIpv4(b);
    }
    if (address instanceof Inet6Address) {
      return isPublicIpv6(b);
    }
    return false;
  }

  private static boolean isPublicIpv4(byte[] b) {
    int b0 = b[0] & 0xFF;
    int b1 = b[1] & 0xFF;
    int b2 = b[2] & 0xFF;
    if (b0 == 0) return false; // 0.0.0.0/8 "this network"
    if (b0 == 10 || b0 == 127) return false; // RFC 1918 / loopback
    if (b0 == 100 && (b1 & 0xC0) == 64) return false; // 100.64.0.0/10 CGNAT
    if (b0 == 169 && b1 == 254) return false; // link-local, cloud metadata
    if (b0 == 172 && (b1 & 0xF0) == 16) return false; // 172.16.0.0/12
    if (b0 == 192 && b1 == 168) return false; // 192.168.0.0/16
    if (b0 == 192 && b1 == 0 && b2 == 0) return false; // 192.0.0.0/24 IETF protocol
    if (b0 == 192 && b1 == 0 && b2 == 2) return false; // TEST-NET-1
    if (b0 == 198 && (b1 & 0xFE) == 18) return false; // 198.18.0.0/15 benchmarking
    if (b0 == 198 && b1 == 51 && b2 == 100) return false; // TEST-NET-2
    if (b0 == 203 && b1 == 0 && b2 == 113) return false; // TEST-NET-3
    return b0 < 224; // 224/4 multicast, 240/4 reserved, 255.255.255.255 broadcast
  }

  private static boolean isPublicIpv6(byte[] b) {
    int b0 = b[0] & 0xFF;
    int b1 = b[1] & 0xFF;
    if ((b0 & 0xFE) == 0xFC) return false; // fc00::/7 unique-local
    if (b0 == 0xFE && (b1 & 0xC0) == 0x80) return false; // fe80::/10 link-local
    if (b0 == 0xFF) return false; // multicast
    if (allZero(b, 0, 10)) {
      // ::/96 (IPv4-compatible, incl. :: and ::1) and ::ffff:0:0/96 (IPv4-mapped)
      boolean mapped = (b[10] & 0xFF) == 0xFF && (b[11] & 0xFF) == 0xFF;
      if (mapped) {
        return isPublicIpv4(new byte[] {b[12], b[13], b[14], b[15]});
      }
      return false;
    }
    if (b0 == 0x00 && b1 == 0x64 && (b[2] & 0xFF) == 0xFF && (b[3] & 0xFF) == 0x9B) {
      return false; // 64:ff9b::/96 NAT64 (embeds an IPv4 target)
    }
    if (b0 == 0x20 && b1 == 0x02) return false; // 2002::/16 6to4 (embeds IPv4)
    if (b0 == 0x20 && b1 == 0x01 && b[2] == 0 && b[3] == 0) return false; // 2001::/32 Teredo
    if (b0 == 0x20 && b1 == 0x01 && (b[2] & 0xFF) == 0x0D && (b[3] & 0xFF) == 0xB8) {
      return false; // 2001:db8::/32 documentation
    }
    if (b0 == 0x01 && b1 == 0x00 && allZero(b, 2, 8)) return false; // 100::/64 discard
    return true;
  }

  private static boolean allZero(byte[] b, int from, int to) {
    for (int i = from; i < to; i++) {
      if (b[i] != 0) return false;
    }
    return true;
  }
}
