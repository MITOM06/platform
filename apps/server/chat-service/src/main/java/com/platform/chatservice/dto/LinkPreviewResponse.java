package com.platform.chatservice.dto;

/** Open Graph (OG) metadata used to render a rich link-preview card. */
public record LinkPreviewResponse(
    String url, String title, String description, String image, String siteName) {}
