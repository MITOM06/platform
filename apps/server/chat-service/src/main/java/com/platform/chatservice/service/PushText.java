package com.platform.chatservice.service;

/**
 * One line of an OS push (title or body): either ready {@code text} (a sender's name, a message
 * preview) or a localization {@code key} the app resolves in the device's language ({@code
 * strings.xml} / {@code Localizable.strings}, kept equal to the ARB by native_push_strings_test).
 * Fixed wording must use a key: the OS shows a push as-is, so English text stays English.
 */
public record PushText(String text, String key) {

  public static PushText of(String text) {
    return new PushText(text, null);
  }

  public static PushText localized(String key) {
    return new PushText(null, key);
  }
}
