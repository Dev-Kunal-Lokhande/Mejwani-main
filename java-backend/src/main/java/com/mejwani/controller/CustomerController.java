package com.mejwani.controller;

import com.mejwani.entity.*;
import com.mejwani.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/customer")
@RequiredArgsConstructor
public class CustomerController {

    private final RestaurantTableRepository tableRepository;
    private final MenuItemRepository menuItemRepository;
    private final MenuCategoryRepository categoryRepository;
    private final HotelRepository hotelRepository;
    private final CaptainRequestRepository captainRequestRepository;

    // GET /api/customer/table/{qrCode}
    @Transactional(readOnly = true)
    @GetMapping("/table/{qrCode}")
    public ResponseEntity<?> getTableByQr(@PathVariable String qrCode) {
        return tableRepository.findByQrCode(qrCode)
                .map(table -> ResponseEntity.ok(Map.of(
                    "tableId", table.getId(),
                    "tableName", table.getTableName(),
                    "hotelId", table.getHotel().getId(),
                    "sectionName", table.getSection() != null ? table.getSection().getSectionName() : ""
                )))
                .orElse(ResponseEntity.notFound().build());
    }

    // GET /api/customer/menu?hotelId=X
    @Transactional(readOnly = true)
    @GetMapping("/menu")
    public ResponseEntity<?> getCustomerMenu(@RequestParam Long hotelId) {
        var categories = categoryRepository.findByHotelIdOrderByDisplayOrderAsc(hotelId)
                .stream().map(c -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id", c.getId());
                    m.put("name", c.getName());
                    m.put("name_hindi", c.getNameHindi());
                    m.put("display_order", c.getDisplayOrder());
                    return m;
                }).toList();

        var items = menuItemRepository.findByHotelIdAndIsAvailableTrue(hotelId)
                .stream().map(item -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id", item.getId());
                    m.put("name", item.getName());
                    m.put("name_hindi", item.getNameHindi());
                    m.put("price", item.getPrice());
                    m.put("image_url", item.getImageUrl());
                    m.put("is_available", item.getIsAvailable());
                    m.put("is_veg", item.getIsVeg());
                    m.put("display_order", item.getDisplayOrder());
                    m.put("category_id", item.getCategory() != null ? item.getCategory().getId() : null);
                    return m;
                }).toList();

        return ResponseEntity.ok(Map.of("categories", categories, "items", items));
    }

    // GET /api/customer/hotel/{hotelId}
    @GetMapping("/hotel/{hotelId}")
    public ResponseEntity<?> getHotelInfo(@PathVariable Long hotelId) {
        return hotelRepository.findById(hotelId)
                .map(h -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id", h.getId());
                    m.put("name", h.getName());
                    m.put("slug", h.getSlug());
                    m.put("logo_url", h.getLogoUrl());
                    m.put("cover_image_url", h.getCoverImageUrl());
                    m.put("address", h.getAddress());
                    m.put("phone", h.getPhone());
                    return ResponseEntity.ok(m);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // GET /api/customer/active-captain-requests?hotelId=X
    @Transactional(readOnly = true)
    @GetMapping("/active-captain-requests")
    public ResponseEntity<?> getActiveCaptainRequests(@RequestParam(required = false) Long hotelId) {
        if (hotelId == null) return ResponseEntity.ok(List.of());
        List<CaptainRequest> reqs = captainRequestRepository.findByHotelIdAndStatus(hotelId, "CAPTAIN_REQUESTED");
        List<Map<String, Object>> result = reqs.stream().map(r -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", r.getId());
            m.put("requestType", r.getRequestType());
            m.put("status", r.getStatus());
            m.put("visitId", r.getVisitId());
            m.put("tableId", r.getTable() != null ? r.getTable().getId() : null);
            m.put("tableName", r.getTable() != null ? r.getTable().getTableName() : "");
            m.put("createdAt", r.getCreatedAt());
            return m;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // POST /api/customer/reject-captain-request
    @PostMapping("/reject-captain-request")
    public ResponseEntity<?> rejectCaptainRequest(@RequestParam(required = false) Long hotelId,
                                                   @RequestBody(required = false) Map<String, Object> body) {
        Long requestId = body != null && body.containsKey("requestId")
                ? Long.valueOf(body.get("requestId").toString()) : null;
        if (requestId != null) {
            captainRequestRepository.findById(requestId).ifPresent(req -> {
                req.setStatus("REJECTED");
                captainRequestRepository.save(req);
            });
        }
        return ResponseEntity.ok(Map.of("success", true));
    }
}
