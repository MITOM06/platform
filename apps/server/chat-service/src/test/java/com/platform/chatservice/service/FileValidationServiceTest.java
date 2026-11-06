package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.platform.chatservice.exception.BadRequestException;
import java.io.ByteArrayInputStream;
import java.util.Arrays;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

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

  // --- signatures ------------------------------------------------------------

  private static byte[] header(int... prefix) {
    byte[] h = new byte[16];
    for (int i = 0; i < prefix.length; i++) h[i] = (byte) prefix[i];
    return h;
  }

  private static final byte[] JPEG = header(0xFF, 0xD8, 0xFF, 0xE0);
  private static final byte[] PNG = header(0x89, 0x50, 0x4E, 0x47);
  private static final byte[] GIF = header(0x47, 0x49, 0x46, 0x38);
  private static final byte[] WEBP =
      header(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);
  private static final byte[] BMP = header(0x42, 0x4D, 0, 0);
  private static final byte[] FTYP = header(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70);
  private static final byte[] AVI =
      header(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20);
  private static final byte[] WAV =
      header(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45);
  private static final byte[] MP3 = header(0xFF, 0xFB, 0x90, 0x00);
  private static final byte[] ID3 = header(0x49, 0x44, 0x33, 0x03);
  private static final byte[] FLAC = header(0x66, 0x4C, 0x61, 0x43);
  private static final byte[] PDF = header(0x25, 0x50, 0x44, 0x46);
  private static final byte[] ZIP = header(0x50, 0x4B, 0x03, 0x04);
  private static final byte[] CFB = header(0xD0, 0xCF, 0x11, 0xE0);
  private static final byte[] RAR = header(0x52, 0x61, 0x72, 0x21);
  private static final byte[] SEVEN_Z = header(0x37, 0x7A, 0xBC, 0xAF);
  private static final byte[] HTML = "<html><script>x</script>".getBytes();

  private void accepts(String name, String type, byte[] bytes) {
    MockMultipartFile f = new MockMultipartFile("file", name, type, bytes);
    assertThatCode(() -> service.validate(f, type)).doesNotThrowAnyException();
  }

  private void rejects(String name, String type, byte[] bytes, String message) {
    MockMultipartFile f = new MockMultipartFile("file", name, type, bytes);
    assertThatThrownBy(() -> service.validate(f, type))
        .isInstanceOf(BadRequestException.class)
        .hasMessage(message);
  }

  @Test
  void acceptsEverySupportedSignatureForItsFamily() {
    accepts("a.jpg", "image/jpeg", JPEG);
    accepts("a.png", "image/png", PNG);
    accepts("a.gif", "image/gif", GIF);
    accepts("a.webp", "image/webp", WEBP);
    accepts("a.bmp", "image/bmp", BMP);
    accepts("a.heic", "image/heic", FTYP);
    accepts("a.mp4", "video/mp4", FTYP);
    accepts("a.mkv", "video/x-matroska", EBML_HEADER);
    accepts("a.avi", "video/x-msvideo", AVI);
    accepts("a.mp3", "audio/mpeg", MP3);
    accepts("a.mp3", "audio/mpeg", ID3);
    accepts("a.wav", "audio/wav", WAV);
    accepts("a.flac", "audio/flac", FLAC);
    accepts("a.m4a", "audio/mp4", FTYP);
    accepts("a.pdf", "application/pdf", PDF);
    accepts(
        "a.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ZIP);
    accepts("a.odt", "application/vnd.oasis.opendocument.text", ZIP);
    accepts("a.epub", "application/epub+zip", ZIP);
    accepts("a.zip", "application/zip", ZIP);
    accepts("a.doc", "application/msword", CFB);
    accepts("a.xls", "application/vnd.ms-excel", CFB);
    accepts("a.ppt", "application/vnd.ms-powerpoint", CFB);
    accepts("a.rar", "application/vnd.rar", RAR);
    accepts("a.rar", "application/x-rar-compressed", RAR);
    accepts("a.7z", "application/x-7z-compressed", SEVEN_Z);
  }

  @Test
  void rejectsContentThatDoesNotMatchTheDeclaredFamily() {
    rejects("x.png", "image/png", HTML, "File content does not match declared image type.");
    // A RIFF header that is neither WEBP nor AVI/WAV is not an image.
    rejects("x.webp", "image/webp", AVI, "File content does not match declared image type.");
    rejects("x.mp4", "video/mp4", PNG, "File content does not match declared video type.");
    rejects("x.avi", "video/x-msvideo", WAV, "File content does not match declared video type.");
    rejects("x.mp3", "audio/mpeg", PDF, "File content does not match declared audio type.");
    rejects("x.pdf", "application/pdf", ZIP, "File content does not match declared PDF type.");
    rejects(
        "x.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        PDF,
        "File content does not match declared document type.");
    rejects(
        "x.doc", "application/msword", ZIP, "File content does not match declared document type.");
    rejects(
        "x.rar", "application/vnd.rar", ZIP, "File content does not match declared archive type.");
    rejects(
        "x.7z",
        "application/x-7z-compressed",
        RAR,
        "File content does not match declared archive type.");
  }

  @Test
  void svgIsNeverAcceptedAsAnImage() {
    byte[] svg = "<svg xmlns='http://www.w3.org/2000/svg'><script/></svg>".getBytes();
    rejects("x.svg", "image/svg+xml", svg, "File content does not match declared image type.");
  }

  @Test
  void textTypesHaveNoBinarySignatureCheck() {
    accepts("notes.txt", "text/plain", HTML);
    accepts("data.json", "application/json", "{\"a\":1}".getBytes());
  }

  @Test
  void contentTypeComparisonIsCaseInsensitive() {
    rejects("x.png", "IMAGE/PNG", HTML, "File content does not match declared image type.");
    accepts("x.pdf", "Application/PDF", PDF);
  }

  @Test
  void filesUnderFourBytesSkipTheSignatureCheck() {
    accepts("tiny.png", "image/png", new byte[] {1, 2, 3});
  }

  @ParameterizedTest
  @ValueSource(
      strings = {"evil.exe", "EVIL.EXE", "run.sh", "a.tar.ps1", "macro.docm", "x.jar", "l.lnk"})
  void rejectsBlockedExtensionsBeforeAnythingElse(String name) {
    String ext = name.toLowerCase().substring(name.lastIndexOf('.') + 1);
    // Even with a perfectly valid PDF body the extension alone is refused.
    rejects(
        name,
        "application/pdf",
        PDF,
        "File type '." + ext + "' is not allowed for security reasons.");
  }

  @Test
  void fileWithoutNameOrExtensionIsNotExtensionBlocked() throws Exception {
    MultipartFile noName = mock(MultipartFile.class);
    when(noName.getOriginalFilename()).thenReturn(null);
    when(noName.getSize()).thenReturn(16L);
    when(noName.getInputStream()).thenReturn(new ByteArrayInputStream(PDF));
    assertThatCode(() -> service.validate(noName, "application/pdf")).doesNotThrowAnyException();

    accepts("README", "application/octet-stream", HTML);
  }

  @ParameterizedTest
  @CsvSource({
    "image/png, 10",
    "video/mp4, 100",
    "audio/mpeg, 20",
    "application/pdf, 20",
  })
  void enforcesPerTypeSizeCap(String type, long capMb) throws Exception {
    long cap = capMb * 1024 * 1024;
    MultipartFile atCap = sized("f", type, cap);
    assertThatCode(() -> service.validate(atCap, type)).doesNotThrowAnyException();

    MultipartFile over = sized("f", type, cap + 1);
    assertThatThrownBy(() -> service.validate(over, type))
        .isInstanceOf(BadRequestException.class)
        .hasMessage("File too large — max allowed for this type is " + capMb + " MB.");
  }

  @Test
  void nullContentTypeUsesDocumentCapAndSkipsSignature() throws Exception {
    MultipartFile over = sized("f", null, 20L * 1024 * 1024 + 1);
    assertThatThrownBy(() -> service.validate(over, null))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("20 MB");
    MultipartFile ok = sized("f", null, 100);
    assertThatCode(() -> service.validate(ok, null)).doesNotThrowAnyException();
  }

  /** A file of a declared size whose body is a header matching {@code type} (or zeros). */
  private static MultipartFile sized(String name, String type, long size) throws Exception {
    MultipartFile f = mock(MultipartFile.class);
    when(f.getOriginalFilename()).thenReturn(name);
    when(f.getSize()).thenReturn(size);
    byte[] body = type == null ? new byte[16] : bodyFor(type);
    when(f.getInputStream()).thenAnswer(inv -> new ByteArrayInputStream(body));
    return f;
  }

  private static byte[] bodyFor(String type) {
    if (type.startsWith("image/")) return PNG;
    if (type.startsWith("video/")) return FTYP;
    if (type.startsWith("audio/")) return MP3;
    return PDF;
  }

  // --- matchesInlineSignature (download-time inline decision) ---------------

  @Test
  void inlineSignatureMatchesOnlyRealMediaOfTheStoredFamily() {
    assertThat(service.matchesInlineSignature("image/png", PNG)).isTrue();
    assertThat(service.matchesInlineSignature("IMAGE/JPEG", JPEG)).isTrue();
    assertThat(service.matchesInlineSignature("video/webm", EBML_HEADER)).isTrue();
    assertThat(service.matchesInlineSignature("audio/ogg", OGG_HEADER)).isTrue();
    assertThat(service.matchesInlineSignature("application/pdf", PDF)).isTrue();

    assertThat(service.matchesInlineSignature("image/png", HTML)).isFalse();
    assertThat(service.matchesInlineSignature("video/mp4", PNG)).isFalse();
    assertThat(service.matchesInlineSignature("audio/mpeg", PDF)).isFalse();
    assertThat(service.matchesInlineSignature("application/pdf", PNG)).isFalse();
  }

  @Test
  void inlineSignatureNeverMatchesSvgOrNonMediaTypes() {
    // An SVG claim never renders inline, even with bytes that look like a PNG.
    assertThat(service.matchesInlineSignature("image/svg+xml", PNG)).isFalse();
    assertThat(service.matchesInlineSignature("text/html", HTML)).isFalse();
    assertThat(service.matchesInlineSignature("application/zip", ZIP)).isFalse();
  }

  @Test
  void inlineSignatureRejectsMissingOrShortInput() {
    assertThat(service.matchesInlineSignature(null, PNG)).isFalse();
    assertThat(service.matchesInlineSignature("image/png", null)).isFalse();
    assertThat(service.matchesInlineSignature("image/png", Arrays.copyOf(PNG, 3))).isFalse();
  }
}
