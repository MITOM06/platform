package com.platform.chatservice.controller;

import com.platform.chatservice.exception.BadRequestException;
import com.platform.chatservice.exception.UnauthorizedException;
import com.platform.chatservice.security.UserPrincipal;
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

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/uploads")
@RequiredArgsConstructor
public class UploadController {

    private final GridFsTemplate gridFsTemplate;
    private final GridFsOperations gridFsOperations;

    @PostMapping
    public ResponseEntity<Map<String, String>> uploadFile(@RequestParam("file") MultipartFile file) throws IOException {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication instanceof UserPrincipal)) {
            throw new UnauthorizedException("User is not authenticated");
        }

        if (file == null || file.isEmpty()) {
            throw new BadRequestException("File is empty");
        }

        // Chấp nhận mọi định dạng ảnh (png, jpg, jpeg, gif, webp, bmp, heic, ...).
        // Một số client gửi contentType chung chung → fallback dò theo đuôi file.
        String contentType = resolveContentType(file);
        if (contentType == null || !contentType.toLowerCase().startsWith("image/")) {
            throw new BadRequestException("Only image files are allowed");
        }

        var objectId = gridFsTemplate.store(
            file.getInputStream(),
            file.getOriginalFilename(),
            contentType
        );

        String url = "/api/uploads/" + objectId.toString();
        return ResponseEntity.ok(Map.of("url", url));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Resource> getFile(@PathVariable String id) {
        ObjectId objectId;
        try {
            objectId = new ObjectId(id);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }

        com.mongodb.client.gridfs.model.GridFSFile gridFSFile =
            gridFsTemplate.findOne(new org.springframework.data.mongodb.core.query.Query(
                org.springframework.data.mongodb.core.query.Criteria.where("_id").is(objectId)
            ));

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

        try {
            return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + resource.getFilename() + "\"")
                .body(new InputStreamResource(resource.getInputStream()));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    private String resolveContentType(MultipartFile file) {
        String contentType = file.getContentType();
        if (contentType != null && contentType.toLowerCase().startsWith("image/")) {
            return contentType;
        }
        // Fallback: dò theo đuôi tên file khi client không gửi đúng content-type
        String name = file.getOriginalFilename();
        if (name == null) {
            return contentType;
        }
        String lower = name.toLowerCase();
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".bmp")) return "image/bmp";
        if (lower.endsWith(".heic")) return "image/heic";
        if (lower.endsWith(".heif")) return "image/heif";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        return contentType;
    }
}
