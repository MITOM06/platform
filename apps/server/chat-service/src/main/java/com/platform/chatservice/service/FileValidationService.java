package com.platform.chatservice.service;

import com.platform.chatservice.exception.BadRequestException;
import java.io.IOException;
import java.io.InputStream;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * Validates uploads via magic-bytes signature check and per-type size caps. Call {@link #validate}
 * before storing any uploaded file.
 */
@Service
@Slf4j
public class FileValidationService {

  // Per-type size caps
  private static final long MAX_IMAGE_BYTES = 10L * 1024 * 1024; // 10 MB
  private static final long MAX_VIDEO_BYTES = 100L * 1024 * 1024; // 100 MB
  private static final long MAX_AUDIO_BYTES = 20L * 1024 * 1024; // 20 MB
  private static final long MAX_DOC_BYTES = 20L * 1024 * 1024; // 20 MB

  /** Validates size caps then checks the file's magic bytes against the declared content type. */
  public void validate(MultipartFile file, String resolvedContentType) throws IOException {
    validateSize(file, resolvedContentType);
    validateMagicBytes(file, resolvedContentType);
  }

  // --- size cap -----------------------------------------------------------

  private void validateSize(MultipartFile file, String contentType) {
    long max = maxBytesFor(contentType);
    if (file.getSize() > max) {
      long mb = max / (1024 * 1024);
      throw new BadRequestException("File too large — max allowed for this type is " + mb + " MB.");
    }
  }

  private long maxBytesFor(String contentType) {
    if (contentType == null) return MAX_DOC_BYTES;
    String lower = contentType.toLowerCase();
    if (lower.startsWith("image/")) return MAX_IMAGE_BYTES;
    if (lower.startsWith("video/")) return MAX_VIDEO_BYTES;
    if (lower.startsWith("audio/")) return MAX_AUDIO_BYTES;
    return MAX_DOC_BYTES;
  }

  // --- magic bytes check --------------------------------------------------

  private void validateMagicBytes(MultipartFile file, String contentType) throws IOException {
    byte[] header = new byte[16];
    int read;
    // MultipartFile.getInputStream() returns a fresh stream backed by the
    // temp file on disk — safe to call multiple times.
    try (InputStream is = file.getInputStream()) {
      read = is.read(header);
    }
    if (read < 4) return; // file too small to inspect — let GridFS reject invalid content

    String lower = contentType == null ? "" : contentType.toLowerCase();

    if (lower.startsWith("image/")) {
      if (!isAllowedImage(header)) {
        throw new BadRequestException("File content does not match declared image type.");
      }
    } else if (lower.startsWith("video/")) {
      if (!isAllowedVideo(header)) {
        throw new BadRequestException("File content does not match declared video type.");
      }
    } else if (lower.startsWith("audio/")) {
      if (!isAllowedAudio(header)) {
        throw new BadRequestException("File content does not match declared audio type.");
      }
    } else if ("application/pdf".equals(lower)) {
      if (!startsWith(header, 0x25, 0x50, 0x44, 0x46)) { // %PDF
        throw new BadRequestException("File content does not match declared PDF type.");
      }
    } else if (isZipBasedDocType(lower)) {
      // DOCX / XLSX / PPTX / ZIP all share the PK\x03\x04 header
      if (!startsWith(header, 0x50, 0x4B, 0x03, 0x04)) {
        throw new BadRequestException("File content does not match declared document type.");
      }
    } else if (isLegacyOfficeType(lower)) {
      // Old binary Office format: DOC / XLS / PPT (Compound File Binary Format)
      if (!startsWith(header, 0xD0, 0xCF, 0x11, 0xE0)) {
        throw new BadRequestException("File content does not match declared document type.");
      }
    } else if ("application/x-rar-compressed".equals(lower)
        || "application/vnd.rar".equals(lower)) {
      if (!startsWith(header, 0x52, 0x61, 0x72, 0x21)) { // Rar!
        throw new BadRequestException("File content does not match declared archive type.");
      }
    } else if ("application/x-7z-compressed".equals(lower)) {
      if (!startsWith(header, 0x37, 0x7A, 0xBC, 0xAF)) { // 7z
        throw new BadRequestException("File content does not match declared archive type.");
      }
    }
    // text/*, application/json, text/csv, text/plain — no strict binary signature enforced
  }

  // --- image signatures ---------------------------------------------------

  private boolean isAllowedImage(byte[] h) {
    return isJpeg(h)
        || isPng(h)
        || isGif(h)
        || isWebP(h)
        || isBmp(h)
        || isFtypBox(h) // HEIC / HEIF use ISO Base Media box
        || isSvgOrXml(h); // SVG is text-based
  }

  private boolean isJpeg(byte[] h) {
    return startsWith(h, 0xFF, 0xD8, 0xFF);
  }

  private boolean isPng(byte[] h) {
    return startsWith(h, 0x89, 0x50, 0x4E, 0x47);
  }

  private boolean isGif(byte[] h) {
    return startsWith(h, 0x47, 0x49, 0x46, 0x38);
  }

  private boolean isWebP(byte[] h) {
    return startsWith(h, 0x52, 0x49, 0x46, 0x46) // RIFF
        && h.length >= 12
        && h[8] == 0x57
        && h[9] == 0x45
        && h[10] == 0x42
        && h[11] == 0x50; // WEBP
  }

  private boolean isBmp(byte[] h) {
    return startsWith(h, 0x42, 0x4D);
  }

  private boolean isSvgOrXml(byte[] h) {
    return (h[0] & 0xFF) == '<'; // SVG starts with <svg or <?xml
  }

  // --- video signatures ---------------------------------------------------

  private boolean isAllowedVideo(byte[] h) {
    return isFtypBox(h) // MP4 / MOV / M4V / 3GP (ISO Base Media File Format)
        || isEbml(h) // WebM / MKV (EBML container)
        || isAvi(h); // AVI (RIFF/AVI )
  }

  private boolean isAvi(byte[] h) {
    return startsWith(h, 0x52, 0x49, 0x46, 0x46) // RIFF
        && h.length >= 12
        && h[8] == 0x41
        && h[9] == 0x56
        && h[10] == 0x49
        && h[11] == 0x20; // AVI<space>
  }

  // --- audio signatures ---------------------------------------------------

  private boolean isAllowedAudio(byte[] h) {
    return isMpegAudio(h)
        || isId3(h)
        || isOgg(h)
        || isWav(h)
        || isFlac(h)
        || isFtypBox(h); // M4A uses ISO Base Media too
  }

  private boolean isMpegAudio(byte[] h) {
    // MPEG sync word: 0xFF followed by 0xE0–0xFF (covers MP3, MP2, MP1)
    return (h[0] & 0xFF) == 0xFF && (h[1] & 0xE0) == 0xE0;
  }

  private boolean isId3(byte[] h) {
    return startsWith(h, 0x49, 0x44, 0x33);
  } // ID3

  private boolean isOgg(byte[] h) {
    return startsWith(h, 0x4F, 0x67, 0x67, 0x53);
  } // OggS

  private boolean isWav(byte[] h) {
    return startsWith(h, 0x52, 0x49, 0x46, 0x46) // RIFF
        && h.length >= 12
        && h[8] == 0x57
        && h[9] == 0x41
        && h[10] == 0x56
        && h[11] == 0x45; // WAVE
  }

  private boolean isFlac(byte[] h) {
    return startsWith(h, 0x66, 0x4C, 0x61, 0x43);
  } // fLaC

  // --- shared signatures --------------------------------------------------

  /** ISO Base Media File Format 'ftyp' box — MP4, MOV, M4V, M4A, 3GP, HEIC, HEIF. */
  private boolean isFtypBox(byte[] h) {
    return h.length >= 8 && h[4] == 0x66 && h[5] == 0x74 && h[6] == 0x79 && h[7] == 0x70; // ftyp
  }

  /** EBML container signature — WebM and MKV. */
  private boolean isEbml(byte[] h) {
    return startsWith(h, 0x1A, 0x45, 0xDF, 0xA3);
  }

  // --- document type helpers ----------------------------------------------

  private boolean isZipBasedDocType(String lower) {
    return lower.contains("zip")
        || lower.contains("openxmlformats")
        || lower.contains("vnd.oasis") // OpenDocument
        || lower.equals("application/epub+zip");
  }

  private boolean isLegacyOfficeType(String lower) {
    return lower.equals("application/msword")
        || lower.equals("application/vnd.ms-excel")
        || lower.equals("application/vnd.ms-powerpoint");
  }

  // --- helper -------------------------------------------------------------

  private boolean startsWith(byte[] data, int... expected) {
    if (data.length < expected.length) return false;
    for (int i = 0; i < expected.length; i++) {
      if ((data[i] & 0xFF) != expected[i]) return false;
    }
    return true;
  }
}
