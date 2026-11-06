package com.platform.chatservice.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.mongodb.client.gridfs.model.GridFSFile;
import com.platform.chatservice.exception.BadRequestException;
import com.platform.chatservice.exception.RateLimitExceededException;
import com.platform.chatservice.exception.UnauthorizedException;
import com.platform.chatservice.security.MediaTokenService;
import com.platform.chatservice.security.UploadReaderResolver;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.FileValidationService;
import com.platform.chatservice.service.RateLimiterService;
import com.platform.chatservice.service.VirusScanService;
import com.platform.chatservice.service.upload.UploadAccessPolicy;
import jakarta.servlet.http.HttpServletRequest;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Map;
import java.util.Optional;
import org.bson.Document;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.core.io.Resource;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.gridfs.GridFsResource;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Upload (POST) and serve (GET) behaviour of {@link UploadController}: who may upload, which types
 * are accepted, how the storage key is chosen, and the headers that keep a served file inert on the
 * API origin. Auth wiring of the GET endpoint is covered by {@link UploadControllerAuthTest}.
 */
class UploadControllerTest {

  private static final String USER = "user-1";
  private static final String UUID_ID = "123e4567-e89b-12d3-a456-426614174000";
  private static final String LEGACY_ID = "507f1f77bcf86cd799439011";
  private static final byte[] PNG = {(byte) 0x89, 0x50, 0x4E, 0x47, 0, 0, 0, 0};

  private final GridFsTemplate gridFs = mock(GridFsTemplate.class);
  private final RateLimiterService rateLimiter = mock(RateLimiterService.class);
  private final FileValidationService validation = mock(FileValidationService.class);
  private final VirusScanService virusScan = mock(VirusScanService.class);
  private final MediaTokenService mediaTokens = mock(MediaTokenService.class);
  private final UploadReaderResolver readerResolver = mock(UploadReaderResolver.class);
  private final UploadAccessPolicy accessPolicy = mock(UploadAccessPolicy.class);
  private final HttpServletRequest request = mock(HttpServletRequest.class);

  private final UploadController controller =
      new UploadController(
          gridFs,
          gridFs,
          rateLimiter,
          validation,
          virusScan,
          mediaTokens,
          readerResolver,
          accessPolicy);

  @BeforeEach
  void authenticate() {
    SecurityContextHolder.getContext().setAuthentication(new UserPrincipal(USER));
  }

  @AfterEach
  void clear() {
    SecurityContextHolder.clearContext();
  }

  // --- POST /api/uploads -----------------------------------------------------

  @Test
  void upload_rejectsNonUserPrincipal_beforeTouchingAnything() {
    SecurityContextHolder.getContext()
        .setAuthentication(new UsernamePasswordAuthenticationToken("x", "y"));
    MockMultipartFile file = new MockMultipartFile("file", "a.png", "image/png", PNG);

    assertThatThrownBy(() -> controller.uploadFile(file)).isInstanceOf(UnauthorizedException.class);
    verifyNoInteractions(rateLimiter, gridFs, validation, virusScan);
  }

  @Test
  void upload_rateLimitStopsBeforeStorage() {
    doThrow(new RateLimitExceededException()).when(rateLimiter).checkUploadRate(USER);
    MockMultipartFile file = new MockMultipartFile("file", "a.png", "image/png", PNG);

    assertThatThrownBy(() -> controller.uploadFile(file))
        .isInstanceOf(RateLimitExceededException.class);
    verifyNoInteractions(gridFs);
  }

  @Test
  void upload_rejectsEmptyAndMissingFile() {
    MockMultipartFile empty = new MockMultipartFile("file", "a.png", "image/png", new byte[0]);
    assertThatThrownBy(() -> controller.uploadFile(empty))
        .isInstanceOf(BadRequestException.class)
        .hasMessage("File is empty");
    assertThatThrownBy(() -> controller.uploadFile(null))
        .isInstanceOf(BadRequestException.class)
        .hasMessage("File is empty");
    verifyNoInteractions(gridFs);
  }

