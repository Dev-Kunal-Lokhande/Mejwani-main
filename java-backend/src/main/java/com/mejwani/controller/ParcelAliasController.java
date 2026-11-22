package com.mejwani.controller;

import com.mejwani.entity.*;
import com.mejwani.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.*;

/**
 * Alias controller - maps /api/parcels/* -> parcel-orders logic
 */
@RestController
@RequestMapping("/api/parcels")
@RequiredArgsConstructor
public class ParcelAliasController {

    private final ParcelOrderRepository parcelOrderRepository;
    private final HotelRepository hotelRepository;
    private final MenuItemRepository menuItemRepository;

    private Map<String, Object> serializeParcel(ParcelOrder order) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", order.getId());
        m.put("customer_name", order.getCustomerName());
        m.put("customer_phone", order.getCustomerPhone());
        m.put("status", order.getStatus());
        m.put("total_amount", order.getTotalAmount());
        m.put("payment_mode", order.getPaymentMode());
        m.put("kot_number", order.getKotNumber());
        m.put("created_at", order.getCreatedAt());
        m.put("hotel_id", order.getHotel() != null ? order.getHotel().getId() : null);

        List> items = new ArrayList<>();
        if (order.getItems() != null) {
            for (ParcelOrderItem poi : order.getItems()) {
                Map<String, Object> item = new HashMap<>();
                item.put("id", poi.getId());
                item.put("item_name", poi.getItemName());
                item.put("quantity", poi.getQuantity());
                item.put("unit_price", poi.getUnitPrice());
                item.put("menu_item_id", poi.getMenuItem() != null ? poi.getMenuItem().getId() : null);
                items.add(item);
            }
        }
        m.put("items", items);
        return m;
    }

    private boolean matchesDate(Object createdAtObj, String dateStr) {
        if (dateStr == null || dateStr.isBlank() || createdAtObj == null) {
            return true;
        }
        try {
            LocalDate targetDate = LocalDate.parse(dateStr.trim());
            ZoneId zone = ZoneId.systemDefault();

            if (createdAtObj instanceof LocalDateTime ldt) {
                return ldt.toLocalDate().equals(targetDate);
            }
            if (createdAtObj instanceof OffsetDateTime odt) {
                return odt.atZoneSameInstant(zone).toLocalDate().equals(targetDate);
            }
            if (createdAtObj instanceof Instant instant) {
                return instant.atZone(zone).toLocalDate().equals(targetDate);
            }
            if (createdAtObj instanceof java.sql.Timestamp ts) {
                return ts.toInstant().atZone(zone).toLocalDate().equals(targetDate);
            }
            if (createdAtObj instanceof Date d) {
                return d.toInstant().atZone(zone).toLocalDate().equals(targetDate);
            }
            String raw = createdAtObj.toString().trim();
            if (raw.length() >= 10) {
                return LocalDate.parse(raw.substring(0, 10)).equals(targetDate);
            }
        } catch (Exception ignored) {
            // Invalid date filter shouldn't break listing
        }
        return true;
    }

    private BigDecimal parseBigDecimalOrZero(Object val) {
        if (val == null || val.toString().isBlank()) {
            return BigDecimal.ZERO;
        }
        try {
            return new BigDecimal(val.toString().trim());
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }

    @Transactional(readOnly = true)
    @GetMapping
    public ResponseEntity<?> getParcels(
            @RequestParam(required = false) Long hotelId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String date) {
        if (hotelId == null) {
            return ResponseEntity.ok(List.of());
        }
        List<ParcelOrder> orders = (status != null && !status.isBlank())
                ? parcelOrderRepository.findByHotelIdAndStatus(hotelId, status.trim())
                : parcelOrderRepository.findByHotelIdOrderByCreatedAtDesc(hotelId);

        List> result = orders.stream()
                .filter(o -> matchesDate(o.getCreatedAt(), date))
                .map(this::serializeParcel)
                .toList();

        return ResponseEntity.ok(result);
    }

    @Transactional(readOnly = true)
    @GetMapping("/{id}")
    public ResponseEntity<?> getParcel(@PathVariable Long id) {
        return parcelOrderRepository.findById(id)
                .map(o -> ResponseEntity.ok(serializeParcel(o)))
                .orElse(ResponseEntity.notFound().build());
    }

    @Transactional
    @PostMapping
    public ResponseEntity<?> createParcel(@RequestBody Map<String, Object> body) {
        if (body == null || body.get("hotelId") == null || body.get("hotelId").toString().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "hotelId is required"));
        }

        final Long hotelId;
        try {
            hotelId = Long.valueOf(body.get("hotelId").toString().trim());
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Invalid hotelId"));
        }

        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new RuntimeException("Hotel not found"));

        String customerName = (body.get("customerName") != null && !body.get("customerName").toString().isBlank())
                ? body.get("customerName").toString().trim()
                : "Walk-in";
        String customerPhone = (body.get("customerPhone") != null && !body.get("customerPhone").toString().isBlank())
                ? body.get("customerPhone").toString().trim()
                : null;
        String paymentMode = (body.get("paymentMode") != null && !body.get("paymentMode").toString().isBlank())
                ? body.get("paymentMode").toString().trim()
                : "CASH";

        ParcelOrder order = ParcelOrder.builder()
                .hotel(hotel)
                .customerName(customerName)
                .customerPhone(customerPhone)
                .status("NEW")
                .paymentMode(paymentMode)
                .build();

        List<ParcelOrderItem> items = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;

        Object rawItems = body.get("items");
        if (rawItems instanceof List<?> rawList) {
            for (Object entry : rawList) {
                if (!(entry instanceof Map<?, ?> rawMap)) continue;

                @SuppressWarnings("unchecked")
                Map<String, Object> itemData = (Map<String, Object>) rawMap;

                ParcelOrderItem poi = new ParcelOrderItem();
                poi.setParcelOrder(order);

                int qty = 1;
                if (itemData.get("quantity") != null && !itemData.get("quantity").toString().isBlank()) {
                    try {
                        qty = Integer.parseInt(itemData.get("quantity").toString().trim());
                    } catch (NumberFormatException ignored) {
                        qty = 1;
                    }
                }
                poi.setQuantity(Math.max(1, qty));

                Object rawMenuItemId = itemData.get("menuItemId");
                BigDecimal fallbackUnitPrice = parseBigDecimalOrZero(itemData.get("unitPrice"));
                String fallbackItemName = (itemData.get("itemName") != null && !itemData.get("itemName").toString().isBlank())
                        ? itemData.get("itemName").toString().trim()
                        : "Item";

                if (rawMenuItemId != null && !rawMenuItemId.toString().isBlank()) {
                    try {
                        Long menuItemId = Long.valueOf(rawMenuItemId.toString().trim());
                        menuItemRepository.findById(menuItemId).ifPresentOrElse(
                                mi -> {
                                    poi.setMenuItem(mi);
                                    poi.setItemName(mi.getName() != null ? mi.getName() : fallbackItemName);
                                    poi.setUnitPrice(mi.getPrice() != null ? mi.getPrice() : fallbackUnitPrice);
                                },
                                () -> {
                                    poi.setItemName(fallbackItemName);
                                    poi.setUnitPrice(fallbackUnitPrice);
                                }
                        );
                    } catch (NumberFormatException e) {
                        poi.setItemName(fallbackItemName);
                        poi.setUnitPrice(fallbackUnitPrice);
                    }
                } else {
                    poi.setItemName(fallbackItemName);
                    poi.setUnitPrice(fallbackUnitPrice);
                }

                BigDecimal unitPrice = poi.getUnitPrice() != null ? poi.getUnitPrice() : BigDecimal.ZERO;
                poi.setUnitPrice(unitPrice);
                total = total.add(unitPrice.multiply(BigDecimal.valueOf(poi.getQuantity())));
                items.add(poi);
            }
        }

        order.setItems(items);
        order.setTotalAmount(total);

        return ResponseEntity.ok(serializeParcel(parcelOrderRepository.save(order)));
    }

    @Transactional
    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String newStatus = body != null ? body.get("status") : null;
        if (newStatus == null || newStatus.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "status is required"));
        }
        return parcelOrderRepository.findById(id).map(order -> {
            order.setStatus(newStatus.trim());
            return ResponseEntity.ok(serializeParcel(parcelOrderRepository.save(order)));
        }).orElse(ResponseEntity.notFound().build());
    }

    @Transactional
    @DeleteMapping("/{id}")
    public ResponseEntity<?> cancelParcel(@PathVariable Long id) {
        return parcelOrderRepository.findById(id).map(order -> {
            order.setStatus("CANCELLED");
            parcelOrderRepository.save(order);
            return ResponseEntity.ok(Map.of("success", true, "message", "Parcel cancelled"));
        }).orElse(ResponseEntity.notFound().build());
    }
}