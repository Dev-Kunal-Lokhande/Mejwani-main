package com.mejwani.controller;

import com.mejwani.entity.*;
import com.mejwani.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.*;

@RestController
@RequestMapping("/api/parcel-orders")
@RequiredArgsConstructor
public class ParcelOrderController {

    private final ParcelOrderRepository parcelOrderRepository;
    private final HotelRepository hotelRepository;
    private final MenuItemRepository menuItemRepository;

    private Map<String, Object> serializeParcelOrder(ParcelOrder order) {
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

    @Transactional(readOnly = true)
    @GetMapping
    public ResponseEntity<?> getParcelOrders(@RequestParam Long hotelId,
                                              @RequestParam(required = false) String status) {
        List<ParcelOrder> orders = (status != null && !status.isBlank())
                ? parcelOrderRepository.findByHotelIdAndStatus(hotelId, status.trim())
                : parcelOrderRepository.findByHotelIdOrderByCreatedAtDesc(hotelId);
        return ResponseEntity.ok(orders.stream().map(this::serializeParcelOrder).toList());
    }

    @Transactional(readOnly = true)
    @GetMapping("/{id}")
    public ResponseEntity<?> getParcelOrder(@PathVariable Long id) {
        return parcelOrderRepository.findById(id)
                .map(o -> ResponseEntity.ok(serializeParcelOrder(o)))
                .orElse(ResponseEntity.notFound().build());
    }

    @Transactional
    @PostMapping
    public ResponseEntity<?> createParcelOrder(@RequestBody Map<String, Object> body) {
        if (body == null || body.get("hotelId") == null || body.get("hotelId").toString().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "hotelId is required"));
        }

        Long hotelId = Long.valueOf(body.get("hotelId").toString().trim());
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> new RuntimeException("Hotel not found"));

        ParcelOrder order = ParcelOrder.builder()
                .hotel(hotel)
                .customerName(body.get("customerName") != null && !body.get("customerName").toString().isBlank()
                        ? body.get("customerName").toString().trim()
                        : "Walk-in")
                .customerPhone(body.get("customerPhone") != null ? body.get("customerPhone").toString().trim() : null)
                .status("NEW")
                .paymentMode(body.get("paymentMode") != null && !body.get("paymentMode").toString().isBlank()
                        ? body.get("paymentMode").toString().trim()
                        : "CASH")
                .build();

        @SuppressWarnings("unchecked")
        List> itemsData = body.get("items") instanceof List<?> rawList
                ? (List>) rawList
                : List.of();

        List<ParcelOrderItem> items = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;

        for (Map<String, Object> itemData : itemsData) {
            if (itemData == null) continue;

            ParcelOrderItem poi = new ParcelOrderItem();
            poi.setParcelOrder(order);

            int qty = itemData.get("quantity") != null
                    ? Integer.parseInt(itemData.get("quantity").toString().trim())
                    : 1;
            poi.setQuantity(Math.max(1, qty));

            Object rawMenuItemId = itemData.get("menuItemId");
            if (rawMenuItemId != null && !rawMenuItemId.toString().isBlank()) {
                Long menuItemId = Long.valueOf(rawMenuItemId.toString().trim());
                menuItemRepository.findById(menuItemId).ifPresentOrElse(
                        mi -> {
                            poi.setMenuItem(mi);
                            poi.setItemName(mi.getName());
                            poi.setUnitPrice(mi.getPrice() != null ? mi.getPrice() : BigDecimal.ZERO);
                        },
                        () -> {
                            poi.setItemName(Objects.toString(itemData.get("itemName"), "Item"));
                            BigDecimal fallbackPrice = itemData.get("unitPrice") != null && !itemData.get("unitPrice").toString().isBlank()
                                    ? new BigDecimal(itemData.get("unitPrice").toString().trim())
                                    : BigDecimal.ZERO;
                            poi.setUnitPrice(fallbackPrice);
                        }
                );
            } else {
                poi.setItemName(Objects.toString(itemData.get("itemName"), "Item"));
                BigDecimal unitPrice = itemData.get("unitPrice") != null && !itemData.get("unitPrice").toString().isBlank()
                        ? new BigDecimal(itemData.get("unitPrice").toString().trim())
                        : BigDecimal.ZERO;
                poi.setUnitPrice(unitPrice);
            }

            if (poi.getUnitPrice() != null && poi.getQuantity() != null) {
                total = total.add(poi.getUnitPrice().multiply(BigDecimal.valueOf(poi.getQuantity())));
            }
            items.add(poi);
        }

        order.setItems(items);
        order.setTotalAmount(total);

        return ResponseEntity.ok(serializeParcelOrder(parcelOrderRepository.save(order)));
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
            return ResponseEntity.ok(serializeParcelOrder(parcelOrderRepository.save(order)));
        }).orElse(ResponseEntity.notFound().build());
    }

    @Transactional
    @DeleteMapping("/{id}")
    public ResponseEntity<?> cancelParcelOrder(@PathVariable Long id) {
        return parcelOrderRepository.findById(id).map(order -> {
            order.setStatus("CANCELLED");
            parcelOrderRepository.save(order);
            return ResponseEntity.ok(Map.of("success", true, "message", "Parcel order cancelled"));
        }).orElse(ResponseEntity.notFound().build());
    }
}