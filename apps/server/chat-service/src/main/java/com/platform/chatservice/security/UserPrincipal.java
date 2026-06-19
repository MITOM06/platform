package com.platform.chatservice.security;

import java.util.Collection;
import java.util.List;
import lombok.Getter;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;

@Getter
public class UserPrincipal implements Authentication {

  private final String userId;
  private boolean authenticated = true;

  public UserPrincipal(String userId) {
    this.userId = userId;
  }

  @Override
  public Collection<? extends GrantedAuthority> getAuthorities() {
    return List.of();
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
