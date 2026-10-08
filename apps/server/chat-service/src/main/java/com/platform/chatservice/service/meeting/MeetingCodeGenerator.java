package com.platform.chatservice.service.meeting;

import java.security.SecureRandom;
import java.util.Locale;
import java.util.Random;
import org.springframework.stereotype.Component;

/**
 * Generates the human-shareable meeting code ({@code abc-defg-hjk}) and normalizes what people type
 * or paste back into its canonical form.
 *
 * <p>The alphabet drops {@code i l o} so a code read aloud or copied by hand cannot be confused
 * with {@code 1 0}. 23^10 ≈ 4·10^13 codes — a collision is extremely rare; the unique index on
 * {@code meetings.code} plus a retry in the caller handles the rest.
 */
@Component
public class MeetingCodeGenerator {

  public static final String ALPHABET = "abcdefghjkmnpqrstuvwxyz";

  private static final int LENGTH = 10;

  private final Random random;

  public MeetingCodeGenerator() {
    this(new SecureRandom());
  }

  MeetingCodeGenerator(Random random) {
    this.random = random;
  }

  /** A fresh random code in the canonical {@code xxx-xxxx-xxx} form. */
  public String next() {
    StringBuilder letters = new StringBuilder(LENGTH);
    for (int i = 0; i < LENGTH; i++) {
      letters.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
    }
    return format(letters);
  }

  /**
   * Canonical form of a code typed or pasted by a person — case, dashes and whitespace are ignored
   * — or {@code null} when the input cannot be a code this generator produced.
   */
  public static String normalize(String raw) {
    if (raw == null || raw.isBlank()) {
      return null;
    }
    StringBuilder letters = new StringBuilder(LENGTH);
    for (char c : raw.toLowerCase(Locale.ROOT).toCharArray()) {
      if (c == '-' || Character.isWhitespace(c)) {
        continue;
      }
      if (ALPHABET.indexOf(c) < 0) {
        return null;
      }
      letters.append(c);
    }
    return letters.length() == LENGTH ? format(letters) : null;
  }

  private static String format(CharSequence letters) {
    return letters.subSequence(0, 3)
        + "-"
        + letters.subSequence(3, 7)
        + "-"
        + letters.subSequence(7, LENGTH);
  }
}