  @Test
  void upload_rejectsTypesOutsideTheAllowList() {
    MockMultipartFile font = new MockMultipartFile("file", "a.ttf", "font/ttf", PNG);
    assertThatThrownBy(() -> controller.uploadFile(font))
        .isInstanceOf(BadRequestException.class)
        .hasMessage("File type is not allowed");

    // Generic octet-stream with an unknown extension resolves to octet-stream → application/*
    // is allowed, but no content type at all (and no name) is refused.
    MockMultipartFile noType = new MockMultipartFile("file", null, null, PNG);
    assertThatThrownBy(() -> controller.uploadFile(noType))
        .isInstanceOf(BadRequestException.class)
        .hasMessage("File type is not allowed");
    verifyNoInteractions(gridFs);
  }

  @Test
  void upload_validationFailureNeverStores() throws Exception {
    MockMultipartFile file = new MockMultipartFile("file", "a.png", "image/png", PNG);
    doThrow(new BadRequestException("bad bytes")).when(validation).validate(file, "image/png");

    assertThatThrownBy(() -> controller.uploadFile(file)).hasMessage("bad bytes");
    verifyNoInteractions(virusScan, gridFs);
  }

  @Test
  void upload_virusDetectedNeverStores() throws Exception {
    MockMultipartFile file = new MockMultipartFile("file", "a.png", "image/png", PNG);
    doThrow(new BadRequestException("infected")).when(virusScan).scan(file);

    assertThatThrownBy(() -> controller.uploadFile(file)).hasMessage("infected");
    verify(gridFs, never())
        .store(any(InputStream.class), anyString(), anyString(), any(Document.class));
  }

  @Test
  void upload_storesUnderRandomUuidWithUploaderMetadata() throws Exception {
    MockMultipartFile file = new MockMultipartFile("file", "cat.png", "image/png", PNG);

    ResponseEntity<Map<String, String>> res = controller.uploadFile(file);

    ArgumentCaptor<String> key = ArgumentCaptor.forClass(String.class);
    ArgumentCaptor<Document> meta = ArgumentCaptor.forClass(Document.class);
    verify(gridFs).store(any(InputStream.class), key.capture(), eq("image/png"), meta.capture());
    assertThat(key.getValue())
        .matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
    Document metadata = meta.getValue();
    assertThat(metadata.getString("fileId")).isEqualTo(key.getValue());
    assertThat(metadata.getString("uploadedBy")).isEqualTo(USER);
    assertThat(metadata.getString("originalFilename")).isEqualTo("cat.png");

    assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(res.getBody())
        .containsEntry("url", "/api/uploads/" + key.getValue())
        .containsEntry("filename", "cat.png")
        .containsEntry("size", String.valueOf(PNG.length))
        .containsEntry("contentType", "image/png");
  }

  @Test
  void upload_twoUploadsGetDifferentKeys() throws Exception {
    MockMultipartFile file = new MockMultipartFile("file", "cat.png", "image/png", PNG);
    String a = controller.uploadFile(file).getBody().get("url");
    String b = controller.uploadFile(file).getBody().get("url");
    assertThat(a).isNotEqualTo(b);
  }

