package com.platform.chatservice.config;

import com.platform.chatservice.security.JwtAuthenticationFilter;
import java.util.Arrays;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
@Slf4j
public class SecurityConfig {

  private final JwtAuthenticationFilter jwtAuthenticationFilter;

  // REQUIRED in every environment. No open-CORS default — the service refuses to
  // start (below) if ALLOWED_ORIGINS is unset, and warns if it is the wildcard "*".
  @Value("${app.cors.allowed-origins:}")
  private String allowedOrigins;

  @Bean
  public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    return http.cors(cors -> cors.configurationSource(corsConfigurationSource()))
        .csrf(AbstractHttpConfigurer::disable)
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .headers(
            headers ->
                headers
                    .frameOptions(frame -> frame.deny())
                    .contentTypeOptions(Customizer.withDefaults())
                    .httpStrictTransportSecurity(
                        hsts ->
                            hsts.maxAgeInSeconds(31536000).includeSubDomains(true).preload(true))
                    .referrerPolicy(
                        referrer ->
                            referrer.policy(
                                ReferrerPolicyHeaderWriter.ReferrerPolicy
                                    .STRICT_ORIGIN_WHEN_CROSS_ORIGIN)))
        .authorizeHttpRequests(
            auth ->
                auth.requestMatchers("/health", "/ws", "/ws/**")
                    .permitAll()
                    // Spring Security 6 filters the ERROR dispatch too, and OncePerRequestFilter
                    // skips it, so the JWT filter never re-runs and the context is empty by then.
                    // Without this, every error Spring forwards to /error — a missing @RequestParam
                    // (400), an unknown route (404), a wrong method (405) — came back to the client
                    // as 401 "Full authentication is required". Both clients treat 401 as an
                    // expired session, so a plain validation error burned a token refresh and
                    // showed the wrong message. Permit /error so the real status/body survives;
                    // the endpoint itself is still guarded by the rules above.
                    .requestMatchers("/error")
                    .permitAll()
                    .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/uploads/**")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .exceptionHandling(
            exceptions ->
                exceptions.authenticationEntryPoint(
                    (request, response, authException) -> {
                      response.setStatus(jakarta.servlet.http.HttpServletResponse.SC_UNAUTHORIZED);
                      response.setContentType("application/json");
                      response
                          .getWriter()
                          .write(
                              "{\"error\":\"Unauthorized\",\"message\":\""
                                  + authException.getMessage()
                                  + "\",\"statusCode\":401}");
                    }))
        .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
        .build();
  }

  @Bean
  public CorsConfigurationSource corsConfigurationSource() {
    if (allowedOrigins == null || allowedOrigins.isBlank()) {
      throw new IllegalStateException(
          "ALLOWED_ORIGINS must be set. Refusing to start with open CORS.");
    }
    if ("*".equals(allowedOrigins.trim())) {
      log.warn("⚠️  CORS ALLOWED_ORIGINS='*' — only acceptable in local dev, NEVER in production");
    }
    CorsConfiguration config = new CorsConfiguration();
    // Read allowed origins from ALLOWED_ORIGINS env (comma-separated). Use origin
    // patterns so credentials are allowed even when the wildcard "*" default is used.
    config.setAllowedOriginPatterns(
        Arrays.stream(allowedOrigins.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .toList());
    config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
    config.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "Accept"));
    config.setAllowCredentials(true);
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return source;
  }
}
