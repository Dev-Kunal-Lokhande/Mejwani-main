package com.mejwani.controller;

import com.mejwani.entity.*;
import com.mejwani.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderRepository orderRepository;
    private final HotelRepository hotelRepository;
    private final RestaurantTableRepository tableRepository;
    private final MenuItemRepository menuItemRepository;
    private final BillRepository billRepository;
    private final SimpMessagingTemplate messagingTemplate;

    // Safe serialization — never return raw Order entity
    private Map<String, Object> serializeOrder(Order order) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", order.getId());
        m.put("status", order.getStatus());
        m.put("payment_mode", order.getPaymentMode());
        m.put("total_amount", order.getTotalAmount());
        m.put("created_at", order.getCreatedAt());
        m.put("kot_printed_at", order.getKotPrintedAt());
        m.put("hotel_id", order.getHotel() != null ? order.getHotel().getId() : null);
        m.put("table_id", order.getTable() != null ? order.getTable().getId() : null);
        m.put("table_name", order.getTable() != null ? order.getTable().getTableName() : null);

        List<Map<String, Object>> items = new ArrayList<>();
        if (order.getItems() != null) {
            for (OrderItem oi : order.getItems()) {
                Map<String, Object> item = new HashMap<>();
                item.put("id", oi.getId());
                item.put("item_name", oi.getItemName());
                item.put("quantity", oi.getQuantity());
                item.put("unit_price", oi.getUnitPrice());
                item.put("printed_quantity", oi.getPrintedQuantity());
                item.put("menu_item_id", oi.getMenuItem() != null ? oi.getMenuItem().getId() : null);
                items.add(item);
            }
        }
        m.put("items", items);
        return m;
    }

    @Transactional(readOnly = true)
    @GetMapping
    public ResponseEntity<?> getOrders(@RequestParam Long hotelId,
                                       @RequestParam(required = false) String status) {
        List<Order> orders = status != null
                ? orderRepository.findByHotelIdAndStatus(hotelId, status)
                : orderRepository.findByHotelIdOrderByCreatedAtDesc(hotelId);
        return ResponseEntity.ok(orders.stream().map(this::serializeOrder).toList());
    }

    @Transactional(readOnly = true)
    @GetMapping("/active")
    public ResponseEntity<?> getActiveOrders(@RequestParam Long hotelId) {
        return ResponseEntity.ok(orderRepository.findActiveOrders(hotelId)
                .stream().map(this::serializeOrder).toList());
    }

    // GET /api/orders/today/sales?hotelId=X
    @Transactional(readOnly = true)
    @GetMapping("/today/sales")
    public ResponseEntity<?> getTodayOrderSales(@RequestParam(required = false) Long hotelId) {
        if (hotelId == null) return ResponseEntity.ok(List.of());
        LocalDateTime start = LocalDate.now().atStartOfDay();
        LocalDateTime end = start.plusDays(1);
        List<Order> orders = orderRepository.findByHotelIdAndDateRange(hotelId, start, end);
        return ResponseEntity.ok(orders.stream().map(this::serializeOrder).toList());
    }

    // GET /api/orders/{id}
    @Transactional(readOnly = true)
    @GetMapping("/{id}")
    public ResponseEntity<?> getOrder(@PathVariable Long id) {
        return orderRepository.findById(id)
                .map(o -> ResponseEntity.ok(serializeOrder(o)))
                .orElse(ResponseEntity.notFound().build());
    }

    // POST /api/orders — create order
    @Transactional
    @PostMapping
    public ResponseEntity<?> createOrder(@RequestBody Map<String, Object> body) {
        Long hotelId = Long.valueOf(body.get("hotelId").toString());
        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new RuntimeException("Hotel not found"));

        Order order = Order.builder()
                .hotel(hotel)
                .status("NEW")
                .paymentMode("CASH")
                .build();

        if (body.containsKey("tableId") && body.get("tableId") != null) {
            Long tableId = Long.valueOf(body.get("tableId").toString());
            tableRepository.findById(tableId).ifPresent(order::setTable);
        }

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> itemsData = (List<Map<String, Object>>) body.get("items");
        List<OrderItem> items = buildOrderItems(order, itemsData);

        BigDecimal total = items.stream()
                .map(i -> i.getUnitPrice().multiply(BigDecimal.valueOf(i.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        order.setItems(items);
        order.setTotalAmount(total);
        Order saved = orderRepository.save(order);

        try {
            messagingTemplate.convertAndSend("/topic/hotel/" + hotelId + "/orders", Map.of(
                "type", "NEW_ORDER", "orderId", saved.getId()
            ));
        } catch (Exception ignored) {}

        return ResponseEntity.ok(Map.of("success", true, "order", serializeOrder(saved)));
    }

    // PUT /api/orders/{id}/append-items
    @Transactional
    @PutMapping("/{id}/append-items")
    public ResponseEntity<?> appendItems(@PathVariable Long id,
                                          @RequestParam(required = false) Long hotelId,
                                          @RequestBody Map<String, Object> body) {
        return orderRepository.findById(id).map(order -> {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> itemsData = (List<Map<String, Object>>) body.get("items");
            List<OrderItem> newItems = buildOrderItems(order, itemsData);

            BigDecimal addedTotal = newItems.stream()
                    .map(i -> i.getUnitPrice().multiply(BigDecimal.valueOf(i.getQuantity())))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            if (order.getItems() != null) order.getItems().addAll(newItems);
            else order.setItems(newItems);

            BigDecimal current = order.getTotalAmount() != null ? order.getTotalAmount() : BigDecimal.ZERO;
            order.setTotalAmount(current.add(addedTotal));

            Order saved = orderRepository.save(order);
            Long hid = order.getHotel() != null ? order.getHotel().getId() : hotelId;
            if (hid != null) {
                try {
                    messagingTemplate.convertAndSend("/topic/hotel/" + hid + "/orders", Map.of(
                        "type", "ORDER_UPDATED", "orderId", saved.getId()
                    ));
                } catch (Exception ignored) {}
            }
            return ResponseEntity.ok(Map.of("success", true, "order", serializeOrder(saved)));
        }).orElse(ResponseEntity.notFound().build());
    }

    // POST /api/orders/print-kot?hotelId=X
    @Transactional
    @PostMapping("/print-kot")
    public ResponseEntity<?> printKot(@RequestParam(required = false) Long hotelId,
                                       @RequestBody Map<String, Object> body) {
        Long orderId = body.containsKey("orderId") ? Long.valueOf(body.get("orderId").toString()) : null;
        if (orderId != null) {
            orderRepository.findById(orderId).ifPresent(order -> {
                order.setStatus("SENT_TO_KITCHEN");
                order.setKotPrintedAt(LocalDateTime.now());
                orderRepository.save(order);
            });
        }
        return ResponseEntity.ok(Map.of("success", true, "message", "KOT sent to kitchen"));
    }

    // POST /api/orders/direct-bill
    @Transactional
    @PostMapping("/direct-bill")
    public ResponseEntity<?> directBill(@RequestParam(required = false) Long hotelId,
                                         @RequestBody Map<String, Object> body) {
        Long hid = hotelId != null ? hotelId
                 : body.containsKey("hotelId") ? Long.valueOf(body.get("hotelId").toString()) : null;
        if (hid == null) return ResponseEntity.badRequest().body(Map.of("error", "hotelId required"));

        Hotel hotel = hotelRepository.findById(hid)
                .orElseThrow(() -> new RuntimeException("Hotel not found"));

        Order order = Order.builder()
                .hotel(hotel)
                .status("COMPLETED")
                .paymentMode(body.containsKey("paymentMode") ? body.get("paymentMode").toString() : "CASH")
                .build();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> itemsData = (List<Map<String, Object>>) body.get("items");
        List<OrderItem> items = buildOrderItems(order, itemsData);
        BigDecimal total = items.stream()
                .map(i -> i.getUnitPrice().multiply(BigDecimal.valueOf(i.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        order.setItems(items);
        order.setTotalAmount(total);
        Order savedOrder = orderRepository.save(order);

        BigDecimal taxAmount = body.containsKey("taxAmount") ? new BigDecimal(body.get("taxAmount").toString()) : BigDecimal.ZERO;
        BigDecimal discount = body.containsKey("discountAmount") ? new BigDecimal(body.get("discountAmount").toString()) : BigDecimal.ZERO;

        Bill bill = Bill.builder()
                .billNumber("BILL-" + System.currentTimeMillis())
                .order(savedOrder)
                .hotel(hotel)
                .subtotal(total)
                .taxAmount(taxAmount)
                .discountAmount(discount)
                .totalAmount(total.add(taxAmount).subtract(discount))
                .paymentMode(order.getPaymentMode())
                .paymentStatus("PAID")
                .build();

        Bill savedBill = billRepository.save(bill);
        return ResponseEntity.ok(Map.of("success", true,
                "order", serializeOrder(savedOrder),
                "bill_id", savedBill.getId(),
                "bill_number", savedBill.getBillNumber()));
    }

    // POST /api/orders/pay/{id}
    @Transactional
    @PostMapping("/pay/{id}")
    public ResponseEntity<?> payOrder(@PathVariable Long id,
                                       @RequestParam(required = false) Long hotelId,
                                       @RequestBody(required = false) Map<String, Object> body) {
        return orderRepository.findById(id).map(order -> {
            order.setStatus("COMPLETED");
            if (body != null && body.containsKey("paymentMode")) {
                order.setPaymentMode(body.get("paymentMode").toString());
            }
            Order saved = orderRepository.save(order);
            return ResponseEntity.ok(Map.of("success", true, "order", serializeOrder(saved)));
        }).orElse(ResponseEntity.notFound().build());
    }

    // PUT /api/orders/{id}/status
    @Transactional
    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateOrderStatus(@PathVariable Long id,
                                                @RequestBody Map<String, String> body) {
        return orderRepository.findById(id).map(order -> {
            order.setStatus(body.get("status"));
            Order saved = orderRepository.save(order);
            try {
                Long hid = order.getHotel() != null ? order.getHotel().getId() : null;
                if (hid != null) {
                    messagingTemplate.convertAndSend("/topic/hotel/" + hid + "/orders", Map.of(
                        "type", "ORDER_STATUS_UPDATE", "orderId", id, "status", body.get("status")
                    ));
                }
            } catch (Exception ignored) {}
            return ResponseEntity.ok(Map.of("success", true, "order", serializeOrder(saved)));
        }).orElse(ResponseEntity.notFound().build());
    }

    // DELETE /api/orders/{id}
    @Transactional
    @DeleteMapping("/{id}")
    public ResponseEntity<?> cancelOrder(@PathVariable Long id) {
        return orderRepository.findById(id).map(order -> {
            order.setStatus("CANCELLED");
            orderRepository.save(order);
            return ResponseEntity.ok(Map.of("success", true, "message", "Order cancelled"));
        }).orElse(ResponseEntity.notFound().build());
    }

    // POST /api/orders/request-bill/{tableId}
    @Transactional
    @PostMapping("/request-bill/{tableId}")
    public ResponseEntity<?> requestBill(@PathVariable Long tableId,
                                          @RequestParam(required = false) Long hotelId) {
        List<Order> orders = orderRepository.findByTableId(tableId);
        Order activeOrder = orders.stream()
                .filter(o -> !"COMPLETED".equals(o.getStatus()) && !"CANCELLED".equals(o.getStatus()))
                .findFirst().orElse(null);
        if (activeOrder != null) {
            activeOrder.setStatus("BILL_PENDING");
            orderRepository.save(activeOrder);
        }
        return ResponseEntity.ok(Map.of("success", true, "message", "Bill requested"));
    }

    // POST /api/orders/transfer
    @Transactional
    @PostMapping("/transfer")
    public ResponseEntity<?> transferOrder(@RequestParam(required = false) Long hotelId,
                                            @RequestBody Map<String, Object> body) {
        Long orderId = body.containsKey("orderId") ? Long.valueOf(body.get("orderId").toString()) : null;
        Long toTableId = body.containsKey("toTableId") ? Long.valueOf(body.get("toTableId").toString()) : null;
        if (orderId == null || toTableId == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "orderId and toTableId required"));
        }
        return orderRepository.findById(orderId).map(order -> {
            tableRepository.findById(toTableId).ifPresent(order::setTable);
            return ResponseEntity.ok(Map.of("success", true, "order", serializeOrder(orderRepository.save(order))));
        }).orElse(ResponseEntity.notFound().build());
    }

    // GET /api/orders/kitchen-queue?hotelId=X
    @Transactional(readOnly = true)
    @GetMapping("/kitchen-queue")
    public ResponseEntity<?> getKitchenQueue(@RequestParam(required = false) Long hotelId) {
        if (hotelId == null) return ResponseEntity.ok(Map.of("success", true, "data", List.of()));
        var data = orderRepository.findActiveOrders(hotelId).stream().map(this::serializeOrder).toList();
        return ResponseEntity.ok(Map.of("success", true, "data", data));
    }

    // Helper: build OrderItem list from request body
    private List<OrderItem> buildOrderItems(Order order, List<Map<String, Object>> itemsData) {
        List<OrderItem> items = new ArrayList<>();
        if (itemsData == null) return items;
        for (Map<String, Object> itemData : itemsData) {
            OrderItem oi = new OrderItem();
            oi.setOrder(order);
            oi.setQuantity(Integer.valueOf(itemData.get("quantity").toString()));
            oi.setPrintedQuantity(0);

            if (itemData.containsKey("menuItemId") && itemData.get("menuItemId") != null) {
                Long menuItemId = Long.valueOf(itemData.get("menuItemId").toString());
                menuItemRepository.findById(menuItemId).ifPresent(mi -> {
                    oi.setMenuItem(mi);
                    oi.setItemName(mi.getName());
                    oi.setUnitPrice(mi.getPrice());
                });
            } else if (itemData.containsKey("itemName")) {
                oi.setItemName(itemData.get("itemName").toString());
                oi.setUnitPrice(itemData.containsKey("unitPrice")
                    ? new BigDecimal(itemData.get("unitPrice").toString()) : BigDecimal.ZERO);
            }
            if (oi.getUnitPrice() == null) oi.setUnitPrice(BigDecimal.ZERO);
            items.add(oi);
        }
        return items;
    }
}
