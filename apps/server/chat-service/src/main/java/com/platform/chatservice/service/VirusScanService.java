package com.platform.chatservice.service;

import org.springframework.web.multipart.MultipartFile;

/**
 * Contract for virus/malware scanning of uploaded files.
 *
 * The production implementation should integrate with ClamAV (clamd socket)
 * or a cloud scanning API (e.g., VirusTotal). The default bean
 * {@link NoOpVirusScanService} is a no-op stub that logs and passes through.
 */
public interface VirusScanService {

    /**
     * Scans the given file for malware.
     *
     * @param file the multipart file to scan
     * @throws com.platform.chatservice.exception.BadRequestException if a threat is detected
     */
    void scan(MultipartFile file);
}
