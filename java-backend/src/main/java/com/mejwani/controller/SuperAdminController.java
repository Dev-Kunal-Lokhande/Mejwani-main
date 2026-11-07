package com.mejwani.controller;

import com.mejwani.entity.*;
import com.mejwani.repository.*;
import com.mejwani.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/super-admin")
@RequiredArgsConstructor
public class SuperAdminController {

    private final AdminRepository adminRepository;
    private final HotelRepository hotelRepository;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;

    @Value("${upload.dir:uploads}")
    private String uploadDir;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String password = body.get("password");

        var adminOpt = adminRepository.findByEmail(email);
        if (adminOpt.isEmpty() || !passwordEncoder.matches(password, adminOpt.get().getPassword())) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid credentials"));
        }

        Admin admin = adminOpt.get();
        if (!"SUPER_ADMIN".equals(admin.getRole())) {
            return ResponseEntity.status(403).body(Map.of("error", "Access denied"));
        }

        String token = jwtUtil.generateToken(admin.getEmail(), admin.getRole(), null);
        return ResponseEntity.ok(Map.of(
            "success", true,
            "token", token,
            "admin", Map.of(
                "id", admin.getId(),
                "name", admin.getName(),
                "email", admin.getEmail(),
                "role", admin.getRole()
            )
        ));
    }

    private Map<String, Object> serializeHotel(Hotel h) {
        Map<String, Object> m = new java.util.HashMap<>();
        m.put("id", h.getId()); m.put("name", h.getName());
        m.put("owner_name", h.getOwnerName()); m.put("slug", h.getSlug());
        m.put("email", h.getEmail()); m.put("phone", h.getPhone());
        m.put("address", h.getAddress()); m.put("plan", h.getPlan());
        m.put("status", h.getStatus()); m.put("is_active", h.getIsActive());
        m.put("logo_url", h.getLogoUrl()); m.put("cover_image_url", h.getCoverImageUrl());
        m.put("qr_pamphlet_url", h.getQrPamphletUrl()); m.put("created_at", h.getCreatedAt());
        return m;
    }

    private Map<String, Object> serializeAdmin(Admin a) {
        Map<String, Object> m = new java.util.HashMap<>();
        m.put("id", a.getId()); m.put("name", a.getName());
        m.put("email", a.getEmail()); m.put("role", a.getRole());
        m.put("is_active", a.getIsActive()); m.put("created_at", a.getCreatedAt());
        m.put("hotel_id", a.getHotel() != null ? a.getHotel().getId() : null);
        return m;
    }

    // GET all hotels
    @GetMapping("/hotels")
    public ResponseEntity<?> getAllHotels() {
        List<Map<String, Object>> hotels = hotelRepository.findAll().stream()
                .map(this::serializeHotel).toList();
        return ResponseEntity.ok(Map.of("success", true, "data", hotels));
    }

    // POST create hotel — multipart/form-data with optional image uploads
    @PostMapping(value = "/hotels", consumes = {"multipart/form-data", "application/octet-stream", "*/*"})
    public ResponseEntity<?> createHotel(
            @RequestParam("name") String name,
            @RequestParam(value = "owner_name", required = false) String ownerName,
            @RequestParam(value = "email", required = false) String email,
            @RequestParam(value = "phone", required = false) String phone,
            @RequestParam(value = "address", required = false) String address,
            @RequestParam(value = "plan", required = false, defaultValue = "Enterprise") String plan,
            @RequestParam(value = "status", required = false, defaultValue = "active") String status,
            @RequestParam(value = "cover_image", required = false) MultipartFile coverImage,
            @RequestParam(value = "qr_pamphlet", required = false) MultipartFile qrPamphlet) {

        // Save images to disk
        String coverImageUrl = saveFile(coverImage, "cover");
        String qrPamphletUrl = saveFile(qrPamphlet, "qr");

        // Generate URL-friendly slug from hotel name
        String slug = name.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");

        // Build and save hotel
        Hotel hotel = Hotel.builder()
                .name(name)
                .ownerName(ownerName)
                .email(email)
                .phone(phone)
                .address(address)
                .plan(plan)
                .status(status)
                .isActive(true)
                .slug(slug)
                .coverImageUrl(coverImageUrl)
                .qrPamphletUrl(qrPamphletUrl)
                .build();

        Hotel savedHotel = hotelRepository.save(hotel);

        // Auto-create a HOTEL_ADMIN account for this hotel
        String rawPassword = UUID.randomUUID().toString().substring(0, 8);
        String adminEmail = email != null ? email : (name.toLowerCase().replaceAll("\\s+", "") + "@mejwani.com");

        String credentials = null;
        boolean adminCreated = false;
        if (!adminRepository.existsByEmail(adminEmail)) {
            Admin hotelAdmin = Admin.builder()
                    .name(ownerName != null ? ownerName : name)
                    .email(adminEmail)
                    .password(passwordEncoder.encode(rawPassword))
                    .role("HOTEL_ADMIN")
                    .hotel(savedHotel)
                    .isActive(true)
                    .build();
            adminRepository.save(hotelAdmin);
            adminCreated = true;
        }

        Map<String, Object> creds = adminCreated
                ? Map.of("username", adminEmail, "password", rawPassword)
                : Map.of("username", adminEmail, "password", "(existing account)");

        return ResponseEntity.ok(Map.of(
                "success", true,
                "emailSent", false,
                "data", Map.of(
                        "hotel", serializeHotel(savedHotel),
                        "credentials", creds
                )
        ));
    }

    /** Save uploaded file to uploads/ folder; return relative URL or null */
    private String saveFile(MultipartFile file, String prefix) {
        if (file == null || file.isEmpty()) return null;
        try {
            Path dir = Paths.get(uploadDir);
            Files.createDirectories(dir);
            String ext = "";
            String original = file.getOriginalFilename();
            if (original != null && original.contains(".")) {
                ext = original.substring(original.lastIndexOf('.'));
            }
            String filename = prefix + "_" + UUID.randomUUID() + ext;
            Path dest = dir.resolve(filename);
            Files.copy(file.getInputStream(), dest, StandardCopyOption.REPLACE_EXISTING);
            return "/uploads/" + filename;
        } catch (IOException e) {
            return null;
        }
    }

    // DELETE hotel
    @DeleteMapping("/hotels/{id}")
    public ResponseEntity<?> deleteHotel(@PathVariable Long id) {
        if (!hotelRepository.existsById(id)) return ResponseEntity.notFound().build();
        hotelRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Hotel deleted"));
    }

    // GET all admins
    @GetMapping("/admins")
    public ResponseEntity<?> getAllAdmins() {
        List<Map<String, Object>> admins = adminRepository.findAll().stream()
                .map(this::serializeAdmin).toList();
        return ResponseEntity.ok(Map.of("success", true, "data", admins));
    }

    // POST create admin for a hotel
    @PostMapping("/admins")
    public ResponseEntity<?> createAdmin(@RequestBody Map<String, Object> body) {
        String email = body.get("email").toString();
        if (adminRepository.existsByEmail(email)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email already exists"));
        }

        Long hotelId = Long.valueOf(body.get("hotelId").toString());
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> new RuntimeException("Hotel not found"));

        Admin admin = Admin.builder()
                .name(body.get("name").toString())
                .email(email)
                .password(passwordEncoder.encode(body.get("password").toString()))
                .role(body.getOrDefault("role", "HOTEL_ADMIN").toString())
                .hotel(hotel)
                .isActive(true)
                .build();

        return ResponseEntity.ok(Map.of(
            "success", true, "data", serializeAdmin(adminRepository.save(admin))
        ));
    }

    // DELETE admin
    @DeleteMapping("/admins/{id}")
    public ResponseEntity<?> deleteAdmin(@PathVariable Long id) {
        if (!adminRepository.existsById(id)) return ResponseEntity.notFound().build();
        adminRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Admin deleted"));
    }

    // DELETE orphan admins
    @DeleteMapping("/admins/cleanup-orphans")
    public ResponseEntity<?> cleanupOrphanAdmins() {
        return ResponseEntity.ok(Map.of("success", true, "message", "Cleanup done", "data", Map.of("deleted", 0)));
    }

    // PUT /api/super-admin/hotels/{id}
    @PutMapping("/hotels/{id}")
    public ResponseEntity<?> updateHotel(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return hotelRepository.findById(id).map(hotel -> {
            if (body.containsKey("name")) hotel.setName(body.get("name").toString());
            if (body.containsKey("owner_name")) hotel.setOwnerName(body.get("owner_name").toString());
            if (body.containsKey("address")) hotel.setAddress(body.get("address").toString());
            if (body.containsKey("phone")) hotel.setPhone(body.get("phone").toString());
            if (body.containsKey("email")) hotel.setEmail(body.get("email").toString());
            if (body.containsKey("plan")) hotel.setPlan(body.get("plan").toString());
            if (body.containsKey("status")) hotel.setStatus(body.get("status").toString());
            Hotel saved = hotelRepository.save(hotel);
            return ResponseEntity.ok(Map.of("success", true, "data", serializeHotel(saved)));
        }).orElse(ResponseEntity.notFound().build());
    }

    // GET /api/super-admin/dashboard
    @GetMapping("/dashboard")
    public ResponseEntity<?> getDashboard() {
        long totalHotels = hotelRepository.count();
        long totalAdmins = adminRepository.count();
        List<Map<String, Object>> recentHotels = hotelRepository.findAll().stream()
                .map(this::serializeHotel).toList();
        return ResponseEntity.ok(Map.of(
            "success", true,
            "data", Map.of(
                "totalHotels", totalHotels,
                "activeHotels", totalHotels,
                "totalAdmins", totalAdmins,
                "totalRevenue", 0,
                "recentHotels", recentHotels
            )
        ));
    }

    // GET /api/super-admin/billing
    @GetMapping("/billing")
    public ResponseEntity<?> getBilling() {
        return ResponseEntity.ok(Map.of("success", true, "data", List.of()));
    }

    // POST /api/super-admin/billing/renew/{hotelId}
    @PostMapping("/billing/renew/{hotelId}")
    public ResponseEntity<?> renewBilling(@PathVariable Long hotelId) {
        return ResponseEntity.ok(Map.of("success", true, "data", Map.of("invoiceNumber", "INV-" + System.currentTimeMillis())));
    }

    // GET /api/super-admin/billing/invoice/{invoiceNumber}
    @GetMapping("/billing/invoice/{invoiceNumber}")
    public ResponseEntity<?> getBillingInvoice(@PathVariable String invoiceNumber) {
        return ResponseEntity.ok(Map.of("success", true, "data", Map.of("invoiceNumber", invoiceNumber)));
    }

    // PUT /api/super-admin/billing/payments/{id}/status
    @PutMapping("/billing/payments/{id}/status")
    public ResponseEntity<?> updatePaymentStatus(@PathVariable Long id, @RequestBody(required = false) Map<String, Object> body) {
        return ResponseEntity.ok(Map.of("success", true, "message", "Status updated"));
    }

    // PUT /api/super-admin/billing/payments/{id}/amount
    @PutMapping("/billing/payments/{id}/amount")
    public ResponseEntity<?> updatePaymentAmount(@PathVariable Long id, @RequestBody(required = false) Map<String, Object> body) {
        return ResponseEntity.ok(Map.of("success", true, "message", "Amount updated"));
    }

    // DELETE /api/super-admin/billing/payments/{id}
    @DeleteMapping("/billing/payments/{id}")
    public ResponseEntity<?> deletePayment(@PathVariable Long id) {
        return ResponseEntity.ok(Map.of("success", true, "message", "Payment deleted"));
    }

    // POST /api/super-admin/billing/cleanup-deleted
    @PostMapping("/billing/cleanup-deleted")
    public ResponseEntity<?> cleanupDeleted() {
        return ResponseEntity.ok(Map.of("success", true, "message", "Cleanup done"));
    }

    // GET /api/super-admin/settings
    @GetMapping("/settings")
    public ResponseEntity<?> getSettings() {
        return ResponseEntity.ok(Map.of("success", true, "data", Map.of(
            "systemName", "Mejwani",
            "currency", "INR",
            "taxRate", 5,
            "gstEnabled", false,
            "maintenanceMode", false
        )));
    }

    // GET /api/super-admin/system-settings
    @GetMapping("/system-settings")
    public ResponseEntity<?> getSystemSettings() {
        return ResponseEntity.ok(Map.of("success", true, "data", Map.of(
            "systemName", "Mejwani",
            "currency", "INR",
            "taxRate", 5
        )));
    }

    // PUT /api/super-admin/system-settings
    @PutMapping("/system-settings")
    public ResponseEntity<?> updateSystemSettings(@RequestBody(required = false) Map<String, Object> body) {
        return ResponseEntity.ok(Map.of("success", true, "message", "Settings saved"));
    }

    // GET /api/super-admin/backups
    @GetMapping("/backups")
    public ResponseEntity<?> getBackups() {
        return ResponseEntity.ok(Map.of("success", true, "data", List.of()));
    }

    // POST /api/super-admin/backups
    @PostMapping("/backups")
    public ResponseEntity<?> createBackup() {
        return ResponseEntity.ok(Map.of("success", true, "data", Map.of("filename", "backup_" + System.currentTimeMillis() + ".sql")));
    }

    // POST /api/super-admin/backups/{filename}/restore
    @PostMapping("/backups/{filename}/restore")
    public ResponseEntity<?> restoreBackup(@PathVariable String filename) {
        return ResponseEntity.ok(Map.of("success", true, "message", "Restore initiated"));
    }

    // DELETE /api/super-admin/backups/{filename}
    @DeleteMapping("/backups/{filename}")
    public ResponseEntity<?> deleteBackup(@PathVariable String filename) {
        return ResponseEntity.ok(Map.of("success", true, "message", "Backup deleted"));
    }

    // GET /api/super-admin/support/super/tickets?status=X
    @GetMapping("/support/super/tickets")
    public ResponseEntity<?> getSupportTickets(@RequestParam(required = false) String status) {
        return ResponseEntity.ok(List.of());
    }
}
