package com.platform.chatservice.controller;

import com.platform.chatservice.exception.BadRequestException;
import com.platform.chatservice.exception.UnauthorizedException;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.FileValidationService;
import com.platform.chatservice.service.RateLimiterService;
import com.platform.chatservice.service.VirusScanService;
import java.io.IOException;
import java.io.PushbackInputStream;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.gridfs.GridFsOperations;
import org.springframework.data.mongodb.gridfs.GridFsResource;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/uploads")
@RequiredArgsConstructor
@Slf4j
public class UploadController {

  private final GridFsTemplate gridFsTemplate;
  private final GridFsOperations gridFsOperations;
  private final RateLimiterService rateLimiterService;
  private final FileValidationService fileValidationService;
  private final VirusScanService virusScanService;

  /** Leading bytes read to confirm a stored type before serving a file inline. */
  private static final int SNIFF_BYTES = 16;

  @PostMapping
  public ResponseEntity<Map<String, String>> uploadFile(@RequestParam("file") MultipartFile file)
      throws IOException {
    var authentication = SecurityContextHolder.getContext().getAuthentication();
    if (!(authentication instanceof UserPrincipal principal)) {
      throw new UnauthorizedException("User is not authenticated");
    }
    rateLimiterService.checkUploadRate(principal.getUserId());

    if (file == null || file.isEmpty()) {
      log.warn(
          "Upload rejected [empty]: filename='{}', size={}",
          file == null ? null : file.getOriginalFilename(),
          file == null ? 0 : file.getSize());
      throw new BadRequestException("File is empty");
    }

    String contentType = resolveContentType(file);
    if (!isAllowedContentType(contentType)) {
      log.warn(
          "Upload rejected [content-type]: resolvedContentType='{}' (declared='{}') not allowed,"
              + " filename='{}', size={}",
          contentType,
          file.getContentType(),
          file.getOriginalFilename(),
          file.getSize());
      throw new BadRequestException("File type is not allowed");
    }

    // Magic-bytes check + per-type size cap
    fileValidationService.validate(file, contentType);
    // Virus/malware scan (no-op stub in dev; swap for ClamAV in prod)
    virusScanService.scan(file);

    // Use a cryptographically random UUID as the public storage key so URLs
    // can't be enumerated (a Mongo ObjectId leaks its creation timestamp).
    String fileId = UUID.randomUUID().toString();
    Document metadata =
        new Document()
            .append("fileId", fileId)
            .append("originalFilename", file.getOriginalFilename())
            .append("uploadedBy", principal.getUserId());

    // Store with the UUID as GridFS filename and mirror it into metadata for lookup.
    gridFsTemplate.store(file.getInputStream(), fileId, contentType, metadata);

    String url = "/api/uploads/" + fileId;
    // Trả về kèm filename + size để client dựng "file card" (tên, dung lượng).
    return ResponseEntity.ok(
        Map.of(
            "url",
            url,
            "filename",
            file.getOriginalFilename() == null ? "" : file.getOriginalFilename(),
            "size",
            String.valueOf(file.getSize()),
            "contentType",
            contentType == null ? "" : contentType));
  }

  /** Allow images, videos, audio and common document/archive formats. */
  private boolean isAllowedContentType(String contentType) {
    if (contentType == null || contentType.isBlank()) return false;
    String lower = contentType.toLowerCase();
    return lower.startsWith("image/")
        || lower.startsWith("video/")
        || lower.startsWith("audio/")
        || lower.startsWith("text/")
        || lower.startsWith("application/");
  }

  /**
   * Serve an upload. Public (no auth) so {@code <img src>} works — which is exactly why the
   * response must be inert on the API origin: it is {@code inline} only for raster images, audio,
   * video and PDF whose stored type is confirmed by the file's own magic bytes (never by the type
   * the client declared at upload); everything else is an {@code attachment}, active types
   * (HTML/XML/SVG/JS) are relabelled {@code application/octet-stream}, and every response carries
   * {@code X-Content-Type-Options: nosniff} plus {@code Content-Security-Policy: sandbox} (except
   * an inline PDF, where a sandboxed document would stop the browser's PDF viewer from loading).
   */
  @GetMapping("/{id}")
  public ResponseEntity<Resource> getFile(
      @PathVariable String id,
      @RequestParam(name = "download", required = false) boolean download) {
    com.mongodb.client.gridfs.model.GridFSFile gridFSFile = findFile(id);
    if (gridFSFile == null) {
      return ResponseEntity.notFound().build();
    }

    GridFsResource resource = gridFsOperations.getResource(gridFSFile);

    String storedType = "";
    try {
      storedType = DownloadHeaders.baseType(resource.getContentType());
    } catch (Exception ignored) {
      // contentType missing/invalid → treated as opaque binary below
    }

    // Prefer the original filename (stored in metadata for UUID-keyed files) so a
    // download keeps its real name rather than exposing the UUID storage key.
    String displayName = resource.getFilename();
    Document meta = gridFSFile.getMetadata();
    if (meta != null && meta.getString("originalFilename") != null) {
      displayName = meta.getString("originalFilename");
    }

    try {
      PushbackInputStream body = new PushbackInputStream(resource.getInputStream(), SNIFF_BYTES);
      byte[] header = body.readNBytes(SNIFF_BYTES);
      body.unread(header);

      // "verified": an inline-capable type whose bytes really are of that type.
      boolean verified =
          DownloadHeaders.isInlineType(storedType)
              && fileValidationService.matchesInlineSignature(storedType, header);
      boolean inline = !download && verified;
      MediaType mediaType = responseType(storedType, verified);

      ResponseEntity.BodyBuilder response =
          ResponseEntity.ok()
              .contentType(mediaType)
              .header(
                  HttpHeaders.CONTENT_DISPOSITION,
                  DownloadHeaders.contentDisposition(inline ? "inline" : "attachment", displayName))
              .header("X-Content-Type-Options", "nosniff");
      if (!(inline && "application/pdf".equals(storedType))) {
        response.header("Content-Security-Policy", "sandbox");
      }
      if (gridFSFile.getLength() >= 0) {
        response.contentLength(gridFSFile.getLength());
      }
      return response.body(new InputStreamResource(body));
    } catch (IOException e) {
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
    }
  }

