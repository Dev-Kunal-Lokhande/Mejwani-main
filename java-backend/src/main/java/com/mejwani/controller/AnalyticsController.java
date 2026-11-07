package com.mejwani.controller;

import com.mejwani.entity.*;
import com.mejwani.repository.*;
import com.mejwani.security.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Handles all /api/dashboard/* endpoints used by the Admin Overview page.
 */
@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class AnalyticsController {

    private final OrderRepository orderRepository;
    private final BillRepository billRepository;
    private final StaffRepository staffRepository;
    private final MenuItemRepository menuItemRepository;
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

    // GET /api/dashboard/analytics
    @GetMapping("/analytics")
    public ResponseEntity<?> getAnalytics(@RequestParam(required = false) Long hotelId,
                                          HttpServletRequest request) {
        Long hid = resolveHotelId(hotelId, request);
        if (hid == null) return ResponseEntity.ok(emptyAnalytics());

        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay = startOfDay.plusDays(1);

        List<Bill> todayBills = billRepository.findByHotelIdAndCreatedAtBetween(hid, startOfDay, endOfDay);
        BigDecimal todayRevenue = todayBills.stream()
                .map(Bill::getTotalAmount).filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<Order> activeOrders = orderRepository.findActiveOrders(hid);

        return ResponseEntity.ok(Map.of(
            "success", true,
            "data", Map.of(
                "todayRevenue", todayRevenue,
                "todayOrders", todayBills.size(),
                "activeOrders", activeOrders.size(),
                "totalStaff", staffRepository.findByHotelIdAndIsActiveTrue(hid).size()
            )
        ));
    }

    // GET /api/dashboard/revenue?timeframe=today
    @GetMapping("/revenue")
    public ResponseEntity<?> getRevenue(@RequestParam(required = false) Long hotelId,
                                         @RequestParam(defaultValue = "today") String timeframe,
                                         HttpServletRequest request) {
        Long hid = resolveHotelId(hotelId, request);
        if (hid == null) return ResponseEntity.ok(Map.of("success", true, "data", List.of()));

        LocalDateTime start = LocalDate.now().atStartOfDay();
        LocalDateTime end = start.plusDays(1);

        if ("week".equals(timeframe)) start = start.minusDays(6);
        else if ("month".equals(timeframe)) start = start.minusDays(29);

        List<Bill> bills = billRepository.findByHotelIdAndCreatedAtBetween(hid, start, end);

        // Group by date for chart
        Map<String, BigDecimal> grouped = new LinkedHashMap<>();
        for (Bill b : bills) {
            String day = b.getCreatedAt().toLocalDate().toString();
            grouped.merge(day, b.getTotalAmount() != null ? b.getTotalAmount() : BigDecimal.ZERO, BigDecimal::add);
        }

        List<Map<String, Object>> result = grouped.entrySet().stream()
                .map(e -> Map.<String, Object>of("date", e.getKey(), "revenue", e.getValue(),
                        "hotelRevenue", e.getValue(), "parcelRevenue", BigDecimal.ZERO))
                .collect(Collectors.toList());

        return ResponseEntity.ok(Map.of("success", true, "data", result));
    }

    // GET /api/dashboard/top-items
    @GetMapping("/top-items")
    public ResponseEntity<?> getTopItems(@RequestParam(required = false) Long hotelId,
                                          @RequestParam(defaultValue = "today") String timeframe) {
        return ResponseEntity.ok(Map.of("success", true, "data", List.of()));
    }

    // GET /api/dashboard/peak-hours
    @GetMapping("/peak-hours")
    public ResponseEntity<?> getPeakHours(@RequestParam(required = false) Long hotelId,
                                           @RequestParam(defaultValue = "today") String timeframe) {
        return ResponseEntity.ok(Map.of("success", true, "data", List.of()));
    }

    // GET /api/dashboard/item-sales-report
    @GetMapping("/item-sales-report")
    public ResponseEntity<?> getItemSalesReport(@RequestParam(required = false) Long hotelId,
                                                 @RequestParam(required = false) String startDate,
                                                 @RequestParam(required = false) String endDate) {
        return ResponseEntity.ok(Map.of("success", true, "data", List.of()));
    }

    // GET /api/dashboard/reports/{type}
    @GetMapping("/reports/{type}")
    public ResponseEntity<?> getReport(@PathVariable String type,
                                        @RequestParam(required = false) Long hotelId,
                                        @RequestParam(required = false) String startDate,
                                        @RequestParam(required = false) String endDate) {
        return ResponseEntity.ok(Map.of("success", true, "type", type, "data", List.of()));
    }

    private Long resolveHotelId(Long hotelId) {
        if (hotelId != null) return hotelId;
        return null;
    }

    private Map<String, Object> emptyAnalytics() {
        return Map.of("success", true, "data", Map.of(
            "todayRevenue", 0, "todayOrders", 0,
            "activeOrders", 0, "totalStaff", 0));
    }
}
