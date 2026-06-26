package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.platform.chatservice.exception.BadRequestException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

/** Magic-bytes + size validation for uploads, focused on voice-note audio formats. */
class FileValidationServiceTest {

  private final FileValidationService service = new FileValidationService();

  // EBML container signature shared by WebM/MKV: 0x1A 0x45 0xDF 0xA3.
  private static final byte[] EBML_HEADER = {
    0x1A, 0x45, (byte) 0xDF, (byte) 0xA3, 0x01, 0x00, 0x00, 0x00, 0, 0, 0, 0, 0, 0, 0, 0
  };
  // "OggS" — Ogg container signature.
  private static final byte[] OGG_HEADER = {
    0x4F, 0x67, 0x67, 0x53, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
  };

  @Test
  void acceptsWebmAudio_browserVoiceNote() {
    // Chrome/Firefox MediaRecorder records voice notes as audio/webm (EBML container).
    MockMultipartFile file =
        new MockMultipartFile("file", "voice_123.webm", "audio/webm", EBML_HEADER);

    assertThatCode(() -> service.validate(file, "audio/webm")).doesNotThrowAnyException();
  }

  @Test
  void acceptsOggAudio_browserVoiceNote() {
    MockMultipartFile file =
        new MockMultipartFile("file", "voice_123.ogg", "audio/ogg", OGG_HEADER);

    assertThatCode(() -> service.validate(file, "audio/ogg")).doesNotThrowAnyException();
  }

  @Test
  void rejectsAudioWithMismatchedMagicBytes() {
    // A PDF posing as audio should still be rejected.
    byte[] pdf = {0x25, 0x50, 0x44, 0x46, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};
    MockMultipartFile file = new MockMultipartFile("file", "fake.webm", "audio/webm", pdf);

    assertThatThrownBy(() -> service.validate(file, "audio/webm"))
        .isInstanceOf(BadRequestException.class);
  }
}
