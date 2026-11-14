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
            Long hotelId = null;
            Object rawHotelId = body.get("hotelId") != null ? body.get("hotelId") : body.get("hotel_id");
            if (rawHotelId != null && !rawHotelId.toString().isBlank()) {
                hotelId = Long.valueOf(rawHotelId.toString());
            } else {
                try {
                    String authHeader = request.getHeader("Authorization");
                    if (authHeader != null && authHeader.startsWith("Bearer ")) {
                        hotelId = jwtUtil.getHotelIdFromToken(authHeader.substring(7));
                    }
                } catch (Exception ignored) {}
            }
            if (hotelId == null) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "hotelId required"));
            }
            Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> new RuntimeException("Hotel not found"));

            Object rawName = body.get("name") != null ? body.get("name")
                    : (body.get("fullName") != null ? body.get("fullName") : body.get("full_name"));
            if (rawName == null || rawName.toString().isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Staff name is required"));
            }
            String staffName = rawName.toString().trim();

            Object rawPhone = body.get("phone") != null ? body.get("phone")
                    : (body.get("phoneNumber") != null ? body.get("phoneNumber") : body.get("phone_number"));
            String staffPhone = (rawPhone != null && !rawPhone.toString().isBlank()) ? rawPhone.toString().trim() : null;

            String staffRole = (body.get("role") != null && !body.get("role").toString().isBlank())
                    ? body.get("role").toString().trim() : "WAITER";

            Object rawSalary = body.get("salary");
            Double staffSalary = (rawSalary != null && !rawSalary.toString().isBlank())
                    ? Double.valueOf(rawSalary.toString()) : null;

            Staff staff = Staff.builder()
                    .name(staffName)
                    .phone(staffPhone)
                    .role(staffRole)
                    .salary(staffSalary)
                    .isActive(true)
                    .hotel(hotel)
                    .build();

            Staff savedStaff = staffRepository.save(staff);

            // Also create Captain login credentials if email is provided and role is Waiter/Captain
            Object rawEmail = body.get("email");
            if (rawEmail != null && !rawEmail.toString().isBlank() &&
                    (staffRole.equalsIgnoreCase("WAITER") || staffRole.equalsIgnoreCase("CAPTAIN"))) {
                String email = rawEmail.toString().trim();
                if (adminRepository.findByEmail(email).isEmpty()) {
                    Object rawPass = body.get("password");
                    String plainPassword = (rawPass != null && !rawPass.toString().isBlank())
                            ? rawPass.toString() : (staffPhone != null ? staffPhone : "123456");

                    Admin captainAccount = Admin.builder()
                            .name(staffName)
                            .email(email)
                            .password(passwordEncoder.encode(plainPassword))
                            .role("CAPTAIN")
                            .isActive(true)
                            .hotel(hotel)
                            .build();
                    adminRepository.save(captainAccount);
                }
            }

            return ResponseEntity.ok(Map.of("success", true, "data", serializeStaff(savedStaff)));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("success", false, "message", e.getMessage() != null ? e.getMessage() : "Error adding staff"));
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
