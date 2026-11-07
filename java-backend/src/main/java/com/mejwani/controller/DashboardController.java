package com.mejwani.controller;

import com.mejwani.entity.*;
import com.mejwani.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequiredArgsConstructor
public class DashboardController {

    private final OrderRepository orderRepository;
    private final BillRepository billRepository;
    private final StaffRepository staffRepository;
    private final HotelRepository hotelRepository;

    // GET /api/summary?hotelId=X
    @GetMapping("/api/summary")
    public ResponseEntity<?> getSummary(@RequestParam Long hotelId) {
        LocalDateTime startOfDay = LocalDateTime.now().toLocalDate().atStartOfDay();
        LocalDateTime endOfDay = startOfDay.plusDays(1);

        List<Order> todayOrders = orderRepository.findByHotelIdAndDateRange(hotelId, startOfDay, endOfDay);
        List<Bill> todayBills = billRepository.findByHotelIdAndCreatedAtBetween(hotelId, startOfDay, endOfDay);

        BigDecimal todayRevenue = todayBills.stream()
                .map(Bill::getTotalAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long activeOrders = orderRepository.findActiveOrders(hotelId).size();

        return ResponseEntity.ok(Map.of(
            "success", true,
            "todayOrders", todayOrders.size(),
            "todayRevenue", todayRevenue,
            "activeBills", todayBills.size(),
            "activeOrders", activeOrders,
            "totalStaff", staffRepository.findByHotelIdAndIsActiveTrue(hotelId).size()
        ));
    }

    // GET /api/hotels/by-slug/{slug}  — used by RoleSelection to load hotel branding
    @GetMapping("/api/hotels/by-slug/{slug}")
    public ResponseEntity<?> getHotelBySlug(@PathVariable String slug) {
        return hotelRepository.findBySlug(slug)
                .map(hotel -> ResponseEntity.ok(Map.of(
                    "success", true,
                    "data", Map.of(
                        "id", hotel.getId(),
                        "name", hotel.getName(),
                        "slug", hotel.getSlug() != null ? hotel.getSlug() : slug,
                        "cover_image", hotel.getCoverImageUrl() != null ? hotel.getCoverImageUrl() : "",
                        "logo_url", hotel.getLogoUrl() != null ? hotel.getLogoUrl() : "",
                        "address", hotel.getAddress() != null ? hotel.getAddress() : "",
                        "phone", hotel.getPhone() != null ? hotel.getPhone() : ""
                    )
                )))
                .orElse(ResponseEntity.status(404).body(Map.of("success", false, "message", "Hotel not found")));
    }
}
