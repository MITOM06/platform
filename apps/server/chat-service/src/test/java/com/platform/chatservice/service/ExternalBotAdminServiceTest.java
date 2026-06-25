package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.platform.chatservice.dto.ExternalBotResponse;
import com.platform.chatservice.model.ExternalBot;
import com.platform.chatservice.repository.ExternalBotRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ExternalBotAdminServiceTest {

  @Mock private ExternalBotRepository repo;

  @Test
  void register_createsMappingWithDerivedBotUserId() {
    when(repo.findByBotUserId("extbot:bf-1")).thenReturn(Optional.empty());
    when(repo.save(any(ExternalBot.class))).thenAnswer(inv -> inv.getArgument(0));

    ExternalBotAdminService service = new ExternalBotAdminService(repo);
    ExternalBotResponse res = service.register("user-1", "bf-1", "My Assistant", null);

    assertThat(res.botUserId()).isEqualTo("extbot:bf-1");
    assertThat(res.ownerUserId()).isEqualTo("user-1");
    assertThat(res.factoryBotId()).isEqualTo("bf-1");
    assertThat(res.enabled()).isTrue();
  }

  @Test
  void findAssistantFor_returnsMapped() {
    when(repo.findByOwnerUserIdAndEnabledTrue("user-1"))
        .thenReturn(
            Optional.of(
                ExternalBot.builder()
                    .id("eb-1")
                    .botUserId("extbot:bf-1")
                    .factoryBotId("bf-1")
                    .ownerUserId("user-1")
                    .name("My Assistant")
                    .enabled(true)
                    .build()));

    ExternalBotAdminService service = new ExternalBotAdminService(repo);
    Optional<ExternalBotResponse> res = service.findAssistantFor("user-1");

    assertThat(res).isPresent();
    assertThat(res.get().botUserId()).isEqualTo("extbot:bf-1");
  }
}
