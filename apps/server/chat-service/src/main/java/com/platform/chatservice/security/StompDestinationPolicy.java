package com.platform.chatservice.security;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Which STOMP destinations a client may SUBSCRIBE / SEND to. Everything not listed here is refused
 * by {@link AuthChannelInterceptor}.
 *
 * <p>SUBSCRIBE is an allow-list ({@link #SUBSCRIBE_ALLOW_LIST}) — the in-memory SimpleBroker
 * resolves wildcard patterns, so a client subscribed to {@code /topic/**} used to receive every
 * conversation's private frames. Conversation topics additionally require membership, checked by
 * the interceptor against the {@code conversationId} captured by the rule.
 *
 * <p>SEND is only allowed to the application prefix ({@code /app/**}); a SEND straight to a broker
 * destination ({@code /topic/...}, {@code /queue/...}, {@code /user/...}) would be fanned out to
 * the subscribers verbatim, letting a non-member inject forged frames (spoofed {@code senderId}).
 */
public final class StompDestinationPolicy {

  /** Application destination prefix handled by {@code @MessageMapping} controllers. */
  public static final String APP_PREFIX = "/app/";

  /** Conversation topic root shared by the message and typing topics. */
  public static final String CONVERSATION_TOPIC_PREFIX = "/topic/conversation/";

  private static final String CONVERSATION_ID = "(?<conversationId>[A-Za-z0-9_-]{1,64})";

  /**
   * One allowed subscription shape. {@code requiresMembership} rules capture a {@code
   * conversationId} group the subscriber must be a participant of.
   */
  public record Rule(Pattern pattern, boolean requiresMembership) {
    static Rule exact(String destination) {
      return new Rule(Pattern.compile(Pattern.quote(destination)), false);
    }

    static Rule conversation(String regex) {
      return new Rule(Pattern.compile(regex), true);
    }
  }

  /**
   * THE subscription allow-list — every destination used by web, Flutter and the in-flight
   * branches. Extend here (and only here) when a client needs a new topic.
   */
  public static final List<Rule> SUBSCRIBE_ALLOW_LIST =
      List.of(
          Rule.exact("/user/queue/notifications"),
          Rule.exact("/user/queue/webrtc"),
          Rule.exact("/topic/presence"),
          Rule.conversation(Pattern.quote(CONVERSATION_TOPIC_PREFIX) + CONVERSATION_ID),
          Rule.conversation(
              Pattern.quote(CONVERSATION_TOPIC_PREFIX) + CONVERSATION_ID + "/typing"));

  private static final Pattern CONVERSATION_TOPIC =
      Pattern.compile(Pattern.quote(CONVERSATION_TOPIC_PREFIX) + CONVERSATION_ID + "(?:/typing)?");

  /** Result of evaluating a SUBSCRIBE destination. */
  public record SubscribeDecision(boolean allowed, String conversationId) {
    static final SubscribeDecision DENIED = new SubscribeDecision(false, null);
  }

  private StompDestinationPolicy() {}

  /**
   * Evaluate a SUBSCRIBE destination against the allow-list. A non-null {@code conversationId} in
   * an allowed decision means the caller must still verify membership.
   */
  public static SubscribeDecision evaluateSubscribe(String destination) {
    if (destination == null || hasForbiddenSyntax(destination)) {
      return SubscribeDecision.DENIED;
    }
    for (Rule rule : SUBSCRIBE_ALLOW_LIST) {
      Matcher m = rule.pattern().matcher(destination);
      if (m.matches()) {
        return new SubscribeDecision(
            true, rule.requiresMembership() ? m.group("conversationId") : null);
      }
    }
    return SubscribeDecision.DENIED;
  }

  /** SEND frames may only target {@code @MessageMapping} handlers under {@code /app/}. */
  public static boolean isAllowedSend(String destination) {
    return destination != null
        && destination.startsWith(APP_PREFIX)
        && destination.length() > APP_PREFIX.length()
        && !hasForbiddenSyntax(destination);
  }

  /**
   * The conversation id of a {@code /topic/conversation/{id}} or {@code .../{id}/typing} broker
   * destination, or null for any other destination. Used by the outbound membership filter.
   */
  public static String conversationIdOfTopic(String destination) {
    if (destination == null || !destination.startsWith(CONVERSATION_TOPIC_PREFIX)) {
      return null;
    }
    Matcher m = CONVERSATION_TOPIC.matcher(destination);
    return m.matches() ? m.group("conversationId") : null;
  }

  /**
   * Pattern / traversal syntax that has no business in a client destination: SimpleBroker treats
   * {@code *} and {@code **} (Ant-style) as wildcards, {@code {}} as template variables, and {@code
   * ?} as a single-char wildcard.
   */
  static boolean hasForbiddenSyntax(String destination) {
    return destination.indexOf('*') >= 0
        || destination.indexOf('?') >= 0
        || destination.indexOf('{') >= 0
        || destination.indexOf('}') >= 0
        || destination.contains("..")
        || destination.indexOf('\\') >= 0
        || destination.chars().anyMatch(ch -> ch < 0x20 || ch == 0x7F);
  }
}
