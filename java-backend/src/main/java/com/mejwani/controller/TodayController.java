package com.mejwani.controller;

import com.mejwani.entity.Bill;
import com.mejwani.repository.BillRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Provides /api/today/* endpoints used by frontend for clock sync and quick stats.
 */
@RestController
@RequestMapping("/api/today")
@RequiredArgsConstructor
public class TodayController {

    private final BillRepository billRepository;

    // Used by frontend apiBase.js for clock synchronization
    @GetMapping("/sales")
    public ResponseEntity<?> getTodaySales(
            @RequestParam(required = false) Long hotelId,
            @RequestParam(required = false, defaultValue = "100") int limit) {

        LocalDateTime startOfDay = LocalDateTime.now().toLocalDate().atStartOfDay();
        LocalDateTime endOfDay = startOfDay.plusDays(1);

        if (hotelId != null) {
            List<Bill> bills = billRepository.findByHotelIdAndCreatedAtBetween(hotelId, startOfDay, endOfDay);
            return ResponseEntity.ok(bills.stream().limit(limit).toList());
        }

        // Return empty list for clock sync purposes (no hotelId needed)
        return ResponseEntity.ok(List.of());
    }
}
