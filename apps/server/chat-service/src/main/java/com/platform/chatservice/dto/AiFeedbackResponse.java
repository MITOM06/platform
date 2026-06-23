package com.platform.chatservice.dto;

/**
 * Current state of the requesting user's feedback for a message. After clearing a vote, {@code
 * rating} is "none" and {@code comment} is null.
 */
public record AiFeedbackResponse(String rating, String comment) {}
