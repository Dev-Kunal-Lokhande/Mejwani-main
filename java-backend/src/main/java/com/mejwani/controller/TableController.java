package com.mejwani.controller;

import com.mejwani.entity.*;
import com.mejwani.repository.*;
import com.mejwani.security.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/tables")
@RequiredArgsConstructor
public class TableController {

    private final RestaurantTableRepository tableRepository;
    private final HotelRepository hotelRepository;
    private final SectionRepository sectionRepository;
    private final JwtUtil jwtUtil;

    private Long resolveHotelId(Long requestHotelId, HttpServletRequest request) {
        if (requestHotelId != null) return requestHotelId;
        try {
            String authHeader = request != null ? request.getHeader("Authorization") : null;
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                Long hid = jwtUtil.getHotelIdFromToken(authHeader.substring(7));
                if (hid != null) return hid;
            }
        } catch (Exception ignored) {}
        return null;
    }

    private Map<String, Object> serializeTable(RestaurantTable table) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("id", table.getId());
        payload.put("table_number", table.getTableNumber());
        payload.put("table_name", table.getTableName());
        payload.put("status", table.getStatus());
        payload.put("qr_code", table.getQrCode());
        payload.put("hotel_id", table.getHotel() != null ? table.getHotel().getId() : null);
        payload.put("section_id", table.getSection() != null ? table.getSection().getId() : null);
        payload.put("section_name", table.getSection() != null ? table.getSection().getSectionName() : "");
        payload.put("seating_capacity", 4);
        return payload;
    }

    @GetMapping
    public ResponseEntity<?> getTables(@RequestParam(required = false) Long hotelId,
                                       @RequestParam(required = false) Long sectionId,
                                       HttpServletRequest request) {
        Long resolvedHotelId = resolveHotelId(hotelId, request);
        if (resolvedHotelId == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "hotelId is required"));
        }

        List<Map<String, Object>> data;
        if (sectionId != null) {
            data = tableRepository.findByHotelIdAndSectionId(resolvedHotelId, sectionId)
                    .stream().map(this::serializeTable).toList();
        } else {
            data = tableRepository.findByHotelId(resolvedHotelId)
                    .stream().map(this::serializeTable).toList();
        }

        return ResponseEntity.ok(Map.of("success", true, "data", data));
    }

    @PostMapping
    public ResponseEntity<?> createTable(@RequestBody Map<String, Object> body,
                                         HttpServletRequest request) {
        Long hotelId = body.containsKey("hotelId") ? Long.valueOf(body.get("hotelId").toString())
                : (body.containsKey("hotel_id") ? Long.valueOf(body.get("hotel_id").toString()) : resolveHotelId(null, request));
        String tableName = body.containsKey("table_name") ? body.get("table_name").toString()
                : (body.containsKey("tableName") ? body.get("tableName").toString() : "");
        String tableNumber = body.containsKey("table_number") ? body.get("table_number").toString()
                : (body.containsKey("tableNumber") ? body.get("tableNumber").toString() : tableName);
        String status = body.containsKey("status") ? body.get("status").toString() : "AVAILABLE";

        if (hotelId == null || tableName.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "hotelId and table name are required"));
        }

        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new RuntimeException("Hotel not found"));

        RestaurantTable table = RestaurantTable.builder()
                .tableName(tableName)
                .tableNumber(tableNumber)
                .hotel(hotel)
                .status(status.toUpperCase())
                .qrCode(UUID.randomUUID().toString())
                .build();

        Object sectionValue = body.get("section_id");
        if (sectionValue == null) sectionValue = body.get("sectionId");
        if (sectionValue != null) {
            Long sectionId = Long.valueOf(sectionValue.toString());
            sectionRepository.findById(sectionId).ifPresent(table::setSection);
        }

        RestaurantTable saved = tableRepository.save(table);
        return ResponseEntity.ok(Map.of("success", true, "message", "Table created successfully", "data", serializeTable(saved)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateTable(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return tableRepository.findById(id).map(table -> {
            if (body.containsKey("table_name") || body.containsKey("tableName")) {
                String tableName = body.containsKey("table_name") ? body.get("table_name").toString() : body.get("tableName").toString();
                table.setTableName(tableName);
            }
            if (body.containsKey("table_number") || body.containsKey("tableNumber")) {
                String tableNumber = body.containsKey("table_number") ? body.get("table_number").toString() : body.get("tableNumber").toString();
                table.setTableNumber(tableNumber);
            }
            if (body.containsKey("status")) {
                table.setStatus(body.get("status").toString().toUpperCase());
            }
            Object sectionValue = body.get("section_id");
            if (sectionValue == null) sectionValue = body.get("sectionId");
            if (sectionValue != null) {
                Long sectionId = Long.valueOf(sectionValue.toString());
                sectionRepository.findById(sectionId).ifPresent(table::setSection);
            }
            RestaurantTable saved = tableRepository.save(table);
            return ResponseEntity.ok(Map.of("success", true, "message", "Table updated successfully", "data", serializeTable(saved)));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteTable(@PathVariable Long id) {
        if (!tableRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        tableRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("success", true, "message", "Table deleted successfully"));
    }
}
