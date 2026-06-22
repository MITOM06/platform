package com.platform.chatservice.dto;

/**
 * Body for {@code PUT /api/conversations/{id}/wallpaper}. {@code wallpaper} may be a preset token,
 * a relative uploaded-image url, or "" / null to reset to the default for everyone.
 */
public record WallpaperRequest(String wallpaper) {}
