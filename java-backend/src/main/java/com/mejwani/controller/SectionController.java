package com.mejwani.controller;

import com.mejwani.entity.Section;
import com.mejwani.entity.Hotel;
import com.mejwani.repository.SectionRepository;
import com.mejwani.repository.HotelRepository;
import com.mejwani.security.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sections")
@RequiredArgsConstructor
public class SectionController {

    private final SectionRepository sectionRepository;
    private final HotelRepository hotelRepository;
    private final JwtUtil jwtUtil;

    /** Get hotel id from JWT token directly (avoids lazy entity loading) */
    private Long resolveHotelId(Long requestHotelId, HttpServletRequest request) {
        if (requestHotelId != null) return requestHotelId;
        try {
            String authHeader = request.getHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                Long hid = jwtUtil.getHotelIdFromToken(authHeader.substring(7));
                if (hid != null) return hid;
            }
        } catch (Exception ignored) {}
        return null;
    }

    private Map<String, Object> serializeSection(Section section) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("id", section.getId());
        payload.put("section_name", section.getSectionName());
        payload.put("display_order", section.getId() != null ? section.getId().intValue() : 1);
        payload.put("hotel_id", section.getHotel() != null ? section.getHotel().getId() : null);
        return payload;
    }

    @GetMapping
    public ResponseEntity<?> getSections(@RequestParam(required = false) Long hotelId,
                                         HttpServletRequest request) {
        Long resolvedHotelId = resolveHotelId(hotelId, request);
        if (resolvedHotelId == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "hotelId is required"));
        }

        List<Map<String, Object>> data = sectionRepository.findByHotelIdOrderByIdAsc(resolvedHotelId)
                .stream()
                .map(this::serializeSection)
                .toList();

        return ResponseEntity.ok(Map.of("success", true, "data", data));
    }

    @PostMapping
    public ResponseEntity<?> createSection(@RequestBody Map<String, Object> body,
                                           HttpServletRequest request) {
        Long hotelId = null;
        if (body.containsKey("hotelId") && body.get("hotelId") != null) {
            hotelId = Long.valueOf(body.get("hotelId").toString());
        } else if (body.containsKey("hotel_id") && body.get("hotel_id") != null) {
            hotelId = Long.valueOf(body.get("hotel_id").toString());
        } else {
            hotelId = resolveHotelId(null, request);
        }

        String sectionName = body.containsKey("section_name") ? body.get("section_name").toString()
                : (body.containsKey("sectionName") ? body.get("sectionName").toString() : "");

        if (hotelId == null || sectionName.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "hotelId and section name are required"));
        }

        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new RuntimeException("Hotel not found"));

        Section section = Section.builder()
                .sectionName(sectionName)
                .hotel(hotel)
                .build();

        Section saved = sectionRepository.save(section);
        return ResponseEntity.ok(Map.of("success", true, "message", "Section created successfully", "data", serializeSection(saved)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateSection(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return sectionRepository.findById(id).map(section -> {
            if (body.containsKey("section_name") || body.containsKey("sectionName")) {
                String sectionName = body.containsKey("section_name") ? body.get("section_name").toString() : body.get("sectionName").toString();
                section.setSectionName(sectionName);
            }
            Section saved = sectionRepository.save(section);
            return ResponseEntity.ok(Map.of("success", true, "message", "Section updated successfully", "data", serializeSection(saved)));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteSection(@PathVariable Long id) {
        if (!sectionRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        sectionRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("success", true, "message", "Section deleted successfully"));
    }
}
