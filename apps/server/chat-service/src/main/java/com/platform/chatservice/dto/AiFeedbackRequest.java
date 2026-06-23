package com.platform.chatservice.dto;

/**
 * Request body for AI message feedback. {@code rating} is "up" | "down" | "none" ("none" clears the
 * vote). {@code comment} is optional, typically only present for a "down" vote.
 */
public record AiFeedbackRequest(String rating, String comment) {}
