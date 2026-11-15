package com.mejwani.controller;

import com.mejwani.entity.*;
import com.mejwani.repository.*;
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
public class OrderController {

    private final OrderRepository orderRepository;
    private final HotelRepository hotelRepository;
    private final RestaurantTableRepository tableRepository;
    private final MenuItemRepository menuItemRepository;
    private final BillRepository billRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public OrderController(OrderRepository orderRepository,
                           HotelRepository hotelRepository,
                           RestaurantTableRepository tableRepository,
                           MenuItemRepository menuItemRepository,
                           BillRepository billRepository,
                           SimpMessagingTemplate messagingTemplate) {
        this.orderRepository = orderRepository;
        this.hotelRepository = hotelRepository;
        this.tableRepository = tableRepository;
        this.menuItemRepository = menuItemRepository;
        this.billRepository = billRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private Map<String, Object> serializeOrder(Order order) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", order.getId());
        m.put("status", order.getStatus());
        m.put("payment_mode", order.getPaymentMode());
        m.put("total_amount", order.getTotalAmount());
        m.put("grand_total", order.getTotalAmount());
        m.put("created_at", order.getCreatedAt());
        m.put("createdAt", order.getCreatedAt());
        m.put("updated_at", order.getCreatedAt());
        m.put("kot_printed_at", order.getKotPrintedAt());
        m.put("hotel_id", order.getHotel() != null ? order.getHotel().getId() : null);
        m.put("table_id", order.getTable() != null ? order.getTable().getId() : null);

        String tableName = order.getTable() != null ? order.getTable().getTableName() : null;
        m.put("table_name", tableName);
        m.put("tableNo", tableName);

        String resolvedCaptain = (order.getCaptainName() != null && !order.getCaptainName().isBlank())
                ? order.getCaptainName() : "ADMIN";
        m.put("captain_name", resolvedCaptain);
        m.put("captain", resolvedCaptain);

        String kotNum = order.getKotNumber() != null ? order.getKotNumber() : "ORD-" + order.getId();
        m.put("kot_number", kotNum);

        List items = new ArrayList();
        if (order.getItems() != null) {
            for (OrderItem oi : order.getItems()) {
                Map<String, Object> item = new HashMap<>();
                item.put("id", oi.getId());
                item.put("item_name", oi.getItemName());
                item.put("name", oi.getItemName());
                item.put("quantity", oi.getQuantity());
                item.put("unit_price", oi.getUnitPrice());
                item.put("price", oi.getUnitPrice());
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
        return ResponseEntity.ok(Map.of("success", true, "data", orders.stream().map(this::serializeOrder).toList()));
    }

    @Transactional(readOnly = true)
    @GetMapping("/active")
    public ResponseEntity<?> getActiveOrders(@RequestParam Long hotelId) {
        var active = orderRepository.findByHotelIdOrderByCreatedAtDesc(hotelId)
                .stream()
                .filter(o -> o.getStatus() == null || 
                            (!o.getStatus().equalsIgnoreCase("COMPLETED") && 
                             !o.getStatus().equalsIgnoreCase("CANCELLED") &&
                             !o.getStatus().equalsIgnoreCase("PAID")))
                .map(this::serializeOrder)
                .toList();
        return ResponseEntity.ok(active);
    }

    @Transactional(readOnly = true)
    @GetMapping("/today/sales")
    public ResponseEntity<?> getTodayOrderSales(@RequestParam(required = false) Long hotelId) {
        if (hotelId == null) return ResponseEntity.ok(List.of());
        LocalDateTime start = LocalDate.now().atStartOfDay();
        LocalDateTime end = start.plusDays(1);
        List<Order> orders = orderRepository.findByHotelIdAndDateRange(hotelId, start, end);
        return ResponseEntity.ok(orders.stream().map(this::serializeOrder).toList());
    }

    @Transactional(readOnly = true)
    @GetMapping("/{id}")
    public ResponseEntity<?> getOrder(@PathVariable Long id) {
        return orderRepository.findById(id)
                .map(o -> ResponseEntity.ok(serializeOrder(o)))
                .orElse(ResponseEntity.notFound().build());
    }
@Transactional
    @PostMapping
    public ResponseEntity<?> createOrder(@RequestParam(required = false) Long hotelId,
                                         @RequestBody Map<String, Object> body) {
        Long resolvedHotelId = hotelId != null ? hotelId
                : (body.get("hotelId") != null ? Long.valueOf(body.get("hotelId").toString())
                : (body.get("hotel_id") != null ? Long.valueOf(body.get("hotel_id").toString()) : null));

        if (resolvedHotelId == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "hotelId is required"));
        }

        Hotel hotel = hotelRepository.findById(resolvedHotelId)
                .orElseThrow(() -> new RuntimeException("Hotel not found"));

        String rawStatus = body.get("status") != null ? body.get("status").toString() : "SENT_TO_KITCHEN";
        boolean isSentToKitchen = "SENT_TO_KITCHEN".equalsIgnoreCase(rawStatus)
                || "pending".equalsIgnoreCase(rawStatus)
                || Boolean.TRUE.equals(body.get("printKot"));

        String resolvedStatus = isSentToKitchen ? "SENT_TO_KITCHEN" : rawStatus.toUpperCase();

        String captainName = body.get("captainName") != null ? body.get("captainName").toString()
                : (body.get("captain_name") != null ? body.get("captain_name").toString() : "ADMIN");

        Order order = Order.builder()
                .hotel(hotel)
                .status(resolvedStatus)
                .paymentMode(body.get("paymentMode") != null ? body.get("paymentMode").toString() : "CASH")
                .captainName(captainName)
                .kotNumber("ORD-" + System.currentTimeMillis() % 100000)
                .kotPrintedAt(isSentToKitchen ? LocalDateTime.now() : null)
                .build();

        Object tableIdRaw = body.get("tableId") != null ? body.get("tableId") : body.get("table_id");
        if (tableIdRaw != null) {
            Long tableId = Long.valueOf(tableIdRaw.toString());
            tableRepository.findById(tableId).ifPresent(table -> {
                order.setTable(table);
                table.setStatus("occupied");
                tableRepository.save(table);
            });
        }

        List<OrderItem> items = buildOrderItems(order, body.get("items"));

        BigDecimal total = items.stream()
                .map(i -> i.getUnitPrice().multiply(BigDecimal.valueOf(i.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        order.setItems(items);
        order.setTotalAmount(total);
        Order saved = orderRepository.save(order);

        try {
            messagingTemplate.convertAndSend("/topic/hotel/" + resolvedHotelId + "/orders", Map.of(
                "type", "NEW_ORDER", "orderId", saved.getId()
            ));
        } catch (Exception ignored) {}

        Map<String, Object> serialized = serializeOrder(saved);
        return ResponseEntity.ok(Map.of(
            "success", true,
            "order", serialized,
            "data", serialized
        ));
    }
@Transactional
    @PutMapping("/{id}/append-items")
    public ResponseEntity<?> appendItems(@PathVariable Long id,
                                         @RequestParam(required = false) Long hotelId,
                                         @RequestBody Map<String, Object> body) {
        return orderRepository.findById(id).map(order -> {
            List<OrderItem> deltaItems = buildOrderItems(order, body.get("items"));

            if (order.getItems() == null) {
                order.setItems(new ArrayList<>());
            }

            BigDecimal addedTotal = BigDecimal.ZERO;

            for (OrderItem delta : deltaItems) {
                int deltaQty = delta.getQuantity() != null ? delta.getQuantity() : 0;
                addedTotal = addedTotal.add(delta.getUnitPrice().multiply(BigDecimal.valueOf(deltaQty)));

                Optional<OrderItem> existingOpt = order.getItems().stream()
                        .filter(existing -> existing.getMenuItem() != null && delta.getMenuItem() != null
                                && existing.getMenuItem().getId().equals(delta.getMenuItem().getId())
                                && Objects.equals(existing.getItemName(), delta.getItemName()))
                        .findFirst();

                if (existingOpt.isPresent()) {
                    OrderItem existing = existingOpt.get();
                    int updatedQty = (existing.getQuantity() != null ? existing.getQuantity() : 0) + deltaQty;
                    if (updatedQty <= 0) {
                        order.getItems().remove(existing);
                    } else {
                        existing.setQuantity(updatedQty);
                    }
                } else if (deltaQty > 0) {
                    order.getItems().add(delta);
                }
            }

            BigDecimal newTotal = order.getItems().stream()
                    .map(i -> i.getUnitPrice().multiply(BigDecimal.valueOf(i.getQuantity())))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            order.setTotalAmount(newTotal);

            Order saved = orderRepository.save(order);
            Long hid = order.getHotel() != null ? order.getHotel().getId() : hotelId;
            if (hid != null) {
                try {
                    messagingTemplate.convertAndSend("/topic/hotel/" + hid + "/orders", Map.of(
                        "type", "ORDER_UPDATED", "orderId", saved.getId()
                    ));
                } catch (Exception ignored) {}
            }
            return ResponseEntity.ok(Map.of("success", true, "data", serializeOrder(saved)));
        }).orElse(ResponseEntity.notFound().build());
    }

    @Transactional
    @PostMapping("/print-kot")
    public ResponseEntity<?> printKot(@RequestParam(required = false) Long hotelId,
                                      @RequestBody(required = false) Map<String, Object> body) {
        if (body != null && body.get("orderId") != null) {
            String rawId = body.get("orderId").toString();
            try {
                Long orderId = Long.valueOf(rawId.replaceAll("[^0-9]", ""));
                orderRepository.findById(orderId).ifPresent(order -> {
                    order.setStatus("SENT_TO_KITCHEN");
                    order.setKotPrintedAt(LocalDateTime.now());
                    orderRepository.save(order);
                });
            } catch (Exception ignored) {}
        }
        return ResponseEntity.ok(Map.of("success", true, "message", "KOT sent to kitchen"));
    }

    @Transactional
    @PostMapping("/direct-bill")
    public ResponseEntity<?> directBill(@RequestParam(required = false) Long hotelId,
                                        @RequestBody Map<String, Object> body) {
        Long hid = hotelId != null ? hotelId
                 : body.containsKey("hotelId") ? Long.valueOf(body.get("hotelId").toString()) : null;
        if (hid == null) return ResponseEntity.badRequest().body(Map.of("error", "hotelId required"));

        Hotel hotel = hotelRepository.findById(hid)
                .orElseThrow(() -> new RuntimeException("Hotel not found"));

        boolean isKotOnly = body.containsKey("printKot") && Boolean.TRUE.equals(body.get("printKot"));

        Order order = Order.builder()
                .hotel(hotel)
                .status(isKotOnly ? "SENT_TO_KITCHEN" : "COMPLETED")
                .paymentMode(body.containsKey("paymentMode") ? body.get("paymentMode").toString() : "CASH")
                .kotNumber("ORD-" + System.currentTimeMillis() % 100000)
                .kotPrintedAt(isKotOnly ? LocalDateTime.now() : null)
                .build();

        if (body.containsKey("tableId") && body.get("tableId") != null) {
            Long tableId = Long.valueOf(body.get("tableId").toString());
            tableRepository.findById(tableId).ifPresent(table -> {
                order.setTable(table);
                if (isKotOnly) {
                    table.setStatus("occupied");
                    tableRepository.save(table);
                }
            });
        }

        List<OrderItem> items = buildOrderItems(order, body.get("items"));
        BigDecimal total = items.stream()
                .map(i -> i.getUnitPrice().multiply(BigDecimal.valueOf(i.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        order.setItems(items);
        order.setTotalAmount(total);
        Order savedOrder = orderRepository.save(order);

        try {
            messagingTemplate.convertAndSend("/topic/hotel/" + hid + "/orders", Map.of(
                "type", "NEW_ORDER", "orderId", savedOrder.getId()
            ));
        } catch (Exception ignored) {}

        if (isKotOnly) {
            return ResponseEntity.ok(Map.of(
                "success", true,
                "order", serializeOrder(savedOrder),
                "data", serializeOrder(savedOrder)
            ));
        }

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
            if (order.getTable() != null) {
                RestaurantTable table = order.getTable();
                table.setStatus("available");
                tableRepository.save(table);
            }
            Order saved = orderRepository.save(order);
            return ResponseEntity.ok(Map.of("success", true, "data", serializeOrder(saved)));
        }).orElse(ResponseEntity.notFound().build());
    }
@Transactional
    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateOrderStatus(@PathVariable Long id,
                                               @RequestBody Map<String, String> body) {
        return orderRepository.findById(id).map(order -> {
            String newStatus = body.get("status");
            order.setStatus(newStatus);
            Order saved = orderRepository.save(order);

            try {
                Long hid = order.getHotel() != null ? order.getHotel().getId() : null;
                if (hid != null) {
                    String tableName = order.getTable() != null ? order.getTable().getTableName() : "Parcel";
                    Map<String, Object> payload = new HashMap<>();
                    payload.put("type", "ORDER_STATUS_UPDATE");
                    payload.put("orderId", saved.getId());
                    payload.put("status", newStatus);
                    payload.put("tableName", tableName);
                    payload.put("table_name", tableName);
                    payload.put("kotNumber", saved.getKotNumber() != null ? saved.getKotNumber() : "ORD-" + saved.getId());
                    payload.put("captainName", saved.getCaptainName() != null ? saved.getCaptainName() : "ADMIN");

                    messagingTemplate.convertAndSend("/topic/hotel/" + hid + "/orders", payload);
                }
            } catch (Exception ignored) {}

            return ResponseEntity.ok(Map.of("success", true, "data", serializeOrder(saved)));
        }).orElse(ResponseEntity.notFound().build());
    }

    @Transactional
    @DeleteMapping("/{id}")
    public ResponseEntity<?> cancelOrder(@PathVariable Long id) {
        return orderRepository.findById(id).map(order -> {
            order.setStatus("CANCELLED");
            if (order.getTable() != null) {
                RestaurantTable table = order.getTable();
                table.setStatus("available");
                tableRepository.save(table);
            }
            orderRepository.save(order);
            return ResponseEntity.ok(Map.of("success", true, "message", "Order cancelled"));
        }).orElse(ResponseEntity.notFound().build());
    }

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
@Transactional
    @PostMapping("/transfer")
    public ResponseEntity<?> transferOrder(@RequestParam(required = false) Long hotelId,
                                           @RequestBody Map<String, Object> body) {
        Object rawOrderId = body.get("orderId") != null ? body.get("orderId") : body.get("order_id");
        Object rawFromTableId = body.get("sourceTableId") != null ? body.get("sourceTableId")
                : (body.get("source_table_id") != null ? body.get("source_table_id")
                : (body.get("fromTableId") != null ? body.get("fromTableId") : body.get("from_table_id")));
        Object rawToTableId = body.get("targetTableId") != null ? body.get("targetTableId")
                : (body.get("target_table_id") != null ? body.get("target_table_id")
                : (body.get("toTableId") != null ? body.get("toTableId")
                : (body.get("to_table_id") != null ? body.get("to_table_id") : body.get("newTableId"))));

        Long toTableId = (rawToTableId != null && !rawToTableId.toString().isBlank())
                ? Long.valueOf(rawToTableId.toString()) : null;

        if (toTableId == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Target table ID is required"));
        }

        Order targetOrder = null;

        if (rawOrderId != null && !rawOrderId.toString().isBlank()) {
            Long orderId = Long.valueOf(rawOrderId.toString());
            targetOrder = orderRepository.findById(orderId).orElse(null);
        } else if (rawFromTableId != null && !rawFromTableId.toString().isBlank()) {
            Long fromTableId = Long.valueOf(rawFromTableId.toString());
            targetOrder = orderRepository.findByTableId(fromTableId).stream()
                    .filter(o -> o.getStatus() == null ||
                            (!o.getStatus().equalsIgnoreCase("COMPLETED") &&
                             !o.getStatus().equalsIgnoreCase("CANCELLED") &&
                             !o.getStatus().equalsIgnoreCase("PAID")))
                    .findFirst()
                    .orElse(null);
        }

        if (targetOrder == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Active order not found for transfer"));
        }

        RestaurantTable newTable = tableRepository.findById(toTableId).orElse(null);
        if (newTable == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Destination table not found"));
        }

        // जुना टेबल रिकामा (available) करा
        RestaurantTable oldTable = targetOrder.getTable();
        if (oldTable != null && !oldTable.getId().equals(newTable.getId())) {
            oldTable.setStatus("available");
            tableRepository.save(oldTable);
        }

        // नवीन टेबल ऑक्युपाय करा
        newTable.setStatus("occupied");
        tableRepository.save(newTable);

        targetOrder.setTable(newTable);
        Order saved = orderRepository.save(targetOrder);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Table shifted successfully",
                "order", serializeOrder(saved),
                "data", serializeOrder(saved)
        ));
    }

    @Transactional(readOnly = true)
    @GetMapping("/kitchen-queue")
    public ResponseEntity<?> getKitchenQueue(@RequestParam(required = false) Long hotelId) {
        if (hotelId == null) {
            return ResponseEntity.ok(Map.of("success", true, "data", List.of()));
        }
        try {
            var data = orderRepository.findByHotelIdOrderByCreatedAtDesc(hotelId)
                    .stream()
                    .filter(o -> o.getStatus() == null || 
                                (!o.getStatus().equalsIgnoreCase("COMPLETED") && 
                                 !o.getStatus().equalsIgnoreCase("CANCELLED") &&
                                 !o.getStatus().equalsIgnoreCase("PAID")))
                    .map(this::serializeOrder)
                    .toList();
            return ResponseEntity.ok(Map.of("success", true, "data", data));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage() != null ? e.getMessage() : "Error fetching kitchen queue"));
        }
    }

