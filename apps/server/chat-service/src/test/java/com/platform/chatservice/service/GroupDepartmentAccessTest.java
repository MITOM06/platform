package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.platform.chatservice.exception.ForbiddenException;
import com.platform.chatservice.security.UserPrincipal;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * A group's departmentId scopes its AI bot to that department's knowledge base. Before this check,
 * any member could create a group carrying another department's id and have the assistant retrieve
 * that department's confidential documents (verified live on 2026-09-30).
 */
class GroupDepartmentAccessTest {

  private static final String DEPT = "dept-accounting";

  @Test
  void outsiderCannotAttachAForeignDepartment() {
    UserPrincipal outsider = new UserPrincipal("u-1", "Member", List.of(), List.of("dept-sales"));

    assertThatThrownBy(() -> ConversationService.requireDepartmentAccess(outsider, DEPT))
        .isInstanceOf(ForbiddenException.class);
  }

  @Test
  void departmentMemberMayAttachTheirDepartment() {
    UserPrincipal member = new UserPrincipal("u-2", "Member", List.of(), List.of(DEPT));

    assertThatCode(() -> ConversationService.requireDepartmentAccess(member, DEPT))
        .doesNotThrowAnyException();
  }

  @Test
  void departmentManagerMayAttachAnyDepartment() {
    UserPrincipal admin =
        new UserPrincipal("u-3", "Admin", List.of("MANAGE_DEPARTMENTS"), List.of());

    assertThatCode(() -> ConversationService.requireDepartmentAccess(admin, DEPT))
        .doesNotThrowAnyException();
  }

  @Test
  void personalGroupsWithoutADepartmentAreUnaffected() {
    UserPrincipal legacy = new UserPrincipal("u-4");

    assertThatCode(() -> ConversationService.requireDepartmentAccess(legacy, null))
        .doesNotThrowAnyException();
    assertThatCode(() -> ConversationService.requireDepartmentAccess(legacy, " "))
        .doesNotThrowAnyException();
  }

  @Test
  void legacyTokenWithoutDepartmentClaimsCannotAttachOne() {
    UserPrincipal legacy = new UserPrincipal("u-5");

    assertThatThrownBy(() -> ConversationService.requireDepartmentAccess(legacy, DEPT))
        .isInstanceOf(ForbiddenException.class);
  }
}
