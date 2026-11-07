package com.mejwani.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "menu_items")
@Data
@ToString(exclude = {"hotel", "category"})
@EqualsAndHashCode(exclude = {"hotel", "category"})
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MenuItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(name = "name_hindi")
    private String nameHindi;

    @Column(name = "name_marathi")
    private String nameMarathi;

    @Column(name = "item_code")
    private String itemCode;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Column(name = "half_price", precision = 10, scale = 2)
    private BigDecimal halfPrice;

    @Column(name = "full_price", precision = 10, scale = 2)
    private BigDecimal fullPrice;

    @Column(name = "pricing_type")
    private String pricingType = "SINGLE"; // SINGLE or HALF_FULL

    @Column(name = "image_url")
    private String imageUrl;

    @Column(name = "is_available")
    private Boolean isAvailable = true;

    @Column(name = "is_veg")
    private Boolean isVeg = true;

    @Column(name = "display_order")
    private Integer displayOrder = 0;

    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "hotel"})
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private MenuCategory category;

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
