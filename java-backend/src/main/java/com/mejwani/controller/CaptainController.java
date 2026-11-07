package com.mejwani.controller;

import com.mejwani.entity.*;
import com.mejwani.repository.*;
import com.mejwani.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/captain")
@RequiredArgsConstructor
public class CaptainController {

    private final CaptainRequestRepository captainRequestRepository;
    private final HotelRepository hotelRepository;
    private final RestaurantTableRepository tableRepository;
    private final AdminRepository adminRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final SimpMessagingTemplate messagingTemplate;

    // GET /api/captain?hotelId=X
    @GetMapping
    public ResponseEntity<?> getRequests(@RequestParam Long hotelId,
                                         @RequestParam(required = false) String status) {
        if (status != null) {
            return ResponseEntity.ok(captainRequestRepository.findByHotelIdAndStatus(hotelId, status));
        }
        return ResponseEntity.ok(captainRequestRepository.findByHotelIdOrderByCreatedAtDesc(hotelId));
    }

    // POST /api/captain — create captain request
    @PostMapping
    public ResponseEntity<?> createRequest(@RequestBody Map<String, Object> body) {
        Long hotelId = Long.valueOf(body.get("hotelId").toString());
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> new RuntimeException("Hotel not found"));

        CaptainRequest req = CaptainRequest.builder()
                .hotel(hotel)
                .requestType(body.getOrDefault("requestType", "CALL_CAPTAIN").toString())
                .visitId(body.containsKey("visitId") ? body.get("visitId").toString() : null)
                .status("CAPTAIN_REQUESTED")
                .build();

        if (body.containsKey("tableId")) {
            Long tableId = Long.valueOf(body.get("tableId").toString());
            tableRepository.findById(tableId).ifPresent(req::setTable);
        }

        CaptainRequest saved = captainRequestRepository.save(req);

        messagingTemplate.convertAndSend("/topic/hotel/" + hotelId + "/captain", Map.of(
            "type", "NEW_REQUEST",
            "requestId", saved.getId(),
            "requestType", saved.getRequestType()
        ));

        return ResponseEntity.ok(saved);
    }

    // PUT /api/captain/{id}/status
    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return captainRequestRepository.findById(id).map(req -> {
            req.setStatus(body.get("status"));
            return ResponseEntity.ok(captainRequestRepository.save(req));
        }).orElse(ResponseEntity.notFound().build());
    }

    // POST /api/captain/forgot-password — Step 1: send OTP (stub)
    @PostMapping("/forgot-password")
    public ResponseEntity<?> captainForgotPassword(@RequestBody Map<String, Object> body) {
        String email = body.containsKey("email") ? body.get("email").toString() : "";
        Optional<Admin> adminOpt = adminRepository.findByEmail(email);
        if (adminOpt.isEmpty()) {
            // Don't reveal if email exists
            return ResponseEntity.ok(Map.of("success", true, "message", "If this email is registered, an OTP has been sent."));
        }
        // In production, send OTP via email. For now, stub returns success.
        return ResponseEntity.ok(Map.of("success", true, "message", "OTP sent to your email."));
    }

    // POST /api/captain/verify-otp — Step 2: verify OTP (stub - always passes)
    @PostMapping("/verify-otp")
    public ResponseEntity<?> captainVerifyOtp(@RequestBody Map<String, Object> body) {
        // Stub: accept any 6-digit OTP for now
        return ResponseEntity.ok(Map.of("success", true, "message", "OTP verified."));
    }

    // POST /api/captain/reset-password — Step 3: reset password
    @PostMapping("/reset-password")
    public ResponseEntity<?> captainResetPassword(@RequestBody Map<String, Object> body) {
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
}
