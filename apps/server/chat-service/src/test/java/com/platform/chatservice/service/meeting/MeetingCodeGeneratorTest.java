package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashSet;
import java.util.Random;
import java.util.Set;
import org.junit.jupiter.api.Test;

class MeetingCodeGeneratorTest {

  @Test
  void codesAreThreeFourThreeLowercaseLettersWithoutLookalikes() {
    MeetingCodeGenerator gen = new MeetingCodeGenerator(new Random(42));
    for (int i = 0; i < 2_000; i++) {
      String code = gen.next();
      assertThat(code).matches("[a-z]{3}-[a-z]{4}-[a-z]{3}");
      assertThat(code).doesNotContain("i", "l", "o");
    }
  }

  @Test
  void codesSpreadOverTheAlphabet() {
    MeetingCodeGenerator gen = new MeetingCodeGenerator(new Random(7));
    Set<Character> seen = new HashSet<>();
    Set<String> codes = new HashSet<>();
    for (int i = 0; i < 500; i++) {
      String code = gen.next();
      codes.add(code);
      code.replace("-", "").chars().forEach(c -> seen.add((char) c));
    }
    assertThat(codes).hasSize(500);
    assertThat(seen).hasSize(MeetingCodeGenerator.ALPHABET.length());
  }

  @Test
  void normalizeAcceptsWhatPeopleTypeOrPaste() {
    assertThat(MeetingCodeGenerator.normalize("abc-defg-hjk")).isEqualTo("abc-defg-hjk");
    assertThat(MeetingCodeGenerator.normalize(" ABC-DEFG-HJK ")).isEqualTo("abc-defg-hjk");
    assertThat(MeetingCodeGenerator.normalize("abcdefghjk")).isEqualTo("abc-defg-hjk");
    assertThat(MeetingCodeGenerator.normalize("abc defg hjk")).isEqualTo("abc-defg-hjk");
  }

  @Test
  void normalizeRejectsAnythingThatCannotBeACode() {
    assertThat(MeetingCodeGenerator.normalize(null)).isNull();
    assertThat(MeetingCodeGenerator.normalize("")).isNull();
    assertThat(MeetingCodeGenerator.normalize("abc-defg-hj")).isNull(); // 9 letters
    assertThat(MeetingCodeGenerator.normalize("abc-defg-hjkm")).isNull(); // 11 letters
    assertThat(MeetingCodeGenerator.normalize("abi-defg-hjk")).isNull(); // 'i' never generated
    assertThat(MeetingCodeGenerator.normalize("ab1-defg-hjk")).isNull();
    assertThat(MeetingCodeGenerator.normalize("670f1c2ab9e4d21f0c3a9e11")).isNull(); // an id
  }
}