  @Test
  void upload_genericTypeFallsBackToExtension() throws Exception {
    assertResolved("report.PDF", "application/octet-stream", "application/pdf");
    assertResolved("a.doc", null, "application/msword");
    assertResolved(
        "a.docx", "", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    assertResolved("a.xls", null, "application/vnd.ms-excel");
    assertResolved(
        "a.xlsx", null, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    assertResolved("a.ppt", null, "application/vnd.ms-powerpoint");
    assertResolved(
        "a.pptx",
        null,
        "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    assertResolved("a.txt", null, "text/plain");
    assertResolved("a.csv", null, "text/csv");
    assertResolved("a.json", null, "application/json");
    assertResolved("a.zip", null, "application/zip");
    assertResolved("a.rar", null, "application/vnd.rar");
    assertResolved("a.7z", null, "application/x-7z-compressed");
    assertResolved("a.png", null, "image/png");
    assertResolved("a.jpeg", null, "image/jpeg");
    assertResolved("a.jpg", null, "image/jpeg");
    assertResolved("a.gif", null, "image/gif");
    assertResolved("a.webp", null, "image/webp");
    assertResolved("a.bmp", null, "image/bmp");
    assertResolved("a.heic", null, "image/heic");
    assertResolved("a.heif", null, "image/heif");
    assertResolved("a.mp4", null, "video/mp4");
    assertResolved("a.mov", null, "video/quicktime");
    assertResolved("a.webm", null, "video/webm");
    assertResolved("a.mkv", null, "video/x-matroska");
    assertResolved("a.avi", null, "video/x-msvideo");
    assertResolved("a.m4v", null, "video/x-m4v");
    assertResolved("a.3gp", null, "video/3gpp");
    // Unknown extension keeps the declared generic type (still application/*).
    assertResolved("a.bin", "application/octet-stream", "application/octet-stream");
  }

  @Test
  void upload_svgByExtensionIsNotMappedSoItIsRefused() {
    // .svg is deliberately missing from the extension map: no declared type ⇒ no type ⇒ refused.
    MockMultipartFile svg = new MockMultipartFile("file", "x.svg", null, "<svg/>".getBytes());
    assertThatThrownBy(() -> controller.uploadFile(svg))
        .isInstanceOf(BadRequestException.class)
        .hasMessage("File type is not allowed");
  }

  @Test
  void upload_clientDeclaredSpecificTypeWinsOverExtension() throws Exception {
    assertResolved("a.pdf", "image/png", "image/png");
  }

  private void assertResolved(String name, String declared, String expected) throws Exception {
    MockMultipartFile file = new MockMultipartFile("file", name, declared, PNG);
    ResponseEntity<Map<String, String>> res = controller.uploadFile(file);
    assertThat(res.getBody()).containsEntry("contentType", expected);
    verify(validation).validate(file, expected);
  }

  // --- GET /api/uploads/token ------------------------------------------------

  @Test
  void token_requiresUserPrincipal() {
    SecurityContextHolder.clearContext();
    assertThatThrownBy(controller::mediaToken).isInstanceOf(UnauthorizedException.class);
    verifyNoInteractions(mediaTokens);
  }

  // --- GET /api/uploads/{id} -------------------------------------------------

  private GridFSFile stored(String contentType, byte[] bytes, Document meta) throws IOException {
    GridFSFile file = mock(GridFSFile.class);
    when(file.getMetadata()).thenReturn(meta);
    when(file.getLength()).thenReturn((long) bytes.length);
    GridFsResource resource = mock(GridFsResource.class);
    when(resource.getContentType()).thenReturn(contentType);
    when(resource.getFilename()).thenReturn(UUID_ID);
    when(resource.getInputStream()).thenReturn(new ByteArrayInputStream(bytes));
    when(gridFs.getResource(file)).thenReturn(resource);
    when(gridFs.findOne(any(Query.class))).thenReturn(file);
    return file;
  }

  @Test
  void get_unknownIdShapesNeverQueryMongo() {
    for (String id : new String[] {"abc", "../../etc", "507F1F77BCF86CD799439011", UUID_ID + "x"}) {
      assertThat(controller.getFile(id, false, request).getStatusCode())
          .isEqualTo(HttpStatus.NOT_FOUND);
    }
    verify(gridFs, never()).findOne(any(Query.class));
  }

  @Test
  void get_uuidLooksUpByMetadataFileId() throws Exception {
    stored("image/png", PNG, new Document("fileId", UUID_ID));
    controller.getFile(UUID_ID, false, request);

    ArgumentCaptor<Query> q = ArgumentCaptor.forClass(Query.class);
    verify(gridFs).findOne(q.capture());
    assertThat(q.getValue().getQueryObject()).containsEntry("metadata.fileId", UUID_ID);
  }

  @Test
  void get_legacyObjectIdOnlyMatchesFilesWithoutFileId() throws Exception {
    stored("image/png", PNG, null);
    controller.getFile(LEGACY_ID, false, request);

    ArgumentCaptor<Query> q = ArgumentCaptor.forClass(Query.class);
    verify(gridFs).findOne(q.capture());
    Document query = q.getValue().getQueryObject();
    assertThat(query.get("_id")).hasToString(LEGACY_ID);
    assertThat(query.get("metadata.fileId")).isEqualTo(new Document("$exists", false));
  }

  @Test
  void get_missingFileIs404() {
    when(gridFs.findOne(any(Query.class))).thenReturn(null);
    assertThat(controller.getFile(UUID_ID, false, request).getStatusCode())
        .isEqualTo(HttpStatus.NOT_FOUND);
  }

  @Test
  void get_verifiedImageIsInlineWithItsTypeAndSandbox() throws Exception {
    stored("image/png", PNG, new Document("originalFilename", "cat.png"));
    when(validation.matchesInlineSignature(eq("image/png"), any())).thenReturn(true);

    ResponseEntity<Resource> res = controller.getFile(UUID_ID, false, request);

    assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(res.getHeaders().getContentType()).isEqualTo(MediaType.IMAGE_PNG);
    assertThat(res.getHeaders().getFirst("Content-Disposition")).startsWith("inline;");
    assertThat(res.getHeaders().getFirst("Content-Disposition")).contains("cat.png");
    assertThat(res.getHeaders().getFirst("X-Content-Type-Options")).isEqualTo("nosniff");
    assertThat(res.getHeaders().getFirst("Content-Security-Policy")).isEqualTo("sandbox");
    assertThat(res.getHeaders().getContentLength()).isEqualTo(PNG.length);
    assertThat(res.getHeaders().getFirst("Cache-Control")).isNull();
    // The sniffed bytes are pushed back: the body is the whole file.
    assertThat(res.getBody().getInputStream().readAllBytes()).isEqualTo(PNG);
  }

  @Test
  void get_downloadFlagForcesAttachmentEvenForVerifiedMedia() throws Exception {
    stored("image/png", PNG, null);
    when(validation.matchesInlineSignature(eq("image/png"), any())).thenReturn(true);

    ResponseEntity<Resource> res = controller.getFile(UUID_ID, true, request);

    assertThat(res.getHeaders().getFirst("Content-Disposition")).startsWith("attachment;");
    assertThat(res.getHeaders().getContentType()).isEqualTo(MediaType.IMAGE_PNG);
    // Without metadata the GridFS filename is the display name.
    assertThat(res.getHeaders().getFirst("Content-Disposition")).contains(UUID_ID);
  }

  @Test
  void get_imageClaimWithForeignBytesIsOctetStreamAttachment() throws Exception {
    stored("image/png", "<html>".getBytes(), null);
    when(validation.matchesInlineSignature(eq("image/png"), any())).thenReturn(false);

    ResponseEntity<Resource> res = controller.getFile(UUID_ID, false, request);

    assertThat(res.getHeaders().getContentType()).isEqualTo(MediaType.APPLICATION_OCTET_STREAM);
    assertThat(res.getHeaders().getFirst("Content-Disposition")).startsWith("attachment;");
    assertThat(res.getHeaders().getFirst("Content-Security-Policy")).isEqualTo("sandbox");
  }

  @Test
  void get_activeTypesAreRelabelledAndNeverInline() throws Exception {
    for (String active :
        new String[] {"text/html; charset=utf-8", "image/svg+xml", "text/javascript"}) {
      stored(active, "<script>alert(1)</script>".getBytes(), null);
      ResponseEntity<Resource> res = controller.getFile(UUID_ID, false, request);
      assertThat(res.getHeaders().getContentType())
          .as(active)
          .isEqualTo(MediaType.APPLICATION_OCTET_STREAM);
      assertThat(res.getHeaders().getFirst("Content-Disposition")).startsWith("attachment;");
    }
    // The inline signature check is never even consulted for a non-inline type.
    verify(validation, never()).matchesInlineSignature(eq("text/html"), any());
  }

  @Test
  void get_plainDocumentKeepsItsTypeAsAttachment() throws Exception {
    stored("application/zip", new byte[] {0x50, 0x4B, 3, 4}, null);
    ResponseEntity<Resource> res = controller.getFile(UUID_ID, false, request);
    assertThat(res.getHeaders().getContentType()).hasToString("application/zip");
    assertThat(res.getHeaders().getFirst("Content-Disposition")).startsWith("attachment;");
  }

  @Test
  void get_missingOrInvalidStoredTypeIsOctetStream() throws Exception {
    stored(null, PNG, null);
    assertThat(controller.getFile(UUID_ID, false, request).getHeaders().getContentType())
        .isEqualTo(MediaType.APPLICATION_OCTET_STREAM);

    stored("not a type", PNG, null);
    assertThat(controller.getFile(UUID_ID, false, request).getHeaders().getContentType())
        .isEqualTo(MediaType.APPLICATION_OCTET_STREAM);
  }

  @Test
  void get_inlinePdfDropsSandboxSoTheViewerLoads_butDownloadedPdfKeepsIt() throws Exception {
    byte[] pdf = {0x25, 0x50, 0x44, 0x46, 0, 0};
    stored("application/pdf", pdf, null);
    when(validation.matchesInlineSignature(eq("application/pdf"), any())).thenReturn(true);
    ResponseEntity<Resource> inline = controller.getFile(UUID_ID, false, request);
    assertThat(inline.getHeaders().getFirst("Content-Disposition")).startsWith("inline;");
    assertThat(inline.getHeaders().getFirst("Content-Security-Policy")).isNull();

    stored("application/pdf", pdf, null);
    ResponseEntity<Resource> download = controller.getFile(UUID_ID, true, request);
    assertThat(download.getHeaders().getFirst("Content-Security-Policy")).isEqualTo("sandbox");
  }

  @Test
  void get_streamFailureIs500() throws Exception {
    GridFSFile file = stored("image/png", PNG, null);
    when(gridFs.getResource(file).getInputStream()).thenThrow(new IOException("gone"));
    assertThat(controller.getFile(UUID_ID, false, request).getStatusCode())
        .isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
  }

  @Test
  void get_requireAuth_forbiddenReaderNeverSeesBytes() throws Exception {
    ReflectionTestUtils.setField(controller, "requireAuth", true);
    GridFSFile file = stored("image/png", PNG, null);
    when(readerResolver.resolve(request)).thenReturn(Optional.of("stranger"));
    when(accessPolicy.canRead(file, "stranger")).thenReturn(false);

    assertThat(controller.getFile(UUID_ID, false, request).getStatusCode())
        .isEqualTo(HttpStatus.FORBIDDEN);
    verify(gridFs, never()).getResource(any(GridFSFile.class));
  }

  @Test
  void get_requireAuth_unknownFileIs404NotForbidden() {
    ReflectionTestUtils.setField(controller, "requireAuth", true);
    when(readerResolver.resolve(request)).thenReturn(Optional.of(USER));
    when(gridFs.findOne(any(Query.class))).thenReturn(null);

    assertThat(controller.getFile(UUID_ID, false, request).getStatusCode())
        .isEqualTo(HttpStatus.NOT_FOUND);
    verifyNoInteractions(accessPolicy);
  }
}
