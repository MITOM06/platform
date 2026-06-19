package com.platform.chatservice.controller;

import com.platform.chatservice.exception.BadRequestException;
import com.platform.chatservice.exception.UnauthorizedException;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.FileValidationService;
import com.platform.chatservice.service.RateLimiterService;
import com.platform.chatservice.service.VirusScanService;
import java.io.IOException;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.bson.types.ObjectId;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
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
public class UploadController {

  private final GridFsTemplate gridFsTemplate;
  private final GridFsOperations gridFsOperations;
  private final RateLimiterService rateLimiterService;
  private final FileValidationService fileValidationService;
  private final VirusScanService virusScanService;

  @PostMapping
  public ResponseEntity<Map<String, String>> uploadFile(@RequestParam("file") MultipartFile file)
      throws IOException {
    var authentication = SecurityContextHolder.getContext().getAuthentication();
    if (!(authentication instanceof UserPrincipal principal)) {
      throw new UnauthorizedException("User is not authenticated");
    }
    rateLimiterService.checkUploadRate(principal.getUserId());

    if (file == null || file.isEmpty()) {
      throw new BadRequestException("File is empty");
    }

    String contentType = resolveContentType(file);
    if (!isAllowedContentType(contentType)) {
      throw new BadRequestException("File type is not allowed");
    }

    // Magic-bytes check + per-type size cap
    fileValidationService.validate(file, contentType);
    // Virus/malware scan (no-op stub in dev; swap for ClamAV in prod)
    virusScanService.scan(file);

    var objectId =
        gridFsTemplate.store(file.getInputStream(), file.getOriginalFilename(), contentType);

    String url = "/api/uploads/" + objectId.toString();
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

  @GetMapping("/{id}")
  public ResponseEntity<Resource> getFile(
      @PathVariable String id,
      @RequestParam(name = "download", required = false) boolean download) {
    ObjectId objectId;
    try {
      objectId = new ObjectId(id);
    } catch (IllegalArgumentException e) {
      return ResponseEntity.notFound().build();
    }

    com.mongodb.client.gridfs.model.GridFSFile gridFSFile =
        gridFsTemplate.findOne(
            new org.springframework.data.mongodb.core.query.Query(
                org.springframework.data.mongodb.core.query.Criteria.where("_id").is(objectId)));

    if (gridFSFile == null) {
      return ResponseEntity.notFound().build();
    }

    GridFsResource resource = gridFsOperations.getResource(gridFSFile);

    MediaType mediaType = MediaType.APPLICATION_OCTET_STREAM;
    try {
      String storedType = resource.getContentType();
      if (storedType != null && !storedType.isBlank()) {
        mediaType = MediaType.parseMediaType(storedType);
      }
    } catch (Exception ignored) {
      // contentType không hợp lệ → giữ octet-stream
    }

    // download=true → buộc trình duyệt/thiết bị tải file về (attachment);
    // mặc định inline để hiển thị ngay trong app.
    String disposition =
        (download ? "attachment" : "inline") + "; filename=\"" + resource.getFilename() + "\"";

    try {
      return ResponseEntity.ok()
          .contentType(mediaType)
          .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
          .body(new InputStreamResource(resource.getInputStream()));
    } catch (IOException e) {
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
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
    if (lower.endsWith(".svg")) return "image/svg+xml";
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
