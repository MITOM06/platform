package com.platform.chatservice.controller;

import com.platform.chatservice.dto.LinkPreviewResponse;
import com.platform.chatservice.service.LinkPreviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/utils")
@RequiredArgsConstructor
public class UtilsController {

    private final LinkPreviewService linkPreviewService;

    /** Open Graph unfurl for a URL — used to render rich link-preview cards. */
    @GetMapping("/link-preview")
    public LinkPreviewResponse linkPreview(@RequestParam("url") String url) {
        return linkPreviewService.fetch(url);
    }
}
