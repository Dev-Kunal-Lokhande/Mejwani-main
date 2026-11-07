package com.mejwani.config;

import com.mejwani.security.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Value("${frontend.url}")
    private String frontendUrl;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Auth endpoints — public
                .requestMatchers("/api/admin/login").permitAll()
                .requestMatchers("/api/admin/register").permitAll()
                .requestMatchers("/api/admin/forgot-password/**").permitAll()
                .requestMatchers("/api/super-admin/login").permitAll()
                // Staff / Captain login & forgot password — public
                .requestMatchers("/api/staff/login").permitAll()
                .requestMatchers("/api/captain/forgot-password").permitAll()
                .requestMatchers("/api/captain/verify-otp").permitAll()
                .requestMatchers("/api/captain/reset-password").permitAll()
                // Public data endpoints
                .requestMatchers("/api/today/**").permitAll()
                .requestMatchers("/api/customer/**").permitAll()
                .requestMatchers("/api/menu/**").permitAll()
                .requestMatchers("/api/hotels/by-slug/**").permitAll()
                .requestMatchers("/api/admin/system-settings").permitAll()
                .requestMatchers("/api/admin/system-settings/**").permitAll()
                // WebSocket & Socket.io
                .requestMatchers("/socket.io/**").permitAll()
                .requestMatchers("/ws/**").permitAll()
                // Misc
                .requestMatchers("/api/").permitAll()
                .requestMatchers("/api/health").permitAll()
                // Uploaded file serving
                .requestMatchers("/uploads/**").permitAll()
                // Everything else needs JWT
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of("*"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
