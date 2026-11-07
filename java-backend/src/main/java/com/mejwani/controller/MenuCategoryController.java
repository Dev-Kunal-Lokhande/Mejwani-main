package com.mejwani.controller;

import com.mejwani.entity.*;
import com.mejwani.repository.*;
import com.mejwani.security.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/menu-categories")
@RequiredArgsConstructor
public class MenuCategoryController {

    private final MenuCategoryRepository categoryRepository;
    private final HotelRepository hotelRepository;
    private final JwtUtil jwtUtil;

    private Long resolveHotelId(Long hotelId, HttpServletRequest request) {
        if (hotelId != null) return hotelId;
        try {
            String authHeader = request != null ? request.getHeader("Authorization") : null;
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                Long hid = jwtUtil.getHotelIdFromToken(authHeader.substring(7));
                if (hid != null) return hid;
            }
        } catch (Exception ignored) {}
        return null;
    }

    private Map<String, Object> serializeCategory(MenuCategory cat) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", cat.getId());
        m.put("name", cat.getName());
        m.put("name_hindi", cat.getNameHindi());
        m.put("display_order", cat.getDisplayOrder());
        m.put("is_active", true);
        m.put("hotel_id", cat.getHotel() != null ? cat.getHotel().getId() : null);
        return m;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> getCategories(@RequestParam(required = false) Long hotelId,
                                           HttpServletRequest request) {
        Long hid = resolveHotelId(hotelId, request);
        if (hid == null) return ResponseEntity.ok(Map.of("success", true, "data", List.of()));
        var data = categoryRepository.findByHotelIdOrderByDisplayOrderAsc(hid)
                .stream().map(this::serializeCategory).toList();
        return ResponseEntity.ok(Map.of("success", true, "data", data));
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> createCategory(@RequestBody Map<String, Object> body,
                                            HttpServletRequest request) {
        try {
            Long hotelId = resolveHotelId(
                body.containsKey("hotelId") && body.get("hotelId") != null
                    ? Long.valueOf(body.get("hotelId").toString()) : null,
                request
            );
            if (hotelId == null) {
                return ResponseEntity.status(400).body(Map.of("success", false, "message", "Hotel ID required"));
            }
            Hotel hotel = hotelRepository.findById(hotelId)
                    .orElseThrow(() -> new RuntimeException("Hotel not found"));

            String name = body.containsKey("name") && body.get("name") != null ? body.get("name").toString() : null;
            if (name == null || name.isBlank()) {
                return ResponseEntity.status(400).body(Map.of("success", false, "message", "Category name is required"));
            }

            MenuCategory cat = MenuCategory.builder()
                    .name(name.trim())
                    .nameHindi(body.containsKey("nameHindi") && body.get("nameHindi") != null ? body.get("nameHindi").toString() : null)
                    .displayOrder(body.containsKey("displayOrder") && body.get("displayOrder") != null
                            ? Integer.valueOf(body.get("displayOrder").toString()) : 0)
                    .hotel(hotel)
                    .build();

            MenuCategory saved = categoryRepository.save(cat);
            return ResponseEntity.ok(Map.of("success", true, "data", serializeCategory(saved), "message", "Category created"));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<?> updateCategory(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return categoryRepository.findById(id).map(cat -> {
            if (body.containsKey("name") && body.get("name") != null) cat.setName(body.get("name").toString());
            if (body.containsKey("nameHindi")) cat.setNameHindi(body.get("nameHindi") != null ? body.get("nameHindi").toString() : null);
            if (body.containsKey("displayOrder") && body.get("displayOrder") != null) cat.setDisplayOrder(Integer.valueOf(body.get("displayOrder").toString()));
            return ResponseEntity.ok(Map.of("success", true, "data", serializeCategory(categoryRepository.save(cat))));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> deleteCategory(@PathVariable Long id) {
        if (!categoryRepository.existsById(id)) return ResponseEntity.notFound().build();
        categoryRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("success", true, "message", "Category deleted"));
    }
}