    @SuppressWarnings("unchecked")
    private List<OrderItem> buildOrderItems(Order order, Object rawItems) {
        List<OrderItem> items = new ArrayList<>();
        if (!(rawItems instanceof List<?> list)) return items;

        for (Object obj : list) {
            if (!(obj instanceof Map<?, ?> rawMap)) continue;
            Map<String, Object> itemData = (Map<String, Object>) rawMap;

            OrderItem oi = new OrderItem();
            oi.setOrder(order);

            Object qtyRaw = itemData.get("quantity") != null ? itemData.get("quantity")
                          : itemData.get("qty") != null ? itemData.get("qty") : 1;
            oi.setQuantity(Integer.valueOf(qtyRaw.toString()));
            oi.setPrintedQuantity(0);

            Object menuIdRaw = itemData.get("menu_item_id") != null ? itemData.get("menu_item_id")
                             : itemData.get("menuItemId") != null ? itemData.get("menuItemId")
                             : itemData.get("id");

            if (menuIdRaw != null) {
                try {
                    Long menuItemId = Long.valueOf(menuIdRaw.toString());
                    menuItemRepository.findById(menuItemId).ifPresent(mi -> {
                        oi.setMenuItem(mi);
                        oi.setItemName(mi.getName());
                        oi.setUnitPrice(mi.getPrice());
                    });
                } catch (Exception ignored) {}
            }

            if (oi.getItemName() == null) {
                Object nameRaw = itemData.get("name") != null ? itemData.get("name")
                               : itemData.get("item_name") != null ? itemData.get("item_name")
                               : itemData.get("itemName");
                oi.setItemName(nameRaw != null ? nameRaw.toString() : "Item");
            }

            if (oi.getUnitPrice() == null) {
                Object priceRaw = itemData.get("price") != null ? itemData.get("price")
                                : itemData.get("unit_price") != null ? itemData.get("unit_price")
                                : itemData.get("unitPrice");
                oi.setUnitPrice(priceRaw != null ? new BigDecimal(priceRaw.toString()) : BigDecimal.ZERO);
            }
            items.add(oi);
        }
        return items;
    }
}