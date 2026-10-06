package com.platform.chatservice.service;

import com.platform.chatservice.exception.BadRequestException;
import com.platform.chatservice.exception.ErrorCodes;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Which message types a CLIENT may create. {@code ai}, {@code meeting_summary} and {@code call_log}
 * are written by the server only; {@code system} is accepted from clients solely for the handful of
 * notices the clients themselves emit (nickname / quick-reaction changes, call logs). Without this
 * a member could store {@code type:"system"} with e.g. {@code system.message.pinned:<adminId>}
 * (rendered as "Admin pinned a message") or {@code type:"ai"} (rendered as an assistant reply).
 */
public final class MessageTypePolicy {

  public static final String TEXT = "text";
  public static final String SYSTEM = "system";

  /** Every non-system type the web and Flutter composers send. */
  public static final Set<String> CLIENT_TYPES =
      Set.of(TEXT, "image", "video", "file", "voice", "sticker");

  /** System codes clients legitimately send (see web system-messages.ts / Flutter parsers). */
  public static final List<String> CLIENT_SYSTEM_PREFIXES =
      List.of("system.nickname.changed:", "system.quick_reaction.changed:", "system.call.");

  /**
   * Content shaped like a system code ({@code system.<word>.<word>[...][:args]}). The clients'
   * preview humanizers treat such content as a system notice whatever the message type, so a
   * non-system message may not consist of one. Ordinary text that merely starts with "system."
   * (e.g. {@code system.out.println("hi")}) does not match.
   */
  private static final Pattern SYSTEM_CODE_SHAPE =
      Pattern.compile("^system\\.[a-z_]+(\\.[a-z_]+)+(:.*)?$", Pattern.DOTALL);

  private MessageTypePolicy() {}

  /**
   * The type to store for a client-originated message: {@code null}/blank defaults to {@code text};
   * anything outside the allow-list is rejected with {@code 400 MESSAGE_TYPE_NOT_ALLOWED}.
   */
  public static String resolveClientType(String requestedType, String content) {
    String type = requestedType == null || requestedType.isBlank() ? TEXT : requestedType.trim();
    String body = content == null ? "" : content.trim();
    if (SYSTEM.equals(type)) {
      if (CLIENT_SYSTEM_PREFIXES.stream().anyMatch(body::startsWith)) {
        return SYSTEM;
      }
      throw notAllowed("System message code not allowed from clients");
    }
    if (!CLIENT_TYPES.contains(type)) {
      throw notAllowed("Message type '" + type + "' is not allowed");
    }
    if (SYSTEM_CODE_SHAPE.matcher(body).matches()) {
      throw notAllowed("A " + type + " message may not carry a system code");
    }
    return type;
  }

  /**
   * The type a forwarded copy gets: assistant replies become plain text (the forwarding member is
   * now its author); server-only kinds cannot be forwarded.
   */
  public static String forwardedType(String originalType) {
    String type = originalType == null || originalType.isBlank() ? TEXT : originalType;
    if ("ai".equals(type)) {
      return TEXT;
    }
    if (!CLIENT_TYPES.contains(type)) {
      throw notAllowed("Messages of type '" + type + "' cannot be forwarded");
    }
    return type;
  }

  /** Only plain text addressed to an assistant triggers a model / Bot Factory reply. */
  public static boolean triggersAssistant(String storedType) {
    return TEXT.equals(storedType);
  }

  private static BadRequestException notAllowed(String message) {
    return new BadRequestException(ErrorCodes.MESSAGE_TYPE_NOT_ALLOWED, message);
  }
}
