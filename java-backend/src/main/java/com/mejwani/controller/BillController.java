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
@RequestMapping("/api/bills")
@RequiredArgsConstructor
public class BillController {

    private final BillRepository billRepository;
    private final OrderRepository orderRepository;
    private final HotelRepository hotelRepository;

    private Map<String, Object> serializeBill(Bill b) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", b.getId());
        m.put("bill_number", b.getBillNumber());
        m.put("subtotal", b.getSubtotal());
        m.put("tax_amount", b.getTaxAmount());
        m.put("discount_amount", b.getDiscountAmount());
        m.put("total_amount", b.getTotalAmount());
        m.put("payment_mode", b.getPaymentMode());
        m.put("payment_status", b.getPaymentStatus());
        m.put("created_at", b.getCreatedAt());
        m.put("hotel_id", b.getHotel() != null ? b.getHotel().getId() : null);
        m.put("order_id", b.getOrder() != null ? b.getOrder().getId() : null);
        return m;
    }

    @Transactional(readOnly = true)
    @GetMapping
    public ResponseEntity<?> getBills(@RequestParam Long hotelId) {
        return ResponseEntity.ok(billRepository.findByHotelIdOrderByCreatedAtDesc(hotelId)
                .stream().map(this::serializeBill).toList());
    }

    @Transactional(readOnly = true)
    @GetMapping("/{id}")
    public ResponseEntity<?> getBill(@PathVariable Long id) {
        return billRepository.findById(id)
                .map(b -> ResponseEntity.ok(serializeBill(b)))
                .orElse(ResponseEntity.notFound().build());
    }

    @Transactional
    @PostMapping
    public ResponseEntity<?> createBill(@RequestBody Map<String, Object> body) {
        Long hotelId = Long.valueOf(body.get("hotelId").toString());
        Long orderId = Long.valueOf(body.get("orderId").toString());

        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> new RuntimeException("Hotel not found"));
        Order order = orderRepository.findById(orderId).orElseThrow(() -> new RuntimeException("Order not found"));

        Optional<Bill> existing = billRepository.findByOrderId(orderId);
        if (existing.isPresent()) {
            return ResponseEntity.ok(serializeBill(existing.get()));
        }

        BigDecimal subtotal = order.getTotalAmount() != null ? order.getTotalAmount() : BigDecimal.ZERO;
        BigDecimal taxAmount = body.containsKey("taxAmount") ? new BigDecimal(body.get("taxAmount").toString()) : BigDecimal.ZERO;
        BigDecimal discount = body.containsKey("discountAmount") ? new BigDecimal(body.get("discountAmount").toString()) : BigDecimal.ZERO;
        BigDecimal total = subtotal.add(taxAmount).subtract(discount);

        Bill bill = Bill.builder()
                .billNumber("BILL-" + System.currentTimeMillis())
                .order(order)
                .hotel(hotel)
                .subtotal(subtotal)
                .taxAmount(taxAmount)
                .discountAmount(discount)
                .totalAmount(total)
                .paymentMode(body.containsKey("paymentMode") ? body.get("paymentMode").toString() : "CASH")
                .paymentStatus("PAID")
                .build();

        order.setStatus("COMPLETED");
        orderRepository.save(order);

        return ResponseEntity.ok(serializeBill(billRepository.save(bill)));
    }

    // GET /api/bills/print
    @Transactional(readOnly = true)
    @GetMapping("/print")
    public ResponseEntity<?> printBill(@RequestParam(required = false) Long hotelId,
                                        @RequestParam(required = false) Long billId,
                                        @RequestParam(required = false) Long orderId) {
        if (billId != null) {
            return billRepository.findById(billId)
                    .map(b -> ResponseEntity.ok(Map.of("success", true, "data", serializeBill(b))))
                    .orElse(ResponseEntity.notFound().build());
        }
        if (orderId != null) {
            return billRepository.findByOrderId(orderId)
                    .map(b -> ResponseEntity.ok(Map.of("success", true, "data", serializeBill(b))))
                    .orElse(ResponseEntity.ok(Map.of("success", false, "message", "Bill not found")));
        }
        return ResponseEntity.ok(Map.of("success", false, "message", "Provide billId or orderId"));
    }

    // POST /api/bills/{id}/cancel
    @Transactional
    @PostMapping("/{id}/cancel")
    public ResponseEntity<?> cancelBill(@PathVariable Long id,
                                         @RequestParam(required = false) Long hotelId) {
        return billRepository.findById(id).map(bill -> {
            bill.setPaymentStatus("CANCELLED");
            Bill saved = billRepository.save(bill);
            if (bill.getOrder() != null) {
                bill.getOrder().setStatus("BILL_PENDING");
                orderRepository.save(bill.getOrder());
            }
            return ResponseEntity.ok(Map.of("success", true, "bill", serializeBill(saved)));
        }).orElse(ResponseEntity.notFound().build());
    }

    @Transactional
    @GetMapping("/{id}/cancel")
    public ResponseEntity<?> cancelBillGet(@PathVariable Long id,
                                            @RequestParam(required = false) Long hotelId) {
        return cancelBill(id, hotelId);
    }

    @Transactional
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteBill(@PathVariable Long id) {
        if (!billRepository.existsById(id)) return ResponseEntity.notFound().build();
        billRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("success", true, "message", "Bill deleted"));
    }

    @GetMapping("/reprint-requests")
    public ResponseEntity<?> getReprintRequests(@RequestParam(required = false) Long hotelId) {
        return ResponseEntity.ok(List.of());
    }

    @PostMapping("/reprint-requests/{id}/resolve")
    public ResponseEntity<?> resolveReprintRequest(@PathVariable Long id,
                                                    @RequestBody(required = false) Map<String, Object> body) {
        return ResponseEntity.ok(Map.of("success", true, "message", "Resolved"));
    }
}
