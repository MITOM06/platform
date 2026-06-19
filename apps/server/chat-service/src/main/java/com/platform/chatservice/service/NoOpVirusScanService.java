package com.platform.chatservice.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * No-op stub — passes all files as clean and emits a debug log. Replace this bean with a real
 * ClamAV or cloud-scanner integration in production.
 */
@Service
@ConditionalOnMissingBean(name = "realVirusScanService")
@Slf4j
public class NoOpVirusScanService implements VirusScanService {

  @Override
  public void scan(MultipartFile file) {
    log.debug(
        "Virus scan stub (no-op): '{}' {} bytes — replace with ClamAV in production",
        file.getOriginalFilename(),
        file.getSize());
  }
}
