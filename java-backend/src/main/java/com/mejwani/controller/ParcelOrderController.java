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

        List<Map<String, Object>> items = new ArrayList<>();
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
        List<ParcelOrder> orders = status != null
                ? parcelOrderRepository.findByHotelIdAndStatus(hotelId, status)
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
        Long hotelId = Long.valueOf(body.get("hotelId").toString());
        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> new RuntimeException("Hotel not found"));

        ParcelOrder order = ParcelOrder.builder()
                .hotel(hotel)
                .customerName(body.containsKey("customerName") ? body.get("customerName").toString() : "Walk-in")
                .customerPhone(body.containsKey("customerPhone") ? body.get("customerPhone").toString() : null)
                .status("NEW")
                .paymentMode(body.containsKey("paymentMode") ? body.get("paymentMode").toString() : "CASH")
                .build();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> itemsData = (List<Map<String, Object>>) body.get("items");
        List<ParcelOrderItem> items = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;

        if (itemsData != null) {
            for (Map<String, Object> itemData : itemsData) {
                ParcelOrderItem poi = new ParcelOrderItem();
                poi.setParcelOrder(order);
                poi.setQuantity(Integer.valueOf(itemData.get("quantity").toString()));

                if (itemData.containsKey("menuItemId")) {
                    Long menuItemId = Long.valueOf(itemData.get("menuItemId").toString());
                    menuItemRepository.findById(menuItemId).ifPresent(mi -> {
                        poi.setMenuItem(mi);
                        poi.setItemName(mi.getName());
                        poi.setUnitPrice(mi.getPrice());
                    });
                } else {
                    poi.setItemName(itemData.get("itemName").toString());
                    poi.setUnitPrice(new BigDecimal(itemData.get("unitPrice").toString()));
                }

                if (poi.getUnitPrice() != null) {
                    total = total.add(poi.getUnitPrice().multiply(BigDecimal.valueOf(poi.getQuantity())));
                }
                items.add(poi);
            }
        }

        order.setItems(items);
        order.setTotalAmount(total);

        return ResponseEntity.ok(serializeParcelOrder(parcelOrderRepository.save(order)));
    }

    @Transactional
    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return parcelOrderRepository.findById(id).map(order -> {
            order.setStatus(body.get("status"));
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
