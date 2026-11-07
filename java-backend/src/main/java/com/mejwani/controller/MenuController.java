package com.mejwani.controller;

import com.mejwani.entity.*;
import com.mejwani.repository.*;
import com.mejwani.security.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.*;

@RestController
@RequestMapping("/api/menu")
@RequiredArgsConstructor
public class MenuController {

    private final MenuItemRepository menuItemRepository;
    private final MenuCategoryRepository categoryRepository;
    private final HotelRepository hotelRepository;
    private final JwtUtil jwtUtil;

    // Get hotel id from JWT token directly (avoids lazy entity loading)
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

    // Safe string from map
    private String str(Map<String, Object> body, String key) {
        Object v = body.get(key);
        return (v != null && !v.toString().isBlank()) ? v.toString().trim() : null;
    }

    // Serialize for frontend: use field names frontend expects
    private Map<String, Object> serializeMenuItem(MenuItem item) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", item.getId());
        m.put("name", item.getName());
        // Frontend uses marathiName
        m.put("marathiName", item.getNameMarathi());
        // Frontend uses hindiName (mapped to nameHindi in DB)
        m.put("hindiName", item.getNameHindi());
        m.put("code", item.getItemCode());
        m.put("price", item.getPrice());
        m.put("half_price", item.getHalfPrice());
        m.put("full_price", item.getFullPrice());
        m.put("pricing_type", item.getPricingType() != null ? item.getPricingType() : "SINGLE");
        m.put("image_url", item.getImageUrl());
        m.put("isAvailable", item.getIsAvailable());
        // type: VEG or NON_VEG from isVeg boolean
        m.put("type", Boolean.TRUE.equals(item.getIsVeg()) ? "VEG" : "NON_VEG");
        m.put("is_veg", item.getIsVeg());
        m.put("display_order", item.getDisplayOrder());
        m.put("hotel_id", item.getHotel() != null ? item.getHotel().getId() : null);
        // category: return name string (frontend uses item.category as string)
        m.put("category", item.getCategory() != null ? item.getCategory().getName() : null);
        m.put("category_id", item.getCategory() != null ? item.getCategory().getId() : null);
        m.put("category_name", item.getCategory() != null ? item.getCategory().getName() : null);
        m.put("created_at", item.getCreatedAt());
        return m;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> getMenu(@RequestParam(required = false) Long hotelId,
                                     @RequestParam(required = false) Long categoryId,
                                     HttpServletRequest request) {
        Long hid = resolveHotelId(hotelId, request);
        if (hid == null) return ResponseEntity.ok(Map.of("success", true, "data", List.of()));
        List<MenuItem> items = categoryId != null
                ? menuItemRepository.findByCategoryIdAndHotelId(categoryId, hid)
                : menuItemRepository.findByHotelIdOrderByDisplayOrderAsc(hid);
        var data = items.stream().map(this::serializeMenuItem).toList();
        return ResponseEntity.ok(Map.of("success", true, "data", data));
    }

