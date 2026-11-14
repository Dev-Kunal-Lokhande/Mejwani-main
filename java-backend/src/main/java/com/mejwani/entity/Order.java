package com.mejwani.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "orders")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "kot_number")
    private String kotNumber;

    @Column(name = "captain_name")
    private String captainName;

    @Column(name = "status")
    private String status = "NEW";

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

    // ===== GETTERS =====
    public Long getId() { return id; }
    public String getKotNumber() { return kotNumber; }
    public String getCaptainName() { return captainName; }
    public String getStatus() { return status; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public String getPaymentMode() { return paymentMode; }
    public LocalDateTime getKotPrintedAt() { return kotPrintedAt; }
    public LocalDateTime getBillCreatedAt() { return billCreatedAt; }
    public RestaurantTable getTable() { return table; }
    public Hotel getHotel() { return hotel; }
    public List<OrderItem> getItems() { return items; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    // ===== SETTERS =====
    public void setId(Long id) { this.id = id; }
    public void setKotNumber(String kotNumber) { this.kotNumber = kotNumber; }
    public void setCaptainName(String captainName) { this.captainName = captainName; }
    public void setStatus(String status) { this.status = status; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }
    public void setPaymentMode(String paymentMode) { this.paymentMode = paymentMode; }
    public void setKotPrintedAt(LocalDateTime kotPrintedAt) { this.kotPrintedAt = kotPrintedAt; }
    public void setBillCreatedAt(LocalDateTime billCreatedAt) { this.billCreatedAt = billCreatedAt; }
    public void setTable(RestaurantTable table) { this.table = table; }
    public void setHotel(Hotel hotel) { this.hotel = hotel; }
    public void setItems(List<OrderItem> items) { this.items = items; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    @Override
    public String toString() {
        return "Order{id=" + id + ", status='" + status + "', kotNumber='" + kotNumber + "'}";
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Order)) return false;
        Order other = (Order) o;
        return id != null && id.equals(other.id);
    }

    @Override
    public int hashCode() {
        return id != null ? id.hashCode() : 0;
    }
}
