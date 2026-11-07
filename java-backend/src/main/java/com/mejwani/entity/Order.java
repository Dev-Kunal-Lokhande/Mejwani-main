package com.mejwani.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "orders")
@Data
@ToString(exclude = {"hotel", "table", "items"})
@EqualsAndHashCode(exclude = {"hotel", "table", "items"})
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "kot_number")
    private String kotNumber;

    @Column(name = "status")
    private String status = "NEW"; // NEW, SENT_TO_KITCHEN, PREPARING, READY, SERVED, BILL_PENDING, COMPLETED, CANCELLED

    @Column(name = "total_amount", precision = 10, scale = 2)
    private BigDecimal totalAmount;

    @Column(name = "payment_mode")
    private String paymentMode = "CASH";

    @Column(name = "kot_printed_at")
    private LocalDateTime kotPrintedAt;

    @Column(name = "bill_created_at")
    private LocalDateTime billCreatedAt;

    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "hotel", "section"})
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "table_id")
    private RestaurantTable table;

    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<OrderItem> items;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
