package com.mejwani.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "captain_requests")
@Data
@ToString(exclude = {"hotel", "table"})
@EqualsAndHashCode(exclude = {"hotel", "table"})
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CaptainRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "hotel", "section"})
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "table_id")
    private RestaurantTable table;

    @Column(name = "visit_id")
    private String visitId;

    @Column(name = "request_type")
    private String requestType; // CALL_CAPTAIN, WATER, BILL, CLEAN_TABLE, TISSUE, WAITER

    @Column(name = "status")
    private String status = "CAPTAIN_REQUESTED"; // CAPTAIN_REQUESTED, ACKNOWLEDGED, RESOLVED

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