    @GetMapping("/available")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getAvailableMenu(@RequestParam(required = false) Long hotelId,
                                              HttpServletRequest request) {
        Long hid = resolveHotelId(hotelId, request);
        if (hid == null) return ResponseEntity.ok(Map.of("success", true, "data", List.of()));
        var data = menuItemRepository.findByHotelIdAndIsAvailableTrue(hid)
                .stream().map(this::serializeMenuItem).toList();
        return ResponseEntity.ok(Map.of("success", true, "data", data));
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> createMenuItem(@RequestBody Map<String, Object> body,
                                            HttpServletRequest request) {
        try {
            // Get hotel id from JWT, not from body
            Long hotelId = resolveHotelId(
                body.containsKey("hotelId") && body.get("hotelId") != null
                    ? Long.valueOf(body.get("hotelId").toString()) : null,
                request
            );
            if (hotelId == null) {
                return ResponseEntity.status(400).body(Map.of("success", false, "message", "Hotel not found in token"));
            }

            Hotel hotel = hotelRepository.findById(hotelId)
                    .orElseThrow(() -> new RuntimeException("Hotel not found: " + hotelId));

            // Price: frontend sends price (for SINGLE) or half_price + full_price (for HALF_FULL)
            String pricingType = str(body, "pricing_type") != null ? str(body, "pricing_type") : "SINGLE";
            BigDecimal price = BigDecimal.ZERO;
            BigDecimal halfPrice = null;
            BigDecimal fullPrice = null;

            if ("HALF_FULL".equals(pricingType)) {
                halfPrice = body.get("half_price") != null ? new BigDecimal(body.get("half_price").toString()) : BigDecimal.ZERO;
                fullPrice = body.get("full_price") != null ? new BigDecimal(body.get("full_price").toString()) : BigDecimal.ZERO;
                price = fullPrice; // store full_price as main price
            } else {
                price = body.get("price") != null ? new BigDecimal(body.get("price").toString()) : BigDecimal.ZERO;
            }

            // type: "VEG" or "NON_VEG" -> isVeg boolean
            String type = str(body, "type");
            boolean isVeg = !"NON_VEG".equalsIgnoreCase(type); // default VEG

            MenuItem item = MenuItem.builder()
                    .name(str(body, "name") != null ? str(body, "name") : "Item")
                    .nameMarathi(str(body, "marathiName"))
                    .nameHindi(str(body, "hindiName"))
                    .itemCode(str(body, "code"))
                    .price(price)
                    .halfPrice(halfPrice)
                    .fullPrice(fullPrice)
                    .pricingType(pricingType)
                    .isAvailable(body.get("isAvailable") != null ? Boolean.valueOf(body.get("isAvailable").toString()) : true)
                    .isVeg(isVeg)
                    .displayOrder(body.containsKey("displayOrder") && body.get("displayOrder") != null
                            ? Integer.valueOf(body.get("displayOrder").toString()) : 0)
                    .imageUrl(str(body, "imageUrl"))
                    .hotel(hotel)
                    .build();

            // category: frontend sends category as a name string (e.g. "SOUP")
            // Try to find by name, or by categoryId
            if (body.containsKey("categoryId") && body.get("categoryId") != null) {
                Long catId = Long.valueOf(body.get("categoryId").toString());
                categoryRepository.findById(catId).ifPresent(item::setCategory);
            } else if (body.containsKey("category") && body.get("category") != null) {
                String catName = body.get("category").toString();
                categoryRepository.findByNameAndHotelId(catName, hotelId)
                        .ifPresent(item::setCategory);
                // If category not found by name, create it
                if (item.getCategory() == null && !catName.isBlank()) {
                    MenuCategory newCat = MenuCategory.builder()
                            .name(catName)
                            .hotel(hotel)
                            .displayOrder(0)
                            .build();
                    item.setCategory(categoryRepository.save(newCat));
                }
            }

            MenuItem saved = menuItemRepository.save(item);
            return ResponseEntity.ok(Map.of("success", true, "data", serializeMenuItem(saved),
                    "message", "Menu item created successfully"));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<?> updateMenuItem(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return menuItemRepository.findById(id).map(item -> {
            try {
                if (body.containsKey("name") && body.get("name") != null)
                    item.setName(body.get("name").toString().trim());
                if (body.containsKey("marathiName"))
                    item.setNameMarathi(str(body, "marathiName"));
                if (body.containsKey("hindiName"))
                    item.setNameHindi(str(body, "hindiName"));
                if (body.containsKey("code"))
                    item.setItemCode(str(body, "code"));
                if (body.containsKey("isAvailable") && body.get("isAvailable") != null)
                    item.setIsAvailable(Boolean.valueOf(body.get("isAvailable").toString()));
                if (body.containsKey("displayOrder") && body.get("displayOrder") != null)
                    item.setDisplayOrder(Integer.valueOf(body.get("displayOrder").toString()));
                if (body.containsKey("imageUrl"))
                    item.setImageUrl(str(body, "imageUrl"));

                // type -> isVeg
                if (body.containsKey("type") && body.get("type") != null) {
                    item.setIsVeg(!"NON_VEG".equalsIgnoreCase(body.get("type").toString()));
                }

                // pricing
                String pricingType = str(body, "pricing_type");
                if (pricingType != null) item.setPricingType(pricingType);

                if ("HALF_FULL".equals(pricingType != null ? pricingType : item.getPricingType())) {
                    if (body.get("half_price") != null)
                        item.setHalfPrice(new BigDecimal(body.get("half_price").toString()));
                    if (body.get("full_price") != null) {
                        item.setFullPrice(new BigDecimal(body.get("full_price").toString()));
                        item.setPrice(new BigDecimal(body.get("full_price").toString()));
                    }
                } else {
                    if (body.get("price") != null)
                        item.setPrice(new BigDecimal(body.get("price").toString()));
                }

                // category
                Long hotelId = item.getHotel() != null ? item.getHotel().getId() : null;
                if (body.containsKey("categoryId") && body.get("categoryId") != null) {
                    Long catId = Long.valueOf(body.get("categoryId").toString());
                    categoryRepository.findById(catId).ifPresent(item::setCategory);
                } else if (body.containsKey("category") && body.get("category") != null && hotelId != null) {
                    String catName = body.get("category").toString();
                    categoryRepository.findByNameAndHotelId(catName, hotelId)
                            .ifPresent(item::setCategory);
                }

                return ResponseEntity.ok(Map.of("success", true, "data", serializeMenuItem(menuItemRepository.save(item))));
            } catch (Exception e) {
                return ResponseEntity.status(500).body(Map.of("success", false, "message", e.getMessage()));
            }
        }).orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/toggle")
    @Transactional
    public ResponseEntity<?> toggleAvailability(@PathVariable Long id) {
        return menuItemRepository.findById(id).map(item -> {
            item.setIsAvailable(!Boolean.TRUE.equals(item.getIsAvailable()));
            return ResponseEntity.ok(Map.of("success", true, "data", serializeMenuItem(menuItemRepository.save(item))));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/toggle")
    @Transactional
    public ResponseEntity<?> toggleAvailabilityPost(@PathVariable Long id) {
        return toggleAvailability(id);
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> deleteMenuItem(@PathVariable Long id) {
        if (!menuItemRepository.existsById(id)) return ResponseEntity.notFound().build();
        menuItemRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("success", true, "message", "Menu item deleted"));
    }
}
