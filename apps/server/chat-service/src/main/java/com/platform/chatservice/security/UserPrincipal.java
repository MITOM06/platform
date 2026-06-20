package com.platform.chatservice.security;

import java.util.Collection;
import java.util.List;
import lombok.Getter;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/**
 * Authenticated principal carrying the PON enterprise RBAC claims extracted from the JWT ({@code
 * role}, {@code perms}, {@code depts}). Each capability is also exposed as a Spring authority
 * {@code PERM_<CAP>} so controllers can gate with
 * {@code @PreAuthorize("hasAuthority('PERM_USE_GROUP_BOT')")}. Legacy tokens without the claims
 * yield an empty role/perms/depts (identity still honored).
 */
@Getter
public class UserPrincipal implements Authentication {

  private final String userId;
  private final String role;
  private final List<String> perms;
  private final List<String> depts;
  private final Collection<GrantedAuthority> authorities;
  private boolean authenticated = true;

  public UserPrincipal(String userId) {
    this(userId, null, List.of(), List.of());
  }

  public UserPrincipal(String userId, String role, List<String> perms, List<String> depts) {
    this.userId = userId;
    this.role = role;
    this.perms = perms == null ? List.of() : List.copyOf(perms);
    this.depts = depts == null ? List.of() : List.copyOf(depts);
    this.authorities =
        this.perms.stream()
            .map(p -> (GrantedAuthority) new SimpleGrantedAuthority("PERM_" + p))
            .toList();
  }

  /** True if the member holds the given capability key. */
  public boolean hasPermission(String capability) {
    return perms.contains(capability);
  }

  /** True if the member belongs to the given department id. */
  public boolean inDepartment(String departmentId) {
    return depts.contains(departmentId);
  }

  @Override
  public Collection<? extends GrantedAuthority> getAuthorities() {
    return authorities;
  }

  @Override
  public Object getCredentials() {
    return null;
  }

  @Override
  public Object getDetails() {
    return null;
  }

  @Override
  public Object getPrincipal() {
    return userId;
  }

  @Override
  public boolean isAuthenticated() {
    return authenticated;
  }

  @Override
  public void setAuthenticated(boolean isAuthenticated) {
    this.authenticated = isAuthenticated;
  }

  @Override
  public String getName() {
    return userId;
  }
}
