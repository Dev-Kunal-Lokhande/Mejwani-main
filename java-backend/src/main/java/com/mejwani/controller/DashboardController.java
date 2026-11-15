package com.mejwani.controller;

import com.mejwani.entity.*;
import com.mejwani.repository.*;
import com.mejwani.security.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.TextStyle;
import java.util.*;
import java.util.stream.Collectors;

@RestController
public class DashboardController {

    private static class Row extends HashMap<String, Object> {
        public Row putVal(String k, Object v) {
            super.put(k, v);
            return this;
        }
    }

    private final OrderRepository orderRepository;
    private final BillRepository billRepository;
    private final StaffRepository staffRepository;
    private final HotelRepository hotelRepository;
    private final JwtUtil jwtUtil;

    public DashboardController(OrderRepository orderRepository,
                               BillRepository billRepository,
                               StaffRepository staffRepository,
                               HotelRepository hotelRepository,
                               JwtUtil jwtUtil) {
        this.orderRepository = orderRepository;
        this.billRepository = billRepository;
        this.staffRepository = staffRepository;
        this.hotelRepository = hotelRepository;
        this.jwtUtil = jwtUtil;
    }

    private Long resolveHotelId(Long hotelId, HttpServletRequest request) {
        if (hotelId != null) return hotelId;
        try {
            String authHeader = request.getHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                return jwtUtil.getHotelIdFromToken(authHeader.substring(7));
            }
        } catch (Exception ignored) {}
        return null;
    }

    private double getOrderAmount(Order o) {
        if (o.getTotalAmount() != null) return o.getTotalAmount().doubleValue();
        if (o.getItems() != null) {
            return o.getItems().stream()
                    .mapToDouble(i -> {
                        double p = i.getUnitPrice() != null ? i.getUnitPrice().doubleValue() : 0.0;
                        int q = i.getQuantity() != null ? i.getQuantity() : 1;
                        return p * q;
                    })
                    .sum();
        }
        return 0.0;
    }

    private boolean isParcelOrder(Order o) {
        return o.getTable() == null;
    }

    private boolean isValidRevenueOrder(Order o) {
        String st = o.getStatus() != null ? o.getStatus().toUpperCase() : "";
        return !"CANCELLED".equals(st) && !"REJECTED".equals(st);
    }

    private LocalDateTime[] getTimeframeRange(String timeframe) {
        LocalDate today = LocalDate.now();
        LocalDateTime end = today.plusDays(1).atStartOfDay();
        LocalDateTime start = switch (timeframe != null ? timeframe.toLowerCase() : "today") {
            case "week" -> today.minusDays(6).atStartOfDay();
            case "month" -> today.withDayOfMonth(1).atStartOfDay();
            case "year" -> today.withDayOfYear(1).atStartOfDay();
            default -> today.atStartOfDay();
        };
        return new LocalDateTime[]{start, end};
    }

    // 1. GET /api/dashboard/analytics
    @Transactional(readOnly = true)
    @GetMapping("/api/dashboard/analytics")
    public ResponseEntity<?> getAnalytics(@RequestParam(required = false) Long hotelId, HttpServletRequest request) {
        Long hid = resolveHotelId(hotelId, request);
        LocalDate today = LocalDate.now();
        LocalDateTime endOfToday = today.plusDays(1).atStartOfDay();

        LocalDateTime startOfToday = today.atStartOfDay();
        LocalDateTime startOfWeek = today.minusDays(6).atStartOfDay();
        LocalDateTime startOfMonth = today.withDayOfMonth(1).atStartOfDay();
        LocalDateTime startOfYear = today.withDayOfYear(1).atStartOfDay();

        List<Order> yearOrders = (hid != null)
                ? orderRepository.findByHotelIdAndDateRange(hid, startOfYear, endOfToday)
                : List.of();

        double todaySales = 0, weeklySales = 0, monthlySales = 0, yearlySales = 0;
        int todayCount = 0;

        for (Order o : yearOrders) {
            if (!isValidRevenueOrder(o) || o.getCreatedAt() == null) continue;
            double amt = getOrderAmount(o);
            LocalDateTime created = o.getCreatedAt();

            yearlySales += amt;
            if (!created.isBefore(startOfMonth)) monthlySales += amt;
            if (!created.isBefore(startOfWeek)) weeklySales += amt;
            if (!created.isBefore(startOfToday)) {
                todaySales += amt;
                todayCount++;
            }
        }

        List<String> insights = new ArrayList<>();
        if (todayCount > 0) {
            insights.add("Today you processed " + todayCount + " orders worth ₹" + Math.round(todaySales) + ".");
        } else {
            insights.add("No orders recorded yet today. Ready for service!");
        }
        insights.add("Monthly revenue stands at ₹" + Math.round(monthlySales) + " across active operations.");
        insights.add("Track peak hours below to optimize kitchen and captain staffing.");

        Row data = new Row()
                .putVal("todaySales", Math.round(todaySales))
                .putVal("weeklySales", Math.round(weeklySales))
                .putVal("monthlySales", Math.round(monthlySales))
                .putVal("yearlySales", Math.round(yearlySales))
                .putVal("todayGrowth", 0)
                .putVal("weeklyGrowth", 0)
                .putVal("yearlyGrowth", 0)
                .putVal("insights", insights);

        return ResponseEntity.ok(Map.of("success", true, "data", data));
    }

    // 2. GET /api/dashboard/revenue?timeframe=today|week|month|year
    @Transactional(readOnly = true)
    @GetMapping("/api/dashboard/revenue")
    public ResponseEntity<?> getRevenueTrend(@RequestParam(required = false) Long hotelId,
                                           @RequestParam(defaultValue = "today") String timeframe,
                                           HttpServletRequest request) {
        Long hid = resolveHotelId(hotelId, request);
        LocalDateTime[] range = getTimeframeRange(timeframe);
        List<Order> orders = (hid != null)
                ? orderRepository.findByHotelIdAndDateRange(hid, range[0], range[1])
                : List.of();

        Map<String, double[]> buckets = new LinkedHashMap<>();
        String tf = timeframe.toLowerCase();

        if ("today".equals(tf)) {
            for (int h = 0; h < 24; h += 3) {
                buckets.put(String.format("%02d:00", h), new double[]{0, 0});
            }
            for (Order o : orders) {
                if (!isValidRevenueOrder(o) || o.getCreatedAt() == null) continue;
                int slot = (o.getCreatedAt().getHour() / 3) * 3;
                String key = String.format("%02d:00", slot);
                double amt = getOrderAmount(o);
                if (isParcelOrder(o)) buckets.get(key)[1] += amt;
                else buckets.get(key)[0] += amt;
            }
        } else if ("year".equals(tf)) {
            LocalDate now = LocalDate.now();
            for (int m = 1; m <= 12; m++) {
                String key = LocalDate.of(now.getYear(), m, 1).getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH);
                buckets.put(key, new double[]{0, 0});
            }
            for (Order o : orders) {
                if (!isValidRevenueOrder(o) || o.getCreatedAt() == null) continue;
                String key = o.getCreatedAt().getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH);
                double amt = getOrderAmount(o);
                if (buckets.containsKey(key)) {
                    if (isParcelOrder(o)) buckets.get(key)[1] += amt;
                    else buckets.get(key)[0] += amt;
                }
            }
        } else {
            LocalDate start = range[0].toLocalDate();
            LocalDate end = LocalDate.now();
            for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
                String key = d.getDayOfMonth() + " " + d.getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH);
                buckets.put(key, new double[]{0, 0});
            }
            for (Order o : orders) {
                if (!isValidRevenueOrder(o) || o.getCreatedAt() == null) continue;
                LocalDate d = o.getCreatedAt().toLocalDate();
                String key = d.getDayOfMonth() + " " + d.getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH);
                double amt = getOrderAmount(o);
                if (buckets.containsKey(key)) {
                    if (isParcelOrder(o)) buckets.get(key)[1] += amt;
                    else buckets.get(key)[0] += amt;
                }
            }
        }

        List<Row> result = new ArrayList<>();
        buckets.forEach((name, vals) -> result.add(
                new Row().putVal("name", name)
                         .putVal("hotelRevenue", Math.round(vals[0]))
                         .putVal("parcelRevenue", Math.round(vals[1]))
        ));

        return ResponseEntity.ok(Map.of("success", true, "data", result));
    }

    // 3. GET /api/dashboard/top-items?timeframe=...
    @Transactional(readOnly = true)
    @GetMapping("/api/dashboard/top-items")
    public ResponseEntity<?> getTopItems(@RequestParam(required = false) Long hotelId,
                                       @RequestParam(defaultValue = "today") String timeframe,
                                       HttpServletRequest request) {
        Long hid = resolveHotelId(hotelId, request);
        LocalDateTime[] range = getTimeframeRange(timeframe);
        List<Order> orders = (hid != null)
                ? orderRepository.findByHotelIdAndDateRange(hid, range[0], range[1])
                : List.of();

        Map<String, int[]> qtyMap = new HashMap<>();
        Map<String, Double> revMap = new HashMap<>();
        int totalQty = 0;

        for (Order o : orders) {
            if (!isValidRevenueOrder(o) || o.getItems() == null) continue;
            for (OrderItem item : o.getItems()) {
                String itemName = (item.getItemName() != null && !item.getItemName().isBlank())
                        ? item.getItemName() : "Item";
                int q = item.getQuantity() != null ? item.getQuantity() : 1;
                double price = item.getUnitPrice() != null ? item.getUnitPrice().doubleValue() : 0.0;

                qtyMap.computeIfAbsent(itemName, k -> new int[]{0})[0] += q;
                revMap.put(itemName, revMap.getOrDefault(itemName, 0.0) + (price * q));
                totalQty += q;
            }
        }

        final int finalTotalQty = Math.max(totalQty, 1);
        List<Row> topList = qtyMap.entrySet().stream()
                .sorted((a, b) -> Integer.compare(b.getValue()[0], a.getValue()[0]))
                .limit(8)
                .map(entry -> {
                    String name = entry.getKey();
                    int q = entry.getValue()[0];
                    double rev = revMap.getOrDefault(name, 0.0);
                    int pop = Math.min(100, Math.round((q * 100f) / finalTotalQty));
                    return new Row().putVal("name", name)
                                    .putVal("orders", q)
                                    .putVal("revenue", Math.round(rev))
                                    .putVal("popularity", pop);
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(Map.of("success", true, "data", topList));
    }

    // 4. GET /api/dashboard/peak-hours?timeframe=...
    @Transactional(readOnly = true)
    @GetMapping("/api/dashboard/peak-hours")
    public ResponseEntity<?> getPeakHours(@RequestParam(required = false) Long hotelId,
                                        @RequestParam(defaultValue = "today") String timeframe,
                                        HttpServletRequest request) {
        Long hid = resolveHotelId(hotelId, request);
        LocalDateTime[] range = getTimeframeRange(timeframe);
        List<Order> orders = (hid != null)
                ? orderRepository.findByHotelIdAndDateRange(hid, range[0], range[1])
                : List.of();

        int[] hourlyCounts = new int[24];
        for (Order o : orders) {
            if (!isValidRevenueOrder(o) || o.getCreatedAt() == null) continue;
            hourlyCounts[o.getCreatedAt().getHour()]++;
        }

        List<Row> peakList = new ArrayList<>();
        for (int h = 8; h <= 23; h++) {
            String label = (h == 12) ? "12 PM" : (h > 12 ? (h - 12) + " PM" : h + " AM");
            peakList.add(new Row().putVal("name", label).putVal("orders", hourlyCounts[h]));
        }

        return ResponseEntity.ok(Map.of("success", true, "data", peakList));
    }

    // 5. GET /api/dashboard/item-sales-report?startDate=...&endDate=...
    @Transactional(readOnly = true)
    @GetMapping("/api/dashboard/item-sales-report")
    public ResponseEntity<?> getItemSalesReport(@RequestParam(required = false) Long hotelId,
                                              @RequestParam(required = false) String startDate,
                                              @RequestParam(required = false) String endDate,
                                              HttpServletRequest request) {
        Long hid = resolveHotelId(hotelId, request);
        LocalDate start = (startDate != null && !startDate.isBlank()) ? LocalDate.parse(startDate) : LocalDate.now().withDayOfMonth(1);
        LocalDate end = (endDate != null && !endDate.isBlank()) ? LocalDate.parse(endDate) : LocalDate.now();

        List<Order> orders = (hid != null)
                ? orderRepository.findByHotelIdAndDateRange(hid, start.atStartOfDay(), end.plusDays(1).atStartOfDay())
                : List.of();

        Map<String, Map<String, double[]>> catItemMap = new LinkedHashMap<>();
        double grandTotal = 0;

        for (Order o : orders) {
            if (!isValidRevenueOrder(o) || o.getItems() == null) continue;
            for (OrderItem item : o.getItems()) {
                String catName = "Menu Items";
                String itemName = (item.getItemName() != null && !item.getItemName().isBlank())
                        ? item.getItemName() : "Item";

                int q = item.getQuantity() != null ? item.getQuantity() : 1;
                double sub = (item.getUnitPrice() != null ? item.getUnitPrice().doubleValue() : 0.0) * q;

                catItemMap.computeIfAbsent(catName, k -> new LinkedHashMap<>())
                        .computeIfAbsent(itemName, k -> new double[]{0, 0});
                catItemMap.get(catName).get(itemName)[0] += q;
                catItemMap.get(catName).get(itemName)[1] += sub;
                grandTotal += sub;
            }
        }

        List<Row> categories = new ArrayList<>();
        catItemMap.forEach((catName, itemsMap) -> {
            List<Row> itemList = new ArrayList<>();
            double catSub = 0;
            for (var entry : itemsMap.entrySet()) {
                double q = entry.getValue()[0];
                double s = entry.getValue()[1];
                catSub += s;
                itemList.add(new Row().putVal("itemName", entry.getKey())
                                      .putVal("quantity", (int) q)
                                      .putVal("subtotal", Math.round(s)));
            }
            categories.add(new Row().putVal("categoryName", catName)
                                    .putVal("categorySubtotal", Math.round(catSub))
                                    .putVal("items", itemList));
        });

        return ResponseEntity.ok(Map.of(
            "success", true,
            "data", Map.of("categories", categories, "grandTotal", Math.round(grandTotal))
        ));
    }

    // 6. GET /api/dashboard/reports/{type}
    @Transactional(readOnly = true)
    @GetMapping("/api/dashboard/reports/{type}")
    public ResponseEntity<?> getReports(@PathVariable String type,
                                      @RequestParam(required = false) Long hotelId,
                                      @RequestParam(required = false) String startDate,
                                      @RequestParam(required = false) String endDate,
                                      HttpServletRequest request) {
        Long hid = resolveHotelId(hotelId, request);
        LocalDate start = (startDate != null && !startDate.isBlank()) ? LocalDate.parse(startDate) : LocalDate.now().withDayOfMonth(1);
        LocalDate end = (endDate != null && !endDate.isBlank()) ? LocalDate.parse(endDate) : LocalDate.now();

        List<Order> orders = (hid != null)
                ? orderRepository.findByHotelIdAndDateRange(hid, start.atStartOfDay(), end.plusDays(1).atStartOfDay())
                : List.of();
        List<Bill> bills = (hid != null)
                ? billRepository.findByHotelIdAndCreatedAtBetween(hid, start.atStartOfDay(), end.plusDays(1).atStartOfDay())
                : List.of();

        if ("payment-summary".equals(type)) {
            Map<String, double[]> modeMap = new LinkedHashMap<>();
            for (Bill b : bills) {
                String mode = b.getPaymentMode() != null ? b.getPaymentMode().toUpperCase() : "CASH";
                double amt = b.getTotalAmount() != null ? b.getTotalAmount().doubleValue() : 0.0;
                modeMap.computeIfAbsent(mode, k -> new double[]{0, 0});
                modeMap.get(mode)[0]++;
                modeMap.get(mode)[1] += amt;
            }
            List<Row> list = new ArrayList<>();
            modeMap.forEach((mode, vals) -> list.add(
                    new Row().putVal("payment_mode", mode)
                             .putVal("total_orders", (int) vals[0])
                             .putVal("grand_total", Math.round(vals[1]))
            ));
            return ResponseEntity.ok(Map.of("success", true, "data", list));
        }

        if ("daily-sales".equals(type) || "day-end".equals(type)) {
            Map<LocalDate, List<Order>> byDate = orders.stream()
                    .filter(o -> o.getCreatedAt() != null)
                    .collect(Collectors.groupingBy(o -> o.getCreatedAt().toLocalDate(), TreeMap::new, Collectors.toList()));
            List<Row> list = new ArrayList<>();
            byDate.forEach((date, dayOrders) -> {
                long completed = dayOrders.stream().filter(this::isValidRevenueOrder).count();
                long cancelled = dayOrders.size() - completed;
                double dining = dayOrders.stream().filter(o -> isValidRevenueOrder(o) && !isParcelOrder(o)).mapToDouble(this::getOrderAmount).sum();
                double parcel = dayOrders.stream().filter(o -> isValidRevenueOrder(o) && isParcelOrder(o)).mapToDouble(this::getOrderAmount).sum();
                double total = dining + parcel;

                list.add(new Row().putVal("date", date.toString())
                                  .putVal("total_orders", completed)
                                  .putVal("completed_orders", completed)
                                  .putVal("cancelled_orders", cancelled)
                                  .putVal("subtotal", total)
                                  .putVal("cgst", 0)
                                  .putVal("sgst", 0)
                                  .putVal("dining_total", dining)
                                  .putVal("parcel_total", parcel)
                                  .putVal("grand_total", total));
            });
            return ResponseEntity.ok(Map.of("success", true, "data", list));
        }

        return ResponseEntity.ok(Map.of("success", true, "data", List.of()));
    }

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

    // GET /api/hotels/by-slug/{slug}
    @GetMapping("/api/hotels/by-slug/{slug}")
    public ResponseEntity<?> getHotelBySlug(@PathVariable String slug) {
        return hotelRepository.findBySlug(slug)
                .map(hotel -> ResponseEntity.ok((Object) Map.of(
                    "success", true,
                    "data", hotel
                )))
                .orElse(ResponseEntity.status(404).body(Map.of("success", false, "message", "Hotel not found")));
    }
}