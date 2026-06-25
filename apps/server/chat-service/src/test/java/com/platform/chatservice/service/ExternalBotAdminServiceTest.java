package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.platform.chatservice.dto.ExternalBotResponse;
import com.platform.chatservice.model.ExternalBot;
import com.platform.chatservice.repository.ExternalBotRepository;
import java.util.List;
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

  @Test
  void listAll_mapsAllRepoDocsToResponses() {
    when(repo.findAll())
        .thenReturn(
            List.of(
                ExternalBot.builder()
                    .id("eb-1")
                    .botUserId("extbot:bf-1")
                    .factoryBotId("bf-1")
                    .ownerUserId("user-1")
                    .name("Assistant One")
                    .avatarUrl("https://cdn/a1.png")
                    .enabled(true)
                    .build(),
                ExternalBot.builder()
                    .id("eb-2")
                    .botUserId("extbot:bf-2")
                    .factoryBotId("bf-2")
                    .ownerUserId("user-2")
                    .name("Assistant Two")
                    .enabled(false)
                    .build()));

    ExternalBotAdminService service = new ExternalBotAdminService(repo);
    List<ExternalBotResponse> res = service.listAll();

    assertThat(res).hasSize(2);
    assertThat(res.get(0).id()).isEqualTo("eb-1");
    assertThat(res.get(0).botUserId()).isEqualTo("extbot:bf-1");
    assertThat(res.get(0).ownerUserId()).isEqualTo("user-1");
    assertThat(res.get(0).name()).isEqualTo("Assistant One");
    assertThat(res.get(0).avatarUrl()).isEqualTo("https://cdn/a1.png");
    assertThat(res.get(0).enabled()).isTrue();
    assertThat(res.get(1).botUserId()).isEqualTo("extbot:bf-2");
    assertThat(res.get(1).enabled()).isFalse();
  }

  @Test
  void listAll_returnsEmptyWhenNoBots() {
    when(repo.findAll()).thenReturn(List.of());

    ExternalBotAdminService service = new ExternalBotAdminService(repo);

    assertThat(service.listAll()).isEmpty();
  }
}
