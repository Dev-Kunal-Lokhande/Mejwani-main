package com.mejwani.controller;

import com.mejwani.entity.*;
import com.mejwani.repository.*;
import com.mejwani.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/staff")
@RequiredArgsConstructor
public class StaffController {

    private final StaffRepository staffRepository;
    private final HotelRepository hotelRepository;
    private final AdminRepository adminRepository;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;

    private Map<String, Object> serializeStaff(Staff s) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", s.getId());
        m.put("name", s.getName());
        m.put("phone", s.getPhone());
        m.put("role", s.getRole());
        m.put("salary", s.getSalary());
        m.put("is_active", s.getIsActive());
        m.put("hotel_id", s.getHotel() != null ? s.getHotel().getId() : null);
        m.put("joined_at", s.getJoinedAt());
        m.put("created_at", s.getCreatedAt());
        return m;
    }

    // GET /api/staff?hotelId=X
    @GetMapping
    public ResponseEntity<?> getStaff(@RequestParam(required = false) Long hotelId,
                                      jakarta.servlet.http.HttpServletRequest request) {
        Long hid = hotelId;
        if (hid == null) {
            try {
                String authHeader = request.getHeader("Authorization");
                if (authHeader != null && authHeader.startsWith("Bearer ")) {
                    hid = jwtUtil.getHotelIdFromToken(authHeader.substring(7));
                }
            } catch (Exception ignored) {}
        }
        if (hid == null) return ResponseEntity.ok(Map.of("success", true, "data", List.of()));
        var data = staffRepository.findByHotelIdAndIsActiveTrue(hid)
                .stream().map(this::serializeStaff).toList();
        return ResponseEntity.ok(Map.of("success", true, "data", data));
    }

    // POST /api/staff/login — Captain login
    @PostMapping("/login")
    public ResponseEntity<?> captainLogin(@RequestBody Map<String, Object> body) {
        String email = body.containsKey("email") ? body.get("email").toString() : "";
        String password = body.containsKey("password") ? body.get("password").toString() : "";

        Optional<Admin> adminOpt = adminRepository.findByEmail(email);
        if (adminOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("success", false, "message", "Invalid email or password"));
        }

        Admin admin = adminOpt.get();
        if (!passwordEncoder.matches(password, admin.getPassword())) {
            return ResponseEntity.status(401).body(Map.of("success", false, "message", "Invalid email or password"));
        }

        if (Boolean.FALSE.equals(admin.getIsActive())) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", "Account is disabled"));
        }

        if (!"CAPTAIN".equals(admin.getRole()) && !"HOTEL_ADMIN".equals(admin.getRole())) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", "Access denied. Not a captain account."));
        }

        Long hotelId = admin.getHotel() != null ? admin.getHotel().getId() : null;
        String hotelSlug = admin.getHotel() != null && admin.getHotel().getSlug() != null
                ? admin.getHotel().getSlug() : "";
        String token = jwtUtil.generateToken(admin.getEmail(), admin.getRole(), hotelId);

        return ResponseEntity.ok(Map.of(
            "success", true,
            "token", token,
            "captain", Map.of(
                "id", admin.getId(),
                "name", admin.getName(),
                "email", admin.getEmail(),
                "role", admin.getRole(),
                "hotel_id", hotelId != null ? hotelId : "",
                "hotel_slug", hotelSlug
            )
        ));
    }

    // POST /api/staff
    @PostMapping
    public ResponseEntity<?> addStaff(@RequestBody Map<String, Object> body,
                                      jakarta.servlet.http.HttpServletRequest request) {
        try {
            // hotelId from body or from JWT token directly
            Long hotelId = null;
            if (body.containsKey("hotelId") && body.get("hotelId") != null) {
                hotelId = Long.valueOf(body.get("hotelId").toString());
            } else {
                try {
                    String authHeader = request.getHeader("Authorization");
                    if (authHeader != null && authHeader.startsWith("Bearer ")) {
                        hotelId = jwtUtil.getHotelIdFromToken(authHeader.substring(7));
                    }
                } catch (Exception ignored) {}
            }
            if (hotelId == null) return ResponseEntity.badRequest().body(Map.of("success", false, "message", "hotelId required"));
            Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> new RuntimeException("Hotel not found"));

            Staff staff = Staff.builder()
                    .name(body.get("name").toString())
                    .phone(body.containsKey("phone") && body.get("phone") != null ? body.get("phone").toString() : null)
                    .role(body.containsKey("role") && body.get("role") != null ? body.get("role").toString() : "WAITER")
                    .salary(body.containsKey("salary") && body.get("salary") != null ? Double.valueOf(body.get("salary").toString()) : null)
                    .isActive(true)
                    .hotel(hotel)
                    .build();

            return ResponseEntity.ok(Map.of("success", true, "data", serializeStaff(staffRepository.save(staff))));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    // PUT /api/staff/{id}
    @PutMapping("/{id}")
    public ResponseEntity<?> updateStaff(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return staffRepository.findById(id).map(staff -> {
            if (body.containsKey("name")) staff.setName(body.get("name").toString());
            if (body.containsKey("phone")) staff.setPhone(body.get("phone").toString());
            if (body.containsKey("role")) staff.setRole(body.get("role").toString());
            if (body.containsKey("salary")) staff.setSalary(Double.valueOf(body.get("salary").toString()));
            if (body.containsKey("isActive")) staff.setIsActive(Boolean.valueOf(body.get("isActive").toString()));
            return ResponseEntity.ok(serializeStaff(staffRepository.save(staff)));
        }).orElse(ResponseEntity.notFound().build());
    }

    // DELETE /api/staff/{id}
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteStaff(@PathVariable Long id) {
        return staffRepository.findById(id).map(staff -> {
            staff.setIsActive(false);
            staffRepository.save(staff);
            return ResponseEntity.ok(Map.of("success", true, "message", "Staff removed"));
        }).orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/performance")
    public ResponseEntity<?> getPerformance(@RequestParam(required = false) Long hotelId,
                                             @RequestParam(required = false) String startDate,
                                             @RequestParam(required = false) String endDate) {
        return ResponseEntity.ok(List.of());
    }

    @GetMapping("/monthly-report")
    public ResponseEntity<?> getMonthlyReport(@RequestParam(required = false) Long hotelId,
                                               @RequestParam(required = false) Integer year,
                                               @RequestParam(required = false) Integer month) {
        return ResponseEntity.ok(List.of());
    }

    @GetMapping("/salary")
    public ResponseEntity<?> getSalary(@RequestParam(required = false) Long hotelId,
                                        @RequestParam(required = false) Integer year,
                                        @RequestParam(required = false) Integer month) {
        return ResponseEntity.ok(List.of());
    }
}