  /**
   * New files are keyed by a random UUID ({@code metadata.fileId}). The 24-hex path exists only for
   * LEGACY files stored before that scheme — it must not resolve a new file by its GridFS {@code
   * _id} (an ObjectId is guessable: timestamp + counter), so it only matches files without a {@code
   * metadata.fileId}.
   */
  private com.mongodb.client.gridfs.model.GridFSFile findFile(String id) {
    if (id.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")) {
      return gridFsTemplate.findOne(Query.query(Criteria.where("metadata.fileId").is(id)));
    }
    if (id.matches("[0-9a-f]{24}")) {
      try {
        return gridFsTemplate.findOne(
            Query.query(
                Criteria.where("_id").is(new ObjectId(id)).and("metadata.fileId").exists(false)));
      } catch (IllegalArgumentException e) {
        return null;
      }
    }
    return null;
  }

  /**
   * A verified media type keeps its type; active content, and an image/audio/video/PDF claim the
   * bytes do not back up, become {@code application/octet-stream}; other documents keep theirs.
   */
  private static MediaType responseType(String storedType, boolean verified) {
    if (!verified
        && (storedType.isEmpty()
            || DownloadHeaders.isActiveType(storedType)
            || DownloadHeaders.isInlineType(storedType))) {
      return MediaType.APPLICATION_OCTET_STREAM;
    }
    try {
      return MediaType.parseMediaType(storedType);
    } catch (Exception e) {
      return MediaType.APPLICATION_OCTET_STREAM;
    }
  }

  private String resolveContentType(MultipartFile file) {
    String contentType = file.getContentType();
    // Trust a meaningful, non-generic content type sent by the client.
    if (contentType != null
        && !contentType.isBlank()
        && !contentType.equalsIgnoreCase("application/octet-stream")) {
      return contentType;
    }
    // Fallback: dò theo đuôi tên file khi client không gửi đúng content-type
    String name = file.getOriginalFilename();
    if (name == null) {
      return contentType;
    }
    String lower = name.toLowerCase();
    // Tài liệu
    if (lower.endsWith(".pdf")) return "application/pdf";
    if (lower.endsWith(".doc")) return "application/msword";
    if (lower.endsWith(".docx"))
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
    if (lower.endsWith(".xlsx"))
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if (lower.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
    if (lower.endsWith(".pptx"))
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    if (lower.endsWith(".txt")) return "text/plain";
    if (lower.endsWith(".csv")) return "text/csv";
    if (lower.endsWith(".json")) return "application/json";
    if (lower.endsWith(".zip")) return "application/zip";
    if (lower.endsWith(".rar")) return "application/vnd.rar";
    if (lower.endsWith(".7z")) return "application/x-7z-compressed";
    // Ảnh
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".gif")) return "image/gif";
    if (lower.endsWith(".webp")) return "image/webp";
    if (lower.endsWith(".bmp")) return "image/bmp";
    if (lower.endsWith(".heic")) return "image/heic";
    if (lower.endsWith(".heif")) return "image/heif";
    // SVG intentionally omitted — see FileValidationService (stored-XSS vector).
    // Video
    if (lower.endsWith(".mp4")) return "video/mp4";
    if (lower.endsWith(".mov")) return "video/quicktime";
    if (lower.endsWith(".webm")) return "video/webm";
    if (lower.endsWith(".mkv")) return "video/x-matroska";
    if (lower.endsWith(".avi")) return "video/x-msvideo";
    if (lower.endsWith(".m4v")) return "video/x-m4v";
    if (lower.endsWith(".3gp")) return "video/3gpp";
    return contentType;
  }
}
