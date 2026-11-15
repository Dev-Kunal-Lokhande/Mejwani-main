package com.mejwani.security;

import com.mejwani.entity.Admin;
import com.mejwani.repository.AdminRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final AdminRepository adminRepository;

    @Autowired
    public JwtAuthFilter(JwtUtil jwtUtil, AdminRepository adminRepository) {
        this.jwtUtil = jwtUtil;
        this.adminRepository = adminRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7).trim();
            try {
                if (jwtUtil.validateToken(token)) {
                    String email = jwtUtil.getEmailFromToken(token);
                    String role = null;
                    try {
                        role = jwtUtil.getRoleFromToken(token);
                    } catch (Exception ignored) {}

                    if (role == null || role.isBlank()) {
                        role = "ADMIN";
                    }
                    String authority = role.startsWith("ROLE_") ? role : "ROLE_" + role;

                    Optional<Admin> adminOpt = (email != null) ? adminRepository.findByEmail(email) : Optional.empty();
                    Object principal;
                    if (adminOpt.isPresent()) {
                        principal = adminOpt.get();
                    } else {
                        Admin jwtAdmin = new Admin();
                        jwtAdmin.setEmail(email);
                        jwtAdmin.setRole(role);
                        principal = jwtAdmin;
                    }

                    var auth = new UsernamePasswordAuthenticationToken(
                            principal,
                            null,
                            List.of(new SimpleGrantedAuthority(authority))
                    );
                    SecurityContextHolder.getContext().setAuthentication(auth);
                } else {
                    System.out.println("[JwtAuthFilter] Invalid or expired token for: " + request.getRequestURI());
                }
            } catch (Exception e) {
                System.err.println("[JwtAuthFilter] Auth error on " + request.getRequestURI() + ": " + e.getMessage());
            }
        }
        filterChain.doFilter(request, response);
    }
}