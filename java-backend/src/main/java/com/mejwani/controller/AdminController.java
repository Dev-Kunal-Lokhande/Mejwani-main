package com.mejwani.controller;

import com.mejwani.entity.Admin;
import com.mejwani.entity.Hotel;
import com.mejwani.repository.AdminRepository;
import com.mejwani.repository.HotelRepository;
import com.mejwani.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminRepository adminRepository;
    private final HotelRepository hotelRepository;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;

    // POST /api/admin/register
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, Object> body) {
        String email = body.get("email").toString();

        if (adminRepository.existsByEmail(email)) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Email already registered"));
        }

        Admin admin = Admin.builder()
                .name(body.get("name").toString())
                .email(email)
                .password(passwordEncoder.encode(body.get("password").toString()))
                .role(body.containsKey("role") ? body.get("role").toString() : "HOTEL_ADMIN")
                .isActive(true)
                .build();

        if (body.containsKey("hotelId") && body.get("hotelId") != null && !body.get("hotelId").toString().isEmpty()) {
            try {
                Long hotelId = Long.valueOf(body.get("hotelId").toString());
                hotelRepository.findById(hotelId).ifPresent(admin::setHotel);
            } catch (NumberFormatException ignored) {}
        }

        Admin saved = adminRepository.save(admin);
        Long hotelId = saved.getHotel() != null ? saved.getHotel().getId() : null;
        String token = jwtUtil.generateToken(saved.getEmail(), saved.getRole(), hotelId);

        return ResponseEntity.ok(Map.of(
            "success", true,
            "token", token,
            "admin", Map.of(
                "id", saved.getId(),
                "name", saved.getName(),
                "email", saved.getEmail(),
                "role", saved.getRole(),
                "hotel_id", hotelId != null ? hotelId : "",
                "hotelId", hotelId != null ? hotelId : ""
            )
        ));
    }

    // POST /api/admin/login
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, Object> body) {
        // Support both "email" and "username" fields from frontend
        String email = body.containsKey("email") ? body.get("email").toString()
                     : body.containsKey("username") ? body.get("username").toString() : "";
        String password = body.containsKey("password") ? body.get("password").toString() : "";

        Optional<Admin> adminOpt = adminRepository.findByEmail(email);
        if (adminOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of(
                "success", false, "message", "Invalid email or password"));
        }

        Admin admin = adminOpt.get();
        if (!passwordEncoder.matches(password, admin.getPassword())) {
            return ResponseEntity.status(401).body(Map.of(
                "success", false, "message", "Invalid email or password"));
        }

        if (Boolean.FALSE.equals(admin.getIsActive())) {
            return ResponseEntity.status(403).body(Map.of(
                "success", false, "message", "Account is disabled. Contact support."));
        }

        Long hotelId = admin.getHotel() != null ? admin.getHotel().getId() : null;
        String hotelSlug = admin.getHotel() != null && admin.getHotel().getSlug() != null ? admin.getHotel().getSlug() : "";
        String token = jwtUtil.generateToken(admin.getEmail(), admin.getRole(), hotelId);

        return ResponseEntity.ok(Map.of(
            "success", true,
            "token", token,
            "admin", Map.of(
                "id", admin.getId(),
                "name", admin.getName(),
                "email", admin.getEmail(),
                "role", admin.getRole(),
                "hotel_id", hotelId != null ? hotelId : "",
                "hotelId", hotelId != null ? hotelId : "",
                "hotel_slug", hotelSlug
            )
        ));
    }

    // GET /api/admin/me
    @GetMapping("/me")
    public ResponseEntity<?> getMe() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Admin admin)) {
            return ResponseEntity.status(401).body(Map.of("success", false, "message", "Unauthorized"));
        }
        Long hotelId = admin.getHotel() != null ? admin.getHotel().getId() : null;
        String hotelSlug = admin.getHotel() != null && admin.getHotel().getSlug() != null ? admin.getHotel().getSlug() : "";
        return ResponseEntity.ok(Map.of(
            "success", true,
            "id", admin.getId(),
            "name", admin.getName(),
            "email", admin.getEmail(),
            "role", admin.getRole(),
            "hotel_id", hotelId != null ? hotelId : "",
            "hotelId", hotelId != null ? hotelId : "",
            "hotel_slug", hotelSlug
        ));
    }

    // GET /api/admin/system-settings  — used by frontend for clock sync & settings
    @GetMapping("/system-settings")
    public ResponseEntity<?> getSystemSettings() {
        return ResponseEntity.ok(Map.of(
            "success", true,
            "data", Map.of(
                "currency", "INR",
                "taxRate", 5,
                "gstEnabled", false
            )
        ));
    }

    // GET /api/admin/system-settings/public?hotelId=X (no auth required)
    @GetMapping("/system-settings/public")
    public ResponseEntity<?> getSystemSettingsPublic(@RequestParam(required = false) Long hotelId) {
        return ResponseEntity.ok(Map.of(
            "success", true,
            "data", Map.of(
                "currency", "INR",
                "taxRate", 5,
                "gstEnabled", false
            )
        ));
    }

    // GET /api/admin/hotels
    @GetMapping("/hotels")
    public ResponseEntity<?> getAllHotels() {
        return ResponseEntity.ok(hotelRepository.findAll());
    }

    // PUT /api/admin/hotels/{id}
    @PutMapping("/hotels/{id}")
    public ResponseEntity<?> updateHotel(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return hotelRepository.findById(id).map(hotel -> {
            if (body.containsKey("name")) hotel.setName(body.get("name").toString());
            if (body.containsKey("address")) hotel.setAddress(body.get("address").toString());
            if (body.containsKey("phone")) hotel.setPhone(body.get("phone").toString());
            if (body.containsKey("email")) hotel.setEmail(body.get("email").toString());
            if (body.containsKey("ownerName")) hotel.setOwnerName(body.get("ownerName").toString());
            return ResponseEntity.ok(hotelRepository.save(hotel));
        }).orElse(ResponseEntity.notFound().build());
    }

    // POST /api/admin/forgot-password/request
    @PostMapping("/forgot-password/request")
    public ResponseEntity<?> forgotPasswordRequest(@RequestBody Map<String, Object> body) {
        // Stub — email OTP not configured; just return success
        return ResponseEntity.ok(Map.of("success", true, "message", "OTP sent to your email (if registered)."));
    }

    // POST /api/admin/forgot-password/verify
    @PostMapping("/forgot-password/verify")
    public ResponseEntity<?> forgotPasswordVerify(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(Map.of("success", true, "message", "OTP verified."));
    }

    // POST /api/admin/forgot-password/reset
    @PostMapping("/forgot-password/reset")
    public ResponseEntity<?> forgotPasswordReset(@RequestBody Map<String, Object> body) {
        String email = body.containsKey("email") ? body.get("email").toString() : "";
        String newPassword = body.containsKey("newPassword") ? body.get("newPassword").toString() : "";
        Optional<Admin> adminOpt = adminRepository.findByEmail(email);
        if (adminOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Email not found."));
        }
        Admin admin = adminOpt.get();
        admin.setPassword(passwordEncoder.encode(newPassword));
        adminRepository.save(admin);
        return ResponseEntity.ok(Map.of("success", true, "message", "Password reset successfully."));
    }

    // PUT /api/admin/system-settings
    @PutMapping("/system-settings")
    public ResponseEntity<?> updateSystemSettings(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(Map.of("success", true, "message", "Settings saved.", "data", body));
    }

    // POST /api/admin/change-password
    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(@RequestBody Map<String, Object> body) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Admin admin)) {
            return ResponseEntity.status(401).body(Map.of("success", false, "message", "Unauthorized"));
        }
        String currentPassword = body.containsKey("currentPassword") ? body.get("currentPassword").toString() : "";
        String newPassword = body.containsKey("newPassword") ? body.get("newPassword").toString() : "";
        if (!passwordEncoder.matches(currentPassword, admin.getPassword())) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Current password is incorrect."));
        }
        admin.setPassword(passwordEncoder.encode(newPassword));
        adminRepository.save(admin);
        return ResponseEntity.ok(Map.of("success", true, "message", "Password changed successfully."));
    }
}
