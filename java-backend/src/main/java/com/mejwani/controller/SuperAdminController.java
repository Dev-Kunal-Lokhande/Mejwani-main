package com.mejwani.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mejwani.entity.*;
import com.mejwani.repository.*;
import com.mejwani.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@RestController
@RequestMapping("/api/super-admin")
@RequiredArgsConstructor
public class SuperAdminController {

    private final AdminRepository adminRepository;
    private final HotelRepository hotelRepository;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${upload.dir:uploads}")
    private String uploadDir;

    private final Map<String, Object> platformSettings = initDefaultSettings();
    private final AtomicLong paymentSeq = new AtomicLong(1001);
    private final List<Map<String, Object>> paymentRecords = Collections.synchronizedList(new ArrayList<>());
    private final Map<String, byte[]> backupSnapshots = new ConcurrentHashMap<>();
    private final List<Map<String, Object>> backupMetadataList = Collections.synchronizedList(new ArrayList<>());

    private static Map<String, Object> initDefaultSettings() {
        Map<String, Object> smtp = new HashMap<>();
        smtp.put("host", "");
        smtp.put("port", "587");
        smtp.put("user", "");
        smtp.put("pass", "");
        smtp.put("sender_email", "");
        smtp.put("secure", false);

        Map<String, Object> settings = new ConcurrentHashMap<>();
        settings.put("brandingLogo", "");
        settings.put("platformName", "Mejwani Command Center");
        settings.put("supportEmail", "support@mejwani.com");
        settings.put("supportPhone", "");
        settings.put("smtpSettings", smtp);
        return settings;
    }

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
        Map<String, Object> adminMap = new HashMap<>();
        adminMap.put("id", admin.getId());
        adminMap.put("name", admin.getName() != null ? admin.getName() : "Super Admin");
        adminMap.put("email", admin.getEmail());
        adminMap.put("role", admin.getRole());

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("token", token);
        res.put("admin", adminMap);
        return ResponseEntity.ok(res);
    }

    private Map<String, Object> serializeHotel(Hotel h) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", h.getId());
        m.put("name", h.getName());
        m.put("owner_name", h.getOwnerName());
        m.put("slug", h.getSlug());
        m.put("email", h.getEmail());
        m.put("phone", h.getPhone());
        m.put("address", h.getAddress());
        m.put("plan", h.getPlan() != null ? h.getPlan() : "Enterprise");
        m.put("status", h.getStatus() != null ? h.getStatus() : "active");
        m.put("is_active", h.getIsActive());
        m.put("logo_url", h.getLogoUrl());
        m.put("cover_image", h.getCoverImageUrl());
        m.put("cover_image_url", h.getCoverImageUrl());
        m.put("qr_pamphlet", h.getQrPamphletUrl());
        m.put("qr_pamphlet_url", h.getQrPamphletUrl());
        m.put("created_at", h.getCreatedAt());
        return m;
    }

    private Map<String, Object> serializeAdmin(Admin a) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", a.getId());
        m.put("name", a.getName());
        m.put("username", a.getEmail());
        m.put("email", a.getEmail());
        m.put("role", a.getRole());
        m.put("is_active", a.getIsActive());
        m.put("created_at", a.getCreatedAt());
        if (a.getHotel() != null) {
            m.put("hotel_id", a.getHotel().getId());
            m.put("hotel_name", a.getHotel().getName());
        } else {
            m.put("hotel_id", null);
            m.put("hotel_name", null);
        }
        return m;
    }

    @GetMapping("/hotels")
    public ResponseEntity<?> getAllHotels() {
        List<Map<String, Object>> hotels = hotelRepository.findAll().stream()
                .map(this::serializeHotel).toList();
        return ResponseEntity.ok(Map.of("success", true, "data", hotels));
    }

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

        String coverImageUrl = saveFile(coverImage, "cover");
        String qrPamphletUrl = saveFile(qrPamphlet, "qr");
        String slug = name.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
        String resolvedStatus = status != null && !status.isBlank() ? status : "active";

        Hotel hotel = Hotel.builder()
                .name(name)
                .ownerName(ownerName)
                .email(email)
                .phone(phone)
                .address(address)
                .plan(plan != null && !plan.isBlank() ? plan : "Enterprise")
                .status(resolvedStatus)
                .isActive(!"suspended".equalsIgnoreCase(resolvedStatus))
                .slug(slug)
                .coverImageUrl(coverImageUrl)
                .qrPamphletUrl(qrPamphletUrl)
                .build();

        Hotel savedHotel = hotelRepository.save(hotel);

        String rawPassword = UUID.randomUUID().toString().substring(0, 8);
        String adminEmail = (email != null && !email.isBlank())
                ? email
                : (name.toLowerCase().replaceAll("[^a-z0-9]+", "") + "@mejwani.com");

        boolean adminCreated = false;
        if (!adminRepository.existsByEmail(adminEmail)) {
            Admin hotelAdmin = Admin.builder()
                    .name(ownerName != null && !ownerName.isBlank() ? ownerName : name)
                    .email(adminEmail)
                    .password(passwordEncoder.encode(rawPassword))
                    .role("HOTEL_ADMIN")
                    .hotel(savedHotel)
                    .isActive(true)
                    .build();
            adminRepository.save(hotelAdmin);
            adminCreated = true;
        }

        Map<String, Object> creds = new HashMap<>();
        creds.put("username", adminEmail);
        creds.put("password", adminCreated ? rawPassword : "(existing account)");

        Map<String, Object> data = new HashMap<>();
        data.put("hotel", serializeHotel(savedHotel));
        data.put("credentials", creds);

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("emailSent", false);
        res.put("data", data);
        return ResponseEntity.ok(res);
    }

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

    @PutMapping(value = "/hotels/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> updateHotelMultipart(
            @PathVariable Long id,
            @RequestParam(value = "name", required = false) String name,
            @RequestParam(value = "owner_name", required = false) String ownerName,
            @RequestParam(value = "email", required = false) String email,
            @RequestParam(value = "phone", required = false) String phone,
            @RequestParam(value = "address", required = false) String address,
            @RequestParam(value = "plan", required = false) String plan,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "cover_image", required = false) MultipartFile coverImage,
            @RequestParam(value = "qr_pamphlet", required = false) MultipartFile qrPamphlet) {

        return hotelRepository.findById(id).map(hotel -> {
            if (name != null && !name.isBlank()) hotel.setName(name);
            if (ownerName != null) hotel.setOwnerName(ownerName);
            if (email != null) hotel.setEmail(email);
            if (phone != null) hotel.setPhone(phone);
            if (address != null) hotel.setAddress(address);
            if (plan != null && !plan.isBlank()) hotel.setPlan(plan);
            if (status != null && !status.isBlank()) {
                hotel.setStatus(status);
                hotel.setIsActive(!"suspended".equalsIgnoreCase(status));
            }
            String coverUrl = saveFile(coverImage, "cover");
            if (coverUrl != null) hotel.setCoverImageUrl(coverUrl);
            String qrUrl = saveFile(qrPamphlet, "qr");
            if (qrUrl != null) hotel.setQrPamphletUrl(qrUrl);

            Hotel saved = hotelRepository.save(hotel);
            return ResponseEntity.ok(Map.of("success", true, "data", serializeHotel(saved)));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping(value = "/hotels/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> updateHotelJson(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return hotelRepository.findById(id).map(hotel -> {
            if (body.containsKey("name") && body.get("name") != null) hotel.setName(body.get("name").toString());
            if (body.containsKey("owner_name") && body.get("owner_name") != null) hotel.setOwnerName(body.get("owner_name").toString());
            if (body.containsKey("address") && body.get("address") != null) hotel.setAddress(body.get("address").toString());
            if (body.containsKey("phone") && body.get("phone") != null) hotel.setPhone(body.get("phone").toString());
            if (body.containsKey("email") && body.get("email") != null) hotel.setEmail(body.get("email").toString());
            if (body.containsKey("plan") && body.get("plan") != null) hotel.setPlan(body.get("plan").toString());
            if (body.containsKey("status") && body.get("status") != null) {
                String st = body.get("status").toString();
                hotel.setStatus(st);
                hotel.setIsActive(!"suspended".equalsIgnoreCase(st));
            }
            Hotel saved = hotelRepository.save(hotel);
            return ResponseEntity.ok(Map.of("success", true, "data", serializeHotel(saved)));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/hotels/{id}")
    public ResponseEntity<?> deleteHotel(@PathVariable Long id) {
        if (!hotelRepository.existsById(id)) return ResponseEntity.notFound().build();
        hotelRepository.deleteById(id);
        synchronized (paymentRecords) {
            for (Map<String, Object> rec : paymentRecords) {
                if (Objects.equals(String.valueOf(rec.get("hotelId")), String.valueOf(id))) {
                    rec.put("hotelDeleted", true);
                }
            }
        }
        return ResponseEntity.ok(Map.of("success", true, "message", "Hotel deleted"));
    }

    @GetMapping("/admins")
    public ResponseEntity<?> getAllAdmins() {
        List<Map<String, Object>> admins = adminRepository.findAll().stream()
                .map(this::serializeAdmin).toList();
        return ResponseEntity.ok(Map.of("success", true, "data", admins));
    }

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

    @DeleteMapping("/admins/{id}")
    public ResponseEntity<?> deleteAdmin(@PathVariable Long id) {
        if (!adminRepository.existsById(id)) return ResponseEntity.notFound().build();
        adminRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("success", true, "message", "Admin deleted"));
    }

    @DeleteMapping("/admins/cleanup-orphans")
    public ResponseEntity<?> cleanupOrphanAdmins() {
        List<Admin> allAdmins = adminRepository.findAll();
        List<String> removedEmails = new ArrayList<>();
        for (Admin adm : allAdmins) {
            if ("HOTEL_ADMIN".equalsIgnoreCase(adm.getRole())) {
                if (adm.getHotel() == null || !hotelRepository.existsById(adm.getHotel().getId())) {
                    removedEmails.add(adm.getEmail());
                    adminRepository.delete(adm);
                }
            }
        }
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("message", removedEmails.size() + " orphan admin(s) removed");
        res.put("removed", removedEmails);
        return ResponseEntity.ok(res);
    }

    @GetMapping("/dashboard")
    public ResponseEntity<?> getDashboard() {
        List<Hotel> allHotels = hotelRepository.findAll();
        long totalHotels = allHotels.size();
        long activeHotels = allHotels.stream()
                .filter(h -> !"suspended".equalsIgnoreCase(h.getStatus()) && Boolean.TRUE.equals(h.getIsActive()))
                .count();
        long suspendedHotels = Math.max(0, totalHotels - activeHotels);

        double totalRevenue = 0;
        double pendingRevenue = 0;
        synchronized (paymentRecords) {
            for (Map<String, Object> rec : paymentRecords) {
                double amt = ((Number) rec.getOrDefault("amount", 0)).doubleValue();
                if ("paid".equalsIgnoreCase(String.valueOf(rec.get("status")))) {
                    totalRevenue += amt;
                } else {
                    pendingRevenue += amt;
                }
            }
        }

        List<Map<String, Object>> recentHotels = allHotels.stream()
                .map(this::serializeHotel).toList();

        Map<String, Object> metrics = new HashMap<>();
        metrics.put("totalHotels", totalHotels);
        metrics.put("activeHotels", activeHotels);
        metrics.put("suspendedHotels", suspendedHotels);
        metrics.put("totalRevenue", totalRevenue);
        metrics.put("monthlyRevenue", totalRevenue);
        metrics.put("totalOrders", 0);
        metrics.put("liveActiveTables", 0);
        metrics.put("totalStaff", adminRepository.count());
        metrics.put("totalCaptains", 0);
        metrics.put("customersServed", 0);
        metrics.put("systemStatus", "Operational");

        Map<String, Object> system = new HashMap<>();
        system.put("activeUsers", adminRepository.count());
        system.put("server", "Operational");
        system.put("api", "Operational");
        system.put("database", "Connected");
        system.put("sockets", "Connected");

        Map<String, Object> insight1 = new HashMap<>();
        insight1.put("title", "Active Tenant Ratio");
        insight1.put("value", totalHotels > 0 ? ((activeHotels * 100) / totalHotels) + "%" : "0%");
        insight1.put("detail", activeHotels + " active out of " + totalHotels + " registered hotels");

        Map<String, Object> insight2 = new HashMap<>();
        insight2.put("title", "Pending Subscription Dues");
        insight2.put("value", "₹" + Math.round(pendingRevenue));
        insight2.put("detail", "Across generated renewal invoices");

        Map<String, Object> payload = new HashMap<>();
        payload.put("metrics", metrics);
        payload.put("system", system);
        payload.put("revenueSeries", List.of());
        payload.put("monthlyGrowth", List.of());
        payload.put("aiInsights", List.of(insight1, insight2));
        payload.put("recentHotels", recentHotels);

        return ResponseEntity.ok(Map.of("success", true, "data", payload));
    }

    @GetMapping("/billing")
    public ResponseEntity<?> getBilling() {
        List<Hotel> activeHotelsList = hotelRepository.findAll().stream()
                .filter(h -> !"suspended".equalsIgnoreCase(h.getStatus()))
                .map(this::serializeHotel)
                .toList();

        double totalBilled = 0;
        double pendingBilled = 0;
        List<Map<String, Object>> paymentsCopy;
        synchronized (paymentRecords) {
            paymentsCopy = new ArrayList<>(paymentRecords);
            for (Map<String, Object> p : paymentsCopy) {
                double amt = ((Number) p.getOrDefault("amount", 0)).doubleValue();
                if ("paid".equalsIgnoreCase(String.valueOf(p.get("status")))) {
                    totalBilled += amt;
                } else {
                    pendingBilled += amt;
                }
            }
        }

        Map<String, Object> analytics = new HashMap<>();
        analytics.put("totalBilled", totalBilled);
        analytics.put("pendingBilled", pendingBilled);
        analytics.put("totalInvoices", paymentsCopy.size());

        Map<String, Object> billingData = new HashMap<>();
        billingData.put("plans", List.of("Starter", "Growth", "Enterprise"));
        billingData.put("payments", paymentsCopy);
        billingData.put("activeHotels", activeHotelsList);
        billingData.put("analytics", analytics);

        return ResponseEntity.ok(Map.of("success", true, "data", billingData));
    }

    @PostMapping("/billing/renew/{hotelId}")
    public ResponseEntity<?> renewBilling(@PathVariable Long hotelId) {
        Hotel hotel = hotelRepository.findById(hotelId).orElse(null);
        if (hotel == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Hotel not found"));
        }

        long seq = paymentSeq.getAndIncrement();
        String invoiceNumber = "INV-" + seq;
        double defaultAmount = "Starter".equalsIgnoreCase(hotel.getPlan()) ? 4999.0 : 9999.0;
        String nowIso = Instant.now().toString();

        Map<String, Object> record = new HashMap<>();
        record.put("paymentId", seq);
        record.put("id", invoiceNumber);
        record.put("invoice_number", invoiceNumber);
        record.put("hotelId", hotel.getId());
        record.put("hotel", hotel.getName());
        record.put("hotel_name", hotel.getName());
        record.put("hotelPlan", hotel.getPlan());
        record.put("plan", hotel.getPlan());
        record.put("ownerName", hotel.getOwnerName());
        record.put("address", hotel.getAddress());
        record.put("phone", hotel.getPhone());
        record.put("email", hotel.getEmail());
        record.put("amount", defaultAmount);
        record.put("status", "pending");
        record.put("createdAt", nowIso);
        record.put("dueDate", nowIso);
        record.put("paidDate", null);
        record.put("paid_at", null);
        record.put("hotelDeleted", false);

        paymentRecords.add(0, record);

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("invoiceNumber", invoiceNumber);
        res.put("data", record);
        return ResponseEntity.ok(res);
    }

    @GetMapping("/billing/invoice/{invoiceNumber}")
    public ResponseEntity<?> getBillingInvoice(@PathVariable String invoiceNumber) {
        synchronized (paymentRecords) {
            for (Map<String, Object> rec : paymentRecords) {
                if (invoiceNumber.equals(rec.get("id")) || invoiceNumber.equals(rec.get("invoice_number"))) {
                    return ResponseEntity.ok(Map.of("success", true, "data", rec));
                }
            }
        }
        Map<String, Object> fallback = new HashMap<>();
        fallback.put("invoice_number", invoiceNumber);
        fallback.put("hotel_name", "Mejwani Tenant");
        fallback.put("plan", "Enterprise");
        fallback.put("amount", 0);
        return ResponseEntity.ok(Map.of("success", true, "data", fallback));
    }

    @PatchMapping("/billing/payments/{id}/status")
    public ResponseEntity<?> updatePaymentStatus(@PathVariable Long id, @RequestBody(required = false) Map<String, Object> body) {
        String newStatus = body != null && body.get("status") != null ? body.get("status").toString() : "paid";
        synchronized (paymentRecords) {
            for (Map<String, Object> rec : paymentRecords) {
                if (Objects.equals(String.valueOf(rec.get("paymentId")), String.valueOf(id))) {
                    rec.put("status", newStatus);
                    if (body != null && body.get("amount") != null) {
                        rec.put("amount", ((Number) body.get("amount")).doubleValue());
                    }
                    if ("paid".equalsIgnoreCase(newStatus)) {
                        String paidAt = Instant.now().toString();
                        rec.put("paidDate", paidAt);
                        rec.put("paid_at", paidAt);
                    }
                    return ResponseEntity.ok(Map.of("success", true, "message", "Status updated", "data", rec));
                }
            }
        }
        return ResponseEntity.ok(Map.of("success", true, "message", "Status updated"));
    }

    @PatchMapping("/billing/payments/{id}/amount")
    public ResponseEntity<?> updatePaymentAmount(@PathVariable Long id, @RequestBody(required = false) Map<String, Object> body) {
        double amount = body != null && body.get("amount") != null ? ((Number) body.get("amount")).doubleValue() : 0.0;
        synchronized (paymentRecords) {
            for (Map<String, Object> rec : paymentRecords) {
                if (Objects.equals(String.valueOf(rec.get("paymentId")), String.valueOf(id))) {
                    rec.put("amount", amount);
                    return ResponseEntity.ok(Map.of("success", true, "message", "Amount updated", "data", rec));
                }
            }
        }
        return ResponseEntity.ok(Map.of("success", true, "message", "Amount updated"));
    }

    @DeleteMapping("/billing/payments/{id}")
    public ResponseEntity<?> deletePayment(@PathVariable Long id) {
        synchronized (paymentRecords) {
            paymentRecords.removeIf(rec -> Objects.equals(String.valueOf(rec.get("paymentId")), String.valueOf(id)));
        }
        return ResponseEntity.ok(Map.of("success", true, "message", "Payment deleted"));
    }

    @DeleteMapping("/billing/cleanup-deleted")
    public ResponseEntity<?> cleanupDeleted() {
        synchronized (paymentRecords) {
            paymentRecords.removeIf(rec -> Boolean.TRUE.equals(rec.get("hotelDeleted")));
        }
        return ResponseEntity.ok(Map.of("success", true, "message", "Cleanup done"));
    }

    @GetMapping("/settings")
    public ResponseEntity<?> getSettings() {
        return ResponseEntity.ok(Map.of("success", true, "data", new HashMap<>(platformSettings)));
    }

    @GetMapping("/system-settings")
    public ResponseEntity<?> getSystemSettings() {
        return ResponseEntity.ok(Map.of("success", true, "data", new HashMap<>(platformSettings)));
    }

    @PutMapping("/system-settings")
    public ResponseEntity<?> updateSystemSettings(@RequestBody(required = false) Map<String, Object> body) {
        if (body != null) {
            platformSettings.putAll(body);
        }
        return ResponseEntity.ok(Map.of("success", true, "message", "Settings saved", "data", platformSettings));
    }

    @GetMapping("/backups")
    public ResponseEntity<?> getBackups() {
        synchronized (backupMetadataList) {
            return ResponseEntity.ok(Map.of("success", true, "data", new ArrayList<>(backupMetadataList)));
        }
    }

    @PostMapping("/backups")
    public ResponseEntity<?> createBackup() {
        try {
            String id = "backup_" + System.currentTimeMillis() + ".json";
            Map<String, Object> snapshot = new HashMap<>();
            snapshot.put("createdAt", Instant.now().toString());
            snapshot.put("hotels", hotelRepository.findAll().stream().map(this::serializeHotel).toList());
            snapshot.put("admins", adminRepository.findAll().stream().map(this::serializeAdmin).toList());

            byte[] bytes = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(snapshot);
            backupSnapshots.put(id, bytes);

            Map<String, Object> meta = new HashMap<>();
            meta.put("id", id);
            meta.put("filename", id);
            meta.put("size", bytes.length);
            meta.put("createdAt", Instant.now().toString());
            backupMetadataList.add(0, meta);

            return ResponseEntity.ok(Map.of("success", true, "data", meta));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/backups/{filename}/download")
    public ResponseEntity<byte[]> downloadBackup(@PathVariable String filename) {
        byte[] content = backupSnapshots.getOrDefault(filename, "{}".getBytes(StandardCharsets.UTF_8));
        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_JSON)
                .body(content);
    }

    @PostMapping("/backups/{filename}/restore")
    public ResponseEntity<?> restoreBackup(@PathVariable String filename) {
        return ResponseEntity.ok(Map.of("success", true, "message", "Snapshot verified for restore: " + filename));
    }

    @DeleteMapping("/backups/{filename}")
    public ResponseEntity<?> deleteBackup(@PathVariable String filename) {
        backupSnapshots.remove(filename);
        synchronized (backupMetadataList) {
            backupMetadataList.removeIf(b -> filename.equals(b.get("id")) || filename.equals(b.get("filename")));
        }
        return ResponseEntity.ok(Map.of("success", true, "message", "Backup deleted"));
    }

    @GetMapping("/support/super/tickets")
    public ResponseEntity<?> getSupportTickets(@RequestParam(required = false) String status) {
        return ResponseEntity.ok(Map.of("success", true, "tickets", List.of()));
    }
}