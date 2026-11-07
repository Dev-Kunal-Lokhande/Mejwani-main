package com.mejwani.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "restaurant_tables")
@Data
@ToString(exclude = {"hotel", "section"})
@EqualsAndHashCode(exclude = {"hotel", "section"})
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RestaurantTable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "table_name", nullable = false)
    private String tableName;

    @Column(name = "table_number")
    private String tableNumber;

    @Column(name = "qr_code")
    private String qrCode;

    @Column(name = "status")
    private String status = "AVAILABLE"; // AVAILABLE, OCCUPIED

    @Column(name = "occupied_at")
    private LocalDateTime occupiedAt;

    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "hotel"})
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "section_id")
    private Section section;

    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
