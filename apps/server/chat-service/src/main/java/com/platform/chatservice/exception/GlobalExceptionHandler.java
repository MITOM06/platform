package com.platform.chatservice.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ConversationNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(ConversationNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
            "error", "Not found",
            "message", ex.getMessage(),
            "statusCode", 404
        ));
    }

    @ExceptionHandler(DuplicateConversationException.class)
    public ResponseEntity<Map<String, Object>> handleDuplicate(DuplicateConversationException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
            "error", "Conversation already exists",
            "conversationId", ex.getConversationId(),
            "statusCode", 409
        ));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, Object>> handleGeneric(RuntimeException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
            "error", ex.getMessage(),
            "statusCode", 400
        ));
    }
}
